// A안 데이터 마이그레이션.
//   node scripts/migrate-a-plan.js                                  → dry-run (영향 문서 수만 출력)
//   node scripts/migrate-a-plan.js --apply --backup-confirmed       → 실제 반영
//
// 여러 번 실행해도 결과가 같다(이미 반영된 문서는 건너뜀).
//  1. Post: topics 빈 배열, 태그 정규화, 카운트(좋아요·스크랩·댓글) 실제 값, 조회수 0,
//           isDeleted false, 인기 점수 계산. board 값은 바꾸지 않는다.
//  2. Comment: Post에 임베드된 댓글을 같은 _id로 comments 컬렉션에 복사 (임베드 원본은 유지)
//  3. User: interests 빈 배열, onboardingCompleted false(없을 때만), 기본 설정값, 카운트 계산
//  4. Notification: 일반 알림에 expiresAt(생성일+90일). 제재·처리 결과 알림은 비워둠
const { APPLY, run, bulkWriteInChunks } = require("./_lib");
const { BOARD_KEYS } = require("../constants/boards");
const { MAX_POST_TAGS } = require("../constants/topics");
const { normalizeTags } = require("../utils/tags");
const { PERSISTENT_TYPES, NOTIFICATION_TTL_MS } = require("../models/Notification");
const { computePopularity, POPULAR_WINDOW_MS } = require("../utils/popularity");

const TITLE_MAX = 100;
const CONTENT_MAX = 20000;

const sameArray = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

const migratePosts = async (db, now) => {
  const posts = db.collection("posts");
  const cursor = posts.find({}, {
    projection: {
      board: 1, title: 1, content: 1, tags: 1, topics: 1, createdAt: 1,
      likes: 1, scraps: 1, comments: 1,
      viewCount: 1, likeCount: 1, commentCount: 1, scrapCount: 1, popularityScore: 1,
      isDeleted: 1, acceptedCommentId: 1,
    },
  });

  const ops = [];
  const boardCounts = {};
  const stats = { total: 0, toUpdate: 0, tagsNormalized: 0, unknownBoard: 0, titleTooLong: 0, contentTooLong: 0, tooManyTags: 0 };

  for await (const p of cursor) {
    stats.total++;
    boardCounts[p.board] = (boardCounts[p.board] || 0) + 1;
    if (!BOARD_KEYS.includes(p.board)) stats.unknownBoard++;
    if ((p.title || "").length > TITLE_MAX) stats.titleTooLong++;
    if ((p.content || "").length > CONTENT_MAX) stats.contentTooLong++;

    const counts = {
      likeCount: (p.likes || []).length,
      scrapCount: (p.scraps || []).length,
      commentCount: (p.comments || []).length,
      viewCount: p.viewCount ?? 0,
    };
    const set = {};
    for (const [k, v] of Object.entries(counts)) if (p[k] !== v) set[k] = v;

    // 점수는 시간에 따라 계속 변하므로, 다시 실행할 때는 인기글 대상(최근 7일)만 새로 계산한다.
    const isRecent = now - new Date(p.createdAt).getTime() < POPULAR_WINDOW_MS;
    if (p.popularityScore === undefined || isRecent) {
      const score = computePopularity({ ...counts, createdAt: p.createdAt }, now);
      if (p.popularityScore !== score) set.popularityScore = score;
    }

    if (!Array.isArray(p.topics)) set.topics = [];
    const tags = normalizeTags(p.tags);
    if (!sameArray(p.tags, tags)) {
      set.tags = tags;
      if ((p.tags || []).length > 0) stats.tagsNormalized++;
    }
    if (tags.length > MAX_POST_TAGS) stats.tooManyTags++;
    if (p.isDeleted === undefined) set.isDeleted = false;
    if (p.acceptedCommentId === undefined) set.acceptedCommentId = null;

    if (Object.keys(set).length > 0) {
      stats.toUpdate++;
      ops.push({ updateOne: { filter: { _id: p._id }, update: { $set: set } } });
    }
  }

  console.log("\n[Post]");
  console.log(`  전체 ${stats.total}개 / 갱신 대상 ${stats.toUpdate}개`);
  console.log("  게시판별 글 수 (board 값은 변경하지 않음):");
  for (const [board, n] of Object.entries(boardCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${board.padEnd(12)} ${n}`);
  }
  console.log(`  태그 정규화(소문자·공백/# 제거·중복 제거)로 바뀌는 글: ${stats.tagsNormalized}개`);
  console.log("  참고 — 새 규칙을 넘는 기존 글 (데이터는 그대로 두고, 새 작성/수정부터 적용):");
  console.log(`    제목 ${TITLE_MAX}자 초과 ${stats.titleTooLong} / 본문 ${CONTENT_MAX}자 초과 ${stats.contentTooLong} / 태그 ${MAX_POST_TAGS}개 초과 ${stats.tooManyTags}`);
  if (stats.unknownBoard) console.log(`  ⚠️ BOARDS에 없는 board 값: ${stats.unknownBoard}개`);

  if (APPLY && ops.length) {
    const res = await bulkWriteInChunks(posts, ops);
    console.log(`  ✅ 반영: ${res.modified}개 수정`);
  }
};

const migrateComments = async (db) => {
  const posts = db.collection("posts");
  const comments = db.collection("comments");

  const embedded = await posts.aggregate([
    { $match: { "comments.0": { $exists: true } } },
    { $unwind: "$comments" },
    { $project: { post: "$_id", c: "$comments" } },
  ]).toArray();

  const existingIds = new Set(
    (await comments.find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id))
  );

  const ops = [];
  for (const { post, c } of embedded) {
    if (existingIds.has(String(c._id))) continue;
    ops.push({
      updateOne: {
        filter: { _id: c._id },
        update: {
          $setOnInsert: {
            post,
            author: c.author,
            content: c.content,
            parentId: c.parentComment || null,
            isAccepted: false,
            isDeleted: false,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt || c.createdAt,
          },
        },
        upsert: true,
      },
    });
  }

  console.log("\n[Comment]");
  console.log(`  임베드 댓글 ${embedded.length}개 / 이미 복사됨 ${embedded.length - ops.length}개 / 새로 복사 ${ops.length}개`);
  console.log("  (Post.comments 임베드 원본은 삭제하지 않음)");

  if (APPLY && ops.length) {
    const res = await bulkWriteInChunks(comments, ops);
    console.log(`  ✅ 반영: ${res.upserted}개 복사`);
  }
};

const countBy = async (posts, pipeline) =>
  new Map((await posts.aggregate(pipeline).toArray()).map((r) => [String(r._id), r.n]));

const migrateUsers = async (db) => {
  const posts = db.collection("posts");
  const users = db.collection("users");

  const postCounts = await countBy(posts, [
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$author", n: { $sum: 1 } } },
  ]);
  const commentCounts = await countBy(posts, [
    { $unwind: "$comments" },
    { $group: { _id: "$comments.author", n: { $sum: 1 } } },
  ]);
  const scrapCounts = await countBy(posts, [
    { $match: { isDeleted: { $ne: true } } },
    { $unwind: "$scraps" },
    { $group: { _id: "$scraps", n: { $sum: 1 } } },
  ]);

  const cursor = users.find({}, {
    projection: {
      followers: 1, following: 1, interests: 1, onboardingCompleted: 1,
      notificationSettings: 1, appSettings: 1, recentSearches: 1,
      postCount: 1, commentCount: 1, scrapCount: 1, followerCount: 1, followingCount: 1,
    },
  });

  const ops = [];
  const stats = { total: 0, toUpdate: 0, toOnboarding: 0 };
  for await (const u of cursor) {
    stats.total++;
    const id = String(u._id);
    const counts = {
      postCount: postCounts.get(id) || 0,
      commentCount: commentCounts.get(id) || 0,
      scrapCount: scrapCounts.get(id) || 0,
      followerCount: (u.followers || []).length,
      followingCount: (u.following || []).length,
    };
    const set = {};
    for (const [k, v] of Object.entries(counts)) if (u[k] !== v) set[k] = v;

    if (!Array.isArray(u.interests)) set.interests = [];
    if (u.onboardingCompleted === undefined) {
      set.onboardingCompleted = false;
      stats.toOnboarding++;
    }
    const ns = u.notificationSettings || {};
    if (ns.comment === undefined) set["notificationSettings.comment"] = true;
    if (ns.studyRecruit === undefined) set["notificationSettings.studyRecruit"] = true;
    if (ns.marketing === undefined) set["notificationSettings.marketing"] = false;
    if (u.appSettings?.darkMode === undefined) set["appSettings.darkMode"] = false;
    if (!Array.isArray(u.recentSearches)) set.recentSearches = [];

    if (Object.keys(set).length > 0) {
      stats.toUpdate++;
      ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: set } } });
    }
  }

  console.log("\n[User]");
  console.log(`  전체 ${stats.total}명 / 갱신 대상 ${stats.toUpdate}명`);
  console.log(`  다음 로그인 때 온보딩으로 이동할 사용자: ${stats.toOnboarding}명`);

  if (APPLY && ops.length) {
    const res = await bulkWriteInChunks(users, ops);
    console.log(`  ✅ 반영: ${res.modified}명 수정`);
  }
};

