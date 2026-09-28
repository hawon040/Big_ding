const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { sameId, includesId } = require("./access");

// 사용자 알림 설정과 연결되는 유형 (설정이 꺼져 있으면 알림을 만들지 않는다)
const SETTING_BY_TYPE = {
  comment: "comment",
  reply: "comment",
  accepted: "comment",
  study_recruit: "studyRecruit",
};
const LIKE_BUNDLE_MS = 60 * 60 * 1000;

const toId = (v) => new mongoose.Types.ObjectId(String(v?._id || v));

// 알림 하나를 만든다. 본인에게·탈퇴한 사람에게·나를 차단한 사람에게는 보내지 않는다.
// 같은 글 좋아요는 1시간 안이면 기존 알림에 묶는다 ("OO님 외 N명이 좋아요").
const notify = async ({ recipient, sender, type, post, comment, commentContent, message }) => {
  if (!recipient || sameId(recipient, sender)) return null;
  const target = await User.findById(recipient).select("notificationSettings isWithdrawn blockedUsers").lean();
  if (!target || target.isWithdrawn) return null;
  if (sender && includesId(target.blockedUsers, sender)) return null;
  const settingKey = SETTING_BY_TYPE[type];
  if (settingKey && target.notificationSettings?.[settingKey] === false) return null;

  if (type === "like" && post) {
    const senderId = toId(sender);
    const bundled = await Notification.findOneAndUpdate(
      { recipient, type: "like", post, createdAt: { $gte: new Date(Date.now() - LIKE_BUNDLE_MS) } },
      [
        {
          $set: {
            actors: { $setUnion: [{ $ifNull: ["$actors", ["$sender"]] }, [senderId]] },
            sender: senderId,
            read: false,
          },
        },
        { $set: { actorCount: { $size: "$actors" } } },
      ],
      { new: true, sort: { createdAt: -1 } }
    );
    if (bundled) return bundled;
  }

  return Notification.create({
    recipient, sender, type, post, comment, commentContent, message,
    actors: sender ? [sender] : [],
    actorCount: 1,
  });
};

// 스터디 모집글: 주제가 내 관심 주제와 겹치는 사용자에게 알림 (설정 끈 사람·차단 관계 제외)
const notifyStudyRecruit = async (post) => {
  if (!post.topics?.length) return 0;
  const author = await User.findById(post.author).select("blockedUsers").lean();
  const recipients = await User.find({
    _id: { $ne: post.author, $nin: author?.blockedUsers || [] },
    blockedUsers: { $ne: post.author },
    interests: { $in: post.topics },
    isWithdrawn: { $ne: true },
    "notificationSettings.studyRecruit": { $ne: false },
  }).select("_id").lean();
  if (!recipients.length) return 0;
  await Notification.insertMany(recipients.map((r) => ({
    recipient: r._id,
    sender: post.author,
    type: "study_recruit",
    post: post._id,
    actors: [post.author],
  })));
  return recipients.length;
};

// 알림 실패가 본 작업(댓글 작성 등)을 실패시키지 않도록 로그만 남긴다.
const notifySafely = (params) => notify(params).catch((err) => console.error("알림 생성 실패:", err.message));

module.exports = { notify, notifySafely, notifyStudyRecruit };
