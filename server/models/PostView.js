const mongoose = require("mongoose");

// 게시물 조회 기록. {post, user} unique + 24시간 TTL이라, 같은 사용자는 하루에 한 번만
// 조회수를 올린다(upsert가 새 문서를 만들었을 때만 viewCount를 $inc).
const postViewSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

// 인덱스는 db/aPlanIndexes.js 참고
module.exports = mongoose.model("PostView", postViewSchema);
