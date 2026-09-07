// 학번+교수 인증번호(2자리)는 무차별 대입에 취약하므로, IP 기준 rate limit과 별개로
// "이 학번을 대상으로 한 시도"를 계정 단위로도 제한한다. 서버 재시작 시 초기화되는
// 메모리 기반 제한이지만, 짧은 시간에 여러 학번을 자동화 스크립트로 훑는 것을 막는
// 최소한의 안전장치는 된다.
const attempts = new Map(); // key -> { count, firstAttemptAt, lockedUntil }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000;

const checkAndRecordAttempt = (key) => {
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
    return { allowed: false, retryAfterMs: LOCK_MS };
  }
  return { allowed: true };
};

const resetAttempts = (key) => {
  attempts.delete(key);
};

module.exports = { checkAndRecordAttempt, resetAttempts };
