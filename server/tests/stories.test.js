const { setupDb, createUser, api } = require("./helpers");
const Story = require("../models/Story");

jest.mock("../config/cloudinary", () => ({
  uploadImage: jest.fn(async (buffer, folder) => ({ secure_url: `https://img.test/${folder}/${buffer.length}.jpg` })),
}));

setupDb();

const png = Buffer.from("89504e470d0a1a0a", "hex");
const postStory = (token, caption, texts) => {
  let req = api(token).post("/api/stories").attach("image", png, { filename: "s.png", contentType: "image/png" });
  if (caption !== undefined) req = req.field("caption", caption);
  if (texts !== undefined) req = req.field("texts", JSON.stringify(texts));
  return req;
};
const follow = (token, targetId) => api(token).post(`/api/users/follow/${targetId}`);

describe("스토리 작성", () => {
  test("사진 없이는 400, 문구 100자 초과 400, 정상 작성 201, 인증 없으면 401", async () => {
    const me = await createUser();
    expect((await api(me.token).post("/api/stories").field("caption", "글만")).status).toBe(400);
    expect((await postStory(me.token, "가".repeat(101))).status).toBe(400);
    const ok = await postStory(me.token, "오늘 하루");
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ caption: "오늘 하루", isMine: true, viewed: true, viewerCount: 0 });
    expect((await postStory(null)).status).toBe(401);
  });
});

describe("사진 위 글", () => {
  const ok = { text: "안녕", x: 0.5, y: 0.25, size: 0.08, color: "#FFE066" };

  test("글(위치·크기·색)을 저장하고 조회에서 그대로 돌려준다", async () => {
    const me = await createUser();
    const res = await postStory(me.token, undefined, [ok, { text: "둘째", x: 0, y: 1, size: 0.2, color: "bad" }]);
    expect(res.status).toBe(201);
    expect(res.body.texts).toEqual([
      { text: "안녕", x: 0.5, y: 0.25, size: 0.08, color: "#ffe066" }, // 색은 소문자로 정규화
      { text: "둘째", x: 0, y: 1, size: 0.2, color: "#ffffff" }, // 잘못된 색은 흰색으로
    ]);
    const list = (await api(me.token).get(`/api/stories/user/${me.id}`)).body.items;
    expect(list[0].texts[0].text).toBe("안녕");
  });

  test("6개 이상·빈 글·범위 밖 위치·크기·잘못된 형식은 400", async () => {
    const me = await createUser();
    expect((await postStory(me.token, undefined, Array.from({ length: 6 }, () => ok))).status).toBe(400);
    expect((await postStory(me.token, undefined, [{ ...ok, text: "  " }])).status).toBe(400);
    expect((await postStory(me.token, undefined, [{ ...ok, text: "가".repeat(101) }])).status).toBe(400);
    expect((await postStory(me.token, undefined, [{ ...ok, x: 1.2 }])).status).toBe(400);
    expect((await postStory(me.token, undefined, [{ ...ok, size: 0.5 }])).status).toBe(400);
    expect((await postStory(me.token, undefined, [{ ...ok, y: "0.5" }])).status).toBe(400);
    expect((await postStory(me.token, undefined, { not: "array" })).status).toBe(400);
  });
});

describe("스토리 트레이·조회", () => {
  test("내 항목이 맨 앞, 팔로우하는 사람만, 안 본 순 → 본 후에는 링이 꺼짐", async () => {
    const me = await createUser();
    const a = await createUser();
    const b = await createUser();
    const stranger = await createUser();
    await follow(me.token, a.id);
    await follow(me.token, b.id);
    await postStory(a.token, "a1");
    await postStory(a.token, "a2");
    await postStory(b.token, "b1");
    await postStory(stranger.token, "모르는 사람");

    let tray = (await api(me.token).get("/api/stories")).body.items;
    expect(tray[0]).toMatchObject({ isMe: true, count: 0, hasUnseen: false });
    expect(tray.slice(1).map((t) => t.user.id).sort()).toEqual([a.id, b.id].sort());
    expect(tray.slice(1).every((t) => t.hasUnseen)).toBe(true);
    expect(tray.find((t) => t.user.id === a.id).count).toBe(2);

    const list = (await api(me.token).get(`/api/stories/user/${a.id}`)).body;
    expect(list.items.map((s) => s.caption)).toEqual(["a1", "a2"]);
    await Promise.all(list.items.map((s) => api(me.token).post(`/api/stories/${s.id}/view`)));
    await api(me.token).post(`/api/stories/${list.items[0].id}/view`); // 중복은 무시

    tray = (await api(me.token).get("/api/stories")).body.items;
    expect(tray.find((t) => t.user?.id === a.id).hasUnseen).toBe(false);
    expect(tray[1].user.id).toBe(b.id); // 안 본 b가 본 a보다 앞
    expect((await Story.findById(list.items[0].id)).viewerCount).toBe(1);
  });

  test("팔로우하지 않는 사람·차단 관계의 스토리는 볼 수 없고, 24시간 지나면 사라짐", async () => {
    const me = await createUser();
    const a = await createUser();
    const s = (await postStory(a.token)).body;
    expect((await api(me.token).get(`/api/stories/user/${a.id}`)).status).toBe(403);
    expect((await api(me.token).post(`/api/stories/${s.id}/view`)).status).toBe(403);

    await follow(me.token, a.id);
    expect((await api(me.token).get(`/api/stories/user/${a.id}`)).body.items).toHaveLength(1);
    await api(a.token).post(`/api/users/block/${me.id}`);
    expect((await api(me.token).get(`/api/stories/user/${a.id}`)).status).toBe(403);
    expect((await api(me.token).get("/api/stories")).body.items).toHaveLength(1);

    await Story.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(s.id) }, { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    expect((await api(a.token).get(`/api/stories/user/${a.id}`)).body.items).toHaveLength(0);
  });

  test("조회자 목록은 작성자만, 삭제도 작성자만", async () => {
    const me = await createUser();
    const a = await createUser();
    await follow(me.token, a.id);
    const s = (await postStory(a.token)).body;
    await api(me.token).post(`/api/stories/${s.id}/view`);

    expect((await api(me.token).get(`/api/stories/${s.id}/viewers`)).status).toBe(403);
    const viewers = await api(a.token).get(`/api/stories/${s.id}/viewers`);
    expect(viewers.body.items.map((u) => u.id)).toEqual([me.id]);

    expect((await api(me.token).delete(`/api/stories/${s.id}`)).status).toBe(403);
    expect((await api(a.token).delete(`/api/stories/${s.id}`)).status).toBe(200);
    expect((await api(a.token).get(`/api/stories/user/${a.id}`)).body.items).toHaveLength(0);
  });
});
