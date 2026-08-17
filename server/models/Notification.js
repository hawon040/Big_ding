const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: [
    "follow", "join", "leave", "comment", "like", "dislike", "scrap",
    "adminWarning", "adminBan", "adminCommentRestriction",
  ], required: true },
  // 공강모임 참여/참여취소, 댓글 알림이 어느 게시물에 대한 것인지 표시하기 위한 참조
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  commentContent: { type: String }, // "어떤 댓글을 남겼는지" 알림에 표시하기 위한 스냅샷 (comment 타입 전용)
  message: { type: String }, // 관리자 제재 알림의 사유 텍스트 (adminWarning/adminBan/adminCommentRestriction 전용)
  until: { type: Date }, // 차단(기간제)/댓글제한 알림의 만료 시각 (영구 차단이면 없음)
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);