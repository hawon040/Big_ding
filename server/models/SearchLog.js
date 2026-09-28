const mongoose = require("mongoose");

// 인기 검색어 집계용 검색 기록 (7일 TTL). keyword는 정규화된 값(공백 제거·소문자)이다.
const searchLogSchema = new mongoose.Schema({
  keyword: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// 인덱스는 db/aPlanIndexes.js 참고
module.exports = mongoose.model("SearchLog", searchLogSchema);
