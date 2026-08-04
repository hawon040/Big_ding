const mongoose = require("mongoose");

// 1:1 채팅 쌍(pair)마다 하나씩 존재하는 상태 문서. 친구 관계 자체는 그대로 둔 채,
// "채팅 삭제"를 누른 사람만 leftBy에 기록해서 내 채팅 목록에서는 숨기고,
// 상대방에게는 "상대방이 나갔습니다"를 보여주며 더 이상 메시지를 보낼 수 없게 한다.
const chatStateSchema = new mongoose.Schema({
  userA: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leftBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

chatStateSchema.index({ userA: 1, userB: 1 }, { unique: true });

// 항상 (문자열 기준) 작은 id를 userA에 넣어서, A-B 조회와 B-A 조회가 같은 문서를 가리키게 한다.
chatStateSchema.statics.pairKey = (id1, id2) => {
  const [a, b] = [String(id1), String(id2)].sort();
  return { userA: a, userB: b };
};

chatStateSchema.statics.findOrCreatePair = async function (id1, id2) {
  const key = this.pairKey(id1, id2);
  let doc = await this.findOne(key);
  if (!doc) {
    doc = await this.create(key);
  }
  return doc;
};

module.exports = mongoose.model("ChatState", chatStateSchema);