const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload")("avatars");

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
// 닉네임만 바꿀 땐 JSON body, 프로필 사진을 바꿀 땐 multipart/form-data의 avatar 필드로 보낸다.
router.patch("/profile", auth, upload.single("avatar"), async (req, res) => {
  try {
    const update = {};
    if (req.body.nickname !== undefined) update.nickname = req.body.nickname;
    if (req.file) {
      // 호스트 없이 경로만 저장한다(클라이언트별로 접근 가능한 origin이 다를 수 있어서 프론트에서 조합한다).
      update.avatar = `/uploads/avatars/${req.file.filename}`;
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/users/search?q= - 학번/닉네임으로 사용자 검색 (친구 신청용)
router.get("/search", auth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    // 내가 차단했거나 나를 차단한 사용자는 검색 결과에서 제외한다.
    const me = await User.findById(req.user.id).select("blockedUsers");
    const blockedMe = await User.find({ blockedUsers: req.user.id }).select("_id");
    const excludedIds = [req.user.id, ...me.blockedUsers, ...blockedMe.map((u) => u._id)];

    const users = await User.find({
      _id: { $nin: excludedIds },
      $or: [
        { studentId: { $regex: q, $options: "i" } },
        { nickname: { $regex: q, $options: "i" } },
      ],
    })
      .select("nickname avatar studentId")
      .limit(20);
    res.json(users);
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
    // 차단하면 더 이상 친구 사이가 아니게 된다.
    await User.findByIdAndUpdate(req.user.id, { $pull: { friends: req.params.targetId } });
    await User.findByIdAndUpdate(req.params.targetId, { $pull: { friends: req.user.id } });
    res.json({ message: "사용자가 차단되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/users/block/:targetId - 사용자 차단 해제
router.delete("/block/:targetId", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: req.params.targetId } });
    res.json({ message: "차단이 해제되었습니다." });
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
