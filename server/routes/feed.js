// /api/feed — 홈 피드 (관심 주제 인기순)
const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const auth = require("../middleware/authMiddleware");
const { TOPICS, TOPIC_KEYS } = require("../constants/topics");
const { getViewerContext, visiblePostsFilter } = require("../utils/access");
const { parseLimit, decodeCursor, pageBy, BadCursorError } = require("../utils/pagination");
const { AUTHOR_FIELDS, cardProjection, toPostCard } = require("../utils/serializers");
const { POPULAR_WINDOW_MS, maybeRefreshPopularity } = require("../utils/popularity");
const v = require("../utils/validate");

// GET /api/feed/topics — 홈 상단 주제 칩: 전체 + 내 관심 주제(온보딩에서 고른 순서)
router.get("/topics", auth, async (req, res) => {
  try {
    const { me } = await getViewerContext(req.user.id);
    const mine = (me.interests || []).map((key) => TOPICS.find((t) => t.key === key)).filter(Boolean);
    res.json({ items: [{ key: "all", label: "전체", shortLabel: "전체" }, ...mine] });
  } catch (err) {
    v.handleError(res, err);
  }
});

// 피드 커서는 두 구간을 이어서 넘긴다.
//  t: 주제가 맞는 최근 7일 인기글  →  g: 나머지 전체 인기글(부족분 채우기)
const encodeFeedCursor = (phase, inner) => Buffer.from(JSON.stringify({ p: phase, c: inner })).toString("base64url");
const decodeFeedCursor = (raw) => {
  if (raw === undefined || raw === "") return null;
  try {
    const { p, c } = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
    if (!["t", "g"].includes(p)) throw new Error();
    return { phase: p, inner: c ? decodeCursor(c) : null };
  } catch {
    throw new BadCursorError("잘못된 커서입니다.");
  }
};

// GET /api/feed?topic=all|<key>&cursor=&limit=
router.get("/", auth, async (req, res) => {
  try {
    maybeRefreshPopularity(); // 시간 감쇠 반영 (마지막 계산이 10분 넘었으면 백그라운드 재계산)

    const topic = req.query.topic || "all";
    if (topic !== "all" && !TOPIC_KEYS.includes(topic)) v.fail("알 수 없는 주제입니다.");
    const limit = parseLimit(req.query.limit);
    const cursor = decodeFeedCursor(req.query.cursor);

    const ctx = await getViewerContext(req.user.id);
    const topicKeys = topic === "all" ? ctx.me.interests || [] : [topic];
    const since = new Date(Date.now() - POPULAR_WINDOW_MS);
    const base = visiblePostsFilter(ctx);
    const matched = { $and: [base, { topics: { $in: topicKeys } }, { createdAt: { $gte: since } }] };
    const rest = topicKeys.length
      ? { $and: [base, { $or: [{ topics: { $nin: topicKeys } }, { createdAt: { $lt: since } }] }] }
      : base;

    const page = (filter, pageCursor, pageLimit) => pageBy({
      model: Post,
      filter,
      field: "popularityScore",
      cursor: pageCursor,
      limit: pageLimit,
      build: (q) => q.select(cardProjection(req.user.id)).populate("author", AUTHOR_FIELDS).lean(),
    });

    let phase = cursor?.phase || (topicKeys.length ? "t" : "g");
    let docs = [];
    let nextCursor = null;

    if (phase === "t") {
      const first = await page(matched, cursor?.inner, limit);
      docs = first.docs;
      if (first.nextCursor) {
        nextCursor = encodeFeedCursor("t", first.nextCursor);
      } else {
        phase = "g";
        const remaining = limit - docs.length;
        if (remaining > 0) {
          const fill = await page(rest, null, remaining);
          docs = docs.concat(fill.docs);
          nextCursor = fill.nextCursor ? encodeFeedCursor("g", fill.nextCursor) : null;
        } else {
          nextCursor = encodeFeedCursor("g", null);
        }
      }
    } else {
      const result = await page(rest, cursor?.inner, limit);
      docs = result.docs;
      nextCursor = result.nextCursor ? encodeFeedCursor("g", result.nextCursor) : null;
    }

    res.json({ items: docs.map((p) => toPostCard(p, req.user.id)), nextCursor });
  } catch (err) {
    v.handleError(res, err);
  }
});

module.exports = router;
