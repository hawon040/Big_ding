const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddleware");
const { getViewerContext } = require("../utils/access");
const { wantsPage, parseLimit, decodeCursor, pageBy } = require("../utils/pagination");
const { AUTHOR_FIELDS, toAuthor } = require("../utils/serializers");
const { handleError, isId } = require("../utils/validate");

const toItem = (n) => ({
  id: String(n._id),
  type: n.type,
  actor: toAuthor(n.sender),
  actorCount: n.actorCount || 1,
  post: n.post ? { id: String(n.post._id), title: n.post.title, board: n.post.board } : null,
  feedId: n.feed ? String(n.feed) : null,
  commentId: n.comment ? String(n.comment) : null,
  commentContent: n.commentContent || null,
  message: n.message || null,
  until: n.until || null,
  isRead: !!n.read,
  createdAt: n.createdAt,
});

// GET /api/notifications — 기존 클라이언트는 최근 50개 배열,
// cursor/limit를 보내면 { items, nextCursor } (차단한 사용자가 보낸 알림 제외)
router.get("/", auth, async (req, res) => {
  try {
    if (wantsPage(req.query)) {
      const { excluded } = await getViewerContext(req.user.id);
      const { docs, nextCursor } = await pageBy({
        model: Notification,
        filter: { recipient: req.user.id, ...(excluded.length ? { sender: { $nin: excluded } } : {}) },
        cursor: decodeCursor(req.query.cursor),
        limit: parseLimit(req.query.limit),
        build: (q) => q.populate("sender", AUTHOR_FIELDS).populate("post", "title board").lean(),
      });
      return res.json({ items: docs.map(toItem), nextCursor });
    }

    const notifications = await Notification.find({ recipient: req.user.id })
      .populate("sender", "nickname avatar studentId")
      .populate("post", "title board")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    handleError(res, err);
  }
});

router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
    res.json({ message: "읽음 처리되었습니다." });
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /api/notifications/:id/read — 하나 읽음 처리
router.patch("/:id/read", auth, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "알림을 찾을 수 없습니다." });
    const result = await Notification.updateOne({ _id: req.params.id, recipient: req.user.id }, { read: true });
    if (result.matchedCount === 0) return res.status(404).json({ message: "알림을 찾을 수 없습니다." });
    res.json({ message: "읽음 처리되었습니다." });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
