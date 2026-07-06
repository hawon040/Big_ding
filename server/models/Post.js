const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [pollOptionSchema],
    validate: (options) => options.length >= 2 && options.length <= 5,
  },
});

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  board: {
    type: String,
    enum: ["free", "qna", "contest", "event", "lecture", "meeting"],
    required: true,
  },
  title: { type: String, required: true },
  // 투표만 올리는 글은 본문 없이도 등록할 수 있어야 하므로, 투표가 없을 때만 필수로 둔다.
  content: {
    type: String,
    default: "",
    required: [function () { return !this.poll; }, "내용을 입력해주세요."],
  },
  images: [{ type: String }],           // 서버 업로드 이미지 URL
  tags: [{ type: String }],
  poll: { type: pollSchema },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema],
  rating: { type: Number, min: 1, max: 5 },           // 강의평가
  maxParticipants: { type: Number },                   // 공강모임
  currentParticipants: { type: Number, default: 1 },
  price: { type: Number },
  isBlocked: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Post", postSchema);
