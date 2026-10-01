const mongoose = require("mongoose");

// 홈 피드 게시물. 커뮤니티 글(Post)과는 별개의 컬렉션(feeds)에 저장한다 — 사진이 반드시 1장 이상 있고,
// 게시판·제목·투표·모집 같은 글 전용 필드는 없다. 좋아요는 likes 배열 + likeCount, 댓글은 FeedComment 컬렉션.
const feedSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  images: {
    type: [String],
    validate: { validator: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 10, message: "사진은 1~10장이어야 합니다." },
  },
  content: { type: String, default: "", maxlength: 1000 },
  // 본문의 #해시태그에서 서버가 뽑아 저장한다(소문자, 중복 제거). 태그 알림·태그별 목록에 쓴다.
  tags: { type: [String], default: [] },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  // 관리자 숨김 / 작성자 소프트 삭제
  isBlocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Feed", feedSchema);
