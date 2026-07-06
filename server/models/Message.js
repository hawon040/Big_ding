const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  // 보낸 사람 (학번으로 구분되는 사용자)
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 받는 사람 (학번으로 구분되는 사용자)
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 메시지 내용 (이미지만 보내는 경우도 있어 필수는 아님)
  content: { type: String, default: "" },

  // 첨부 이미지 URL (Firebase Storage)
  image: { type: String },

  // 읽음 여부
  read: { type: Boolean, default: false },

}, { timestamps: true }); // createdAt이 전송 시간

module.exports = mongoose.model("Message", messageSchema);
