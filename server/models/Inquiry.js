const mongoose = require("mongoose");

const inquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ["pending", "resolved"], default: "pending" },

  // 관리자가 처리하면서 남긴 답변/피드백. 작성자에게 알림 문구로 그대로 전달된다.
  adminResponse: { type: String },
}, { timestamps: true });

// 내 건의 내역(user + createdAt)과 관리자 전체 목록(status + createdAt) 조회에 쓰인다.
inquirySchema.index({ user: 1, createdAt: -1 });
inquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Inquiry", inquirySchema);