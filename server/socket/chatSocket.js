const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const { filterProfanity } = require("../middleware/profanityFilter");

const onlineUsers = new Map(); // userId -> socketId

module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  // JWT 인증
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("인증 실패"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    console.log(`🟢 ${userId} 접속`);

    // 1:1 채팅 메시지 전송
    socket.on("send_message", async ({ toId, content, image }) => {
      const filtered = content ? filterProfanity(content) : "";

      // DB 저장
      const msg = await Message.create({ from: userId, to: toId, content: filtered, image });
      await msg.populate("from", "nickname avatar studentId");

      // 수신자에게 실시간 전달
      const toSocketId = onlineUsers.get(toId);
      if (toSocketId) {
        io.to(toSocketId).emit("receive_message", msg);
      }

      // 발신자에게도 echo
      socket.emit("message_sent", msg);
    });

    // 게시글 실시간 댓글 알림
    socket.on("join_post", (postId) => {
      socket.join(`post_${postId}`);
    });

    socket.on("leave_post", (postId) => {
      socket.leave(`post_${postId}`);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`🔴 ${userId} 접속 종료`);
    });
  });

  return io;
};
