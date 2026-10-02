// /api/feeds — 홈 피드 게시물(사진 필수). 커뮤니티 글(/api/posts)과 별개의 컬렉션을 쓴다.
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Feed = require("../models/Feed");
const FeedComment = require("../models/FeedComment");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { uploadImage } = require("../config/cloudinary");
const { filterProfanity } = require("../middleware/profanityFilter");
const { MAX_POST_TAGS } = require("../constants/topics");
const { normalizeTag, normalizeTags } = require("../utils/tags");
const { getViewerContext, isBlockedBetween, sameId, includesId } = require("../utils/access");
const { parseLimit, decodeCursor, pageBy } = require("../utils/pagination");
const { AUTHOR_FIELDS, toAuthor, toFeed } = require("../utils/serializers");
const { notifySafely, notifyFeedTags } = require("../utils/notify");
const v = require("../utils/validate");
const { announceCounts } = require("../services/profileCounts");

const MAX_IMAGES = 10;
const CONTENT_MAX = 1000;
const COMMENT_MAX = 300;
const COMMENT_LIMIT = 200;
const TAG_MAX_LEN = 30;
const MAX_TAG_ALERTS = 30;

// 본문의 #해시태그(한글·영문·숫자·_)를 소문자·중복 제거해서 뽑는다.
const extractTags = (content) => normalizeTags([...content.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]));

const toComment = (c, meId) => ({
  id: String(c._id),
  author: toAuthor(c.author),
  content: c.content,
  createdAt: c.createdAt,
  isMine: sameId(c.author?._id || c.author, meId),
});

const isAdmin = async (userId) => !!(await User.findById(userId).select("isAdmin").lean())?.isAdmin;

// 보이는 피드인지: 삭제·숨김·차단 관계 제외 (작성자 본인은 숨김 상태여도 볼 수 있다)
const findVisible = async (id, meId) => {
  if (!v.isId(id)) throw new v.HttpError(404, "게시물을 찾을 수 없습니다.");
  const feed = await Feed.findById(id).populate("author", AUTHOR_FIELDS);
  const mine = feed && sameId(feed.author?._id, meId);
  if (!feed || feed.isDeleted || (feed.isBlocked && !mine)) throw new v.HttpError(404, "게시물을 찾을 수 없습니다.");
  if (!mine && (await isBlockedBetween(meId, feed.author._id))) throw new v.HttpError(403, "권한이 없습니다.");
  return feed;
};

