const mongoose = require("mongoose");

// 주기 작업의 마지막 실행 시각. Render 무료 인스턴스는 유휴 시 잠들어 cron이 돌지 않으므로,
// 요청이 들어왔을 때 lastRunAt이 오래됐으면 그때 작업을 실행하는 지연 갱신 방식에 쓴다.
const jobStateSchema = new mongoose.Schema({
  key: { type: String, required: true },
  lastRunAt: { type: Date },
});

// 인덱스는 db/aPlanIndexes.js 참고

module.exports = mongoose.model("JobState", jobStateSchema);
