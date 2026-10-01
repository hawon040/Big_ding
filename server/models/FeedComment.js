const mongoose = require("mongoose");

// 피드 게시물의 댓글 (커뮤니티 Comment와 별개 컬렉션 feedcomments). 대댓글 없이 한 단계만.
const feedCommentSchema = new mongoose.Schema({
  feed: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model("FeedComment", feedCommentSchema);