// GET /api/feeds?tag=<태그>&cursor=&limit= — 최신순 (tag를 주면 그 #태그가 달린 피드만)
router.get("/", auth, async (req, res) => {
  try {
    const tag = req.query.tag ? normalizeTag(req.query.tag) : null;
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const { excluded } = await getViewerContext(req.user.id);

    const filter = {
      isBlocked: { $ne: true },
      isDeleted: { $ne: true },
      ...(excluded.length ? { author: { $nin: excluded } } : {}),
      ...(tag ? { tags: tag } : {}),
    };
    const { docs, nextCursor } = await pageBy({
      model: Feed,
      filter,
      cursor,
      limit,
      build: (q) => q.populate("author", AUTHOR_FIELDS).lean(),
    });
    res.json({ items: docs.map((f) => toFeed(f, req.user.id)), nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/feeds — multipart/form-data: images(1~10장, 필수), content(선택, #해시태그는 태그로 저장)
router.post("/", auth, upload.array("images", MAX_IMAGES), async (req, res) => {
  try {
    if (!req.files?.length) v.fail("사진을 1장 이상 올려주세요.");
    const raw = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (raw.length > CONTENT_MAX) v.fail(`내용은 ${CONTENT_MAX}자 이하로 입력해주세요.`);
    const content = filterProfanity(raw);
    const tags = extractTags(content);
    if (tags.length > MAX_POST_TAGS) v.fail(`태그는 최대 ${MAX_POST_TAGS}개까지 달 수 있습니다.`);
    if (tags.some((t) => t.length > TAG_MAX_LEN)) v.fail(`태그는 ${TAG_MAX_LEN}자 이하로 입력해주세요.`);

    const images = (await Promise.all(req.files.map((file) => uploadImage(file.buffer, "feeds")))).map((r) => r.secure_url);
    const feed = await Feed.create({ author: req.user.id, images, content, tags });
    notifyFeedTags(feed).catch((err) => console.error("태그 알림 실패:", err.message));
    await feed.populate("author", AUTHOR_FIELDS);
    announceCounts(req.user.id);
    res.status(201).json(toFeed(feed, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// 태그 알림 구독: GET 목록 / POST { tag } 추가 / DELETE /:tag 해제. /:id보다 먼저 선언한다.
router.get("/tag-alerts", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("tagAlerts").lean();
    res.json({ items: me?.tagAlerts || [] });
  } catch (err) {
    v.handleError(res, err);
  }
});

router.post("/tag-alerts", auth, async (req, res) => {
  try {
    const tag = normalizeTag(v.requireString(req.body.tag, "태그", { max: TAG_MAX_LEN + 1 }));
    if (!tag || !/^[\p{L}\p{N}_]+$/u.test(tag)) v.fail("태그는 글자·숫자·밑줄만 쓸 수 있어요.");
    if (tag.length > TAG_MAX_LEN) v.fail(`태그는 ${TAG_MAX_LEN}자 이하로 입력해주세요.`);
    const me = await User.findById(req.user.id).select("tagAlerts").lean();
    if (!me.tagAlerts?.includes(tag) && (me.tagAlerts?.length || 0) >= MAX_TAG_ALERTS) v.fail(`태그 알림은 최대 ${MAX_TAG_ALERTS}개까지 설정할 수 있어요.`);
    await User.updateOne({ _id: req.user.id }, { $addToSet: { tagAlerts: tag } });
    const fresh = await User.findById(req.user.id).select("tagAlerts").lean();
    res.json({ items: fresh.tagAlerts });
  } catch (err) {
    v.handleError(res, err);
  }
});

router.delete("/tag-alerts/:tag", auth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $pull: { tagAlerts: normalizeTag(req.params.tag) } });
    const fresh = await User.findById(req.user.id).select("tagAlerts").lean();
    res.json({ items: fresh.tagAlerts });
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/feeds/comments/:commentId — 댓글 삭제 (작성자 또는 관리자). /:id보다 먼저 선언한다.
router.delete("/comments/:commentId", auth, async (req, res) => {
  try {
    if (!v.isId(req.params.commentId)) throw new v.HttpError(404, "댓글을 찾을 수 없습니다.");
    const comment = await FeedComment.findById(req.params.commentId);
    if (!comment) throw new v.HttpError(404, "댓글을 찾을 수 없습니다.");
    if (!sameId(comment.author, req.user.id) && !(await isAdmin(req.user.id))) throw new v.HttpError(403, "권한이 없습니다.");
    const { deletedCount } = await FeedComment.deleteOne({ _id: comment._id });
    if (deletedCount) await Feed.updateOne({ _id: comment.feed, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
    res.json({ deleted: true });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/feeds/:id
router.get("/:id", auth, async (req, res) => {
  try {
    res.json(toFeed(await findVisible(req.params.id, req.user.id), req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/feeds/:id — 소프트 삭제 (작성자 또는 관리자)
router.delete("/:id", auth, async (req, res) => {
  try {
    const feed = await findVisible(req.params.id, req.user.id);
    if (!sameId(feed.author._id, req.user.id) && !(await isAdmin(req.user.id))) throw new v.HttpError(403, "권한이 없습니다.");
    feed.isDeleted = true;
    feed.deletedAt = new Date();
    await feed.save();
    announceCounts(feed.author._id);
    res.json({ deleted: true });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST·DELETE /api/feeds/:id/like — 좋아요 / 취소 (중복 요청은 카운트가 늘지 않는다)
const setLike = (on) => async (req, res) => {
  try {
    const feed = await findVisible(req.params.id, req.user.id);
    const me = new mongoose.Types.ObjectId(String(req.user.id));
    if (on) {
      const { modifiedCount } = await Feed.updateOne({ _id: req.params.id, likes: { $ne: me } }, { $addToSet: { likes: me }, $inc: { likeCount: 1 } });
      if (modifiedCount) notifySafely({ recipient: feed.author._id, sender: req.user.id, type: "like", feed: feed._id });
    }
    else await Feed.updateOne({ _id: req.params.id, likes: me }, { $pull: { likes: me }, $inc: { likeCount: -1 } });
    const fresh = await Feed.findById(req.params.id).select("likeCount likes").lean();
    res.json({ likeCount: fresh.likeCount, isLiked: includesId(fresh.likes, me) });
  } catch (err) {
    v.handleError(res, err);
  }
};
router.post("/:id/like", auth, setLike(true));
router.delete("/:id/like", auth, setLike(false));

// GET /api/feeds/:id/comments — 오래된 순 (최대 200개)
router.get("/:id/comments", auth, async (req, res) => {
  try {
    await findVisible(req.params.id, req.user.id);
    const { excluded } = await getViewerContext(req.user.id);
    const comments = await FeedComment.find({
      feed: req.params.id,
      ...(excluded.length ? { author: { $nin: excluded } } : {}),
    })
      .sort({ createdAt: 1 })
      .limit(COMMENT_LIMIT)
      .populate("author", AUTHOR_FIELDS)
      .lean();
    res.json({ items: comments.map((c) => toComment(c, req.user.id)) });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/feeds/:id/comments { content }
router.post("/:id/comments", auth, async (req, res) => {
  try {
    const feed = await findVisible(req.params.id, req.user.id);
    const content = filterProfanity(v.requireString(req.body.content, "댓글", { max: COMMENT_MAX }));
    const comment = await FeedComment.create({ feed: req.params.id, author: req.user.id, content });
    await Feed.updateOne({ _id: req.params.id }, { $inc: { commentCount: 1 } });
    notifySafely({ recipient: feed.author._id, sender: req.user.id, type: "comment", feed: feed._id, commentContent: content });
    await comment.populate("author", AUTHOR_FIELDS);
    res.status(201).json(toComment(comment, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
