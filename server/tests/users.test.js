const { setupDb, createUser, api, createPost, flush, User } = require("./helpers");
const Notification = require("../models/Notification");
const Report = require("../models/Report");
const Feed = require("../models/Feed");

setupDb();

describe("온보딩·내 정보·설정", () => {
  test("관심 분야 3개 이상이면 온보딩 완료", async () => {
    const me = await createUser();
    expect((await api(me.token).get("/api/users/me")).body.onboardingCompleted).toBe(false);
    expect((await api(me.token).put("/api/users/me/interests").send({ interests: ["ml", "sql"] })).status).toBe(400);
    expect((await api(me.token).put("/api/users/me/interests").send({ interests: ["ml", "sql", "x"] })).status).toBe(400);
    const res = await api(me.token).put("/api/users/me/interests").send({ interests: ["ml", "sql", "r"] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ onboardingCompleted: true, interests: ["ml", "sql", "r"] });
    expect(res.body.counts).toEqual({ posts: 0, feeds: 0, comments: 0, scraps: 0, followers: 0, following: 0 });
    expect(res.body.studentId).toBeDefined();
    expect(res.body.password).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
  });

  test("프로필 수정: 학과·학년·소개 검증과 지우기", async () => {
    const me = await createUser();
    const taken = await createUser();
    const ok = await api(me.token).patch("/api/users/me").send({ department: "빅데이터학과", grade: 3, bio: "안녕" });
    expect(ok.body).toMatchObject({ department: "빅데이터학과", grade: 3, bio: "안녕" });
    expect((await api(me.token).patch("/api/users/me").send({ grade: 5 })).status).toBe(400);
    expect((await api(me.token).patch("/api/users/me").send({ bio: "가".repeat(151) })).status).toBe(400);
    expect((await api(me.token).patch("/api/users/me").send({ nickname: taken.user.nickname })).status).toBe(409);
    const cleared = await api(me.token).patch("/api/users/me").send({ bio: "" });
    expect(cleared.body.bio).toBeNull();
  });

  test("설정 토글 저장, 잘못된 값은 400", async () => {
    const me = await createUser();
    const res = await api(me.token).patch("/api/users/me/settings")
      .send({ notificationSettings: { marketing: true, comment: false }, appSettings: { darkMode: true } });
    expect(res.body.notificationSettings).toEqual({ comment: false, studyRecruit: true, marketing: true });
    expect(res.body.appSettings).toEqual({ darkMode: true });
    expect((await api(me.token).patch("/api/users/me/settings").send({ appSettings: { darkMode: "yes" } })).status).toBe(400);
    expect((await api(me.token).patch("/api/users/me/settings").send({})).status).toBe(400);
    expect((await api().get("/api/users/me")).status).toBe(401);
  });
});

describe("팔로우", () => {
  test("팔로우/언팔로우 카운트와 알림, 자기 자신은 400, 중복 팔로우는 한 번만", async () => {
    const a = await createUser();
    const b = await createUser();
    expect((await api(a.token).post(`/api/users/${a.id}/follow`)).status).toBe(400);
    const res = await api(a.token).post(`/api/users/${b.id}/follow`);
    expect(res.body).toMatchObject({ isFollowing: true, followerCount: 1 });
    await api(a.token).post(`/api/users/follow/${b.id}`); // 기존 경로로 한 번 더
    await flush();
    expect((await User.findById(b.id)).followerCount).toBe(1);
    expect((await User.findById(a.id)).followingCount).toBe(1);
    expect(await Notification.countDocuments({ type: "follow", recipient: b.id })).toBe(1);

    const followers = await api(a.token).get(`/api/users/${b.id}/followers?limit=20`);
    expect(followers.body.items[0]).toMatchObject({ id: a.id, isFollowing: false });

    await api(a.token).delete(`/api/users/${b.id}/follow`);
    expect((await User.findById(b.id)).followerCount).toBe(0);
    expect((await User.findById(a.id)).followingCount).toBe(0);
  });
});

describe("차단", () => {
  test("차단하면 서로 팔로우 해제, 프로필 403, 차단 목록", async () => {
    const a = await createUser();
    const b = await createUser();
    await api(a.token).post(`/api/users/${b.id}/follow`);
    await api(b.token).post(`/api/users/${a.id}/follow`);
    expect((await api(a.token).post(`/api/users/${b.id}/block`)).status).toBe(200);
    const [ua, ub] = await Promise.all([User.findById(a.id), User.findById(b.id)]);
    expect([ua.followerCount, ua.followingCount, ub.followerCount, ub.followingCount]).toEqual([0, 0, 0, 0]);
    expect((await api(b.token).get(`/api/users/${a.id}`)).status).toBe(403);
    expect((await api(b.token).post(`/api/users/${a.id}/follow`)).status).toBe(403);
    const blocks = await api(a.token).get("/api/users/me/blocks");
    expect(blocks.body.items.map((u) => u.id)).toEqual([b.id]);
    await api(a.token).delete(`/api/users/${b.id}/block`);
    expect((await api(b.token).get(`/api/users/${a.id}`)).status).toBe(200);
  });
});

