// /api/users/:id/posts, /feeds, /comments, /scraps — 마이페이지·타인 프로필 탭
const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");
const User = require("../../models/User");
const Comment = require("../../models/Comment");
const Feed = require("../../models/Feed");
const auth = require("../../middleware/authMiddleware");
const { getViewerContext, visiblePostsFilter, includesId, sameId } = require("../../utils/access");
const { parseLimit, decodeCursor, pageBy } = require("../../utils/pagination");
const { AUTHOR_FIELDS, cardProjection, toPostCard, toFeed } = require("../../utils/serializers");
const v = require("../../utils/validate");

// 대상 사용자를 확인한다. 차단 관계면 403, 비공개 계정은 본인·맞팔로우만 (기존 규칙과 동일)
const loadTarget = async (targetId, ctx) => {
  if (!v.isId(targetId)) throw new v.HttpError(404, "사용자를 찾을 수 없습니다.");
  const target = await User.findById(targetId).select("isPrivate followers following").lean();
  if (!target) throw new v.HttpError(404, "사용자를 찾을 수 없습니다.");
  if (includesId(ctx.excluded, target._id)) throw new v.HttpError(403, "차단된 사용자입니다.");
  const isMe = sameId(target._id, ctx.me._id);
  const mutual = includesId(target.followers, ctx.me._id) && includesId(target.following, ctx.me._id);
  if (target.isPrivate && !isMe && !mutual) throw new v.HttpError(403, "비공개 계정입니다.");
  return { target, isMe };
};

const postPage = (req, filter) =>
  pageBy({
    model: Post,
    filter,
    cursor: decodeCursor(req.query.cursor),
    limit: parseLimit(req.query.limit),
    build: (q) => q.select(cardProjection(req.user.id)).populate("author", AUTHOR_FIELDS).lean(),
  });

// GET /api/users/:id/posts — 작성한 글(최신순)
router.get("/:id/posts", auth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.user.id);
    const { target } = await loadTarget(req.params.id, ctx);
    const { docs, nextCursor } = await postPage(req, { $and: [visiblePostsFilter(ctx), { author: target._id }] });
    res.json({ items: docs.map((p) => toPostCard(p, req.user.id)), nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/users/:id/feeds — 올린 피드(사진 게시물, 최신순). 비공개·차단 규칙은 글 탭과 같다.
router.get("/:id/feeds", auth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.user.id);
    const { target } = await loadTarget(req.params.id, ctx);
    const { docs, nextCursor } = await pageBy({
      model: Feed,
      filter: { author: target._id, isDeleted: { $ne: true }, isBlocked: { $ne: true } },
      cursor: decodeCursor(req.query.cursor),
      limit: parseLimit(req.query.limit),
      build: (q) => q.populate("author", AUTHOR_FIELDS).lean(),
    });
    res.json({ items: docs.map((f) => toFeed(f, req.user.id)), nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/users/:id/comments — 작성한 댓글(최신순). 삭제된 글·볼 수 없는 글의 댓글은 뺀다.
router.get("/:id/comments", auth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.user.id);
    const { target } = await loadTarget(req.params.id, ctx);
    const { docs, nextCursor } = await pageBy({
      model: Comment,
      filter: { author: target._id, isDeleted: false },
      cursor: decodeCursor(req.query.cursor),
      limit: parseLimit(req.query.limit),
      build: (q) => q.lean(),
    });
    const visiblePosts = await Post.find({
      $and: [visiblePostsFilter(ctx), { _id: { $in: docs.map((c) => c.post) } }],
    }).select("title board").lean();
    const postById = new Map(visiblePosts.map((p) => [String(p._id), p]));
    const items = docs
      .filter((c) => postById.has(String(c.post)))
      .map((c) => {
        const post = postById.get(String(c.post));
        return {
          id: String(c._id),
          content: c.content,
          parentId: c.parentId ? String(c.parentId) : null,
          isAccepted: !!c.isAccepted,
          createdAt: c.createdAt,
          post: { id: String(post._id), title: post.title, board: post.board },
        };
      });
    res.json({ items, nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/users/:id/scraps — 스크랩한 글. 본인만 볼 수 있다.
// 스크랩 시각을 따로 저장하지 않으므로 글 작성일 기준 최신순이다.
router.get("/:id/scraps", auth, async (req, res) => {
  try {
    if (!sameId(req.params.id, req.user.id)) return res.status(403).json({ message: "본인의 스크랩만 볼 수 있습니다." });
    const ctx = await getViewerContext(req.user.id);
    const { docs, nextCursor } = await postPage(req, { $and: [visiblePostsFilter(ctx), { scraps: ctx.me._id }] });
    res.json({ items: docs.map((p) => toPostCard(p, req.user.id)), nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
