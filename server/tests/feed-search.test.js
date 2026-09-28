const { setupDb, createUser, api, createPost, User, Post } = require("./helpers");
const SearchLog = require("../models/SearchLog");
const TrendingSnapshot = require("../models/TrendingSnapshot");

setupDb();

describe("GET /api/feed", () => {
  test("주제 칩: 전체 + 내 관심 주제(선택 순서)", async () => {
    const me = await createUser({ interests: ["sql", "ml", "dataviz"] });
    const res = await api(me.token).get("/api/feed/topics");
    expect(res.body.items.map((t) => t.shortLabel)).toEqual(["전체", "SQL", "ML", "시각화"]);
  });

  test("관심 주제 인기순 → 부족하면 나머지 인기글로 채움, 커서로 이어짐", async () => {
    const me = await createUser({ interests: ["ml", "sql", "r"] });
    const writer = await createUser();
    const ml = await createPost(writer.token, { title: "ML 인기", topics: JSON.stringify(["ml"]) });
    const ml2 = await createPost(writer.token, { title: "ML 보통", topics: JSON.stringify(["ml"]) });
    const other = await createPost(writer.token, { title: "다른 주제 인기", topics: JSON.stringify(["tableau"]) });
    await Post.updateOne({ _id: ml._id }, { popularityScore: 5 });
    await Post.updateOne({ _id: ml2._id }, { popularityScore: 1 });
    await Post.updateOne({ _id: other._id }, { popularityScore: 100 });

    const first = await api(me.token).get("/api/feed?topic=all&limit=2");
    expect(first.status).toBe(200);
    expect(first.body.items.map((p) => p.title)).toEqual(["ML 인기", "ML 보통"]);
    const second = await api(me.token).get(`/api/feed?topic=all&limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.items.map((p) => p.title)).toEqual(["다른 주제 인기"]);
    expect(second.body.nextCursor).toBeNull();

    const single = await api(me.token).get("/api/feed?topic=tableau&limit=1");
    expect(single.body.items[0].title).toBe("다른 주제 인기");
    expect(single.body.items[0].author).toMatchObject({ nickname: expect.any(String) });
  });

  test("관심 주제가 없으면 전체 인기순, 잘못된 주제는 400", async () => {
    const me = await createUser();
    const writer = await createUser();
    await createPost(writer.token, { title: "글" });
    const res = await api(me.token).get("/api/feed");
    expect(res.body.items.map((p) => p.title)).toEqual(["글"]);
    expect((await api(me.token).get("/api/feed?topic=cooking")).status).toBe(400);
    expect((await api(me.token).get("/api/feed?cursor=bad")).status).toBe(400);
  });
});

describe("GET /api/search", () => {
  test("제목 검색·#태그 검색·태그 목록·사용자 검색", async () => {
    const me = await createUser();
    const writer = await createUser({ nickname: "파이썬고수", department: "빅데이터학과" });
    await createPost(writer.token, { title: "판다스 질문", tags: JSON.stringify(["pandas", "python"]) });
    await createPost(writer.token, { title: "SQL 조인", tags: JSON.stringify(["sql"]) });

    const byTitle = await api(me.token).get(`/api/search?q=${encodeURIComponent("판다스")}`);
    expect(byTitle.body.items.map((p) => p.title)).toEqual(["판다스 질문"]);
    const byTagText = await api(me.token).get("/api/search?q=PAND");
    expect(byTagText.body.items.map((p) => p.title)).toEqual(["판다스 질문"]);
    const byTag = await api(me.token).get(`/api/search?q=${encodeURIComponent("#SQL")}`);
    expect(byTag.body.items.map((p) => p.title)).toEqual(["SQL 조인"]);
    const tags = await api(me.token).get("/api/search?q=p&type=tag");
    expect(tags.body.items).toEqual([{ tag: "pandas", postCount: 1 }, { tag: "python", postCount: 1 }]);
    const users = await api(me.token).get(`/api/search?q=${encodeURIComponent("파이썬")}&type=user`);
    expect(users.body.items[0]).toMatchObject({ nickname: "파이썬고수", department: "빅데이터학과", isFollowing: false });
  });

  test("잘못된 입력은 400, 인증 없으면 401", async () => {
    const me = await createUser();
    expect((await api(me.token).get("/api/search?q=")).status).toBe(400);
    expect((await api(me.token).get(`/api/search?q=${"a".repeat(51)}`)).status).toBe(400);
    expect((await api(me.token).get("/api/search?q=abc&type=video")).status).toBe(400);
    expect((await api().get("/api/search?q=abc")).status).toBe(401);
  });

  test("최근 검색어: 앞에 추가·중복 제거·최대 10개·개별/전체 삭제", async () => {
    const me = await createUser();
    for (const q of ["a1", "b2", "a1"]) await api(me.token).get(`/api/search?q=${q}`);
    for (let i = 0; i < 10; i++) await api(me.token).get(`/api/search?q=k${i}`);
    await new Promise((r) => setTimeout(r, 200));
    let recent = await api(me.token).get("/api/search/recent");
    expect(recent.body.items).toHaveLength(10);
    expect(recent.body.items[0].keyword).toBe("k9");

    await api(me.token).delete("/api/search/recent/k9");
    recent = await api(me.token).get("/api/search/recent");
    expect(recent.body.items[0].keyword).toBe("k8");
    await api(me.token).delete("/api/search/recent");
    expect((await api(me.token).get("/api/search/recent")).body.items).toEqual([]);
  });

  test("검색 기록은 정규화(공백·대소문자), 2글자 미만·비속어는 인기 검색어에서 제외", async () => {
    const me = await createUser();
    for (const q of ["Deep Learning", "deeplearning", "a", "병신"]) {
      await api(me.token).get(`/api/search?q=${encodeURIComponent(q)}`);
    }
    await new Promise((r) => setTimeout(r, 200));
    const logs = await SearchLog.find().lean();
    expect(logs.map((l) => l.keyword)).toEqual(["deeplearning", "deeplearning"]);
    const user = await User.findById(me.id).lean();
    expect(user.recentSearches.map((r) => r.keyword)).toEqual(["병신", "a", "deeplearning", "Deep Learning"]);
  });
});

describe("GET /api/search/trending", () => {
  test("최근 1시간 Top 10과 직전 스냅샷 대비 순위 변동", async () => {
    const me = await createUser();
    const hour = 60 * 60 * 1000;
    const hourStart = new Date(Math.floor(Date.now() / hour) * hour);
    await TrendingSnapshot.create({
      computedAt: new Date(hourStart.getTime() - hour),
      rankings: [
        { keyword: "sql", rank: 1, change: "new" },
        { keyword: "python", rank: 2, change: "new" },
      ],
    });
    await SearchLog.insertMany([
      ...Array(3).fill({ keyword: "python" }),
      ...Array(2).fill({ keyword: "sql" }),
      { keyword: "spark" },
    ]);
    const res = await api(me.token).get("/api/search/trending");
    expect(res.body.items).toEqual([
      { keyword: "python", rank: 1, change: "up" },
      { keyword: "sql", rank: 2, change: "down" },
      { keyword: "spark", rank: 3, change: "new" },
    ]);
    expect(new Date(res.body.computedAt).getTime()).toBe(hourStart.getTime());
    // 같은 시각에는 저장된 스냅샷을 그대로 쓴다
    await SearchLog.create({ keyword: "hadoop" });
    const again = await api(me.token).get("/api/search/trending");
    expect(again.body.items).toHaveLength(3);
  });
});
