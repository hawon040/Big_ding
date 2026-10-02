const mongoose = require("mongoose");
const { includesId } = require("./access");

// A안 응답 형태로 변환하는 함수들. 작성자 정보는 AUTHOR_FIELDS로 populate한 값을 쓴다.
const AUTHOR_FIELDS = "nickname avatar department isWithdrawn";

// 카드 미리보기용: 마크다운 문법(코드 블록·이미지·링크·강조·헤더 등)을 걷어낸 평문
const stripMarkdown = (md = "") =>
  String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|~~|\*|_)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

const contentPreview = (md, max = 100) => stripMarkdown(md).slice(0, max);

const toAuthor = (u) => {
  if (!u || !u._id) return null;
  return {
    id: String(u._id),
    nickname: u.nickname,
    department: u.department || null,
    profileImage: u.avatar || null,
    isWithdrawn: !!u.isWithdrawn,
  };
};

// 목록 조회용 projection. likes/scraps 배열 전체 대신 내가 들어있는지만 가져온다.
const cardProjection = (meId) => {
  const me = new mongoose.Types.ObjectId(String(meId));
  return {
    board: 1, title: 1, content: 1, images: 1, author: 1, topics: 1, tags: 1, createdAt: 1,
    likeCount: 1, commentCount: 1, scrapCount: 1, viewCount: 1, recruit: 1, acceptedCommentId: 1,
    visibility: 1, popularityScore: 1, rating: 1, lectureGrade: 1,
    likes: { $elemMatch: { $eq: me } },
    scraps: { $elemMatch: { $eq: me } },
  };
};

// 홈 PostCard / 커뮤니티 PostListItem 공용
const toPostCard = (p, meId) => ({
  id: String(p._id),
  board: p.board,
  title: p.title,
  contentPreview: contentPreview(p.content),
  thumbnail: p.images?.[0] || null,
  imageCount: p.images?.length || 0,
  author: toAuthor(p.author),
  topics: p.topics || [],
  tags: p.tags || [],
  createdAt: p.createdAt,
  likeCount: p.likeCount || 0,
  commentCount: p.commentCount || 0,
  scrapCount: p.scrapCount || 0,
  viewCount: p.viewCount || 0,
  isLiked: includesId(p.likes, meId),
  isScrapped: includesId(p.scraps, meId),
  recruit: p.recruit || null,
  rating: p.rating ?? null,
  lectureGrade: p.lectureGrade || null,
  isAnswered: !!p.acceptedCommentId,
});

// 투표는 누가 골랐는지(votes의 사용자 id)는 숨기고 옵션별 득표 수와 내가 고른 옵션만 내려준다.
const toPoll = (poll, meId) => {
  if (!poll) return null;
  const options = (poll.options || []).map((opt) => ({
    text: opt.text,
    count: opt.votes?.length || 0,
    voted: includesId(opt.votes, meId),
  }));
  return { question: poll.question, options, totalVotes: options.reduce((n, o) => n + o.count, 0) };
};

const toPostDetail = (p, meId, { isFollowingAuthor = false } = {}) => ({
  ...toPostCard(p, meId),
  content: p.content,
  images: p.images || [],
  poll: toPoll(p.poll, meId),
  visibility: p.visibility || "all",
  acceptedCommentId: p.acceptedCommentId ? String(p.acceptedCommentId) : null,
  updatedAt: p.updatedAt,
  isMine: String(p.author?._id || p.author) === String(meId),
  isFollowingAuthor,
});

const toUserSummary = (u, { isFollowing = false } = {}) => ({
  ...toAuthor(u),
  bio: u.bio || null,
  isFollowing,
});

// 홈 피드 게시물(사진 필수) — /api/feeds와 프로필 피드 탭 공용
const toFeed = (f, meId) => ({
  id: String(f._id),
  author: toAuthor(f.author),
  images: f.images || [],
  content: f.content || "",
  tags: f.tags || [],
  createdAt: f.createdAt,
  likeCount: f.likeCount || 0,
  commentCount: f.commentCount || 0,
  isLiked: includesId(f.likes, meId),
  isMine: String(f.author?._id || f.author) === String(meId),
});

module.exports = {
  AUTHOR_FIELDS,
  stripMarkdown,
  contentPreview,
  toAuthor,
  cardProjection,
  toPostCard,
  toPostDetail,
  toUserSummary,
  toFeed,
};
