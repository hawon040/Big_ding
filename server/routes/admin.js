const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Sanction = require("../models/Sanction");
const Notification = require("../models/Notification");
const FriendRequest = require("../models/FriendRequest");
const Post = require("../models/Post");
const AdminActionLog = require("../models/AdminActionLog");
const crypto = require("crypto");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

router.use(auth, isAdmin);

const addDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// POST /api/admin/users/:userId/warn - 유저 경고
// body: { reason: string, postId?: string }
router.post("/users/:userId/warn", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, postId } = req.body;
    if (userId === req.user.id) return res.status(400).json({ message: "본인은 대상으로 지정할 수 없습니다." });
    if (!reason?.trim()) return res.status(400).json({ message: "사유를 입력해주세요." });

    const target = await User.findById(userId).select("_id");
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const sanction = await Sanction.create({ user: userId, type: "warning", reason: reason.trim(), admin: req.user.id, post: postId || undefined });
    await Notification.create({ recipient: userId, sender: req.user.id, type: "adminWarning", post: postId || undefined, message: reason.trim() });
    res.status(201).json(sanction);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/admin/users/:userId/ban - 앱 차단
// body: { reason: string, banType: "permanent" | "temporary", days?: number, postId?: string }
router.post("/users/:userId/ban", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, banType, days, postId } = req.body;
    if (userId === req.user.id) return res.status(400).json({ message: "본인은 대상으로 지정할 수 없습니다." });
    if (!reason?.trim()) return res.status(400).json({ message: "사유를 입력해주세요." });
    if (!["permanent", "temporary"].includes(banType)) return res.status(400).json({ message: "차단 유형이 올바르지 않습니다." });
    if (banType === "temporary" && (!Number.isInteger(days) || days < 1)) {
      return res.status(400).json({ message: "차단 기간(일수)을 올바르게 입력해주세요." });
    }

    const target = await User.findById(userId).select("_id");
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const expiresAt = banType === "temporary" ? addDays(days) : undefined;
    const sanction = await Sanction.create({ user: userId, type: "ban", reason: reason.trim(), admin: req.user.id, post: postId || undefined, banType, expiresAt });

    await User.findByIdAndUpdate(userId, {
      banned: true, banType, banReason: reason.trim(), banUntil: expiresAt, banSanctionId: sanction._id,
    });
    await Notification.create({ recipient: userId, sender: req.user.id, type: "adminBan", post: postId || undefined, message: reason.trim(), until: expiresAt });

    res.status(201).json(sanction);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/admin/users/:userId/restrict-comments - 댓글 제한 (기간제만 지원)
// body: { reason: string, days: number, postId?: string }
router.post("/users/:userId/restrict-comments", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, days, postId } = req.body;
    if (userId === req.user.id) return res.status(400).json({ message: "본인은 대상으로 지정할 수 없습니다." });
    if (!reason?.trim()) return res.status(400).json({ message: "사유를 입력해주세요." });
    if (!Number.isInteger(days) || days < 1) return res.status(400).json({ message: "제한 기간(일수)을 올바르게 입력해주세요." });

    const target = await User.findById(userId).select("_id");
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const expiresAt = addDays(days);
    const sanction = await Sanction.create({ user: userId, type: "commentRestriction", reason: reason.trim(), admin: req.user.id, post: postId || undefined, expiresAt });

    await User.findByIdAndUpdate(userId, {
      commentRestrictedUntil: expiresAt, commentRestrictionReason: reason.trim(), commentRestrictionSanctionId: sanction._id,
    });
    await Notification.create({ recipient: userId, sender: req.user.id, type: "adminCommentRestriction", post: postId || undefined, message: reason.trim(), until: expiresAt });

    res.status(201).json(sanction);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/admin/event-admins - 행사공지 작성 권한을 부여받은 계정 목록
