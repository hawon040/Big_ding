const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

// GET /api/users/profile - 내 프로필
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("friends", "nickname avatar");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/users/profile - 프로필 수정 (닉네임, 아바타)
router.patch("/profile", auth, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { nickname, avatar },
      { new: true }
    ).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/users/friends/:targetId - 친구 추가
router.post("/friends/:targetId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.friends.includes(req.params.targetId)) {
      user.friends.push(req.params.targetId);
      await user.save();
    }
    res.json({ message: "친구가 추가되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/users/block/:targetId - 사용자 차단
router.post("/block/:targetId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.blockedUsers.includes(req.params.targetId)) {
      user.blockedUsers.push(req.params.targetId);
      await user.save();
    }
    res.json({ message: "사용자가 차단되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/users/account - 회원 탈퇴
router.delete("/account", auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: "계정이 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
