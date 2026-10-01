const { setupDb, createUser, api, Post } = require("./helpers");
const Feed = require("../models/Feed");
const FeedComment = require("../models/FeedComment");
const Notification = require("../models/Notification");

// 실제 Cloudinary로 올리지 않도록 막는다.
jest.mock("../config/cloudinary", () => ({
  uploadImage: jest.fn(async (buffer, folder) => ({ secure_url: `https://img.test/${folder}/${buffer.length}.jpg` })),
}));

setupDb();

const png = Buffer.from("89504e470d0a1a0a", "hex");
const postFeed = (token, { images = 1, content, topics } = {}) => {
  let req = api(token).post("/api/feeds");
  for (let i = 0; i < images; i += 1) req = req.attach("images", png, { filename: `p${i}.png`, contentType: "image/png" });
  if (content !== undefined) req = req.field("content", content);
  if (topics) req = req.field("topics", JSON.stringify(topics));
  return req;
};

describe("피드 작성", () => {
  test("사진 없이는 400, 사진이 있으면 feeds 컬렉션에만 저장된다 (posts는 그대로)", async () => {
    const me = await createUser();
    const none = await api(me.token).post("/api/feeds").field("content", "글만");
    expect(none.status).toBe(400);

    const ok = await postFeed(me.token, { images: 2, content: "오늘의 사진", topics: ["python"] });
    expect(ok.status).toBe(201);
    expect(ok.body.images).toHaveLength(2);
    expect(await Feed.countDocuments()).toBe(1);
    expect(await Post.countDocuments()).toBe(0);
  });

  test("사진 11장·주제 4개·너무 긴 내용은 400, 인증 없으면 401", async () => {
    const me = await createUser();
    expect((await postFeed(me.token, { images: 11 })).status).toBe(400);
    expect((await postFeed(me.token, { topics: ["python", "sql", "ml", "dl"] })).status).toBe(400);
    expect((await postFeed(me.token, { content: "가".repeat(1001) })).status).toBe(400);
    expect((await postFeed(null)).status).toBe(401);
  });
});

describe("피드 알림", () => {
  test("좋아요(중복 제외)·댓글은 작성자에게 feed 알림, 본인에게는 없음", async () => {
    const a = await createUser();
    const b = await createUser();
    const feed = (await postFeed(a.token)).body;
    await api(b.token).post(`/api/feeds/${feed.id}/like`);
    await api(b.token).post(`/api/feeds/${feed.id}/like`);
    await api(b.token).post(`/api/feeds/${feed.id}/comments`).send({ content: "좋아요" });
    await api(a.token).post(`/api/feeds/${feed.id}/comments`).send({ content: "감사" });
    await new Promise((r) => setTimeout(r, 200));
    const notes = await Notification.find({}).sort({ createdAt: 1 });
    expect(notes.map((n) => [n.type, String(n.recipient), String(n.feed)])).toEqual([
      ["like", a.id, feed.id],
      ["comment", a.id, feed.id],
    ]);
    const list = await api(a.token).get("/api/notifications?limit=10");
    expect(list.body.items[0].feedId).toBe(feed.id);
  });
});

describe("피드 목록·상호작용", () => {
  test("최신순 목록, 주제 필터, 차단한 사람의 피드는 숨김", async () => {
    const a = await createUser();
    const b = await createUser();
    await postFeed(a.token, { topics: ["python"], content: "첫째" });
    await postFeed(b.token, { topics: ["sql"], content: "둘째" });

    const all = await api(a.token).get("/api/feeds");
    expect(all.body.items.map((f) => f.content)).toEqual(["둘째", "첫째"]);
    expect((await api(a.token).get("/api/feeds?topic=sql")).body.items).toHaveLength(1);
    expect((await api(a.token).get("/api/feeds?topic=nope")).status).toBe(400);

    await api(a.token).post(`/api/users/block/${b.id}`);
    expect((await api(a.token).get("/api/feeds")).body.items.map((f) => f.content)).toEqual(["첫째"]);
  });

  test("좋아요는 중복해도 1회만, 취소하면 줄어든다", async () => {
    const a = await createUser();
    const b = await createUser();
    const feed = (await postFeed(a.token)).body;
    await api(b.token).post(`/api/feeds/${feed.id}/like`);
    const again = await api(b.token).post(`/api/feeds/${feed.id}/like`);
    expect(again.body).toEqual({ likeCount: 1, isLiked: true });
    expect((await api(b.token).delete(`/api/feeds/${feed.id}/like`)).body).toEqual({ likeCount: 0, isLiked: false });
    expect((await api(b.token).delete(`/api/feeds/${feed.id}/like`)).body.likeCount).toBe(0);
  });

  test("댓글 작성·카운트·삭제 권한", async () => {
    const a = await createUser();
    const b = await createUser();
    const feed = (await postFeed(a.token)).body;
    const c = await api(b.token).post(`/api/feeds/${feed.id}/comments`).send({ content: "멋져요" });
    expect(c.status).toBe(201);
    expect((await api(b.token).post(`/api/feeds/${feed.id}/comments`).send({ content: "  " })).status).toBe(400);
    expect((await Feed.findById(feed.id)).commentCount).toBe(1);

    expect((await api(a.token).delete(`/api/feeds/comments/${c.body.id}`)).status).toBe(403);
    expect((await api(b.token).delete(`/api/feeds/comments/${c.body.id}`)).status).toBe(200);
    expect((await Feed.findById(feed.id)).commentCount).toBe(0);
    expect(await FeedComment.countDocuments()).toBe(0);
  });

  test("삭제는 작성자만, 삭제 후에는 404", async () => {
    const a = await createUser();
    const b = await createUser();
    const feed = (await postFeed(a.token)).body;
    expect((await api(b.token).delete(`/api/feeds/${feed.id}`)).status).toBe(403);
    expect((await api(a.token).delete(`/api/feeds/${feed.id}`)).status).toBe(200);
    expect((await api(a.token).get(`/api/feeds/${feed.id}`)).status).toBe(404);
    expect((await api(a.token).get("/api/feeds")).body.items).toHaveLength(0);
  });
});