// 기존 일반 알림에 expiresAt(생성일+90일)을 채운다. 제재·처리 결과 알림은 비워서 영구 보관.
const migrateNotifications = async (db, now) => {
  const notifications = db.collection("notifications");
  const filter = { expiresAt: { $exists: false }, type: { $nin: PERSISTENT_TYPES } };
  const [target, alreadyExpired, persistent] = await Promise.all([
    notifications.countDocuments(filter),
    notifications.countDocuments({ ...filter, createdAt: { $lt: new Date(now - NOTIFICATION_TTL_MS) } }),
    notifications.countDocuments({ type: { $in: PERSISTENT_TYPES } }),
  ]);

  console.log("\n[Notification]");
  console.log(`  expiresAt 채울 일반 알림 ${target}개 (그중 이미 90일 지나 TTL 인덱스 생성 시 삭제될 알림 ${alreadyExpired}개)`);
  console.log(`  영구 보관(제재·신고/문의 처리 결과) 알림 ${persistent}개`);

  if (APPLY && target) {
    const res = await notifications.updateMany(filter, [
      { $set: { expiresAt: { $add: ["$createdAt", NOTIFICATION_TTL_MS] } } },
    ]);
    console.log(`  ✅ 반영: ${res.modifiedCount}개 수정`);
  }
};

run("migrate-a-plan", async (db) => {
  const now = Date.now();
  await migratePosts(db, now);
  await migrateComments(db);
  await migrateUsers(db);
  await migrateNotifications(db, now);
  if (!APPLY) console.log("\n변경 없음 (dry-run). 반영하려면 --apply --backup-confirmed");
});
