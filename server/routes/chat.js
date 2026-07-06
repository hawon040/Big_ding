const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { filterProfanity } = require("../middleware/profanityFilter");

const USER_FIELDS = "nickname avatar studentId";

// GET /api/chat/:friendId - 1:1 대화 내역 조회
router.get("/:friendId", auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { from: req.user.id, to: req.params.friendId },
        { from: req.params.friendId, to: req.user.id },
      ],
    })
      .populate("from", USER_FIELDS)
      .populate("to", USER_FIELDS)
      .sort({ createdAt: 1 });

    // 상대가 보낸 메시지를 읽음 처리
    await Message.updateMany(
      { from: req.params.friendId, to: req.user.id, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/chat/:friendId - 메시지 보내기 (텍스트: JSON, 이미지: multipart/form-data의 image 필드)
router.post("/:friendId", auth, upload.single("image"), async (req, res) => {
  try {
    const { content } = req.body;
    const image = req.file ? `${req.protocol}://${req.get("host")}/uploads/chat/${req.file.filename}` : undefined;
    if (!content && !image) {
      return res.status(400).json({ message: "내용 또는 이미지를 입력해주세요." });
    }

    const message = await Message.create({
      from: req.user.id,
      to: req.params.friendId,
      content: content ? filterProfanity(content) : "",
      image,
    });
    await message.populate("from", USER_FIELDS);
    await message.populate("to", USER_FIELDS);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
