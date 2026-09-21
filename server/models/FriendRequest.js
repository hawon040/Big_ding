const mongoose = require("mongoose");

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending"], default: "pending" },
}, { timestamps: true });

friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
// "나에게 온 신청" 목록 조회(to + createdAt 정렬)에 쓰인다.
friendRequestSchema.index({ to: 1, createdAt: -1 });

module.exports = mongoose.model("FriendRequest", friendRequestSchema);
