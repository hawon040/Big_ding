const mongoose = require("mongoose");
const { TOPIC_KEYS, MAX_POST_TOPICS, MAX_POST_TAGS, MIN_INTERESTS } = require("../constants/topics");
const { normalizeTags } = require("./tags");

// 입력 검증 헬퍼. 실패하면 ValidationError를 던지고 라우트에서 400으로 응답한다.
class ValidationError extends Error {
  name = "InputValidationError";
}

const fail = (message) => {
  throw new ValidationError(message);
};

// 권한 없음(403)·없음(404)·충돌(409) 등을 서비스 함수에서 던질 때 사용
class HttpError extends Error {
  name = "HttpError";
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v);

// multipart/form-data로 온 배열·객체 필드는 JSON 문자열이다.
const parseJsonField = (value, name) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fail(`${name} 형식이 올바르지 않습니다.`);
  }
};

const requireString = (value, name, { min = 1, max }) => {
  if (typeof value !== "string") fail(`${name}을(를) 입력해주세요.`);
  const trimmed = value.trim();
  if (trimmed.length < min) fail(`${name}을(를) 입력해주세요.`);
  if (max && trimmed.length > max) fail(`${name}은(는) ${max}자 이하로 입력해주세요.`);
  return trimmed;
};

const topicList = (value, { min, max, name }) => {
  if (!Array.isArray(value)) fail(`${name}을(를) 선택해주세요.`);
  const unique = [...new Set(value)];
  if (unique.some((t) => !TOPIC_KEYS.includes(t))) fail(`알 수 없는 ${name}이(가) 있습니다.`);
  if (unique.length < min) fail(`${name}을(를) ${min}개 이상 선택해주세요.`);
  if (max && unique.length > max) fail(`${name}은(는) 최대 ${max}개까지 선택할 수 있습니다.`);
  return unique;
};

const postTopics = (value) => topicList(value, { min: 1, max: MAX_POST_TOPICS, name: "주제" });
const interests = (value) => topicList(value, { min: MIN_INTERESTS, name: "관심 분야" });

const postTags = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail("태그 형식이 올바르지 않습니다.");
  const tags = normalizeTags(value);
  if (tags.length > MAX_POST_TAGS) fail(`태그는 최대 ${MAX_POST_TAGS}개까지 추가할 수 있습니다.`);
  if (tags.some((t) => t.length > 30)) fail("태그는 30자 이하로 입력해주세요.");
  return tags;
};

const optionalBoolean = (value, name) => {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(`${name} 값이 올바르지 않습니다.`);
  return value;
};

// 라우트 공통 에러 처리: 검증·커서 오류는 400, 나머지는 500
const handleError = (res, err) => {
  if (err?.name === "InputValidationError" || err?.name === "BadCursorError") {
    return res.status(400).json({ message: err.message });
  }
  if (err?.name === "HttpError") return res.status(err.status).json({ message: err.message });
  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return res.status(400).json({ message: "입력값이 올바르지 않습니다." });
  }
  console.error(err);
  return res.status(500).json({ message: "서버 오류" });
};

module.exports = {
  ValidationError,
  HttpError,
  fail,
  isId,
  parseJsonField,
  requireString,
  postTopics,
  interests,
  postTags,
  optionalBoolean,
  handleError,
};
