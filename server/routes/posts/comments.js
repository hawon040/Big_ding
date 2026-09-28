// 게시글의 댓글 (원본은 Comment 컬렉션 — services/commentService.js)
const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const profanityFilter = require("../../middleware/profanityFilter");
const Post = require("../../models/Post");
const { getViewerContext } = require("../../utils/access");
const { buildCommentTree, legacyCommentsOf } = require("../../utils/comments");
const { loadAccessiblePost, createComment, deleteComment } = require("../../services/commentService");
const v = require("../../utils/validate");

// GET /api/posts/:id/comments — 댓글 + 대댓글 트리, 채택 댓글이 맨 위
router.get("/:id/comments", auth, async (req, res) => {
  try {
    const post = await loadAccessiblePost(req.params.id, req.user.id);
    const { excluded } = await getViewerContext(req.user.id);
    const items = await buildCommentTree(post._id, req.user.id, excluded);
    res.json({
      items,
      commentCount: post.commentCount,
      acceptedCommentId: post.acceptedCommentId ? String(post.acceptedCommentId) : null,
    });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/posts/:id/comments — { content, parentId? } (기존 클라이언트는 parentComment)
// 응답은 기존 클라이언트 호환을 위해 이 글의 댓글 전체(임베드 형태 배열)
router.post("/:id/comments", auth, profanityFilter, async (req, res) => {
  try {
    const { post } = await createComment({
      postId: req.params.id,
      userId: req.user.id,
      content: req.body.content,
      parentId: req.body.parentId ?? req.body.parentComment,
    });
    res.json(await legacyCommentsOf(post._id));
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/posts/:id/comments/:commentId — 기존 경로. DELETE /api/comments/:id와 같은 동작
router.delete("/:id/comments/:commentId", auth, async (req, res) => {
  try {
    if (!v.isId(req.params.id) || !(await Post.exists({ _id: req.params.id }))) {
      return res.status(404).json({ message: "게시물을 찾을 수 없습니다." });
    }
    await deleteComment({ commentId: req.params.commentId, userId: req.user.id, postId: req.params.id });
    res.json(await legacyCommentsOf(req.params.id));
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
