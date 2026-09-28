const mongoose = require("mongoose");

// 좋아요·스크랩·팔로우·댓글처럼 "원본 변경 + 카운트 $inc"를 함께 해야 하는 작업을 트랜잭션으로 묶는다.
// Atlas(레플리카셋)에서는 트랜잭션을 쓰고, 로컬 단독 mongod처럼 트랜잭션을 지원하지 않는
// 환경에서는 세션 없이 그대로 실행한다(카운트가 어긋나면 scripts/recount.js로 맞춘다).
let transactionsSupported = null;

const isTransactionUnsupported = (err) =>
  err?.code === 20 || /Transaction numbers are only allowed/i.test(err?.message || "");

const runInTransaction = async (fn) => {
  if (transactionsSupported === false) return fn(undefined);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    if (transactionsSupported === null && isTransactionUnsupported(err)) {
      transactionsSupported = false;
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { runInTransaction };
