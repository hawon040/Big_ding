const mongoose = require("mongoose");
const { BOARD_KEYS } = require("../constants/boards");
const { TOPIC_KEYS, MAX_POST_TOPICS } = require("../constants/topics");

// 임베드 댓글은 A안에서 Comment 컬렉션으로 옮긴다. 마이그레이션(scripts/migrate-a-plan.js)이
// 같은 _id로 복사해두며, 모든 라우트가 Comment 컬렉션을 쓰도록 바뀌기 전까지는 지우지 않는다.
const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  // 답글이면 최상위 댓글의 _id를 가리킨다 (대댓글은 1단계까지만 허용)
  parentComment: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [pollOptionSchema],
    validate: (options) => options.length >= 2 && options.length <= 5,
  },
});

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  board: { type: String, enum: BOARD_KEYS, required: true },
  // 관심 주제 key (새 글은 1~3개 필수 — API에서 검증. 기존 글은 빈 배열일 수 있다)
  topics: {
    type: [{ type: String, enum: TOPIC_KEYS }],
    default: [],
    validate: [(v) => v.length <= MAX_POST_TOPICS, `주제는 최대 ${MAX_POST_TOPICS}개까지 선택할 수 있습니다.`],
  },
  title: { type: String, required: true },
  // 투표만 올리는 글은 본문 없이도 등록할 수 있어야 하므로, 투표가 없을 때만 필수로 둔다.
  content: {
    type: String,
    default: "",
    required: [function () { return !this.poll; }, "내용을 입력해주세요."],
  },
  images: [{ type: String }],           // 서버 업로드 이미지 URL
  tags: [{ type: String }],
  poll: { type: pollSchema },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema],
  rating: { type: Number, min: 0.5, max: 5 },          // 강의평가
  lectureGrade: { type: String },                        // 강의평가 교과군
  maxParticipants: { type: Number },                   // 공강모임
  currentParticipants: { type: Number, default: 1 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // 공강모임 참여자 목록(중복 참여 방지용)
  scraps: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],       // 스크랩(북마크)한 사용자 목록. 인기순 정렬에 사용
  price: { type: Number },
  isBlocked: { type: Boolean, default: false },
  // 공개 범위: all(전체공개) / followers(팔로워 공개) / private(나만 보기)
  visibility: {
    type: String,
    enum: ["all", "followers", "private"],
    default: "all",
  },

  // 목록마다 배열 길이/댓글 수를 집계하지 않도록 카운트를 문서에 저장한다.
  // 좋아요·스크랩은 배열(likes/scraps)이 원본이고, 카운트는 $inc로 함께 갱신한다.
  // 어긋나면 scripts/recount.js로 재계산한다.
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  scrapCount: { type: Number, default: 0 },
  // 홈 인기순 정렬용 (utils/popularity.js)
  popularityScore: { type: Number, default: 0 },

  // 스터디·공모전 모집 정보 (RECRUIT_BOARDS에서만 사용)
  recruit: {
    type: new mongoose.Schema({
      status: { type: String, enum: ["open", "closed"], default: "open" },
      capacity: { type: Number, min: 2 },
      current: { type: Number, min: 0, default: 1 },
    }, { _id: false }),
    default: undefined,
  },
  // Q&A 채택 댓글 (ACCEPT_BOARDS에서만 사용, 채택 후 변경 불가)
  acceptedCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },

  // 소프트 삭제. 목록/상세에서 제외한다.
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

// A안 인덱스는 운영 DB에 자동 생성되지 않도록 스키마에 선언하지 않고
// db/aPlanIndexes.js + scripts/indexes-a-plan.js로 확인 후 생성한다.

// 메인 피드 조회(GET /api/posts)가 매번 isBlocked:false + board 필터 + createdAt 내림차순
// 정렬을 하므로 이 조합에 복합 인덱스를 건다.
postSchema.index({ isBlocked: 1, board: 1, createdAt: -1 });
// 댓글은 게시물 문서에 임베드되어 있어 comments._id는 기본적으로 인덱싱되지 않는다.
// 신고 대상 댓글을 담은 게시물을 찾는 조회(Post.findOne({ "comments._id": id }))에 필요하다.
postSchema.index({ "comments._id": 1 });

module.exports = mongoose.model("Post", postSchema);
