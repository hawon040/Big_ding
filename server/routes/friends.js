const express = require("express");
const router = express.Router();
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const auth = require("../middleware/authMiddleware");

// GET /api/friends - 내 친구 목록
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friends", "nickname avatar studentId");
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/friends/requests - 나에게 온 대기 중인 친구 신청 목록
router.get("/requests", auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user.id })
      .populate("from", "nickname avatar studentId")
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/friends/requests/:targetId - 친구 신청 보내기
router.post("/requests/:targetId", auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    if (targetId === req.user.id) {
      return res.status(400).json({ message: "자기 자신에게는 신청할 수 없습니다." });
    }
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const me = await User.findById(req.user.id);
    if (
      me.blockedUsers.includes(targetId) ||
      targetUser.blockedUsers.some((id) => id.toString() === req.user.id)
    ) {
      return res.status(403).json({ message: "차단된 사용자에게는 친구 신청을 보낼 수 없습니다." });
    }
    if (me.friends.includes(targetId)) {
      return res.status(400).json({ message: "이미 친구입니다." });
    }
    const alreadySent = await FriendRequest.findOne({ from: req.user.id, to: targetId });
    if (alreadySent) return res.status(400).json({ message: "이미 신청했습니다." });

    // 상대방이 이미 나에게 신청한 상태라면 바로 친구가 되도록 처리한다.
    const reverseRequest = await FriendRequest.findOne({ from: targetId, to: req.user.id });
    if (reverseRequest) {
      await User.findByIdAndUpdate(req.user.id, { $addToSet: { friends: targetId } });
      await User.findByIdAndUpdate(targetId, { $addToSet: { friends: req.user.id } });
      await reverseRequest.deleteOne();
      return res.json({ message: "서로 신청하여 친구가 되었습니다." });
    }

    await FriendRequest.create({ from: req.user.id, to: targetId });
    res.status(201).json({ message: "친구 신청을 보냈습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/friends/requests/:id/accept - 친구 신청 수락
router.post("/requests/:id/accept", auth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "신청을 찾을 수 없습니다." });
    if (request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }
    await User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } });
    await User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } });
    await request.deleteOne();
    res.json({ message: "친구 요청을 수락했습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/friends/requests/:id - 친구 신청 거절/취소
router.delete("/requests/:id", auth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "신청을 찾을 수 없습니다." });
    if (request.from.toString() !== req.user.id && request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }
    await request.deleteOne();
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/friends/:friendId - 친구 삭제
router.delete("/:friendId", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { friends: req.params.friendId } });
    await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.user.id } });
    res.json({ message: "친구를 삭제했습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
