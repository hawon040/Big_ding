const mongoose = require("mongoose");

// 게시물/댓글 삭제 이력을 남긴다. 본인이 자기 글을 지운 것과 관리자가 지운 것을 구분해서
// 기록하며, 문서 자체는 삭제되어 사라지므로 제목/내용 일부를 스냅샷으로 함께 저장한다.
const adminActionLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  actorIsAdmin: { type: Boolean, default: false }, // true면 관리자 권한으로 남의 글/댓글을 지운 것
  actionType: { type: String, enum: ["deletePost", "deleteComment"], required: true },
  board: { type: String },
  targetAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 삭제된 글/댓글의 원작성자
  snapshot: {
    title: { type: String },
    content: { type: String },
  },
  postId: { type: mongoose.Schema.Types.ObjectId }, // 댓글 삭제 시 소속 게시물 id (게시물 자체는 이미 없을 수도 있음)
}, { timestamps: true });

module.exports = mongoose.model("AdminActionLog", adminActionLogSchema);
