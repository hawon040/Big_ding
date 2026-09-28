const { setupDb, createUser, api, createPost, flush, User, Post } = require("./helpers");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");

setupDb();

const addComment = (token, postId, body) => api(token).post(`/api/posts/${postId}/comments`).send(body);

describe("댓글 작성", () => {
  test("댓글·대댓글 작성, 카운트 증가, comment/reply 알림 (본인 제외)", async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const post = await createPost(author.token);

    const res = await addComment(a.token, post._id, { content: "첫 댓글" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true); // 기존 클라이언트 호환 응답
    const parentId = res.body[0]._id;

    await addComment(b.token, post._id, { content: "답글", parentId });
    await addComment(author.token, post._id, { content: "작성자 댓글" });
    await flush();

    expect((await Post.findById(post._id)).commentCount).toBe(3);
    expect((await User.findById(a.id)).commentCount).toBe(1);
    const notes = await Notification.find({}).sort({ createdAt: 1 });
    expect(notes.map((n) => [n.type, String(n.recipient)])).toEqual([
      ["comment", author.id],
      ["comment", author.id],
      ["reply", a.id],
    ]);
  });

  test("대댓글에 다시 답글은 404, 빈 댓글·너무 긴 댓글은 400, 인증 없으면 401", async () => {
    const author = await createUser();
    const post = await createPost(author.token);
    const first = await addComment(author.token, post._id, { content: "댓글" });
    const reply = await addComment(author.token, post._id, { content: "답글", parentId: first.body[0]._id });
    const replyId = reply.body.find((c) => c.parentComment)._id;
    expect((await addComment(author.token, post._id, { content: "x", parentId: replyId })).status).toBe(404);
    expect((await addComment(author.token, post._id, { content: "  " })).status).toBe(400);
    expect((await addComment(author.token, post._id, { content: "가".repeat(1001) })).status).toBe(400);
    expect((await api().post(`/api/posts/${post._id}/comments`).send({ content: "x" })).status).toBe(401);
  });

  test("댓글·답글 알림을 끈 사용자에게는 알림을 만들지 않는다", async () => {
    const author = await createUser({ notificationSettings: { comment: false } });
    const a = await createUser();
    const post = await createPost(author.token);
    await addComment(a.token, post._id, { content: "댓글" });
    await flush();
    expect(await Notification.countDocuments({ recipient: author.id })).toBe(0);
  });
});

describe("GET /api/posts/:id/comments", () => {
  test("트리 구조, 삭제된 댓글은 대댓글이 있으면 자리만 남는다", async () => {
    const author = await createUser();
    const a = await createUser();
    const post = await createPost(author.token);
    const first = await addComment(a.token, post._id, { content: "부모" });
    const parentId = first.body[0]._id;
    await addComment(author.token, post._id, { content: "답글", parentId });
    const lonely = await addComment(a.token, post._id, { content: "혼자" });
    const lonelyId = lonely.body.find((c) => c.content === "혼자")._id;

    await api(a.token).delete(`/api/comments/${parentId}`);
    await api(a.token).delete(`/api/comments/${lonelyId}`);

    const res = await api(author.token).get(`/api/posts/${post._id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ isDeleted: true, content: "삭제된 댓글입니다.", author: null });
    expect(res.body.items[0].replies[0]).toMatchObject({ content: "답글", isMine: true });
    expect(res.body.commentCount).toBe(1);
  });

  test("차단한 사용자의 댓글은 가려진다", async () => {
    const author = await createUser();
    const troll = await createUser();
    const post = await createPost(author.token);
    await addComment(troll.token, post._id, { content: "나쁜 댓글" });
    await api(author.token).post(`/api/users/${troll.id}/block`);
    const res = await api(author.token).get(`/api/posts/${post._id}/comments`);
    expect(res.body.items).toHaveLength(0);
  });
});

describe("PATCH / DELETE /api/comments/:id", () => {
  test("작성자만 수정·삭제, 삭제하면 카운트 감소", async () => {
    const author = await createUser();
    const other = await createUser();
    const post = await createPost(author.token);
    const res = await addComment(author.token, post._id, { content: "원래" });
    const id = res.body[0]._id;
    expect((await api(other.token).patch(`/api/comments/${id}`).send({ content: "x" })).status).toBe(403);
    expect((await api(other.token).delete(`/api/comments/${id}`)).status).toBe(403);
    const edited = await api(author.token).patch(`/api/comments/${id}`).send({ content: "수정" });
    expect(edited.body.content).toBe("수정");
    expect((await api(author.token).delete(`/api/comments/${id}`)).status).toBe(200);
    expect((await api(author.token).delete(`/api/comments/${id}`)).status).toBe(404);
    expect((await Post.findById(post._id)).commentCount).toBe(0);
    expect((await User.findById(author.id)).commentCount).toBe(0);
  });

  test("기존 삭제 경로는 댓글 배열을 돌려준다", async () => {
    const author = await createUser();
    const post = await createPost(author.token);
    const res = await addComment(author.token, post._id, { content: "댓글" });
    const del = await api(author.token).delete(`/api/posts/${post._id}/comments/${res.body[0]._id}`);
    expect(del.status).toBe(200);
    expect(del.body[0]).toMatchObject({ isDeleted: true, content: "삭제된 댓글입니다." });
  });
});

describe("POST /api/comments/:id/accept", () => {
  const setup = async () => {
    const author = await createUser();
    const answerer = await createUser();
    const post = await createPost(author.token, { board: "question", topics: JSON.stringify(["sql"]) });
    const r1 = await addComment(answerer.token, post._id, { content: "답변1" });
    const r2 = await addComment(answerer.token, post._id, { content: "답변2" });
    const [c1, c2] = [r1.body[0]._id, r2.body[1]._id];
    return { author, answerer, post, c1, c2 };
  };

  test("글 작성자만 1개 채택, 채택 댓글이 맨 위, 알림, 이후 변경·삭제 불가", async () => {
    const { author, answerer, post, c1, c2 } = await setup();
    expect((await api(answerer.token).post(`/api/comments/${c2}/accept`)).status).toBe(403);
    const ok = await api(author.token).post(`/api/comments/${c2}/accept`);
    expect(ok.status).toBe(200);
    expect((await api(author.token).post(`/api/comments/${c1}/accept`)).status).toBe(409);
    expect((await api(answerer.token).delete(`/api/comments/${c2}`)).status).toBe(400);

    const tree = await api(author.token).get(`/api/posts/${post._id}/comments`);
    expect(tree.body.items[0]).toMatchObject({ id: c2, isAccepted: true });
    expect(tree.body.acceptedCommentId).toBe(c2);
    await flush();
    expect(await Notification.countDocuments({ type: "accepted", recipient: answerer.id })).toBe(1);
    const list = await api(author.token).get("/api/posts?board=question&limit=5");
    expect(list.body.items[0].isAnswered).toBe(true);
  });

  test("Q&A가 아닌 글·본인 댓글은 400", async () => {
    const author = await createUser();
    const post = await createPost(author.token);
    const other = await createUser();
    const r = await addComment(other.token, post._id, { content: "댓글" });
    expect((await api(author.token).post(`/api/comments/${r.body[0]._id}/accept`)).status).toBe(400);

    const q = await createPost(author.token, { board: "question", topics: JSON.stringify(["sql"]) });
    const own = await addComment(author.token, q._id, { content: "셀프" });
    expect((await api(author.token).post(`/api/comments/${own.body[0]._id}/accept`)).status).toBe(400);
    expect(await Comment.countDocuments({ isAccepted: true })).toBe(0);
  });
});
