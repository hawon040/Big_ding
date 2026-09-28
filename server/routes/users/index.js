const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const FriendRequest = require("../../models/FriendRequest");
const AdminActionLog = require("../../models/AdminActionLog");
const auth = require("../../middleware/authMiddleware");
const isAdmin = require("../../middleware/adminMiddleware");
const upload = require("../../middleware/upload");
const { uploadImage } = require("../../config/cloudinary");
const { escapeRegex } = require("../../utils/regex");
const relations = require("../../services/relationService");
const { isBlockedBetween, includesId } = require("../../utils/access");
const { wantsPage } = require("../../utils/pagination");
const { handleError, isId } = require("../../utils/validate");

// /me, /me/*, /:id/posts 같은 경로는 아래 GET /:id보다 먼저 등록되어야 한다.
router.use(require("./me"));
router.use(require("./content"));

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

const followState = async (targetId) => {
  const target = await User.findById(targetId).select("followerCount").lean();
  return { followerCount: target?.followerCount || 0 };
};

// 팔로우 / 언팔로우. 기존 경로(/follow/:targetId)와 A안 경로(/:id/follow) 모두 지원한다.
const followHandler = (param) => async (req, res) => {
  try {
    await relations.follow(req.user.id, req.params[param]);
    res.json({ message: "팔로우했습니다.", isFollowing: true, ...(await followState(req.params[param])) });
  } catch (err) {
    handleError(res, err);
  }
};
const unfollowHandler = (param) => async (req, res) => {
  try {
    await relations.unfollow(req.user.id, req.params[param]);
    res.json({ message: "언팔로우했습니다.", isFollowing: false, ...(await followState(req.params[param])) });
  } catch (err) {
    handleError(res, err);
  }
};
router.post("/follow/:targetId", auth, followHandler("targetId"));
router.delete("/follow/:targetId", auth, unfollowHandler("targetId"));
router.post("/:id/follow", auth, followHandler("id"));
router.delete("/:id/follow", auth, unfollowHandler("id"));

// 비공개 계정의 팔로워/팔로잉 "목록"은 본인이거나 맞팔로우가 아니면 볼 수 없다.
// (팔로우 여부/팔로워·팔로잉 숫자는 GET /api/users/:id에서 항상 내려준다 - 인스타와 동일)
const canViewFollowLists = (user, viewerId) => {
  if (String(user._id) === String(viewerId)) return true;
  if (!user.isPrivate) return true;
  const viewerFollowsThem = user.followers.some((id) => String(id) === String(viewerId));
  const theyFollowViewer = user.following.some((id) => String(id) === String(viewerId));
  return viewerFollowsThem && theyFollowViewer;
};

// 목록의 각 사용자에 대해, 요청한 본인이 그 사람을 팔로우하고 있는지 표시를 붙여준다.
// (인스타처럼 팔로워/팔로잉 목록에서 바로 팔로우/언팔로우 버튼을 보여주기 위함)
const withIsFollowedByMe = async (users, viewerId) => {
  const me = await User.findById(viewerId).select("following blockedUsers");
  const myFollowingIds = new Set((me?.following || []).map((id) => id.toString()));
  return users
    .filter((u) => !includesId(me?.blockedUsers, u._id))
    .map((u) => ({
      _id: u._id,
      id: String(u._id),
      nickname: u.nickname,
      avatar: u.avatar,
      profileImage: u.avatar || null,
      department: u.department || null,
      studentId: u.studentId,
      isFollowedByMe: myFollowingIds.has(u._id.toString()),
      isFollowing: myFollowingIds.has(u._id.toString()),
    }));
};

// GET /api/users/:id/followers, /following - 팔로워·팔로잉 목록
// 기존 클라이언트는 배열, cursor/limit를 보내면 { items, nextCursor }(목록 전체, nextCursor는 null)
["followers", "following"].forEach((field) => {
  router.get(`/:id/${field}`, auth, async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      const user = await User.findById(req.params.id).select("isPrivate followers following");
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      if (await isBlockedBetween(req.user.id, user._id)) return res.status(403).json({ message: "차단된 사용자입니다." });
      if (!canViewFollowLists(user, req.user.id)) {
        return res.status(403).json({ message: "비공개 계정입니다." });
      }
      await user.populate({ path: field, select: "nickname avatar studentId department", match: { isWithdrawn: { $ne: true } } });
      const list = await withIsFollowedByMe(user[field], req.user.id);
      res.json(wantsPage(req.query) ? { items: list, nextCursor: null } : list);
    } catch (err) {
      handleError(res, err);
    }
  });
});

