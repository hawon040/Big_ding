const { setupDb, createUser, api, createPost, flush, User, Post } = require("./helpers");
const Notification = require("../models/Notification");

setupDb();

describe("POST /api/posts", () => {
  test("글 작성 성공: 주제·태그 정규화·모집 정보, 작성자 postCount 증가", async () => {
    const { token, id } = await createUser();
    const post = await createPost(token, {
      board: "study",
      topics: JSON.stringify(["ml", "python"]),
      tags: JSON.stringify(["#Deep Learning", "python", "PYTHON"]),
      recruit: JSON.stringify({ capacity: 4 }),
    });
    expect(post.topics).toEqual(["ml", "python"]);
    expect(post.tags).toEqual(["deeplearning", "python"]);
    expect(post.recruit).toEqual({ status: "open", capacity: 4, current: 1 });
    expect((await User.findById(id)).postCount).toBe(1);
  });

  test("인증 없으면 401", async () => {
    const res = await api().post("/api/posts").send({ board: "free", title: "t", content: "c" });
    expect(res.status).toBe(401);
  });

  test.each([
    ["알 수 없는 게시판", { board: "nope" }],
    ["A안 게시판인데 주제 없음", { board: "question", topics: undefined }],
    ["주제 4개", { topics: JSON.stringify(["python", "sql", "ml", "dl"]) }],
    ["알 수 없는 주제", { topics: JSON.stringify(["cooking"]) }],
    ["제목 101자", { title: "가".repeat(101) }],
    ["태그 11개", { tags: JSON.stringify(Array.from({ length: 11 }, (_, i) => `t${i}`)) }],
    ["자유게시판에 모집 정보", { recruit: JSON.stringify({ capacity: 3 }) }],
    ["모집 인원 1명", { board: "study", recruit: JSON.stringify({ capacity: 1 }) }],
  ])("잘못된 입력은 400: %s", async (_, body) => {
    const { token } = await createUser();
    const res = await api(token).post("/api/posts").send({
      board: "free", title: "제목", content: "본문", topics: JSON.stringify(["python"]), ...body,
    });
    expect(res.status).toBe(400);
  });

  test("기존 글쓰기 화면처럼 주제 없이 자유게시판 글 작성은 허용", async () => {
    const { token } = await createUser();
    const res = await api(token).post("/api/posts").send({ board: "free", title: "t", content: "c" });
    expect(res.status).toBe(201);
    expect(res.body.topics).toEqual([]);
  });
});

