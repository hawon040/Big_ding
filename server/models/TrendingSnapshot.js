const mongoose = require("mongoose");

// 인기 검색어 Top 10 스냅샷. 요청 시 최신 스냅샷이 1시간 지났으면 다시 계산해서 새로 저장하고,
// 직전 스냅샷과 비교해 순위 변동(change)을 기록한다.
const trendingSnapshotSchema = new mongoose.Schema({
  rankings: [{
    _id: false,
    keyword: { type: String, required: true },
    rank: { type: Number, required: true },
    change: { type: String, enum: ["up", "down", "same", "new"], required: true },
  }],
  computedAt: { type: Date, default: Date.now },
});

// 인덱스는 db/aPlanIndexes.js 참고
module.exports = mongoose.model("TrendingSnapshot", trendingSnapshotSchema);
