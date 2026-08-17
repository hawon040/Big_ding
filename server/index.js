const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const initSocket = require("./socket/chatSocket");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io 초기화
initSocket(server);

// 미들웨어
// Helmet: 클릭재킹, MIME 스니핑 등을 막는 표준 보안 HTTP 헤더를 자동으로 붙여준다.
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// 개발 환경(로컬 npm run dev)에서는 프론트 폴링(2~3초 간격 새로고침)이 많아
// 제한이 너무 빡빡하면 정상 사용도 막혀버린다. 배포 환경(production)에서만
// 엄격하게 걸고, 개발 중에는 넉넉하게 풀어둔다.
const isProd = process.env.NODE_ENV === "production";

// 로그인 무차별 대입 공격 방지: 같은 IP에서 15분 동안 로그인 시도를 제한한다.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  message: { message: "너무 많은 요청을 시도했습니다. 잠시 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 일반 API 남용/스팸 방지: 같은 IP에서 15분 동안 요청 횟수를 제한한다.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 3000,
  message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", generalLimiter);
app.use("/api/auth", authLimiter);

// 라우터 연결
app.use("/api/auth", require("./routes/auth")); // authLimiter는 위에서 이미 /api/auth에 적용됨
app.use("/api/posts", require("./routes/posts"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/users", require("./routes/users"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/group-chats", require("./routes/groupChat"));
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
