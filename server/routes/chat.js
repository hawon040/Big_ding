const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const auth = require("../middleware/authMiddleware");
const { filterProfanity } = require("../middleware/profanityFilter");

// GET /api/chat/:friendId - 대화 내역 조회
router.get("/:friendId", auth, async (req, res) => {
  try {
    const messages = await Chat.find({
      $or: [
        { from: req.user.id, to: req.params.friendId },
        { from: req.params.friendId, to: req.user.id },
      ],
    })
      .populate("from", "nickname avatar")
      .sort({ createdAt: 1 });

    // 읽음 처리
    await Chat.updateMany(
      { from: req.params.friendId, to: req.user.id, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/chat/:friendId - 메시지 저장 (Socket.io와 병행)
router.post("/:friendId", auth, async (req, res) => {
  try {
    const content = filterProfanity(req.body.content);
    const msg = await Chat.create({
      from: req.user.id,
      to: req.params.friendId,
      content,
    });
    await msg.populate("from", "nickname avatar");
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
