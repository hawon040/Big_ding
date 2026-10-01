const mongoose = require("mongoose");

// 스토리: 사진 1장 + 짧은 글. 올린 지 24시간 동안만 보인다(조회 시 createdAt으로 거른다).
// 내 스토리와 "내가 팔로우하는 사람"의 스토리만 홈 상단에 뜬다.
const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  image: { type: String, required: true },
  caption: { type: String, default: "", maxlength: 100 },
  // 본 사람들 (작성자 본인 제외) — 홈 트레이의 "안 본 스토리" 링과 작성자의 조회자 목록에 쓴다
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  viewerCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Story", storySchema);
