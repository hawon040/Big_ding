const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate("sender", "nickname avatar studentId")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
    res.json({ message: "읽음 처리되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;