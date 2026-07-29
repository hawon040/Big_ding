const mongoose = require("mongoose");

const groupChatSchema = new mongoose.Schema({
  // 이 채팅방이 속한 공강모임 게시물 (게시물 하나당 채팅방 하나). 친구끼리 직접 만든
  // 채팅방은 특정 게시물에 속하지 않으므로 없을 수 있다(sparse 인덱스로 중복 체크 예외 처리).
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", unique: true, sparse: true },

  // 친구끼리 직접 만든 채팅방의 이름(게시물에 속한 채팅방은 게시물 제목을 대신 쓴다)
  name: { type: String },

  // 방을 만든 사람 = 방장. 방장은 항상 멤버에도 포함되어 있다.
  host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 채팅방 멤버 목록
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("GroupChat", groupChatSchema);
