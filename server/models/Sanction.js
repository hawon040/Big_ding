const mongoose = require("mongoose");

const sanctionSchema = new mongoose.Schema({
  // 제재 대상
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  type: { type: String, enum: ["warning", "ban", "commentRestriction"], required: true },
  reason: { type: String, required: true },

  // 처리한 관리자
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 어느 게시물에서 비롯된 제재인지 (선택)
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },

  // type이 "ban"일 때만 사용
  banType: { type: String, enum: ["permanent", "temporary"] },

  // type이 ban(temporary) 또는 commentRestriction일 때 만료 시각
  expiresAt: { type: Date },

  // 해제(또는 만료 정리)되면 false
  active: { type: Boolean, default: true },
  liftedAt: { type: Date },
  liftedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Sanction", sanctionSchema);
