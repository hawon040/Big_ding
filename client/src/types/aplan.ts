// A안 API 응답 타입 (server/utils/serializers.js 등과 맞춘다)
import type { BoardKey } from "@/constants/boards";
import type { TopicKey } from "@/constants/topics";

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthorSummary {
  id: string;
  nickname: string;
  department: string | null;
  profileImage: string | null;
  isWithdrawn: boolean;
}

export interface Recruit {
  status: "open" | "closed";
  capacity: number;
  current: number;
}

export interface PostCard {
  id: string;
  board: BoardKey;
  title: string;
  contentPreview: string;
  thumbnail: string | null;
  imageCount: number;
  author: AuthorSummary | null;
  topics: TopicKey[];
  tags: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  scrapCount: number;
  viewCount: number;
  isLiked: boolean;
  isScrapped: boolean;
  recruit: Recruit | null;
  /** 전공 강의평가 글만: 0.5~5 별점과 교과군 */
  rating?: number | null;
  lectureGrade?: string | null;
  isAnswered: boolean;
}

export interface Poll {
  question: string;
  options: { text: string; count: number; voted: boolean }[];
  totalVotes: number;
}

export interface PostDetail extends PostCard {
  content: string;
  poll?: Poll | null;
  images: string[];
  visibility: "all" | "followers" | "private";
  acceptedCommentId: string | null;
  updatedAt: string;
  isMine: boolean;
  isFollowingAuthor: boolean;
}

export interface CommentNode {
  id: string;
  parentId: string | null;
  author: AuthorSummary | null;
  content: string;
  isDeleted: boolean;
  isHidden: boolean;
  isAccepted: boolean;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
  replies?: CommentNode[];
}

export interface CommentTree {
  items: CommentNode[];
  commentCount: number;
  acceptedCommentId: string | null;
}

export interface Me {
  id: string;
  studentId: string;
  nickname: string;
  profileImage: string | null;
  department: string | null;
  grade: number | null;
  bio: string | null;
  interests: TopicKey[];
  onboardingCompleted: boolean;
  notificationSettings: { comment: boolean; studyRecruit: boolean; marketing: boolean };
  appSettings: { darkMode: boolean };
  isPrivate: boolean;
  isAdmin: boolean;
  canPostEvents: boolean;
  counts: { posts: number; feeds: number; comments: number; scraps: number; followers: number; following: number };
  createdAt: string;
}

export interface UserProfile {
  id: string;
  nickname: string;
  profileImage: string | null;
  department: string | null;
  grade: number | null;
  bio: string | null;
  interests: TopicKey[];
  isPrivate: boolean;
  isWithdrawn: boolean;
  isMe: boolean;
  postCount: number;
  feedCount: number;
  commentCount: number;
  scrapCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isMutualFollow: boolean;
  isFriend: boolean;
}

export interface UserSummary extends AuthorSummary {
  bio: string | null;
  isFollowing: boolean;
}

export interface MyComment {
  id: string;
  content: string;
  parentId: string | null;
  isAccepted: boolean;
  createdAt: string;
  post: { id: string; title: string; board: BoardKey };
}

export type NotificationType =
  | "comment" | "reply" | "like" | "dislike" | "scrap" | "follow" | "accepted" | "study_recruit" | "feed_tag"
  | "join" | "leave" | "adminWarning" | "adminBan" | "adminCommentRestriction"
  | "reportResolved" | "inquiryResolved";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: AuthorSummary | null;
  actorCount: number;
  post: { id: string; title: string; board: BoardKey } | null;
  feedId?: string | null;
  /** feed_tag 알림: 구독한 해시태그 */
  tag?: string | null;
  commentId: string | null;
  commentContent: string | null;
  message: string | null;
  until: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface TopicChipItem {
  key: TopicKey | "all";
  label: string;
  shortLabel: string;
}

export interface RecentSearch {
  keyword: string;
  searchedAt: string;
}

export interface TrendingKeyword {
  keyword: string;
  rank: number;
  change: "up" | "down" | "same" | "new";
}

export interface TagResult {
  tag: string;
  postCount: number;
}

// 홈 피드 게시물(사진 필수) — 커뮤니티 글(PostCard)과는 별개 데이터 (server/routes/feeds.js)
export interface FeedItem {
  id: string;
  author: AuthorSummary | null;
  images: string[];
  content: string;
  /** 본문 #해시태그 (소문자) */
  tags: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isMine: boolean;
}

export interface FeedComment {
  id: string;
  author: AuthorSummary | null;
  content: string;
  createdAt: string;
  isMine: boolean;
}

// 24시간 스토리 (server/routes/stories.js)
export interface StoryTrayItem {
  user: AuthorSummary | null;
  isMe: boolean;
  count: number;
  /** 내가 아직 안 본 스토리가 있음 → 그라데이션 링 */
  hasUnseen: boolean;
  latestAt: string | null;
}

/** 사진 위에 얹은 글. x·y는 사진 가로·세로 대비 0~1(글의 중심), size는 사진 가로 대비 글자 크기 비율 */
export interface StoryText {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface StoryItem {
  id: string;
  image: string;
  caption: string;
  texts: StoryText[];
  createdAt: string;
  isMine: boolean;
  viewed: boolean;
  /** 내 스토리일 때만 */
  viewerCount: number | null;
}

// ── 건의 / 신고 / 차단 내역 ──
export interface BlockedUser {
  id: string;
  nickname: string;
  profileImage: string | null;
  department: string | null;
}

export interface InquiryItem {
  _id: string;
  title: string;
  content: string;
  status: "pending" | "resolved";
  adminResponse?: string;
  createdAt: string;
  user?: { _id: string; nickname: string; studentId: string } | null;
}

export interface ReportItem {
  _id: string;
  targetType: "post" | "comment" | "user";
  targetId: string;
  reason: string;
  detail?: string;
  status: "pending" | "resolved";
  sanctionApplied?: boolean;
  sanctionType?: SanctionType;
  createdAt: string;
  reporter?: { _id: string; nickname: string; studentId: string } | null;
}

// ── 관리자 ──
export type SanctionType = "warning" | "ban" | "commentRestriction" | "forceWithdraw";

export interface AdminUser {
  _id: string;
  nickname: string;
  studentId: string;
  isAdmin: boolean;
  canPostEvents: boolean;
  banned: boolean;
  banType?: "permanent" | "temporary";
  banUntil?: string;
  commentRestrictedUntil?: string;
  isWithdrawn: boolean;
  warningCount: number;
  banCount: number;
}

export interface SanctionItem {
  _id: string;
  type: SanctionType;
  reason: string;
  active: boolean;
  expiresAt?: string;
  liftedAt?: string;
  createdAt: string;
  user?: { _id: string; nickname: string; studentId: string } | null;
  admin?: { nickname: string } | null;
}

export interface AdminReportTarget {
  targetType: "post" | "comment" | "user";
  post?: { _id: string; title: string; content: string; board: string; author?: { _id: string; nickname: string; studentId: string } | null };
  targetCommentId?: string;
  user?: { _id: string; nickname: string; studentId: string };
}
