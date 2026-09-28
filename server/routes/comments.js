// /api/comments — 댓글 수정·삭제·채택
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const profanityFilter = require("../middleware/profanityFilter");
const { updateComment, deleteComment, acceptComment } = require("../services/commentService");
const { handleError } = require("../utils/validate");

// PATCH /api/comments/:id — 작성자만
router.patch("/:id", auth, profanityFilter, async (req, res) => {
  try {
    const comment = await updateComment({ commentId: req.params.id, userId: req.user.id, content: req.body.content });
    res.json({ id: String(comment._id), content: comment.content, updatedAt: comment.updatedAt });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/comments/:id — 작성자(또는 관리자), 소프트 삭제
router.delete("/:id", auth, async (req, res) => {
  try {
    await deleteComment({ commentId: req.params.id, userId: req.user.id });
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/comments/:id/accept — Q&A 글 작성자만, 1개만, 변경 불가
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const result = await acceptComment({ commentId: req.params.id, userId: req.user.id });
    res.json({ postId: String(result.postId), acceptedCommentId: String(result.acceptedCommentId) });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
