const { setupDb, createUser, api, Post } = require("./helpers");
const Feed = require("../models/Feed");
const FeedComment = require("../models/FeedComment");
const Notification = require("../models/Notification");

// 실제 Cloudinary로 올리지 않도록 막는다.
jest.mock("../config/cloudinary", () => ({
  uploadImage: jest.fn(async (buffer, folder) => ({ secure_url: `https://img.test/${folder}/${buffer.length}.jpg` })),
}));

setupDb();

// 알림은 응답과 별개로 비동기 생성되므로, 고정 시간 대신 기대 개수가 될 때까지 기다린다.
const waitForNotifications = async (filter, count) => {
  for (let i = 0; i < 50; i += 1) {
    if ((await Notification.countDocuments(filter)) >= count) return;
    await new Promise((r) => setTimeout(r, 40));
  }
};

const png = Buffer.from("89504e470d0a1a0a", "hex");
const postFeed = (token, { images = 1, content } = {}) => {
  let req = api(token).post("/api/feeds");
  for (let i = 0; i < images; i += 1) req = req.attach("images", png, { filename: `p${i}.png`, contentType: "image/png" });
  if (content !== undefined) req = req.field("content", content);
  return req;
};

describe("피드 작성", () => {
  test("사진 없이는 400, 사진이 있으면 feeds 컬렉션에만 저장된다 (posts는 그대로)", async () => {
    const me = await createUser();
    const none = await api(me.token).post("/api/feeds").field("content", "글만");
    expect(none.status).toBe(400);

    const ok = await postFeed(me.token, { images: 2, content: "오늘의 사진 #Python #파이썬 #python" });
    expect(ok.status).toBe(201);
    expect(ok.body.images).toHaveLength(2);
    expect(ok.body.tags).toEqual(["python", "파이썬"]); // 본문 #해시태그 → 소문자·중복 제거
    expect(await Feed.countDocuments()).toBe(1);
    expect(await Post.countDocuments()).toBe(0);
  });

  test("사진 11장·태그 11개·너무 긴 태그/내용은 400, 인증 없으면 401", async () => {
    const me = await createUser();
    expect((await postFeed(me.token, { images: 11 })).status).toBe(400);
    expect((await postFeed(me.token, { content: Array.from({ length: 11 }, (_, i) => `#t${i}`).join(" ") })).status).toBe(400);
    expect((await postFeed(me.token, { content: `#${"가".repeat(31)}` })).status).toBe(400);
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
    await waitForNotifications({}, 2);
    const notes = await Notification.find({}).sort({ createdAt: 1 });
    expect(notes.map((n) => [n.type, String(n.recipient), String(n.feed)])).toEqual([
      ["like", a.id, feed.id],
      ["comment", a.id, feed.id],
    ]);
    const list = await api(a.token).get("/api/notifications?limit=10");
    expect(list.body.items[0].feedId).toBe(feed.id);
  });
});

describe("태그 알림", () => {
  test("구독 추가·중복·해제·잘못된 값·개수 제한", async () => {
    const me = await createUser();
    expect((await api(me.token).post("/api/feeds/tag-alerts").send({ tag: "#Python" })).body.items).toEqual(["python"]);
    expect((await api(me.token).post("/api/feeds/tag-alerts").send({ tag: "python" })).body.items).toEqual(["python"]);
    expect((await api(me.token).post("/api/feeds/tag-alerts").send({ tag: "a b!" })).status).toBe(400);
    expect((await api(me.token).get("/api/feeds/tag-alerts")).body.items).toEqual(["python"]);
    expect((await api(me.token).delete("/api/feeds/tag-alerts/%23python")).body.items).toEqual([]);
    for (let i = 0; i < 30; i += 1) await api(me.token).post("/api/feeds/tag-alerts").send({ tag: `t${i}` });
    expect((await api(me.token).post("/api/feeds/tag-alerts").send({ tag: "extra" })).status).toBe(400);
  });

  test("구독한 태그의 새 피드는 구독자에게만 1개씩 알림 (작성자·차단 관계 제외)", async () => {
    const author = await createUser();
    const fan = await createUser();
    const blocker = await createUser();
    const other = await createUser();
    await api(author.token).post("/api/feeds/tag-alerts").send({ tag: "python" }); // 본인 제외
    await api(fan.token).post("/api/feeds/tag-alerts").send({ tag: "sql" });
    await api(fan.token).post("/api/feeds/tag-alerts").send({ tag: "python" });
    await api(blocker.token).post("/api/feeds/tag-alerts").send({ tag: "python" });
    await api(blocker.token).post(`/api/users/block/${author.id}`);
    await api(other.token).post("/api/feeds/tag-alerts").send({ tag: "react" });

    const feed = (await postFeed(author.token, { content: "공부 #Python #sql" })).body;
    await waitForNotifications({ type: "feed_tag" }, 1);
    await new Promise((r) => setTimeout(r, 150)); // 잘못 더 생기는 알림이 없는지 확인할 여유
    const notes = await Notification.find({ type: "feed_tag" });
    expect(notes).toHaveLength(1);
    expect(String(notes[0].recipient)).toBe(fan.id);
    expect(notes[0].tag).toBe("python");
    const list = await api(fan.token).get("/api/notifications?limit=10");
    expect(list.body.items[0]).toMatchObject({ type: "feed_tag", feedId: feed.id, tag: "python" });
  });
});

describe("피드 목록·상호작용", () => {
  test("최신순 목록, 태그 필터, 차단한 사람의 피드는 숨김", async () => {
    const a = await createUser();
    const b = await createUser();
    await postFeed(a.token, { content: "첫째 #python" });
    await postFeed(b.token, { content: "둘째 #sql" });

    const all = await api(a.token).get("/api/feeds");
    expect(all.body.items.map((f) => f.content)).toEqual(["둘째 #sql", "첫째 #python"]);
    expect((await api(a.token).get("/api/feeds?tag=SQL")).body.items).toHaveLength(1);
    expect((await api(a.token).get("/api/feeds?tag=%23nope")).body.items).toHaveLength(0);

    await api(a.token).post(`/api/users/block/${b.id}`);
    expect((await api(a.token).get("/api/feeds")).body.items.map((f) => f.content)).toEqual(["첫째 #python"]);
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
