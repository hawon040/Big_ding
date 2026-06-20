const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  board: {
    type: String,
    enum: ["free", "qna", "contest", "event", "lecture", "meeting"],
    required: true,
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  images: [{ type: String }],           // Firebase Storage URLs
  tags: [{ type: String }],
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