describe("GET /api/posts", () => {
  test("cursor/limit를 보내면 {items, nextCursor}로 페이지네이션", async () => {
    const { token } = await createUser();
    for (let i = 0; i < 5; i++) await createPost(token, { title: `글${i}` });
    const first = await api(token).get("/api/posts?board=all&limit=2");
    expect(first.status).toBe(200);
    expect(first.body.items.map((p) => p.title)).toEqual(["글4", "글3"]);
    expect(first.body.items[0]).toMatchObject({ likeCount: 0, isLiked: false, contentPreview: "본문" });
    const second = await api(token).get(`/api/posts?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.items.map((p) => p.title)).toEqual(["글2", "글1"]);
    const third = await api(token).get(`/api/posts?limit=2&cursor=${second.body.nextCursor}`);
    expect(third.body.items.map((p) => p.title)).toEqual(["글0"]);
    expect(third.body.nextCursor).toBeNull();
  });

  test("게시판 필터와 잘못된 커서", async () => {
    const { token } = await createUser();
    await createPost(token, { board: "career", title: "취업글" });
    await createPost(token, { board: "free", title: "자유글" });
    const res = await api(token).get("/api/posts?board=career&cursor=");
    expect(res.body.items.map((p) => p.title)).toEqual(["취업글"]);
    expect((await api(token).get("/api/posts?cursor=garbage")).status).toBe(400);
    expect((await api(token).get("/api/posts?board=nope&limit=5")).status).toBe(400);
  });

  test("기존 클라이언트용 응답(배열 + 임베드 형태 comments)은 그대로", async () => {
    const { token } = await createUser();
    const post = await createPost(token);
    await api(token).post(`/api/posts/${post._id}/comments`).send({ content: "댓글" });
    const res = await api(token).get("/api/posts");
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].comments[0]).toMatchObject({ content: "댓글", parentComment: null });
    expect(res.body[0].comments[0].author.nickname).toBeDefined();
  });

  test("차단한 사용자와 삭제된 글은 목록에서 빠진다", async () => {
    const a = await createUser();
    const b = await createUser();
    await createPost(b.token, { title: "B의 글" });
    const mine = await createPost(a.token, { title: "지울 글" });
    await api(a.token).delete(`/api/posts/${mine._id}`);
    await api(a.token).post(`/api/users/${b.id}/block`);
    const res = await api(a.token).get("/api/posts?limit=20");
    expect(res.body.items).toHaveLength(0);
    // 차단당한 쪽에서도 보이지 않는다
    const other = await api(b.token).get("/api/posts?limit=20");
    expect(other.body.items.map((p) => p.title)).toEqual(["B의 글"]);
  });
});

describe("GET /api/posts/:id", () => {
  test("조회수는 사용자별 하루 1회, 작성자 본인은 증가 안 함", async () => {
    const author = await createUser();
    const reader = await createUser();
    const post = await createPost(author.token);
    await api(author.token).get(`/api/posts/${post._id}`);
    const first = await api(reader.token).get(`/api/posts/${post._id}`);
    expect(first.status).toBe(200);
    expect(first.body.viewCount).toBe(1);
    const again = await api(reader.token).get(`/api/posts/${post._id}`);
    expect(again.body.viewCount).toBe(1);
    expect(again.body).toMatchObject({ isMine: false, content: "본문", isFollowingAuthor: false });
  });

  test("나만 보기 글은 403, 삭제된 글·잘못된 id는 404", async () => {
    const author = await createUser();
    const other = await createUser();
    const priv = await createPost(author.token, { visibility: "private" });
    expect((await api(other.token).get(`/api/posts/${priv._id}`)).status).toBe(403);
    await api(author.token).delete(`/api/posts/${priv._id}`);
    expect((await api(author.token).get(`/api/posts/${priv._id}`)).status).toBe(404);
    expect((await api(author.token).get("/api/posts/not-an-id")).status).toBe(404);
  });
});

describe("PATCH / DELETE /api/posts/:id", () => {
  test("작성자가 아니면 403, 작성자는 수정 가능", async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost(author.token);
    expect((await api(other.token).patch(`/api/posts/${post._id}`).send({ title: "x" })).status).toBe(403);
    expect((await api(other.token).delete(`/api/posts/${post._id}`)).status).toBe(403);
    const res = await api(author.token).patch(`/api/posts/${post._id}`).send({ title: "수정", topics: ["sql"] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "수정", topics: ["sql"] });
    expect((await api(author.token).patch(`/api/posts/${post._id}`).send({ topics: [] })).status).toBe(400);
  });

  test("삭제는 소프트 삭제이고 작성자 postCount 감소", async () => {
    const author = await createUser();
    const post = await createPost(author.token);
    expect((await api(author.token).delete(`/api/posts/${post._id}`)).status).toBe(200);
    const doc = await Post.findById(post._id);
    expect(doc.isDeleted).toBe(true);
    expect((await User.findById(author.id)).postCount).toBe(0);
  });
});

describe("좋아요·스크랩", () => {
  test("좋아요 토글/취소와 카운트, 1시간 내 좋아요 알림 묶기", async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const post = await createPost(author.token);

    const liked = await api(a.token).post(`/api/posts/${post._id}/like`);
    expect(liked.body).toMatchObject({ likeCount: 1, isLiked: true, likes: 1 });
    await api(b.token).post(`/api/posts/${post._id}/like`);
    await flush();

    const notes = await Notification.find({ recipient: author.id, type: "like" });
    expect(notes).toHaveLength(1);
    expect(notes[0].actorCount).toBe(2);

    const unliked = await api(a.token).delete(`/api/posts/${post._id}/like`);
    expect(unliked.body).toMatchObject({ likeCount: 1, isLiked: false });
    // 이미 취소된 상태에서 다시 취소해도 카운트는 그대로
    expect((await api(a.token).delete(`/api/posts/${post._id}/like`)).body.likeCount).toBe(1);
    // 기존 클라이언트: 같은 POST 다시 누르면 취소(토글)
    expect((await api(b.token).post(`/api/posts/${post._id}/like`)).body.likeCount).toBe(0);
  });

  test("싫어요를 누르면 좋아요가 취소되고 likeCount도 줄어든다", async () => {
    const author = await createUser();
    const a = await createUser();
    const post = await createPost(author.token);
    await api(a.token).post(`/api/posts/${post._id}/like`);
    const res = await api(a.token).post(`/api/posts/${post._id}/dislike`);
    expect(res.body).toMatchObject({ likeCount: 0, dislikes: 1, isLiked: false });
  });

  test("스크랩은 글 scrapCount와 내 scrapCount를 함께 갱신", async () => {
    const author = await createUser();
    const a = await createUser();
    const post = await createPost(author.token);
    const res = await api(a.token).post(`/api/posts/${post._id}/scrap`);
    expect(res.body).toMatchObject({ scrapCount: 1, isScrapped: true });
    expect((await User.findById(a.id)).scrapCount).toBe(1);
    await api(a.token).delete(`/api/posts/${post._id}/scrap`);
    expect((await User.findById(a.id)).scrapCount).toBe(0);
    expect((await Post.findById(post._id)).scrapCount).toBe(0);
  });

  test("없는 글 404, 볼 수 없는 글 403", async () => {
    const author = await createUser();
    const a = await createUser();
    const post = await createPost(author.token, { visibility: "private" });
    expect((await api(a.token).post(`/api/posts/${post._id}/like`)).status).toBe(403);
    expect((await api(a.token).post("/api/posts/64b000000000000000000000/scrap")).status).toBe(404);
  });
});

describe("PATCH /api/posts/:id/recruit", () => {
  test("작성자만 모집 상태를 바꿀 수 있고 인원 검증", async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost(author.token, { board: "study", recruit: JSON.stringify({ capacity: 4 }) });
    expect((await api(other.token).patch(`/api/posts/${post._id}/recruit`).send({ status: "closed" })).status).toBe(403);
    expect((await api(author.token).patch(`/api/posts/${post._id}/recruit`).send({ current: 5 })).status).toBe(400);
    const res = await api(author.token).patch(`/api/posts/${post._id}/recruit`).send({ status: "closed", current: 4 });
    expect(res.body.recruit).toEqual({ status: "closed", capacity: 4, current: 4 });
    const free = await createPost(author.token);
    expect((await api(author.token).patch(`/api/posts/${free._id}/recruit`).send({ status: "closed" })).status).toBe(400);
  });

  test("스터디 모집글은 관심 주제가 겹치는 사용자에게 알림 (설정 끈 사람 제외)", async () => {
    const author = await createUser();
    const fan = await createUser({ interests: ["ml", "sql", "r"] });
    await createUser({ interests: ["ml", "sql", "r"], notificationSettings: { studyRecruit: false } });
    await createUser({ interests: ["tableau", "sql", "r"] });
    await createPost(author.token, { board: "study", topics: JSON.stringify(["ml"]), recruit: JSON.stringify({ capacity: 3 }) });
    await flush();
    const notes = await Notification.find({ type: "study_recruit" });
    expect(notes.map((n) => String(n.recipient))).toEqual([fan.id]);
  });
});
