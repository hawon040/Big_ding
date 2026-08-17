const express = require("express");
const router = express.Router();
const GroupChat = require("../models/GroupChat");
const GroupMessage = require("../models/GroupMessage");
const Message = require("../models/Message");
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

    // 친구 기능은 폐기되고 팔로우/팔로잉으로 대체되었다. 서로 팔로우(맞팔로우)
    // 관계인 사람만 단체채팅에 초대할 수 있게 한다.
    const me = await User.findById(req.user.id).select("following");
    const myFollowingIds = new Set(me.following.map((id) => id.toString()));
    const invitedUsers = await User.find({ _id: { $in: memberIds } }).select("following");
    const invalidInvite = invitedUsers.some((u) => {
      const theyFollowMe = u.following.some((id) => id.toString() === req.user.id);
      const iFollowThem = myFollowingIds.has(u._id.toString());
      return !(theyFollowMe && iFollowThem);
    });
    if (invalidInvite || invitedUsers.length !== memberIds.length) {
      return res.status(400).json({ message: "서로 팔로우하는 사이만 초대할 수 있습니다." });
    }

    const members = Array.from(new Set([req.user.id, ...memberIds]));

    // 나를 포함해서 최종 인원이 2명이면 사실상 1:1 채팅이다. 1:1 채팅은 별도의
    // 방 문서 없이 Message 컬렉션의 from/to만으로 존재하므로, 그룹채팅방을 새로
    // 만들지 않고 상대방 정보만 돌려준다. 프론트에서는 이 응답을 보고 그 친구와의
    // 기존 1:1 채팅 화면으로 바로 연결해주면 된다.
    if (members.length === 2) {
      const friendId = members.find((id) => id !== req.user.id);
      const friend = await User.findById(friendId).select(USER_FIELDS);
      return res.status(200).json({ isDirect: true, friend });
    }

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

// PATCH /api/group-chats/messages/:messageId/like - 메시지 하트 반응 토글 (1:1 채팅과 동일)
router.patch("/messages/:messageId/like", auth, async (req, res) => {
  try {
    const message = await GroupMessage.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "메시지를 찾을 수 없습니다." });

    const groupChat = await GroupChat.findById(message.groupChat);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 반응할 수 있습니다." });
    }

    message.liked = !message.liked;
    await message.save();
    await message.populate("sender", USER_FIELDS);

    groupChat.members
      .filter((memberId) => memberId.toString() !== req.user.id)
      .forEach((memberId) => emitToUser(memberId, "receive_group_message", message));

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/group-chats/messages/:messageId/like - 메시지 하트 반응 토글 (1:1 채팅과 동일)
router.patch("/messages/:messageId/like", auth, async (req, res) => {
  try {
    const message = await GroupMessage.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "메시지를 찾을 수 없습니다." });

    const groupChat = await GroupChat.findById(message.groupChat);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 반응할 수 있습니다." });
    }

    message.liked = !message.liked;
    await message.save();
    await message.populate("sender", USER_FIELDS);

    groupChat.members
      .filter((memberId) => memberId.toString() !== req.user.id)
      .forEach((memberId) => emitToUser(memberId, "group_message_liked", message));

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 변경된 채팅방 정보를 나 자신을 뺀 나머지 멤버들에게 실시간으로 알린다(설정창이 열려있으면 바로 반영).
const notifyGroupChatUpdated = (groupChat, exceptUserId) => {
  groupChat.members
    .filter((memberId) => memberId.toString() !== String(exceptUserId))
    .forEach((memberId) => emitToUser(memberId, "group_chat_updated", groupChat));
};

