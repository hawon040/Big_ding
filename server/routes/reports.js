const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const auth = require("../middleware/authMiddleware");

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

module.exports = router;
