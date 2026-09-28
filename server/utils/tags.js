// 해시태그 정규화: 앞의 #과 공백을 제거하고 소문자로, 빈 값·중복은 제거한다.
// 개수 제한(MAX_POST_TAGS)은 새 글 작성/수정 API에서 검증한다.
const normalizeTag = (tag) =>
  String(tag ?? "")
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
};

module.exports = { normalizeTag, normalizeTags };
