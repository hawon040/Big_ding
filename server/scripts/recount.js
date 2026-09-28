// 어긋난 카운트를 원본 데이터 기준으로 다시 계산한다. (migrate-a-plan.js 실행 이후에 사용)
//   node scripts/recount.js                                → dry-run (어긋난 문서 수와 예시 출력)
//   node scripts/recount.js --apply --backup-confirmed     → 실제 반영
//
// 원본 기준:
//   Post.likeCount/scrapCount = likes/scraps 배열 길이
//   Post.commentCount         = comments 컬렉션의 삭제되지 않은 댓글 수
//   User.postCount            = 삭제되지 않은 내 글 수
//   User.commentCount         = 삭제되지 않은 내 댓글 수
//   User.scrapCount           = 내가 스크랩한 삭제되지 않은 글 수
//   User.followerCount/followingCount = followers/following 배열 길이
// viewCount는 원본(PostView)이 24시간 뒤 사라지므로 재계산하지 않는다.
const { APPLY, run, bulkWriteInChunks } = require("./_lib");

const countBy = async (collection, pipeline) =>
  new Map((await collection.aggregate(pipeline).toArray()).map((r) => [String(r._id), r.n]));

const diffAndFix = async (label, collection, docs, expectedOf) => {
  const ops = [];
  const samples = [];
  for (const doc of docs) {
    const expected = expectedOf(doc);
    const set = {};
    for (const [k, v] of Object.entries(expected)) if (doc[k] !== v) set[k] = v;
    if (Object.keys(set).length === 0) continue;
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    if (samples.length < 5) {
      samples.push(`${doc._id}: ${Object.entries(set).map(([k, v]) => `${k} ${doc[k] ?? "없음"}→${v}`).join(", ")}`);
    }
  }
  console.log(`\n[${label}] 전체 ${docs.length}개 / 어긋남 ${ops.length}개`);
  samples.forEach((s) => console.log(`  ${s}`));
  if (APPLY && ops.length) {
    const res = await bulkWriteInChunks(collection, ops);
    console.log(`  ✅ 반영: ${res.modified}개 수정`);
  }
};

run("recount", async (db) => {
  const posts = db.collection("posts");
  const users = db.collection("users");
  const comments = db.collection("comments");

  // 마이그레이션 전이면 comments 컬렉션이 비어 있어서 댓글 수가 전부 0으로 계산된다 → 중단
  const [commentDocs, embeddedPosts] = await Promise.all([
    comments.estimatedDocumentCount(),
    posts.countDocuments({ "comments.0": { $exists: true } }),
  ]);
  if (commentDocs === 0 && embeddedPosts > 0) {
    console.error("comments 컬렉션이 비어 있습니다. migrate-a-plan.js를 먼저 실행하세요.");
    return;
  }

  const liveComments = { $match: { isDeleted: { $ne: true } } };
  const commentsPerPost = await countBy(comments, [liveComments, { $group: { _id: "$post", n: { $sum: 1 } } }]);
  const commentsPerUser = await countBy(comments, [liveComments, { $group: { _id: "$author", n: { $sum: 1 } } }]);
  const postsPerUser = await countBy(posts, [
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: "$author", n: { $sum: 1 } } },
  ]);
  const scrapsPerUser = await countBy(posts, [
    { $match: { isDeleted: { $ne: true } } },
    { $unwind: "$scraps" },
    { $group: { _id: "$scraps", n: { $sum: 1 } } },
  ]);

  const postDocs = await posts
    .find({}, { projection: { likeCount: 1, scrapCount: 1, commentCount: 1, likes: 1, scraps: 1 } })
    .toArray();
  await diffAndFix("Post", posts, postDocs, (p) => ({
    likeCount: (p.likes || []).length,
    scrapCount: (p.scraps || []).length,
    commentCount: commentsPerPost.get(String(p._id)) || 0,
  }));

  const userDocs = await users
    .find({}, {
      projection: {
        postCount: 1, commentCount: 1, scrapCount: 1, followerCount: 1, followingCount: 1,
        followers: 1, following: 1,
      },
    })
    .toArray();
  await diffAndFix("User", users, userDocs, (u) => {
    const id = String(u._id);
    return {
      postCount: postsPerUser.get(id) || 0,
      commentCount: commentsPerUser.get(id) || 0,
      scrapCount: scrapsPerUser.get(id) || 0,
      followerCount: (u.followers || []).length,
      followingCount: (u.following || []).length,
    };
  });

  if (!APPLY) console.log("\n변경 없음 (dry-run). 반영하려면 --apply --backup-confirmed");
});
