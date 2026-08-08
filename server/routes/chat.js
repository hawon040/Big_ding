const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const ChatState = require("../models/ChatState");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { uploadImage } = require("../config/cloudinary");
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

// GET /api/chat/conversations - 실제로 메시지를 주고받은 적 있는 상대 목록.
// 친구 기능을 없애면서 채팅 탭 하단 패널은 "팔로우 여부"가 아니라
// "대화 이력이 있는 사람"을 기준으로 보여준다. 최근 메시지 시각 기준 내림차순.
router.get("/conversations", auth, async (req, res) => {
  try {
    const myId = new (require("mongoose").Types.ObjectId)(req.user.id);
    const results = await Message.aggregate([
      { $match: { $or: [{ from: myId }, { to: myId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$from", myId] }, "$to", "$from"],
          },
          lastMessageAt: { $first: "$createdAt" },
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    const partnerIds = results.map((r) => r._id);
    const users = await User.find({ _id: { $in: partnerIds } }).select("nickname avatar studentId");
    const usersById = new Map(users.map((u) => [u._id.toString(), u]));

    // 차단한 사람/나를 차단한 사람은 대화상대 목록에서 제외한다.
    const me = await User.findById(req.user.id).select("blockedUsers");
    const blockedMe = await User.find({ blockedUsers: req.user.id }).select("_id");
    const excluded = new Set([
      ...me.blockedUsers.map((id) => id.toString()),
      ...blockedMe.map((u) => u._id.toString()),
    ]);

    const conversations = results
      .filter((r) => usersById.has(r._id.toString()) && !excluded.has(r._id.toString()))
      .map((r) => usersById.get(r._id.toString()));

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/chat/unread-count - 전체 안 읽은 메시지 개수 (읽음 처리하지 않음, 뱃지 표시 전용)
// POST /api/chat/read-all - 화면에서 열 수 없는 상대(차단/탈퇴 등)가 보낸 메시지까지
// 포함해서, 나에게 온 모든 메시지를 강제로 읽음 처리한다. 정상적인 방법으로는
// 사라지지 않는 채팅 뱃지 잔여값을 초기화하는 용도.
router.post("/read-all", auth, async (req, res) => {
  try {
    await Message.updateMany({ to: req.user.id, read: false }, { read: true });
    res.json({ message: "모두 읽음 처리했습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

router.get("/unread-count", auth, async (req, res) => {
  try {
    // 차단한 사용자가 차단 전에 보낸 메시지는 화면에서 열 방법이 없어 영원히
    // 읽음 처리가 안 되므로, 뱃지 카운트에서도 제외한다.
    const me = await User.findById(req.user.id).select("blockedUsers");
    const count = await Message.countDocuments({
      to: req.user.id,
      read: false,
      from: { $nin: me.blockedUsers },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/chat/hidden-friends - 내가 "채팅 삭제"를 눌러서 목록에서 숨긴 친구 id 목록
router.get("/hidden-friends", auth, async (req, res) => {
  try {
    const states = await ChatState.find({
      $or: [{ userA: req.user.id }, { userB: req.user.id }],
      leftBy: req.user.id,
    });
    const friendIds = states.map((s) =>
      s.userA.toString() === req.user.id ? s.userB.toString() : s.userA.toString()
    );
    res.json(friendIds);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/chat/:friendId/state - 이 1:1 채팅에서 나(또는 상대)가 "채팅 삭제(나가기)"를 눌렀는지 조회
router.get("/:friendId/state", auth, async (req, res) => {
  try {
    const state = await ChatState.findOrCreatePair(req.user.id, req.params.friendId);
    const leftBy = state.leftBy.map((id) => id.toString());
    res.json({
      theyLeft: leftBy.includes(req.params.friendId), // 상대방이 나갔는지 (나는 남아있는 입장)
      iLeft: leftBy.includes(req.user.id), // 내가 나갔는지
    });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/chat/:friendId/leave - 1:1 채팅 삭제(나가기). 친구 관계는 그대로 두고, 내 채팅
// 목록에서만 이 대화가 사라지며 상대방에게는 "상대방이 나갔습니다"가 표시된다.
router.post("/:friendId/leave", auth, async (req, res) => {
  try {
    const state = await ChatState.findOrCreatePair(req.user.id, req.params.friendId);
    if (!state.leftBy.some((id) => id.toString() === req.user.id)) {
      state.leftBy.push(req.user.id);
      await state.save();
    }
    emitToUser(req.params.friendId, "chat_left", { friendId: req.user.id });
    res.json({ left: true });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/chat/:friendId - 1:1 대화 내역 조회
router.get("/:friendId", auth, async (req, res) => {
  try {
    if (await isBlockedPair(req.user.id, req.params.friendId)) {
      return res.status(403).json({ message: "차단된 상대와는 채팅할 수 없습니다." });
    }

    // preview=true (채팅 목록 미리보기)일 때는 읽음 처리하지 않는다.
    // 실제 채팅방을 열 때만(preview 없음) 읽음 처리를 먼저 하고 나서 조회한다.
    if (req.query.preview !== "true") {
      await Message.updateMany(
        { from: req.params.friendId, to: req.user.id, read: false },
        { read: true }
      );
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

    const state = await ChatState.findOrCreatePair(req.user.id, req.params.friendId);
    const leftBy = state.leftBy.map((id) => id.toString());
    if (leftBy.includes(req.params.friendId)) {
      return res.status(403).json({ message: "상대방이 채팅을 나갔습니다." });
    }
    // 내가 이 채팅을 나갔었는데 다시 메시지를 보내는 경우, 대화를 재개하는 것으로 보고 복구한다.
    if (leftBy.includes(req.user.id)) {
      state.leftBy = state.leftBy.filter((id) => id.toString() !== req.user.id);
      await state.save();
    }

    const { content } = req.body;
    const image = req.file ? (await uploadImage(req.file.buffer, "chat")).secure_url : undefined;
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

// GET /api/chat/:friendId/photos - 1:1 채팅방에 올라온 모든 사진 모아보기
router.get("/:friendId/photos", auth, async (req, res) => {
  try {
    if (await isBlockedPair(req.user.id, req.params.friendId)) {
      return res.status(403).json({ message: "차단된 상대와는 채팅할 수 없습니다." });
    }

    const messages = await Message.find({
      $or: [
        { from: req.user.id, to: req.params.friendId },
        { from: req.params.friendId, to: req.user.id },
      ],
      image: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .select("image createdAt");

    res.json(messages.map((m) => ({ image: m.image, createdAt: m.createdAt })));
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/chat/messages/:messageId/like - 메시지 하트 반응 토글 (인스타 DM처럼 더블탭)
router.patch("/messages/:messageId/like", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "메시지를 찾을 수 없습니다." });
    const isParticipant = [message.from.toString(), message.to.toString()].includes(req.user.id);
    if (!isParticipant) return res.status(403).json({ message: "권한이 없습니다." });

    message.liked = !message.liked;
    await message.save();
    await message.populate("from", USER_FIELDS);
    await message.populate("to", USER_FIELDS);

    const otherId = message.from._id.toString() === req.user.id ? message.to._id.toString() : message.from._id.toString();
    emitToUser(otherId, "message_liked", message);

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
