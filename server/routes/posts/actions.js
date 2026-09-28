// 게시글 상호작용: 좋아요·싫어요·스크랩·공강모임 참여·투표·모집 상태
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Post = require("../../models/Post");
const User = require("../../models/User");
const GroupChat = require("../../models/GroupChat");
const auth = require("../../middleware/authMiddleware");
const { RECRUIT_BOARDS } = require("../../constants/boards");
const { canAccessPost, includesId, sameId } = require("../../utils/access");
const { withLegacyComments } = require("../../utils/comments");
const { refreshPostPopularity } = require("../../utils/popularity");
const { runInTransaction } = require("../../utils/transaction");
const { notifySafely } = require("../../utils/notify");
const v = require("../../utils/validate");

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const refreshScore = (postId) =>
  refreshPostPopularity(postId).catch((err) => console.error("인기 점수 갱신 실패:", err.message));

// 접근 가능한 글을 불러온다. 없으면 404, 권한이 없으면 403을 던진다.
const loadPost = async (id, userId, select) => {
  if (!v.isId(id)) throw new v.HttpError(404, "게시물을 찾을 수 없습니다.");
  const query = Post.findById(id);
  if (select) query.select(select);
  const post = await query;
  if (!post || post.isDeleted) throw new v.HttpError(404, "게시물을 찾을 수 없습니다.");
  if (!(await canAccessPost(post, userId))) throw new v.HttpError(403, "권한이 없습니다.");
  return post;
};

// ── 좋아요 / 싫어요 ──
// 배열(likes)과 likeCount를 한 번의 조건부 업데이트로 함께 바꿔서 어긋나지 않게 한다.
const setLike = async (postId, userId, on) => {
  const me = oid(userId);
  const res = on
    ? await Post.updateOne(
      { _id: postId, likes: { $ne: me } },
      { $addToSet: { likes: me }, $pull: { dislikes: me }, $inc: { likeCount: 1 } },
      { timestamps: false }
    )
    : await Post.updateOne(
      { _id: postId, likes: me },
      { $pull: { likes: me }, $inc: { likeCount: -1 } },
      { timestamps: false }
    );
  return res.modifiedCount === 1;
};

const likeState = async (postId, userId) => {
  const p = await Post.findById(postId).select("likes dislikes likeCount").lean();
  return {
    likes: p.likes.length,
    dislikes: p.dislikes.length,
    likeCount: p.likeCount,
    isLiked: includesId(p.likes, userId),
  };
};

const afterLike = (post, userId, added) => {
  refreshScore(post._id);
  if (added) notifySafely({ recipient: post.author, sender: userId, type: "like", post: post._id });
};