// DELETE /api/users/followers/:followerId - 나를 팔로우하는 사람을 팔로워 목록에서 삭제
router.delete("/followers/:followerId", auth, async (req, res) => {
  try {
    await relations.removeFollower(req.user.id, req.params.followerId);
    res.json({ message: "팔로워를 삭제했습니다." });
  } catch (err) {
    handleError(res, err);
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
    if (req.body.professor !== undefined) {
      if (!["유진호", "차대현", "홍진근"].includes(req.body.professor)) {
        return res.status(400).json({ message: "올바른 담당 교수를 선택해주세요." });
      }
      update.professor = req.body.professor;
    }
    if (req.body.isPrivate !== undefined) {
      update.isPrivate = req.body.isPrivate === true || req.body.isPrivate === "true";
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
        { studentId: { $regex: escapeRegex(q), $options: "i" } },
        { nickname: { $regex: escapeRegex(q), $options: "i" } },
      ],
    })
      .select("nickname avatar studentId")
      .limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 차단 / 차단 해제. 차단하면 친구 관계와 서로의 팔로우가 모두 끊긴다.
// 기존 경로(/block/:targetId)와 A안 경로(/:id/block) 모두 지원한다.
const blockHandler = (param) => async (req, res) => {
  try {
    await relations.block(req.user.id, req.params[param]);
    res.json({ message: "사용자가 차단되었습니다.", isBlocked: true });
  } catch (err) {
    handleError(res, err);
  }
};
const unblockHandler = (param) => async (req, res) => {
  try {
    await relations.unblock(req.user.id, req.params[param]);
    res.json({ message: "차단이 해제되었습니다.", isBlocked: false });
  } catch (err) {
    handleError(res, err);
  }
};
router.post("/block/:targetId", auth, blockHandler("targetId"));
router.delete("/block/:targetId", auth, unblockHandler("targetId"));
router.post("/:id/block", auth, blockHandler("id"));
router.delete("/:id/block", auth, unblockHandler("id"));

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
    // A안 설정 화면은 비밀번호를 다시 입력받아 보낸다. (기존 설정 화면은 보내지 않으므로,
    // 기존 화면이 교체되면 필수로 바꾼다)
    const password = req.body?.password;
    if (password !== undefined && !(await user.comparePassword(String(password)))) {
      return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });
    }

    // 1. 다른 유저들의 친구/팔로워/팔로잉/차단 목록에서 나를 제거
    //    (팔로우 관계는 상대방의 팔로워·팔로잉 수도 함께 줄인다)
    await relations.detachAllFollows(user);
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
    user.followerCount = 0;
    user.followingCount = 0;
    user.bio = undefined;
    user.department = undefined;
    user.recentSearches = [];
    user.isWithdrawn = true;
    user.withdrawnAt = new Date();

    await user.save();

    res.json({ message: "계정이 탈퇴되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/users/admins - 현재 관리자 목록 (관리자 전용)
router.get("/admins", auth, isAdmin, async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true }).select("nickname avatar studentId");
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/users/:id/admin - 관리자 권한 부여/해제 (관리자 전용)
router.patch("/:id/admin", auth, isAdmin, async (req, res) => {
  try {
    const { isAdmin: nextIsAdmin } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isAdmin: !!nextIsAdmin },
      { new: true }
    ).select("nickname studentId isAdmin");
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    // 누가 언제 누구에게 관리자 권한을 부여/해제했는지 감사 로그에 남긴다.
    await AdminActionLog.create({
      actor: req.user.id,
      actorIsAdmin: true,
      actionType: nextIsAdmin ? "grantAdmin" : "revokeAdmin",
      targetAuthor: user._id,
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/users/:id - 다른 사용자의 공개 프로필 정보
// 비공개 계정이어도 팔로우 여부/팔로워·팔로잉 "숫자"는 인스타처럼 항상 내려준다.
// (실제 목록은 GET /:id/followers, /:id/following 에서 친구 여부에 따라 막힌다)
// 차단 관계면 403. A안 마이페이지(타인 프로필)용 필드(학과·학년·소개·관심 주제·활동 수)도 함께 내려준다.
router.get("/:id", auth, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    const user = await User.findById(req.params.id).select(
      "nickname avatar studentId isPrivate followers following friends department grade bio interests postCount commentCount scrapCount isWithdrawn"
    );
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    if (await isBlockedBetween(req.user.id, user._id)) {
      return res.status(403).json({ message: "차단된 사용자입니다." });
    }
    const isFollowedByMe = user.followers.some((id) => String(id) === String(req.user.id));
    const followsMeBack = user.following.some((id) => String(id) === String(req.user.id));
    res.json({
      _id: user._id,
      id: String(user._id),
      nickname: user.nickname,
      avatar: user.avatar,
      profileImage: user.avatar || null,
      studentId: user.studentId,
      department: user.department || null,
      grade: user.grade || null,
      bio: user.bio || null,
      interests: user.interests || [],
      isPrivate: !!user.isPrivate,
      isWithdrawn: !!user.isWithdrawn,
      isMe: String(user._id) === String(req.user.id),
      postCount: user.postCount || 0,
      commentCount: user.commentCount || 0,
      scrapCount: user.scrapCount || 0,
      followerCount: user.followers.length,
      followingCount: user.following.length,
      isFollowedByMe,
      isFollowing: isFollowedByMe,
      // 비공개 계정의 글/북마크는 "맞팔로우"(서로 팔로우)일 때만 공개한다.
      isMutualFollow: isFollowedByMe && followsMeBack,
      isFriend: user.friends.some((id) => String(id) === String(req.user.id)),
    });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
