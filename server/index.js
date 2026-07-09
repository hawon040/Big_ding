const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const initSocket = require("./socket/chatSocket");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io 초기화
initSocket(server);

// 미들웨어
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// 라우터 연결
app.use("/api/auth", require("./routes/auth"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/users", require("./routes/users"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/reports", require("./routes/reports"));

// 새 이미지는 전부 Cloudinary로 올라간다. 이 라우트는 마이그레이션 전 로컬 디스크에
// 저장된 기존 아바타/채팅/게시글 이미지를 계속 보여주기 위한 하위 호환용이다.
app.use("/uploads", express.static("uploads"));

// 관리자 페이지 정적 파일 제공
app.use(express.static("admin"));

// http://localhost:5000/admin 접속 시 admin/index.html 반환
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/admin/index.html");
});

// 헬스체크
app.get("/", (req, res) => res.json({ message: "BigData Community Server 🚀" }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
