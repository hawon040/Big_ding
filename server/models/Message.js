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

  // 하트 반응 여부 (인스타 DM처럼 메시지를 더블탭하면 하트가 붙는다)
  liked: { type: Boolean, default: false },

}, { timestamps: true }); // createdAt이 전송 시간

// 1:1 대화 내역 조회($or: [{from,to},{from,to}])와 정렬에 쓰인다. from/to 위치가 바뀐
// 두 방향 모두 이 인덱스의 접두사(from, to)로 동등 비교되므로 하나의 복합 인덱스로 충분하다.
messageSchema.index({ from: 1, to: 1, createdAt: 1 });
// 안 읽은 메시지 개수/전체 읽음 처리(to + read)에 쓰인다.
messageSchema.index({ to: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
