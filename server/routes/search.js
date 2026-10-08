// /api/search — 검색(제목·태그 정규식), 최근 검색어, 인기 검색어
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const SearchLog = require("../models/SearchLog");
const TrendingSnapshot = require("../models/TrendingSnapshot");
const auth = require("../middleware/authMiddleware");
const { filterProfanity } = require("../middleware/profanityFilter");
const { escapeRegex } = require("../utils/regex");
const { normalizeTag } = require("../utils/tags");
const { getViewerContext, visiblePostsFilter, includesId } = require("../utils/access");
const { parseLimit, decodeCursor, pageBy } = require("../utils/pagination");
const { AUTHOR_FIELDS, cardProjection, toPostCard, toUserSummary } = require("../utils/serializers");
const v = require("../utils/validate");

const QUERY_MAX = 50;
const RECENT_MAX = 10;
const TRENDING_SIZE = 10;
const HOUR_MS = 60 * 60 * 1000;

// 인기 검색어 집계용 정규화: 공백 제거·소문자, 2글자 미만·비속어 제외(null)
const normalizeKeyword = (q) => {
  const k = String(q).replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
  if (k.length < 2) return null;
  if (filterProfanity(k) !== k) return null;
  return k;
};

// 최근 검색어: 맨 앞에 추가하고 같은 검색어는 지우고 최대 10개만 남긴다.
const pushRecentSearch = (userId, keyword) =>
  User.updateOne({ _id: userId }, [
    {
      $set: {
        recentSearches: {
          $slice: [
            {
              $concatArrays: [
                [{ keyword: { $literal: keyword }, searchedAt: "$$NOW" }],
                {
                  $filter: {
                    input: { $ifNull: ["$recentSearches", []] },
                    cond: { $ne: ["$$this.keyword", { $literal: keyword }] },
                  },
                },
              ],
            },
            RECENT_MAX,
          ],
        },
      },
    },
  ]);

const recordSearch = async (userId, q) => {
  const keyword = normalizeKeyword(q);
  await Promise.all([
    pushRecentSearch(userId, q),
    keyword ? SearchLog.create({ keyword }) : null,
  ]);
};

// GET /api/search?q=&type=post|user|tag&cursor=&limit=
//  - q가 #으로 시작하면 해당 태그가 달린 글 검색
//  - 조회만 수행한다. 검색 기록은 명시적인 실행 요청에서만 POST /history로 남긴다.
router.get("/", auth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) v.fail("검색어를 입력해주세요.");
    if (q.length > QUERY_MAX) v.fail(`검색어는 ${QUERY_MAX}자 이하로 입력해주세요.`);
    const type = req.query.type || "post";
    if (!["post", "user", "tag"].includes(type)) v.fail("검색 유형이 올바르지 않습니다.");
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const ctx = await getViewerContext(req.user.id);

    const isTagQuery = q.startsWith("#");
    const term = isTagQuery ? normalizeTag(q) : q;
    if (!term) v.fail("검색어를 입력해주세요.");

    if (type === "post") {
      const match = isTagQuery
        ? { tags: term }
        : {
          $or: [
            { title: { $regex: escapeRegex(term), $options: "i" } },
            { tags: { $regex: escapeRegex(normalizeTag(term)) } },
          ],
        };
      const { docs, nextCursor } = await pageBy({
        model: Post,
        filter: { $and: [visiblePostsFilter(ctx), match] },
        cursor,
        limit,
        build: (query) => query.select(cardProjection(req.user.id)).populate("author", AUTHOR_FIELDS).lean(),
      });
      return res.json({ items: docs.map((p) => toPostCard(p, req.user.id)), nextCursor });
    }

    if (type === "user") {
      const { docs, nextCursor } = await pageBy({
        model: User,
        filter: {
          _id: { $nin: ctx.excluded },
          isWithdrawn: { $ne: true },
          nickname: { $regex: escapeRegex(term), $options: "i" },
        },
        cursor,
        limit,
        build: (query) => query.select(`${AUTHOR_FIELDS} bio createdAt`).lean(),
      });
      return res.json({
        items: docs.map((u) => toUserSummary(u, { isFollowing: includesId(ctx.me.following, u._id) })),
        nextCursor,
      });
    }

    // type === "tag": 태그 이름 앞부분이 일치하는 태그와 글 수 (많은 순 20개)
    const tags = await Post.aggregate([
      { $match: { $and: [visiblePostsFilter(ctx), { tags: { $regex: `^${escapeRegex(normalizeTag(term))}` } }] } },
      { $unwind: "$tags" },
      { $match: { tags: { $regex: `^${escapeRegex(normalizeTag(term))}` } } },
      { $group: { _id: "$tags", postCount: { $sum: 1 } } },
      { $sort: { postCount: -1, _id: 1 } },
      { $limit: 20 },
    ]);
    res.json({ items: tags.map((t) => ({ tag: t._id, postCount: t.postCount })), nextCursor: null });
  } catch (err) {
    v.handleError(res, err);
  }
});

