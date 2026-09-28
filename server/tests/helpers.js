// 테스트 공통: 메모리 MongoDB(레플리카셋 — 트랜잭션 지원), 사용자·토큰·글 생성 헬퍼
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/User");
const Post = require("../models/Post");
const indexDefinitions = require("../db/aPlanIndexes");

let replSet;

const setupDb = () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    await mongoose.connect(replSet.getUri());
    // 운영과 같은 인덱스(unique·TTL 포함)를 만든다.
    for (const def of indexDefinitions) {
      await mongoose.connection.db.collection(def.collection).createIndex(def.key, def.options);
    }
  });
  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await replSet?.stop();
  });
};

let seq = 0;
const createUser = async (overrides = {}) => {
  seq += 1;
  const user = await User.create({
    studentId: `2024${String(seq).padStart(4, "0")}`,
    professorCode: "11",
    password: "password1!",
    nickname: `user${seq}`,
    professor: "유진호",
    phone: "01012345678",
    ...overrides,
  });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  return { user, token, id: String(user._id) };
};

const api = (token) => {
  const withAuth = (req) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
  return {
    get: (url) => withAuth(request(app).get(url)),
    post: (url) => withAuth(request(app).post(url)),
    put: (url) => withAuth(request(app).put(url)),
    patch: (url) => withAuth(request(app).patch(url)),
    delete: (url) => withAuth(request(app).delete(url)),
  };
};

// API로 글 작성 (JSON 본문 — multipart가 아니어도 같은 필드로 처리된다)
const createPost = async (token, body = {}) => {
  const res = await api(token).post("/api/posts").send({
    board: "free",
    title: "제목",
    content: "본문",
    topics: JSON.stringify(["python"]),
    ...body,
  });
  if (res.status !== 201) throw new Error(`글 작성 실패 ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};

// 비동기(await 없이 실행되는) 알림·점수 갱신이 끝나도록 잠깐 기다린다.
const flush = () => new Promise((r) => setTimeout(r, 150));

module.exports = { setupDb, createUser, api, createPost, flush, User, Post };
