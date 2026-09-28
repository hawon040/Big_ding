const Post = require("../models/Post");
const JobState = require("../models/JobState");

// 인기글은 최근 7일 이내 글만 대상으로 한다.
const POPULAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// 시간 감쇠를 반영하려면 주기적으로 다시 계산해야 하는데, Render 무료 인스턴스는 잠들면
// cron이 돌지 않으므로 홈 피드 요청 시 마지막 계산이 이 간격보다 오래됐으면 다시 계산한다.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const JOB_KEY = "popularity";

// score = (좋아요×3 + 댓글×2 + 스크랩×4 + 조회×0.1) ÷ (경과시간(시간) + 2)^1.5
const computePopularity = (post, now = Date.now()) => {
  const hours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3600000);
  const raw =
    (post.likeCount || 0) * 3 +
    (post.commentCount || 0) * 2 +
    (post.scrapCount || 0) * 4 +
    (post.viewCount || 0) * 0.1;
  return raw / Math.pow(hours + 2, 1.5);
};

// 좋아요·댓글·스크랩·조회가 발생한 글 하나를 다시 계산한다.
const refreshPostPopularity = async (postId, session) => {
  const post = await Post.findById(postId)
    .select("createdAt likeCount commentCount scrapCount viewCount")
    .session(session || null)
    .lean();
  if (!post) return;
  await Post.updateOne(
    { _id: postId },
    { $set: { popularityScore: computePopularity(post) } },
    { session, timestamps: false }
  );
};

// 최근 7일 글 전체를 다시 계산한다.
const recomputeRecentPopularity = async () => {
  const now = Date.now();
  const posts = await Post.find({ createdAt: { $gte: new Date(now - POPULAR_WINDOW_MS) }, isDeleted: { $ne: true } })
    .select("createdAt likeCount commentCount scrapCount viewCount")
    .lean();
  if (posts.length > 0) {
    await Post.bulkWrite(
      posts.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { popularityScore: computePopularity(p, now) } },
          timestamps: false, // 점수 갱신은 글 수정이 아니므로 updatedAt을 건드리지 않는다
        },
      }))
    );
  }
  return posts.length;
};

// 작업 key의 lastRunAt이 interval보다 오래됐으면 지금 시각으로 갱신하고 true를 돌려준다.
// 조건부 갱신이라 동시에 들어온 요청 중 하나만 true를 받는다.
const claimJob = async (key, intervalMs) => {
  const now = new Date();
  const threshold = new Date(now.getTime() - intervalMs);
  const res = await JobState.updateOne(
    { key, $or: [{ lastRunAt: { $lt: threshold } }, { lastRunAt: { $exists: false } }] },
    { $set: { lastRunAt: now } }
  );
  if (res.modifiedCount === 1) return true;
  if (res.matchedCount === 1) return false;
  // 문서가 아직 없으면 처음 한 번 만든다 (이미 있으면 $setOnInsert라 아무것도 바뀌지 않음)
  const created = await JobState.updateOne({ key }, { $setOnInsert: { lastRunAt: now } }, { upsert: true });
  return created.upsertedCount === 1;
};

// 마지막 계산이 10분 이상 지났으면 백그라운드로 다시 계산한다. 요청은 기다리지 않는다.
const maybeRefreshPopularity = () => {
  claimJob(JOB_KEY, REFRESH_INTERVAL_MS)
    .then((claimed) => (claimed ? recomputeRecentPopularity() : null))
    .catch((err) => {
      // 동시에 문서를 처음 만들려다 unique 인덱스에 걸린 경우 → 다른 요청이 실행하므로 무시
      if (err?.code !== 11000) console.error("인기 점수 재계산 실패:", err.message);
    });
};

module.exports = {
  POPULAR_WINDOW_MS,
  claimJob,
  computePopularity,
  refreshPostPopularity,
  recomputeRecentPopularity,
  maybeRefreshPopularity,
};
