const mongoose = require("mongoose");

// 스토리: 사진 1장 + 짧은 글. 올린 지 24시간 동안만 보인다(조회 시 createdAt으로 거른다).
// 내 스토리와 "내가 팔로우하는 사람"의 스토리만 홈 상단에 뜬다.
const storySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  image: { type: String, required: true },
  caption: { type: String, default: "", maxlength: 100 },
  // 사진 위에 얹은 글 (최대 5개). x·y는 사진 가로·세로 대비 0~1 위치(글의 중심), size는 사진 가로 대비 글자 크기 비율이라
  // 기기·화면 크기가 달라도 같은 자리에 같은 비율로 보인다.
  texts: {
    type: [new mongoose.Schema({
      text: { type: String, required: true, maxlength: 100 },
      x: { type: Number, required: true, min: 0, max: 1 },
      y: { type: Number, required: true, min: 0, max: 1 },
      size: { type: Number, required: true, min: 0.03, max: 0.2 },
      color: { type: String, default: "#ffffff" },
    }, { _id: false })],
    default: [],
  },
  // 본 사람들 (작성자 본인 제외) — 홈 트레이의 "안 본 스토리" 링과 작성자의 조회자 목록에 쓴다
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  viewerCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Story", storySchema);
