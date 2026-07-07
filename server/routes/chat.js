const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload")("chat");
const { filterProfanity } = require("../middleware/profanityFilter");
const { emitToUser } = require("../socket/chatSocket");

const USER_FIELDS = "nickname avatar studentId";

// 나와 상대방 중 한쪽이라도 상대를 차단했다면 채팅을 주고받을 수 없다.
const isBlockedPair = async (userId, friendId) => {
  const [me, friend] = await Promise.all([
    User.findById(userId).select("blockedUsers"),
    User.findById(friendId).select("blockedUsers"),
  ]);
  if (!me || !friend) return true;
  return (
    me.blockedUsers.some((id) => id.toString() === friendId) ||
    friend.blockedUsers.some((id) => id.toString() === userId)
  );
};

// GET /api/chat/:friendId - 1:1 대화 내역 조회
router.get("/:friendId", auth, async (req, res) => {
  try {
    if (await isBlockedPair(req.user.id, req.params.friendId)) {
      return res.status(403).json({ message: "차단된 상대와는 채팅할 수 없습니다." });
    }
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
    if (await isBlockedPair(req.user.id, req.params.friendId)) {
      return res.status(403).json({ message: "차단된 상대와는 채팅할 수 없습니다." });
    }
    const { content } = req.body;
    // 호스트 없이 경로만 저장한다(클라이언트별로 접근 가능한 origin이 다를 수 있어서 프론트에서 조합한다).
    const image = req.file ? `/uploads/chat/${req.file.filename}` : undefined;
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

    emitToUser(req.params.friendId, "receive_message", message);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
