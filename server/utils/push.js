// Web Push: 알림(Notification)이 만들어지면 받는 사람의 기기들로 푸시를 보낸다.
// 앱이 꺼져 있어도 서비스 워커(client/src/sw.ts)가 받아서 휴대폰 알림창에 띄운다.
// VAPID 키가 없으면(로컬·테스트) 아무것도 하지 않는다.
const webpush = require("web-push");
const User = require("../models/User");

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT
  || (process.env.CLIENT_URL?.startsWith("https://") ? process.env.CLIENT_URL : "mailto:noreply@example.com");

const enabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

const MAX_BODY = 120;
const clip = (s, n = MAX_BODY) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
const dateKo = (d) => new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

// 클라이언트 알림 목록(NotificationScreen)과 같은 문구. 이름 뒤에 붙는 부분만 다르다.
const bodyFor = (n, name, postTitle) => {
  const preview = clip(n.commentContent, 40);
  const onPost = postTitle ? ` (게시물: "${clip(postTitle, 30)}")` : "";
  switch (n.type) {
    case "follow": return `${name}님이 회원님을 팔로우하기 시작했어요.`;
    case "join": return `${name}님이 회원님의 모임에 참여했어요.`;
    case "leave": return `${name}님이 회원님의 모임 참여를 취소했어요.`;
    case "comment":
      if (n.feed) return preview ? `${name}님이 피드에 "${preview}"라는 댓글을 남겼어요.` : `${name}님이 피드에 댓글을 남겼어요.`;
      return preview ? `${name}님이 "${preview}"라는 댓글을 남겼어요.` : `${name}님이 글에 댓글을 남겼어요.`;
    case "reply": return preview ? `${name}님이 댓글에 "${preview}"라는 답글을 남겼어요.` : `${name}님이 댓글에 답글을 남겼어요.`;
    case "like": return n.actorCount > 1 ? `${name}님 외 ${n.actorCount - 1}명이 좋아요를 눌렀어요.` : `${name}님이 좋아요를 눌렀어요.`;
    case "dislike": return `${name}님이 싫어요를 눌렀어요.`;
    case "scrap": return `${name}님이 글을 스크랩했어요.`;
    case "accepted": return `${name}님이 회원님의 댓글을 채택했어요.`;
    case "study_recruit": return `${name}님이 관심 분야에 맞는 모집글을 올렸어요.`;
    case "feed_tag": return n.tag ? `${name}님이 #${n.tag} 태그가 달린 피드를 올렸어요.` : `${name}님이 구독한 태그의 피드를 올렸어요.`;
    case "adminWarning": return `관리자에게 경고를 받았어요.${onPost} 사유: ${n.message || "-"}`;
    case "adminBan": return `계정이 ${n.until ? `${dateKo(n.until)}까지` : "영구"} 정지되었어요.${onPost} 사유: ${n.message || "-"}`;
    case "adminCommentRestriction": return `${n.until ? `${dateKo(n.until)}까지 ` : ""}댓글 작성이 제한되었어요.${onPost} 사유: ${n.message || "-"}`;
    case "reportResolved": return `신고 처리 결과가 도착했어요: ${n.message || "-"}`;
    case "inquiryResolved": return `건의사항에 답변이 도착했어요: ${n.message || "-"}`;
    default: return `${name}님과 관련된 새 알림이 있어요.`;
  }
};

// 구독 하나에 보낸다. 만료된 구독(404/410)이면 false를 돌려줘 지우게 한다.
const sendTo = async (sub, payload) => {
  try {
    await webpush.sendNotification(sub, payload, { TTL: 24 * 60 * 60, urgency: "high" });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return false;
    console.error("푸시 전송 실패:", err.statusCode || "", err.message);
    return true;
  }
};

// 한 사용자에게 보낸다. data.url: 알림을 눌렀을 때 열 주소
const sendToUser = async (userId, { title = "Big Ding", body, tag, url = "/?open=notifications" }) => {
  if (!enabled) return 0;
  const user = await User.findById(userId).select("pushSubscriptions isWithdrawn").lean();
  const subs = user?.pushSubscriptions || [];
  if (!subs.length || user.isWithdrawn) return 0;

  const payload = JSON.stringify({ title, body, tag, url });
  const results = await Promise.all(subs.map((s) => sendTo(s, payload)));
  const expired = subs.filter((_, i) => !results[i]).map((s) => s.endpoint);
  if (expired.length) {
    await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: { $in: expired } } } });
  }
  return results.filter(Boolean).length;
};

// Notification 문서(들)로 푸시를 보낸다. 실패해도 본 작업을 막지 않도록 에러는 로그만 남긴다.
const pushNotifications = async (docs) => {
  if (!enabled || !docs?.length) return;
  const Post = require("../models/Post");
  const senderIds = [...new Set(docs.map((d) => String(d.sender)).filter(Boolean))];
  const postIds = [...new Set(docs.map((d) => d.post && String(d.post)).filter(Boolean))];
  const [senders, posts] = await Promise.all([
    User.find({ _id: { $in: senderIds } }).select("nickname").lean(),
    postIds.length ? Post.find({ _id: { $in: postIds } }).select("title").lean() : [],
  ]);
  const nameOf = new Map(senders.map((u) => [String(u._id), u.nickname || "누군가"]));
  const titleOf = new Map(posts.map((p) => [String(p._id), p.title]));

  await Promise.all(docs.map((n) =>
    sendToUser(n.recipient, {
      body: bodyFor(n, nameOf.get(String(n.sender)) || "누군가", n.post && titleOf.get(String(n.post))),
      // 같은 tag면 기기 알림창에서 새 알림이 이전 것을 대체한다 (좋아요 묶음이 여러 줄로 쌓이지 않게)
      tag: String(n._id),
    }).catch((err) => console.error("푸시 전송 실패:", err.message))
  ));
};

const pushNotificationsSafely = (docs) => {
  if (!enabled) return;
  pushNotifications(docs).catch((err) => console.error("푸시 전송 실패:", err.message));
};

module.exports = { enabled, PUBLIC_KEY, sendToUser, pushNotifications, pushNotificationsSafely, bodyFor };