// POST /api/group-chats/:id/invite - 채팅방에 친구 초대 (기존 멤버만 가능)
router.post("/:id/invite", auth, async (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: "초대할 친구를 선택해주세요." });
    }

    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 친구를 초대할 수 있습니다." });
    }

    const existingIds = new Set(groupChat.members.map((id) => id.toString()));
    const newIds = Array.from(new Set(memberIds.filter((id) => !existingIds.has(id))));
    if (newIds.length === 0) {
      return res.status(400).json({ message: "이미 채팅방에 있는 친구입니다." });
    }

    // 친구 기능은 폐기되고 팔로우/팔로잉으로 대체되었다. 서로 팔로우(맞팔로우)
    // 관계인 사람만 단체채팅에 초대할 수 있게 한다(채팅방 생성 시와 동일한 규칙).
    const me = await User.findById(req.user.id).select("following");
    const myFollowingIds = new Set(me.following.map((id) => id.toString()));
    const invitedUsers = await User.find({ _id: { $in: newIds } }).select(`following ${USER_FIELDS}`);
    const invalidInvite = invitedUsers.some((u) => {
      const theyFollowMe = u.following.some((id) => id.toString() === req.user.id);
      const iFollowThem = myFollowingIds.has(u._id.toString());
      return !(theyFollowMe && iFollowThem);
    });
    if (invalidInvite || invitedUsers.length !== newIds.length) {
      return res.status(400).json({ message: "서로 팔로우하는 사이만 초대할 수 있습니다." });
    }

    groupChat.members.push(...newIds);
    await groupChat.save();
    await groupChat.populate([
      { path: "post", select: "title board" },
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    // "OO님을 초대했습니다" 시스템 메시지를 남기고, 나를 뺀 기존 멤버들에게 실시간으로 보낸다.
    const inviteeNames = invitedUsers.map((u) => u.nickname).join(", ");
    const systemMessage = await GroupMessage.create({
      groupChat: groupChat._id,
      sender: req.user.id,
      content: `${inviteeNames}님을 초대했습니다`,
      type: "system",
    });
    await systemMessage.populate("sender", USER_FIELDS);
    Array.from(existingIds)
      .filter((id) => id !== req.user.id)
      .forEach((id) => emitToUser(id, "receive_group_message", systemMessage));

    // 기존 멤버에게는 채팅방 정보 갱신을, 새로 초대된 멤버에게는 새로 생긴 채팅방처럼 알려서
    // 각자의 채팅 목록에 바로 반영되게 한다.
    notifyGroupChatUpdated(groupChat, req.user.id);
    newIds.forEach((id) => emitToUser(id, "group_chat_created", groupChat));

    res.json(groupChat);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/group-chats/:id/name - 채팅방 이름 변경 (멤버만)
router.patch("/:id/name", auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 이름을 바꿀 수 있습니다." });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "채팅방 이름을 입력해주세요." });
    }

    groupChat.name = name.trim().slice(0, 30);
    await groupChat.save();
    await groupChat.populate([
      { path: "post", select: "title board" },
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    notifyGroupChatUpdated(groupChat, req.user.id);
    res.json(groupChat);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/group-chats/:id/avatar - 채팅방 대표 사진 변경 (멤버만, multipart의 image 필드)
router.patch("/:id/avatar", auth, upload.single("image"), async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 대표 사진을 바꿀 수 있습니다." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "이미지를 선택해주세요." });
    }

    const uploaded = await uploadImage(req.file.buffer, "group-chat-avatars");
    groupChat.avatar = uploaded.secure_url;
    await groupChat.save();
    await groupChat.populate([
      { path: "post", select: "title board" },
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    notifyGroupChatUpdated(groupChat, req.user.id);
    res.json(groupChat);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/group-chats/:id/photos - 채팅방에 올라온 모든 사진 모아보기 (멤버만)
router.get("/:id/photos", auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버만 볼 수 있습니다." });
    }

    const messages = await GroupMessage.find({ groupChat: groupChat._id, image: { $ne: null } })
      .sort({ createdAt: -1 })
      .select("image createdAt");

    res.json(messages.map((m) => ({ image: m.image, createdAt: m.createdAt })));
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/group-chats/:id/leave - 채팅방 나가기 (멤버만)
router.post("/:id/leave", auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (!isMember(groupChat, req.user.id)) {
      return res.status(403).json({ message: "채팅방 멤버가 아닙니다." });
    }

    const leavingUser = await User.findById(req.user.id).select(USER_FIELDS);
    const remainingMemberIds = groupChat.members
      .map((id) => id.toString())
      .filter((id) => id !== req.user.id);

    groupChat.members = groupChat.members.filter((id) => id.toString() !== req.user.id);

    // 마지막 멤버가 나가면 채팅방과 대화 내역을 함께 정리한다.
    if (groupChat.members.length === 0) {
      await GroupMessage.deleteMany({ groupChat: groupChat._id });
      await groupChat.deleteOne();
      return res.json({ deleted: true });
    }

    // 방장이 나갔다면 남은 멤버 중 가장 먼저 들어온 사람에게 방장을 넘긴다.
    if (groupChat.host.toString() === req.user.id) {
      groupChat.host = groupChat.members[0];
    }

    await groupChat.save();
    await groupChat.populate([
      { path: "post", select: "title board" },
      { path: "host", select: USER_FIELDS },
      { path: "members", select: USER_FIELDS },
    ]);

    // "OO님이 채팅방을 나갔습니다" 시스템 메시지를 남기고, 남은 멤버들에게 실시간으로 보낸다.
    const systemMessage = await GroupMessage.create({
      groupChat: groupChat._id,
      sender: req.user.id,
      content: `${leavingUser?.nickname ?? "알 수 없음"}님이 채팅방을 나갔습니다`,
      type: "system",
    });
    await systemMessage.populate("sender", USER_FIELDS);
    remainingMemberIds.forEach((id) => emitToUser(id, "receive_group_message", systemMessage));

    notifyGroupChatUpdated(groupChat, req.user.id);
    res.json({ deleted: false, groupChat });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/group-chats/:id - 채팅방 완전 삭제 (방장만 가능, 모든 멤버에게서 사라진다)
router.delete("/:id", auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);
    if (!groupChat) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    if (groupChat.host.toString() !== req.user.id) {
      return res.status(403).json({ message: "방장만 채팅방을 삭제할 수 있습니다." });
    }

    const memberIds = groupChat.members.map((id) => id.toString());
    await GroupMessage.deleteMany({ groupChat: groupChat._id });
    await groupChat.deleteOne();

    memberIds.forEach((id) => emitToUser(id, "group_chat_deleted", { _id: groupChat._id.toString() }));
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;