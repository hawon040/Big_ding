const mongoose = require("mongoose");

// 게시물 댓글. 예전에는 Post.comments에 임베드했지만, 채택·소프트 삭제·작성자별 조회를 위해
// 별도 컬렉션으로 분리했다. 기존 임베드 댓글은 마이그레이션이 같은 _id로 옮긴다.
const commentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  // 답글이면 최상위 댓글의 _id (대댓글은 1단계까지만 허용)
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
  // Q&A 채택 여부
  isAccepted: { type: Boolean, default: false },
  // 소프트 삭제: "삭제된 댓글입니다"로 표시하고 달린 대댓글은 유지한다.
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

// 인덱스는 db/aPlanIndexes.js 참고
module.exports = mongoose.model("Comment", commentSchema);
