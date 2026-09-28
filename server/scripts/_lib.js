// DB 스크립트 공통: .env 로드, 접속 대상 표시(계정 정보는 가림), 실행 플래그 처리.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const BACKUP_CONFIRMED = args.includes("--backup-confirmed");

// mongodb://user:pass@host1,host2/db?opts → host1,host2/db (계정·옵션 제외)
const describeTarget = (uri) => {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/?([^?]*)/.exec(uri || "");
  if (!m) return "(알 수 없는 MONGO_URI)";
  return `${m[1]}/${m[2] || "(기본 DB)"}`;
};

const connect = async (scriptName) => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI가 설정되어 있지 않습니다 (server/.env).");
    process.exit(1);
  }
  if (APPLY && !BACKUP_CONFIRMED) {
    console.error("--apply는 Atlas 백업(스냅샷)을 확인한 뒤 --backup-confirmed와 함께 실행하세요.");
    process.exit(1);
  }
  console.log(`[${scriptName}] 모드: ${APPLY ? "APPLY (실제 변경)" : "DRY-RUN (변경 없음)"}`);
  console.log(`[${scriptName}] 대상: ${describeTarget(process.env.MONGO_URI)}`);
  await mongoose.connect(process.env.MONGO_URI);
  return mongoose.connection.db;
};

// 대량 쓰기는 500개씩 나눠서 보낸다.
const bulkWriteInChunks = async (collection, ops, size = 500) => {
  let modified = 0;
  let upserted = 0;
  for (let i = 0; i < ops.length; i += size) {
    const res = await collection.bulkWrite(ops.slice(i, i + size), { ordered: false });
    modified += res.modifiedCount;
    upserted += res.upsertedCount;
  }
  return { modified, upserted };
};

const run = (scriptName, main) => {
  connect(scriptName)
    .then(main)
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error(`[${scriptName}] 실패:`, err);
      await mongoose.disconnect();
      process.exit(1);
    });
};

module.exports = { APPLY, run, bulkWriteInChunks };