describe("마이페이지 목록", () => {
  test("내 글·댓글, 스크랩은 본인만", async () => {
    const me = await createUser();
    const other = await createUser();
    const post = await createPost(me.token, { title: "내 글" });
    await api(me.token).post(`/api/posts/${post._id}/comments`).send({ content: "내 댓글" });
    await api(me.token).post(`/api/posts/${post._id}/scrap`);

    const posts = await api(other.token).get(`/api/users/${me.id}/posts?limit=10`);
    expect(posts.body.items.map((p) => p.title)).toEqual(["내 글"]);
    const comments = await api(other.token).get(`/api/users/${me.id}/comments`);
    expect(comments.body.items[0]).toMatchObject({ content: "내 댓글", post: { title: "내 글", board: "free" } });
    expect((await api(other.token).get(`/api/users/${me.id}/scraps`)).status).toBe(403);
    const scraps = await api(me.token).get(`/api/users/${me.id}/scraps`);
    expect(scraps.body.items[0]).toMatchObject({ title: "내 글", isScrapped: true });
  });

  test("타인 프로필에 A안 필드 포함, 비공개 계정은 맞팔로우만 글 목록", async () => {
    const me = await createUser();
    const priv = await createUser({ isPrivate: true, department: "통계학과", bio: "소개" });
    const profile = await api(me.token).get(`/api/users/${priv.id}`);
    expect(profile.body).toMatchObject({ department: "통계학과", bio: "소개", isMe: false, postCount: 0 });
    expect((await api(me.token).get(`/api/users/${priv.id}/posts`)).status).toBe(403);
  });
});

describe("알림", () => {
  test("페이지네이션 응답, 하나 읽음·전체 읽음, 다른 사람 알림은 404", async () => {
    const me = await createUser();
    const other = await createUser();
    const post = await createPost(me.token);
    await api(other.token).post(`/api/posts/${post._id}/comments`).send({ content: "안녕" });
    await api(other.token).post(`/api/users/${me.id}/follow`);
    await flush();

    const list = await api(me.token).get("/api/notifications?limit=10");
    expect(list.body.items.map((n) => n.type)).toEqual(["follow", "comment"]);
    expect(list.body.items[1]).toMatchObject({ commentContent: "안녕", isRead: false, post: { board: "free" } });
    expect((await api(me.token).get("/api/notifications/unread-count")).body.count).toBe(2);

    const id = list.body.items[0].id;
    expect((await api(other.token).patch(`/api/notifications/${id}/read`)).status).toBe(404);
    await api(me.token).patch(`/api/notifications/${id}/read`);
    expect((await api(me.token).get("/api/notifications/unread-count")).body.count).toBe(1);
    await api(me.token).patch("/api/notifications/read-all");
    expect((await api(me.token).get("/api/notifications/unread-count")).body.count).toBe(0);
    // 기존 클라이언트용 응답은 배열
    expect(Array.isArray((await api(me.token).get("/api/notifications")).body)).toBe(true);
  });

  test("일반 알림은 expiresAt(90일)이 있고, 제재 알림은 없다", async () => {
    const me = await createUser();
    const other = await createUser();
    await api(other.token).post(`/api/users/${me.id}/follow`);
    await flush();
    const follow = await Notification.findOne({ type: "follow" });
    expect(follow.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 3600 * 1000);
    const ban = await Notification.create({ recipient: me.id, sender: other.id, type: "adminBan" });
    expect(ban.expiresAt).toBeUndefined();
  });
});

describe("POST /api/reports", () => {
  test("신고 접수, 중복 신고 409, 잘못된 입력 400, 없는 대상 404", async () => {
    const me = await createUser();
    const author = await createUser();
    const post = await createPost(author.token);
    const body = { targetType: "post", targetId: post._id, reason: "스팸", detail: "광고입니다" };
    expect((await api(me.token).post("/api/reports").send(body)).status).toBe(201);
    expect((await api(me.token).post("/api/reports").send(body)).status).toBe(409);
    expect((await api(me.token).post("/api/reports").send({ ...body, targetType: "video" })).status).toBe(400);
    expect((await api(me.token).post("/api/reports").send({ ...body, reason: "" })).status).toBe(400);
    expect((await api(me.token).post("/api/reports").send({ ...body, targetId: "64b000000000000000000000" })).status).toBe(404);
    expect((await api(me.token).post("/api/reports").send({ targetType: "user", targetId: me.id, reason: "x" })).status).toBe(400);
    expect((await Report.findOne()).detail).toBe("광고입니다");
  });

  test("피드 신고: 다른 사람 피드는 접수, 내 피드 400, 삭제된 피드 404", async () => {
    const me = await createUser();
    const author = await createUser();
    const feed = await Feed.create({ author: author.id, images: ["/uploads/a.jpg"], content: "hi" });
    const body = { targetType: "feed", targetId: feed._id, reason: "스팸/광고" };
    expect((await api(me.token).post("/api/reports").send(body)).status).toBe(201);
    expect((await api(author.token).post("/api/reports").send(body)).status).toBe(400);
    await Feed.updateOne({ _id: feed._id }, { isDeleted: true });
    const other = await createUser();
    expect((await api(other.token).post("/api/reports").send(body)).status).toBe(404);
  });
});

describe("회원가입·탈퇴", () => {
  test("회원가입에 학과·학년, 탈퇴 시 비밀번호 확인과 팔로우 카운트 정리", async () => {
    const reg = await api().post("/api/auth/register").send({
      studentId: "20259999", name: "새내기", professor: "유진호", code: "11",
      password: "pw1234!!", phone: "010-1111-2222", department: "빅데이터학과", grade: 1,
    });
    expect(reg.status).toBe(200);
    const created = await User.findOne({ studentId: "20259999" });
    expect(created).toMatchObject({ department: "빅데이터학과", grade: 1, onboardingCompleted: false });

    const me = await createUser();
    const fan = await createUser();
    await api(fan.token).post(`/api/users/${me.id}/follow`);
    expect((await api(me.token).delete("/api/users/account").send({ password: "wrong" })).status).toBe(401);
    expect((await api(me.token).delete("/api/users/account").send({ password: "password1!" })).status).toBe(200);
    expect((await User.findById(fan.id)).followingCount).toBe(0);
  });
});
