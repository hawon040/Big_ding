const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");
const Comment = require("../models/Comment");
const { withLegacyComments } = require("../utils/comments");
const v = require("../utils/validate");

const TARGET_MODELS = { post: Post, comment: Comment, user: User };

// POST /api/reports - 신고 접수 { targetType, targetId, reason, detail? }
router.post("/", auth, async (req, res) => {
  try {
    // status/sanctionApplied/sanctionType까지 req.body로 그대로 넘기면 신고자가
    // 자기 신고의 처리 상태를 직접 조작할 수 있으므로, 신고 접수에 필요한 필드만 골라 쓴다.
    const { targetType, targetId } = req.body;
    if (!TARGET_MODELS[targetType]) v.fail("신고 대상 유형이 올바르지 않습니다.");
    if (!v.isId(String(targetId))) v.fail("신고 대상이 올바르지 않습니다.");
    const reason = v.requireString(req.body.reason, "신고 사유", { max: 200 });
    const detail = req.body.detail ? v.requireString(req.body.detail, "상세 내용", { max: 500 }) : undefined;

    // 기존 임베드 댓글(마이그레이션 전)도 신고할 수 있도록 댓글은 두 곳 모두 확인한다.
    const exists = targetType === "comment"
      ? (await Comment.exists({ _id: targetId })) || (await Post.exists({ "comments._id": targetId }))
      : await TARGET_MODELS[targetType].exists({ _id: targetId });
    if (!exists) return res.status(404).json({ message: "신고 대상을 찾을 수 없습니다." });
    if (targetType === "user" && String(targetId) === String(req.user.id)) v.fail("자기 자신은 신고할 수 없습니다.");

    // 같은 대상을 처리 대기 중에 다시 신고하는 것은 막는다.
    if (await Report.exists({ reporter: req.user.id, targetType, targetId, status: "pending" })) {
      return res.status(409).json({ message: "이미 신고한 대상입니다." });
    }
    const report = await Report.create({ targetType, targetId, reason, detail, reporter: req.user.id });
    res.status(201).json({ message: "신고가 접수되었습니다.", report });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/reports/mine - 내 신고 내역
router.get("/mine", auth, async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.user.id }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/reports - 전체 신고 목록 (관리자 전용). 미처리 건이 위로 오도록 정렬한다.
router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("reporter", "nickname studentId")
      .sort({ status: 1, createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/reports/:id/target - 신고 대상(게시물/댓글/유저) 바로 조회 (관리자 전용)
router.get("/:id/target", auth, isAdmin, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "신고를 찾을 수 없습니다." });

    if (report.targetType === "post") {
      const post = await Post.findById(report.targetId).populate("author", "nickname avatar studentId");
      if (!post) return res.status(404).json({ message: "게시물을 찾을 수 없습니다. 삭제되었을 수 있습니다." });
      return res.json({ targetType: "post", post: await withLegacyComments(post) });
    }

    if (report.targetType === "comment") {
      // 댓글을 담고 있는 게시물을 함께 내려준다 (댓글 원본은 Comment 컬렉션, 기존 임베드 댓글도 확인)
      const comment = await Comment.findById(report.targetId).select("post").lean();
      const post = comment
        ? await Post.findById(comment.post).populate("author", "nickname avatar studentId")
        : await Post.findOne({ "comments._id": report.targetId }).populate("author", "nickname avatar studentId");
      if (!post) return res.status(404).json({ message: "댓글을 찾을 수 없습니다. 삭제되었을 수 있습니다." });
      return res.json({ targetType: "comment", post: await withLegacyComments(post), targetCommentId: report.targetId });
    }

    // targetType === "user"
    const user = await User.findById(report.targetId).select("nickname studentId avatar isAdmin createdAt");
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다. 탈퇴했을 수 있습니다." });
    return res.json({ targetType: "user", user });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/reports/:id - 신고 처리 상태 변경 (관리자 전용)
// body: { status, note? } - note는 별도의 유저 제재 없이(또는 게시물 삭제 등으로) 처리 완료할 때
// 신고자에게 그대로 전달되는 처리 결과 메시지다.
router.patch("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!["pending", "resolved"].includes(status)) {
      return res.status(400).json({ message: "올바르지 않은 상태입니다." });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "신고를 찾을 수 없습니다." });
    const wasPending = report.status === "pending";
    report.status = status;
    await report.save();

    // 이미 제재 처리로 자동 해결된 신고가 아닐 때만, 이 처리 자체에 대한 결과를 신고자에게 알린다.
    if (status === "resolved" && wasPending && !report.sanctionApplied) {
      await Notification.create({
        recipient: report.reporter,
        sender: req.user.id,
        type: "reportResolved",
        message: note?.trim() || "검토 결과 별도의 제재 조치는 없었습니다.",
      });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
