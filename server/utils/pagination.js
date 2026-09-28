const mongoose = require("mongoose");

// 커서 기반 페이지네이션. 정렬 필드(내림차순) + _id(내림차순)로 이어서 가져온다.
// 응답: { items, nextCursor } — nextCursor가 null이면 마지막 페이지.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseLimit = (raw) => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(MAX_LIMIT, Math.max(1, n)) : DEFAULT_LIMIT;
};

// 기존 클라이언트는 목록 API가 배열 전체를 준다고 가정한다. cursor나 limit를 보낸
// 요청만 새 응답 형태({items, nextCursor})로 돌려준다.
const wantsPage = (query) => query.cursor !== undefined || query.limit !== undefined;

const encodeCursor = (value, id) =>
  Buffer.from(JSON.stringify({
    v: value instanceof Date ? value.toISOString() : value,
    d: value instanceof Date,
    id: String(id),
  })).toString("base64url");

// 잘못된 커서면 BadCursorError를 던진다 (라우트에서 400으로 응답)
class BadCursorError extends Error {
  name = "BadCursorError";
}

const decodeCursor = (raw) => {
  if (raw === undefined || raw === "") return null;
  try {
    const c = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
    if (!mongoose.Types.ObjectId.isValid(c.id)) throw new Error();
    return { value: c.d ? new Date(c.v) : c.v, id: new mongoose.Types.ObjectId(c.id) };
  } catch {
    throw new BadCursorError("잘못된 커서입니다.");
  }
};

const seekFilter = (field, cursor) => ({
  $or: [
    { [field]: { $lt: cursor.value } },
    { [field]: cursor.value, _id: { $lt: cursor.id } },
  ],
});

// model.find(filter)를 field 내림차순으로 limit개 가져온다. build로 select/populate를 붙인다.
const pageBy = async ({ model, filter, field = "createdAt", cursor, limit, build }) => {
  const finalFilter = cursor ? { $and: [filter, seekFilter(field, cursor)] } : filter;
  let query = model.find(finalFilter).sort({ [field]: -1, _id: -1 }).limit(limit + 1);
  if (build) query = build(query);
  const docs = await query;
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  return { docs: page, nextCursor: hasMore ? encodeCursor(last[field], last._id) : null };
};

module.exports = { parseLimit, wantsPage, encodeCursor, decodeCursor, pageBy, BadCursorError };
