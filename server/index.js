const http = require("http");
const dotenv = require("dotenv");

// 라우트/Cloudinary 설정이 환경변수를 읽으므로 앱을 불러오기 전에 로드한다.
dotenv.config();

const connectDB = require("./config/db");
const initSocket = require("./socket/chatSocket");
const app = require("./app");

connectDB();

const server = http.createServer(app);

// Socket.io 초기화
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