// POST /api/search/history — 사용자가 검색을 명시적으로 실행했을 때만 최근·인기 검색어에 기록
router.post("/history", auth, async (req, res) => {
  try {
    const q = typeof req.body?.keyword === "string" ? req.body.keyword.trim() : "";
    if (!q) v.fail("검색어를 입력해주세요.");
    if (q.length > QUERY_MAX) v.fail(`검색어는 ${QUERY_MAX}자 이하로 입력해주세요.`);
    const term = q.startsWith("#") ? normalizeTag(q) : q;
    if (!term) v.fail("검색어를 입력해주세요.");
    await recordSearch(req.user.id, q);
    res.status(201).json({ message: "검색 기록이 저장되었습니다." });
  } catch (err) {
    v.handleError(res, err);
  }
});

// GET /api/search/recent — 최근 검색어(최신순)
router.get("/recent", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("recentSearches").lean();
    res.json({ items: me?.recentSearches || [] });
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/search/recent/:keyword — 하나 삭제
router.delete("/recent/:keyword", auth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $pull: { recentSearches: { keyword: req.params.keyword } } });
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    v.handleError(res, err);
  }
});

// DELETE /api/search/recent — 전체 삭제
router.delete("/recent", auth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $set: { recentSearches: [] } });
    res.json({ message: "삭제되었습니다." });
  } catch (err) {
    v.handleError(res, err);
  }
});

// 인기 검색어: 최근 1시간 검색 기록을 검색어별로 세어 Top 10, 직전 스냅샷과 비교해 순위 변동 표시.
// 매시 정각 기준으로 스냅샷을 하나씩 만든다. cron 대신 요청이 들어왔을 때 이번 시각의
// 스냅샷이 없으면 계산한다(Render 무료 인스턴스가 잠들어도 동작).
const computeTrending = async (hourStart) => {
  const counts = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - HOUR_MS) } } },
    { $group: { _id: "$keyword", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: TRENDING_SIZE },
  ]);
  const previous = await TrendingSnapshot.findOne({ computedAt: { $lt: hourStart } }).sort({ computedAt: -1 }).lean();
  const prevRank = new Map((previous?.rankings || []).map((r) => [r.keyword, r.rank]));
  const rankings = counts.map((c, i) => {
    const rank = i + 1;
    const before = prevRank.get(c._id);
    const change = before === undefined ? "new" : before > rank ? "up" : before < rank ? "down" : "same";
    return { keyword: c._id, rank, change };
  });
  // 같은 시각 스냅샷은 하나만 (동시에 계산돼도 먼저 저장된 것을 쓴다)
  await TrendingSnapshot.updateOne(
    { computedAt: hourStart },
    { $setOnInsert: { rankings } },
    { upsert: true }
  );
  return TrendingSnapshot.findOne({ computedAt: hourStart }).lean();
};

// GET /api/search/trending — { items: [{keyword, rank, change}], computedAt }
router.get("/trending", auth, async (req, res) => {
  try {
    const hourStart = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
    let snapshot = await TrendingSnapshot.findOne({ computedAt: hourStart }).lean();
    if (!snapshot) snapshot = await computeTrending(hourStart);
    res.json({ items: snapshot.rankings, computedAt: snapshot.computedAt });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
