const mongoose = require("mongoose");

const NOTIFICATION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
// 자동 삭제하지 않는 알림 유형
const PERSISTENT_TYPES = [
  "adminWarning", "adminBan", "adminCommentRestriction", "reportResolved", "inquiryResolved",
];

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: [
    "follow", "join", "leave", "comment", "reply", "like", "dislike", "scrap",
    "adminWarning", "adminBan", "adminCommentRestriction",
    "reportResolved", "inquiryResolved",
    "accepted", "study_recruit", "feed_tag", // A안: Q&A 채택, 관심 주제 스터디 모집
  ], required: true },
  // 알림이 가리키는 댓글 (comment/reply/accepted)
  comment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  // 같은 글 좋아요를 1시간 안에 묶을 때 모인 사람들 (sender는 가장 최근 사람).
  // "OO님 외 N명" 표시는 actorCount - 1로 계산한다.
  actors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  actorCount: { type: Number, default: 1 },
  // TTL 인덱스(db/aPlanIndexes.js)가 이 시각에 알림을 자동 삭제한다. 제재·신고/문의 처리 결과
  // 알림은 사용자가 사유를 계속 확인할 수 있어야 하므로 값을 비워 삭제 대상에서 뺀다.
  expiresAt: {
    type: Date,
    default: function () {
      return PERSISTENT_TYPES.includes(this.type) ? undefined : new Date(Date.now() + NOTIFICATION_TTL_MS);
    },
  },
  // 공강모임 참여/참여취소, 댓글 알림이 어느 게시물에 대한 것인지 표시하기 위한 참조
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  // 피드(홈 게시물) 좋아요·댓글 알림이 가리키는 피드. post와 동시에 쓰이지 않는다.
  feed: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
  tag: { type: String }, // feed_tag 알림: 구독한 해시태그
  commentContent: { type: String }, // "어떤 댓글을 남겼는지" 알림에 표시하기 위한 스냅샷 (comment/reply 타입 전용)
  message: { type: String }, // 관리자 제재 알림의 사유 텍스트 (adminWarning/adminBan/adminCommentRestriction 전용)
  until: { type: Date }, // 차단(기간제)/댓글제한 알림의 만료 시각 (영구 차단이면 없음)
  read: { type: Boolean, default: false },
}, { timestamps: true });

// 알림 목록(recipient + createdAt 정렬)과 안 읽은 개수(recipient + read) 조회에 쓰인다.
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.PERSISTENT_TYPES = PERSISTENT_TYPES;
module.exports.NOTIFICATION_TTL_MS = NOTIFICATION_TTL_MS;