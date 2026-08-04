const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({
  groupChat: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  image: { type: String },
  liked: { type: Boolean, default: false },
  // "text": 일반 메시지, "system": "OO님이 채팅방을 나갔습니다" 같은 안내 메시지
  type: { type: String, enum: ["text", "system"], default: "text" },
}, { timestamps: true });

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
