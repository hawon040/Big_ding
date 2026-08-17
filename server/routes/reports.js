const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

// POST /api/reports - 신고 접수
router.post("/", auth, async (req, res) => {
  try {
    const report = await Report.create({ ...req.body, reporter: req.user.id });
    res.status(201).json({ message: "신고가 접수되었습니다.", report });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
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
      const post = await Post.findById(report.targetId)
        .populate("author", "nickname avatar studentId")
        .populate("comments.author", "nickname avatar");
      if (!post) return res.status(404).json({ message: "게시물을 찾을 수 없습니다. 삭제되었을 수 있습니다." });
      return res.json({ targetType: "post", post });
    }

    if (report.targetType === "comment") {
      // 댓글은 게시물 안에 임베드되어 있으므로, 해당 댓글을 담고 있는 게시물을 찾아서 함께 내려준다.
      const post = await Post.findOne({ "comments._id": report.targetId })
        .populate("author", "nickname avatar studentId")
        .populate("comments.author", "nickname avatar");
      if (!post) return res.status(404).json({ message: "댓글을 찾을 수 없습니다. 삭제되었을 수 있습니다." });
      return res.json({ targetType: "comment", post, targetCommentId: report.targetId });
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
router.patch("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "resolved"].includes(status)) {
      return res.status(400).json({ message: "올바르지 않은 상태입니다." });
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ message: "신고를 찾을 수 없습니다." });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
