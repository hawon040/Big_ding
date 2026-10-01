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
  isAnswered: boolean;
}

export interface PostDetail extends PostCard {
  content: string;
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
  counts: { posts: number; comments: number; scraps: number; followers: number; following: number };
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
