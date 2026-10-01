// /api/stories — 24시간짜리 스토리. 내가 팔로우하는 사람과 내 스토리만 보인다.
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Story = require("../models/Story");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { uploadImage } = require("../config/cloudinary");
const { filterProfanity } = require("../middleware/profanityFilter");
const { getViewerContext, isBlockedBetween, sameId, includesId } = require("../utils/access");
const { AUTHOR_FIELDS, toAuthor } = require("../utils/serializers");
const v = require("../utils/validate");

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const CAPTION_MAX = 100;

const activeFilter = () => ({ isDeleted: { $ne: true }, createdAt: { $gte: new Date(Date.now() - STORY_TTL_MS) } });

const toStory = (s, meId) => {
  const mine = sameId(s.author?._id || s.author, meId);
  return {
    id: String(s._id),
    image: s.image,
    caption: s.caption || "",
    createdAt: s.createdAt,
    isMine: mine,
    viewed: mine || includesId(s.viewers, meId),
    viewerCount: mine ? s.viewerCount || 0 : null,
  };
};

// GET /api/stories — 홈 상단 트레이. 내 항목이 맨 앞(스토리가 없어도 "내 스토리 +"로 보임),
// 그다음 안 본 스토리가 있는 사람 → 최근 순.
router.get("/", auth, async (req, res) => {
  try {
    const { me, excluded } = await getViewerContext(req.user.id);
    const myId = String(req.user.id);
    const followingIds = (me.following || []).map(String).filter((id) => !excluded.some((e) => sameId(e, id)));
    const meObj = new mongoose.Types.ObjectId(myId);

    const stories = await Story.find({ author: { $in: [meObj, ...followingIds] }, ...activeFilter() })
      .select({ author: 1, createdAt: 1, viewers: { $elemMatch: { $eq: meObj } } })
      .sort({ createdAt: 1 })
      .lean();

    const byAuthor = new Map();
    stories.forEach((s) => {
      const key = String(s.author);
      const entry = byAuthor.get(key) || { count: 0, hasUnseen: false, latestAt: s.createdAt };
      entry.count += 1;
      entry.latestAt = s.createdAt;
      if (key !== myId && !includesId(s.viewers, myId)) entry.hasUnseen = true;
      byAuthor.set(key, entry);
    });

    const users = await User.find({ _id: { $in: [myId, ...byAuthor.keys()] }, isWithdrawn: { $ne: true } }).select(AUTHOR_FIELDS).lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const toItem = (id) => ({
      user: toAuthor(userById.get(id)),
      isMe: id === myId,
      count: byAuthor.get(id)?.count || 0,
      hasUnseen: !!byAuthor.get(id)?.hasUnseen,
      latestAt: byAuthor.get(id)?.latestAt || null,
    });

    const others = [...byAuthor.keys()]
      .filter((id) => id !== myId && userById.has(id))
      .map(toItem)
      .sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.latestAt) - new Date(a.latestAt));
    res.json({ items: [toItem(myId), ...others] });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/stories/user/:userId — 그 사람의 진행 중인 스토리 (오래된 순). 본인 또는 내가 팔로우하는 사람만.
router.get("/user/:userId", auth, async (req, res) => {
  try {
    if (!v.isId(req.params.userId)) throw new v.HttpError(404, "사용자를 찾을 수 없습니다.");
    const target = req.params.userId;
    if (!sameId(target, req.user.id)) {
      const { me } = await getViewerContext(req.user.id);
      if (!includesId(me.following, target)) throw new v.HttpError(403, "팔로우하는 사람의 스토리만 볼 수 있어요.");
      if (await isBlockedBetween(req.user.id, target)) throw new v.HttpError(403, "권한이 없습니다.");
    }
    const [user, stories] = await Promise.all([
      User.findById(target).select(AUTHOR_FIELDS).lean(),
      Story.find({ author: target, ...activeFilter() }).sort({ createdAt: 1 }).lean(),
    ]);
    if (!user || user.isWithdrawn) throw new v.HttpError(404, "사용자를 찾을 수 없습니다.");
    res.json({ user: toAuthor(user), items: stories.map((s) => toStory(s, req.user.id)) });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/stories — multipart/form-data: image(필수 1장), caption(선택, 100자 이하)
router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) v.fail("사진을 선택해주세요.");
    const raw = typeof req.body.caption === "string" ? req.body.caption.trim() : "";
    if (raw.length > CAPTION_MAX) v.fail(`문구는 ${CAPTION_MAX}자 이하로 입력해주세요.`);
    const { secure_url: image } = await uploadImage(req.file.buffer, "stories");
    const story = await Story.create({ author: req.user.id, image, caption: filterProfanity(raw) });
    res.status(201).json(toStory(story, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// 볼 수 있는 진행 중 스토리 하나를 찾는다 (본인 또는 내가 팔로우하는 사람, 차단 관계 아님)
const findViewable = async (id, meId) => {
  if (!v.isId(id)) throw new v.HttpError(404, "스토리를 찾을 수 없습니다.");
  const story = await Story.findOne({ _id: id, ...activeFilter() });
  if (!story) throw new v.HttpError(404, "스토리를 찾을 수 없습니다.");
  if (!sameId(story.author, meId)) {
    const { me } = await getViewerContext(meId);
    if (!includesId(me.following, story.author) || (await isBlockedBetween(meId, story.author))) {
      throw new v.HttpError(403, "권한이 없습니다.");
    }
  }
  return story;
};

// POST /api/stories/:id/view — 봤다고 기록 (중복·본인 스토리는 무시)
router.post("/:id/view", auth, async (req, res) => {
  try {
    const story = await findViewable(req.params.id, req.user.id);
    if (!sameId(story.author, req.user.id)) {
      await Story.updateOne({ _id: story._id, viewers: { $ne: req.user.id } }, { $addToSet: { viewers: req.user.id }, $inc: { viewerCount: 1 } });
    }
    res.json({ viewed: true });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/stories/:id/viewers — 내 스토리를 본 사람들
router.get("/:id/viewers", auth, async (req, res) => {
  try {
    const story = await findViewable(req.params.id, req.user.id);
    if (!sameId(story.author, req.user.id)) throw new v.HttpError(403, "권한이 없습니다.");
    await story.populate("viewers", AUTHOR_FIELDS);
    res.json({ items: story.viewers.map(toAuthor).filter(Boolean) });
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/stories/:id — 내 스토리 삭제
router.delete("/:id", auth, async (req, res) => {
  try {
    const story = await findViewable(req.params.id, req.user.id);
    if (!sameId(story.author, req.user.id)) throw new v.HttpError(403, "권한이 없습니다.");
    story.isDeleted = true;
    await story.save();
    res.json({ deleted: true });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
