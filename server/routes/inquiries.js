const express = require("express");
const router = express.Router();
const Inquiry = require("../models/Inquiry");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

// POST /api/inquiries - 건의사항 접수
router.post("/", auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ message: "제목과 내용을 입력해주세요." });
    }
    const inquiry = await Inquiry.create({ title, content, user: req.user.id });
    res.status(201).json({ message: "건의사항이 접수되었습니다.", inquiry });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/inquiries/mine - 내 건의사항 내역
router.get("/mine", auth, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// GET /api/inquiries - 전체 건의사항 목록 (관리자 전용). 미처리 건이 위로 오도록 정렬한다.
router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const inquiries = await Inquiry.find()
      .populate("user", "nickname studentId")
      .sort({ status: 1, createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// PATCH /api/inquiries/:id - 건의사항 처리 상태 변경 (관리자 전용)
router.patch("/:id", auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "resolved"].includes(status)) {
      return res.status(400).json({ message: "올바르지 않은 상태입니다." });
    }
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!inquiry) return res.status(404).json({ message: "건의사항을 찾을 수 없습니다." });
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;