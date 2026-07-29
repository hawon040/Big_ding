const mongoose = require("mongoose");

const groupChatSchema = new mongoose.Schema({
  // 이 채팅방이 속한 공강모임 게시물 (게시물 하나당 채팅방 하나)
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, unique: true },

  // 모임을 만든 사람 = 방장. 방장은 항상 멤버에도 포함되어 있다.
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 채팅방 멤버(=모임 참여자) 목록
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("GroupChat", groupChatSchema);
