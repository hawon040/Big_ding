const express = require("express");
const router = express.Router();
const GroupChat = require("../models/GroupChat");
const GroupMessage = require("../models/GroupMessage");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { uploadImage } = require("../config/cloudinary");
const { filterProfanity } = require("../middleware/profanityFilter");
const { emitToUser } = require("../socket/chatSocket");

const USER_FIELDS = "nickname avatar studentId";

const isMember = (groupChat, userId) =>
  groupChat.members.some((id) => id.toString() === userId);

// GET /api/group-chats - 내가 멤버로 속한 모임 채팅방 목록
router.get("/", auth, async (req, res) => {
  try {
    const groupChats = await GroupChat.find({ members: req.user.id })
      .populate("post", "title board")
      .populate("host", USER_FIELDS)
      .populate("members", USER_FIELDS)
      .sort({ updatedAt: -1 });

    const withLastMessage = await Promise.all(
      groupChats.map(async (gc) => {
        const lastMessage = await GroupMessage.findOne({ groupChat: gc._id }).sort({ createdAt: -1 });
        return { ...gc.toObject(), lastMessage };
      })
    );

    res.json(withLastMessage);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/group-chats - 친구끼리 직접 만드는 단체 채팅방 (공강모임과 무관)
router.post("/", auth, async (req, res) => {
  try {
    const { memberIds, name } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "함께할 친구를 선택해주세요." });
    }

    // 실제로 내 친구인 사람만 초대할 수 있게 한다.
    const me = await User.findById(req.user.id).select("friends nickname");
    const myFriendIds = new Set(me.friends.map((id) => id.toString()));
    const invalidInvite = memberIds.some((id) => !myFriendIds.has(id));
    if (invalidInvite) {
      return res.status(400).json({ message: "친구만 초대할 수 있습니다." });
    }

    const members = Array.from(new Set([req.user.id, ...memberIds]));
    const groupChat = await GroupChat.create({
      host: req.user.id,
      members,
      name: name?.trim() || undefined,
    });
    await groupChat.populate([
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    // 초대된 친구들에게 실시간으로 알려서 채팅 목록에 바로 뜨게 한다.
    memberIds.forEach((memberId) => emitToUser(memberId, "group_chat_created", groupChat));

    res.status(201).json(groupChat);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/group-chats/by-post/:postId - 특정 모임 게시물의 채팅방 조회 (멤버만)
router.get("/by-post/:postId", auth, async (req, res) => {
  try {
    let groupChat = await GroupChat.findOne({ post: req.params.postId });

    // 이 기능이 추가되기 전에 만들어진 모임 게시물은 채팅방이 없을 수 있으므로,
    // 방장 또는 참여자가 처음 채팅방을 열 때 그 자리에서 만들어준다.
    if (!groupChat) {
      const post = await Post.findById(req.params.postId);
      if (!post || post.board !== "meeting") {
        return res.status(404).json({ message: "모임 게시물을 찾을 수 없습니다." });
      }
      const isHostOrParticipant =
        post.author.toString() === req.user.id ||
        post.participants.some((id) => id.toString() === req.user.id);
      if (!isHostOrParticipant) {
        return res.status(403).json({ message: "모임 참여자만 채팅방을 열 수 있습니다." });
      }
      groupChat = await GroupChat.create({
        post: post._id,
        host: post.author,
        members: [post.author, ...post.participants.filter((id) => id.toString() !== post.author.toString())],
      });
    }

    // populate 전에(멤버가 아직 순수 ObjectId인 상태에서) 확인해야 한다.
    // populate 이후에 비교하면 배열 요소가 populate된 User 문서가 되어 toString()이
    // "[object Object]"를 반환하므로 항상 false가 되는 버그가 있었다.
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 볼 수 있습니다." });
    }

    groupChat = await groupChat.populate([
      { path: "post", select: "title board" },
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    res.json(groupChat);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/group-chats/:id/messages - 채팅방 메시지 내역 (멤버만)
router.get("/:id/messages", auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 볼 수 있습니다." });
    }
    const messages = await GroupMessage.find({ groupChat: groupChat._id })
      .populate("sender", USER_FIELDS)
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/group-chats/:id/messages - 채팅방에 메시지 보내기 (멤버만)
router.post("/:id/messages", auth, upload.single("image"), async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 메시지를 보낼 수 있습니다." });
    }

    const { content } = req.body;
    const image = req.file ? (await uploadImage(req.file.buffer, "group-chat")).secure_url : undefined;
    if (!content && !image) {
      return res.status(400).json({ message: "내용 또는 이미지를 입력해주세요." });
    }

    const message = await GroupMessage.create({
      groupChat: groupChat._id,
      sender: req.user.id,
      content: content ? filterProfanity(content) : "",
      image,
    });
    await message.populate("sender", USER_FIELDS);

    groupChat.members
      .filter((memberId) => memberId.toString() !== req.user.id)
      .forEach((memberId) => emitToUser(memberId, "receive_group_message", message));

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
