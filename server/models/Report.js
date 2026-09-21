const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetType: { type: String, enum: ["post", "comment", "user"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["pending", "resolved"], default: "pending" },

  // 이 신고를 처리하면서 신고당한 사람에게 제재를 적용했는지 여부 (신고자 알림 문구에 사용)
  sanctionApplied: { type: Boolean, default: false },
  sanctionType: { type: String, enum: ["warning", "ban", "commentRestriction", "forceWithdraw"] },
}, { timestamps: true });

// 내 신고 내역(reporter + createdAt)과 관리자 전체 목록(status + createdAt) 조회에 쓰인다.
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Report", reportSchema);