router.get("/event-admins", async (req, res) => {
  try {
    const users = await User.find({ canPostEvents: true }).select("nickname avatar studentId");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/admin/users/:userId/event-admin - 행사공지 작성 권한 부여/해제
// body: { canPostEvents: boolean }
// 이 권한은 행사공지 게시판 글쓰기만 가능하게 하며, 신고 처리/유저 제재/관리자 관리 등
// 다른 관리자 권한은 전혀 부여하지 않는다 (isAdmin과는 별개의 필드).
router.patch("/users/:userId/event-admin", async (req, res) => {
  try {
    const { userId } = req.params;
    const { canPostEvents } = req.body;
    if (typeof canPostEvents !== "boolean") {
      return res.status(400).json({ message: "잘못된 요청입니다." });
    }

    const target = await User.findByIdAndUpdate(userId, { canPostEvents }, { new: true }).select("nickname avatar studentId canPostEvents");
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    res.json(target);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/admin/sanctions?type=warning|ban|commentRestriction - 제재 관리 화면 목록 조회
router.get("/sanctions", async (req, res) => {
  try {
    const { type } = req.query;
    const query = {};
    if (type) query.type = type;
    const sanctions = await Sanction.find(query)
      .populate("user", "nickname avatar studentId")
      .populate("admin", "nickname")
      .sort({ active: -1, createdAt: -1 }); // 아직 살아있는 제재가 위로
    res.json(sanctions);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/admin/sanctions/:id/lift - 제재 해제 (경고/차단/댓글제한 공통)
router.patch("/sanctions/:id/lift", async (req, res) => {
  try {
    const sanction = await Sanction.findById(req.params.id);
    if (!sanction) return res.status(404).json({ message: "제재 내역을 찾을 수 없습니다." });

    sanction.active = false;
    sanction.liftedAt = new Date();
    sanction.liftedBy = req.user.id;
    await sanction.save();

    // 이 제재가 현재 유저에게 적용 중인 "현재 상태"와 같다면 User 필드도 함께 정리한다.
    if (sanction.type === "ban") {
      await User.updateOne(
        { _id: sanction.user, banSanctionId: sanction._id },
        { banned: false, banType: undefined, banUntil: undefined, banReason: undefined, banSanctionId: undefined }
      );
    } else if (sanction.type === "commentRestriction") {
      await User.updateOne(
        { _id: sanction.user, commentRestrictionSanctionId: sanction._id },
        { $unset: { commentRestrictedUntil: "", commentRestrictionReason: "", commentRestrictionSanctionId: "" } }
      );
    }
    res.json({ message: "해제되었습니다." });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/admin/users?q=&page=1&limit=30 - 전체 회원 목록 조회/검색 (관리자 전용)
// 학번/닉네임으로 검색하고, 현재 제재 상태(차단/댓글제한/탈퇴 여부)를 함께 내려준다.
router.get("/users", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const query = q
      ? { $or: [{ studentId: { $regex: q, $options: "i" } }, { nickname: { $regex: q, $options: "i" } }] }
      : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .select("nickname studentId avatar isAdmin canPostEvents banned banType banUntil commentRestrictedUntil isWithdrawn createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({ users, total, page, hasMore: page * limit < total });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// POST /api/admin/users/:userId/withdraw - 관리자에 의한 강제 탈퇴
// body: { reason: string }
// DELETE /users/account(본인 탈퇴)와 동일하게 문서를 삭제하지 않고 익명화하며,
// 처리 이력을 Sanction에 남겨 나중에 누가/언제/왜 탈퇴시켰는지 추적할 수 있게 한다.
router.post("/users/:userId/withdraw", async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    if (userId === req.user.id) return res.status(400).json({ message: "본인은 대상으로 지정할 수 없습니다." });
    if (!reason?.trim()) return res.status(400).json({ message: "사유를 입력해주세요." });

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    if (target.isWithdrawn) return res.status(400).json({ message: "이미 탈퇴한 사용자입니다." });

    const sanction = await Sanction.create({ user: userId, type: "forceWithdraw", reason: reason.trim(), admin: req.user.id });

    await User.updateMany(
      {},
      { $pull: { friends: userId, followers: userId, following: userId, blockedUsers: userId } }
    );
    await FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] });

    target.nickname = "탈퇴한 사용자";
    target.avatar = undefined;
    target.studentId = `WITHDRAWN_${target.studentId}_${Date.now()}`;
    target.password = crypto.randomBytes(32).toString("hex");
    target.friends = [];
    target.followers = [];
    target.following = [];
    target.blockedUsers = [];
    target.isWithdrawn = true;
    target.withdrawnAt = new Date();
    await target.save();

    res.status(201).json({ message: "강제 탈퇴 처리되었습니다.", sanction });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/admin/posts?board=&q=&page=1&limit=30 - 게시판 통합 모니터링 (관리자 전용)
// 일반 GET /posts와 달리 공개범위(팔로워 공개/나만 보기)나 차단 관계를 따지지 않고
// 관리자가 모든 게시판의 최근 글을 한눈에 볼 수 있게 한다.
router.get("/posts", async (req, res) => {
  try {
    const { board, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const query = {};
    if (board) query.board = board;
    if (q?.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: "i" } },
        { content: { $regex: q.trim(), $options: "i" } },
      ];
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate("author", "nickname avatar studentId")
        .populate("comments.author", "nickname avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    res.json({ posts, total, page, hasMore: page * limit < total });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/admin/logs?type=deletePost|deleteComment&page=1&limit=30 - 삭제된 글/댓글 로그 (관리자 전용)
router.get("/logs", async (req, res) => {
  try {
    const { type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const query = {};
    if (type && ["deletePost", "deleteComment"].includes(type)) query.actionType = type;

    const [logs, total] = await Promise.all([
      AdminActionLog.find(query)
        .populate("actor", "nickname studentId")
        .populate("targetAuthor", "nickname studentId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AdminActionLog.countDocuments(query),
    ]);

    res.json({ logs, total, page, hasMore: page * limit < total });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