// POST /api/posts/:id/like — 기존 클라이언트 호환을 위해 토글로 동작한다.
// 새 클라이언트는 좋아요 안 한 상태에서만 POST, 취소는 DELETE를 쓴다.
router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id, "author likes isDeleted visibility");
    const liked = includesId(post.likes, req.user.id);
    const changed = await setLike(post._id, req.user.id, !liked);
    afterLike(post, req.user.id, !liked && changed);
    res.json(await likeState(post._id, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/posts/:id/like — 좋아요 취소 (이미 취소된 상태면 그대로)
router.delete("/:id/like", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id, "author isDeleted visibility");
    if (await setLike(post._id, req.user.id, false)) refreshScore(post._id);
    res.json(await likeState(post._id, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/posts/:id/dislike — 싫어요 토글 (싫어요를 누르면 좋아요는 취소된다)
router.post("/:id/dislike", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id, "author dislikes isDeleted visibility");
    const me = oid(req.user.id);
    if (includesId(post.dislikes, me)) {
      await Post.updateOne({ _id: post._id }, { $pull: { dislikes: me } }, { timestamps: false });
    } else {
      const added = await Post.updateOne(
        { _id: post._id, dislikes: { $ne: me } },
        { $addToSet: { dislikes: me } },
        { timestamps: false }
      );
      if (await setLike(post._id, req.user.id, false)) refreshScore(post._id);
      if (added.modifiedCount === 1) {
        notifySafely({ recipient: post.author, sender: req.user.id, type: "dislike", post: post._id });
      }
    }
    res.json(await likeState(post._id, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// ── 스크랩 ── 글의 scraps/scrapCount와 내 scrapCount를 한 트랜잭션으로
const setScrap = (postId, userId, on) =>
  runInTransaction(async (session) => {
    const me = oid(userId);
    const res = await Post.updateOne(
      on ? { _id: postId, scraps: { $ne: me } } : { _id: postId, scraps: me },
      on
        ? { $addToSet: { scraps: me }, $inc: { scrapCount: 1 } }
        : { $pull: { scraps: me }, $inc: { scrapCount: -1 } },
      { session, timestamps: false }
    );
    if (res.modifiedCount === 0) return false;
    await User.updateOne({ _id: me }, { $inc: { scrapCount: on ? 1 : -1 } }, { session });
    return true;
  });

const scrapState = async (postId, userId) => {
  const p = await Post.findById(postId).select("scraps scrapCount").lean();
  return { scraps: p.scraps, scrapCount: p.scrapCount, isScrapped: includesId(p.scraps, userId) };
};

// POST /api/posts/:id/scrap — 토글 (기존 클라이언트 호환). 새 클라이언트는 취소에 DELETE 사용
router.post("/:id/scrap", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id, "author scraps isDeleted visibility");
    const scrapped = includesId(post.scraps, req.user.id);
    const changed = await setScrap(post._id, req.user.id, !scrapped);
    if (changed) refreshScore(post._id);
    if (changed && !scrapped) {
      notifySafely({ recipient: post.author, sender: req.user.id, type: "scrap", post: post._id });
    }
    res.json(await scrapState(post._id, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/posts/:id/scrap — 스크랩 취소
router.delete("/:id/scrap", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id, "author isDeleted visibility");
    if (await setScrap(post._id, req.user.id, false)) refreshScore(post._id);
    res.json(await scrapState(post._id, req.user.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/posts/:id/likes, /dislikes — 누른 사용자 목록
["likes", "dislikes"].forEach((field) => {
  router.get(`/:id/${field}`, auth, async (req, res) => {
    try {
      const post = await loadPost(req.params.id, req.user.id);
      await post.populate(field, "nickname avatar studentId");
      res.json(post[field]);
    } catch (err) {
      v.handleError(res, err);
    }
  });
});

// ── 모집 상태 (스터디·공모전) ──
// PATCH /api/posts/:id/recruit — 작성자만. { status?: "open"|"closed", capacity?, current? }
router.patch("/:id/recruit", auth, async (req, res) => {
  try {
    const post = await loadPost(req.params.id, req.user.id);
    if (!sameId(post.author, req.user.id)) return res.status(403).json({ message: "권한이 없습니다." });
    if (!RECRUIT_BOARDS.includes(post.board)) v.fail("모집 정보는 스터디·공모전 게시판에서만 쓸 수 있습니다.");

    const next = { status: "open", capacity: 2, current: 1, ...(post.recruit?.toObject?.() || post.recruit || {}) };
    const { status, capacity, current } = req.body;
    if (status !== undefined) {
      if (!["open", "closed"].includes(status)) v.fail("모집 상태가 올바르지 않습니다.");
      next.status = status;
    }
    if (capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) v.fail("모집 인원은 2~100명 사이로 입력해주세요.");
      next.capacity = capacity;
    }
    if (current !== undefined) {
      if (!Number.isInteger(current) || current < 0) v.fail("현재 인원이 올바르지 않습니다.");
      next.current = current;
    }
    if (next.current > next.capacity) v.fail("현재 인원이 모집 인원보다 많을 수 없습니다.");

    post.recruit = next;
    await post.save();
    res.json({ recruit: post.recruit });
  } catch (err) {
    v.handleError(res, err);
  }
});

// ── 공강모임 참여 / 취소 ──
const loadMeeting = async (id, userId) => {
  const post = await loadPost(id, userId).catch((err) => {
    if (err.status === 404) throw new v.HttpError(404, "모임 게시물을 찾을 수 없습니다.");
    throw err;
  });
  if (post.board !== "meeting") throw new v.HttpError(404, "모임 게시물을 찾을 수 없습니다.");
  return post;
};

// POST /api/posts/:id/join — 참여하면 모임 채팅방에도 자동 초대
router.post("/:id/join", auth, async (req, res) => {
  try {
    const post = await loadMeeting(req.params.id, req.user.id);
    if (includesId(post.participants, req.user.id)) v.fail("이미 참여한 모임입니다.");
    if (post.maxParticipants && post.participants.length >= post.maxParticipants) v.fail("모집 인원이 모두 찼습니다.");
    post.participants.push(req.user.id);
    post.currentParticipants = post.participants.length;
    await post.save();
    await post.populate("author", "nickname avatar");
    await GroupChat.findOneAndUpdate({ post: post._id }, { $addToSet: { members: req.user.id } });
    notifySafely({ recipient: post.author._id, sender: req.user.id, type: "join", post: post._id });
    res.json(await withLegacyComments(post));
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/posts/:id/leave — 참여 취소하면 모임 채팅방에서도 나간다(방장은 취소 불가)
router.post("/:id/leave", auth, async (req, res) => {
  try {
    const post = await loadMeeting(req.params.id, req.user.id);
    if (!includesId(post.participants, req.user.id)) v.fail("참여하지 않은 모임입니다.");
    post.participants = post.participants.filter((id) => !sameId(id, req.user.id));
    post.currentParticipants = post.participants.length;
    await post.save();
    await post.populate("author", "nickname avatar");
    await GroupChat.findOneAndUpdate({ post: post._id }, { $pull: { members: req.user.id } });
    notifySafely({ recipient: post.author._id, sender: req.user.id, type: "leave", post: post._id });
    res.json(await withLegacyComments(post));
  } catch (err) {
    v.handleError(res, err);
  }
});

// ── 투표 ──
// POST /api/posts/:id/poll/vote — 다른 옵션을 누르면 옮기고, 같은 옵션을 다시 누르면 취소
router.post("/:id/poll/vote", auth, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const post = await loadPost(req.params.id, req.user.id).catch((err) => {
      if (err.status === 404) throw new v.HttpError(404, "투표를 찾을 수 없습니다.");
      throw err;
    });
    if (!post.poll) return res.status(404).json({ message: "투표를 찾을 수 없습니다." });
    if (typeof optionIndex !== "number" || optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ message: "잘못된 옵션입니다." });
    }
    const alreadyVotedThisOption = includesId(post.poll.options[optionIndex].votes, req.user.id);
    post.poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((id) => !sameId(id, req.user.id));
    });
    if (!alreadyVotedThisOption) post.poll.options[optionIndex].votes.push(req.user.id);
    await post.save();
    await post.populate("author", "nickname avatar");
    res.json(await withLegacyComments(post));
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
