// A안 인덱스 생성. 현재 인덱스와 추가할 인덱스를 비교해서 보여준다.
//   node scripts/indexes-a-plan.js                                → dry-run (목록만 출력)
//   node scripts/indexes-a-plan.js --apply --backup-confirmed     → 없는 인덱스만 생성
// 기존 인덱스는 삭제하지 않는다.
const { APPLY, run } = require("./_lib");
const definitions = require("../db/aPlanIndexes");

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (key) => JSON.stringify(key);
const describeOptions = (o = {}) =>
  [o.unique && "unique", o.expireAfterSeconds !== undefined && `TTL ${o.expireAfterSeconds}s`]
    .filter(Boolean)
    .join(", ");

const listIndexes = async (db, name) => {
  const exists = await db.listCollections({ name }).hasNext();
  return exists ? db.collection(name).indexes() : [];
};

run("indexes-a-plan", async (db) => {
  const collections = [...new Set(definitions.map((d) => d.collection))];
  const plan = [];

  for (const name of collections) {
    const current = await listIndexes(db, name);
    console.log(`\n[${name}] 현재 인덱스 ${current.length}개`);
    current.forEach((ix) => console.log(`    ${ix.name.padEnd(40)} ${fmt(ix.key)} ${describeOptions(ix)}`));

    for (const def of definitions.filter((d) => d.collection === name)) {
      const match = current.find((ix) => sameKey(ix.key, def.key));
      let status;
      if (!match) status = "create";
      else if (
        !!match.unique === !!def.options.unique &&
        match.expireAfterSeconds === def.options.expireAfterSeconds
      ) status = "exists";
      else status = "conflict";
      plan.push({ ...def, status, match });

      const mark = { create: "+ 추가", exists: "= 있음", conflict: "! 충돌" }[status];
      console.log(`  ${mark} ${fmt(def.key)} ${describeOptions(def.options)}`);
      if (status === "conflict") {
        console.log(`      같은 키의 기존 인덱스(${match.name})와 옵션이 달라 생성할 수 없습니다. 수동 확인 필요.`);
      }
      if (def.danger && status === "create") {
        console.log(`      ⚠️ ${def.danger}`);
        if (def.options.expireAfterSeconds !== undefined) {
          const field = Object.keys(def.key)[0];
          const cutoff = new Date(Date.now() - def.options.expireAfterSeconds * 1000);
          const affected = await db.collection(name).countDocuments({ [field]: { $lt: cutoff } });
          console.log(`      → 생성 즉시 삭제될 문서: ${affected}개`);
        }
      }
    }
  }

  const toCreate = plan.filter((p) => p.status === "create");
  console.log(`\n추가 ${toCreate.length}개 / 이미 있음 ${plan.filter((p) => p.status === "exists").length}개 / 충돌 ${plan.filter((p) => p.status === "conflict").length}개`);

  if (!APPLY) {
    console.log("변경 없음 (dry-run). 생성하려면 --apply --backup-confirmed");
    return;
  }
  for (const def of toCreate) {
    await db.collection(def.collection).createIndex(def.key, def.options);
    console.log(`  ✅ ${def.collection}.${def.options.name}`);
  }
});
