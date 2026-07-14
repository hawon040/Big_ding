const express = require("express");
const router = express.Router();
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { uploadImage } = require("../config/cloudinary");

// GET /api/users/profile - 내 프로필 (팔로워/팔로잉 수 포함)
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

// POST /api/users/follow/:targetId - 팔로우
router.post("/follow/:targetId", auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    if (targetId === req.user.id) {
      return res.status(400).json({ message: "자기 자신은 팔로우할 수 없습니다." });
    }
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: req.user.id } });

    // 상대방에게 "팔로우" 알림 생성
    await Notification.create({ recipient: targetId, sender: req.user.id, type: "follow" });

    res.json({ message: "팔로우했습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// DELETE /api/users/follow/:targetId - 언팔로우
router.delete("/follow/:targetId", auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    await User.findByIdAndUpdate(req.user.id, { $pull: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { followers: req.user.id } });
    res.json({ message: "언팔로우했습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/users/:id/followers - 팔로워 목록
router.get("/:id/followers", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("followers", "nickname avatar studentId");
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    res.json(user.followers);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/users/:id/following - 팔로잉 목록
router.get("/:id/following", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("following", "nickname avatar studentId");
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    res.json(user.following);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/users/profile - 프로필 수정 (닉네임, 아바타)
// 닉네임만 바꿀 땐 JSON body, 프로필 사진을 바꿀 땐 multipart/form-data의 avatar 필드로 보낸다.
router.patch("/profile", auth, upload.single("avatar"), async (req, res) => {
  try {
    const update = {};
    if (req.body.nickname !== undefined) {
      const nickname = req.body.nickname.trim();

      // 저장 직전, 다른 사람이 이미 쓰고 있는 닉네임인지 다시 한번 확인한다.
      // (본인이 원래 쓰던 닉네임으로 "그대로" 저장하는 경우는 제외)
      const existing = await User.findOne({
        nickname,
        _id: { $ne: req.user.id },
      });
      if (existing) {
        return res.status(409).json({ message: "이미 사용 중인 닉네임입니다." });
      }

      update.nickname = nickname;
    }
    if (req.file) {
      update.avatar = (await uploadImage(req.file.buffer, "avatars")).secure_url;
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
      isWithdrawn: { $ne: true },
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
// 유저 문서를 완전히 삭제하지 않고 "익명화"한다.
// 게시글/댓글의 author 참조(ObjectId)는 그대로 살아있으므로 별도 처리 없이
// "탈퇴한 사용자"로 자동 표시되고, 개인정보(닉네임/학번/프로필사진/비밀번호)만 제거된다.
router.delete("/account", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const crypto = require("crypto");

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    // 1. 다른 유저들의 친구/팔로워/팔로잉/차단 목록에서 나를 제거
    await User.updateMany(
      {},
      {
        $pull: {
          friends: userId,
          followers: userId,
          following: userId,
          blockedUsers: userId,
        },
      }
    );

    // 2. 나와 관련된 대기 중인 친구 신청 삭제
    await FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] });

    // 3. 개인정보 익명화 (게시글/댓글은 남긴다)
    user.nickname = "탈퇴한 사용자";
    user.avatar = undefined;
    // 학번은 재가입이 가능하도록 실제 값을 반납하고 고유한 익명 값으로 대체
    user.studentId = `WITHDRAWN_${user.studentId}_${Date.now()}`;
    // 로그인이 불가능하도록 비밀번호를 무작위 값으로 변경 (pre save 훅에서 자동 해시)
    user.password = crypto.randomBytes(32).toString("hex");
    user.friends = [];
    user.followers = [];
    user.following = [];
    user.blockedUsers = [];
    user.isWithdrawn = true;
    user.withdrawnAt = new Date();

    await user.save();

    res.json({ message: "계정이 탈퇴되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
