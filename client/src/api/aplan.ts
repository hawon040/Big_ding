// A안 화면용 API 호출. 공통 axios 인스턴스(토큰 첨부·401 처리)를 그대로 쓴다.
import api from "./index";
import type { BoardKey } from "@/constants/boards";
import type { TopicKey } from "@/constants/topics";
import type {
  AdminReportTarget, AdminUser, AuthorSummary, BlockedUser, CommentTree, InquiryItem, ReportItem, SanctionItem, SanctionType, FeedComment, FeedItem, StoryItem, StoryText, StoryTrayItem, Me, MyComment, NotificationItem, Page, PostCard, PostDetail, RecentSearch,
  TagResult, TopicChipItem, TrendingKeyword, UserProfile, UserSummary,
} from "@/types/aplan";

const PAGE_SIZE = 20;
const pageParams = (cursor?: string | null, limit = PAGE_SIZE) => ({ cursor: cursor ?? "", limit });

// ── 내 정보 ──
export const meApi = {
  get: () => api.get<Me>("/users/me").then((r) => r.data),
  saveInterests: (interests: TopicKey[]) => api.put<Me>("/users/me/interests", { interests }).then((r) => r.data),
  updateProfile: (data: FormData | Partial<Pick<Me, "nickname" | "department" | "grade" | "bio">>) =>
    api.patch<Me>("/users/me", data).then((r) => r.data),
  updateSettings: (data: { notificationSettings?: Partial<Me["notificationSettings"]>; appSettings?: Partial<Me["appSettings"]> }) =>
    api.patch<Me>("/users/me/settings", data).then((r) => r.data),
  blocks: () => api.get<Page<BlockedUser>>("/users/me/blocks").then((r) => r.data),
  withdraw: (password: string) => api.delete("/users/account", { data: { password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch("/auth/password", { currentPassword, newPassword }).then((r) => r.data),
};

// ── 피드 ──
export const feedApi = {
  topics: () => api.get<{ items: TopicChipItem[] }>("/feed/topics").then((r) => r.data.items),
  list: (topic: TopicKey | "all", cursor?: string | null) =>
    api.get<Page<PostCard>>("/feed", { params: { topic, ...pageParams(cursor) } }).then((r) => r.data),
};

// ── 홈 피드 게시물 (사진 필수, 커뮤니티 글과 별개) ──
export const feedPostApi = {
  list: (tag: string | null, cursor?: string | null) =>
    api.get<Page<FeedItem>>("/feeds", { params: { tag: tag ?? undefined, ...pageParams(cursor) } }).then((r) => r.data),
  get: (id: string) => api.get<FeedItem>(`/feeds/${id}`).then((r) => r.data),
  create: (input: { images: File[]; content: string }) => {
    const form = new FormData();
    input.images.forEach((file) => form.append("images", file));
    if (input.content) form.append("content", input.content);
    return api.post<FeedItem>("/feeds", form).then((r) => r.data);
  },
  remove: (id: string) => api.delete(`/feeds/${id}`),
  like: (id: string) => api.post<{ likeCount: number; isLiked: boolean }>(`/feeds/${id}/like`).then((r) => r.data),
  unlike: (id: string) => api.delete<{ likeCount: number; isLiked: boolean }>(`/feeds/${id}/like`).then((r) => r.data),
  comments: (id: string) => api.get<{ items: FeedComment[] }>(`/feeds/${id}/comments`).then((r) => r.data.items),
  addComment: (id: string, content: string) => api.post<FeedComment>(`/feeds/${id}/comments`, { content }).then((r) => r.data),
  removeComment: (commentId: string) => api.delete(`/feeds/comments/${commentId}`),
};

// ── 스토리 (24시간, 팔로우하는 사람 + 내 것) ──
export const storyApi = {
  tray: () => api.get<{ items: StoryTrayItem[] }>("/stories").then((r) => r.data.items),
  ofUser: (userId: string) =>
    api.get<{ user: AuthorSummary | null; items: StoryItem[] }>(`/stories/user/${userId}`).then((r) => r.data),
  create: (image: File, texts: StoryText[]) => {
    const form = new FormData();
    form.append("image", image);
    if (texts.length) form.append("texts", JSON.stringify(texts));
    return api.post<StoryItem>("/stories", form).then((r) => r.data);
  },
  view: (id: string) => api.post(`/stories/${id}/view`),
  viewers: (id: string) => api.get<{ items: AuthorSummary[] }>(`/stories/${id}/viewers`).then((r) => r.data.items),
  remove: (id: string) => api.delete(`/stories/${id}`),
};

// ── 피드 태그 알림: 구독한 #태그가 달린 새 피드가 올라오면 알림 ──
export const tagAlertApi = {
  list: () => api.get<{ items: string[] }>("/feeds/tag-alerts").then((r) => r.data.items),
  add: (tag: string) => api.post<{ items: string[] }>("/feeds/tag-alerts", { tag }).then((r) => r.data.items),
  remove: (tag: string) => api.delete<{ items: string[] }>(`/feeds/tag-alerts/${encodeURIComponent(tag)}`).then((r) => r.data.items),
};

// ── 게시글 ──
export interface PostInput {
  board: BoardKey;
  topics: TopicKey[];
  tags: string[];
  title: string;
  content: string;
  images?: File[];
  recruit?: { capacity: number };
  poll?: { question: string; options: string[] };
  /** 전공 강의평가 */
  rating?: number;
  lectureGrade?: string;
}

const toFormData = (input: PostInput) => {
  const form = new FormData();
  form.append("board", input.board);
  form.append("title", input.title);
  form.append("content", input.content);
  form.append("topics", JSON.stringify(input.topics));
  form.append("tags", JSON.stringify(input.tags));
  if (input.recruit) form.append("recruit", JSON.stringify(input.recruit));
  if (input.poll) form.append("poll", JSON.stringify(input.poll));
  if (input.rating !== undefined) form.append("rating", String(input.rating));
  if (input.lectureGrade) form.append("lectureGrade", input.lectureGrade);
  input.images?.forEach((file) => form.append("images", file));
  return form;
};

export const postApi = {
  list: (board: BoardKey | "all", cursor?: string | null) =>
    api.get<Page<PostCard>>("/posts", { params: { board, ...pageParams(cursor) } }).then((r) => r.data),
  get: (id: string) => api.get<PostDetail>(`/posts/${id}`).then((r) => r.data),
  create: (input: PostInput) => api.post<{ _id: string }>("/posts", toFormData(input)).then((r) => r.data),
  update: (id: string, data: Partial<Pick<PostInput, "title" | "content" | "topics" | "tags">>) =>
    api.patch(`/posts/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/posts/${id}`),
  like: (id: string) => api.post<{ likeCount: number; isLiked: boolean }>(`/posts/${id}/like`).then((r) => r.data),
  unlike: (id: string) => api.delete<{ likeCount: number; isLiked: boolean }>(`/posts/${id}/like`).then((r) => r.data),
  scrap: (id: string) => api.post<{ scrapCount: number; isScrapped: boolean }>(`/posts/${id}/scrap`).then((r) => r.data),
  unscrap: (id: string) => api.delete<{ scrapCount: number; isScrapped: boolean }>(`/posts/${id}/scrap`).then((r) => r.data),
  vote: (id: string, optionIndex: number) => api.post(`/posts/${id}/poll/vote`, { optionIndex }).then((r) => r.data),
  updateRecruit: (id: string, data: { status?: "open" | "closed"; capacity?: number; current?: number }) =>
    api.patch(`/posts/${id}/recruit`, data).then((r) => r.data),
};

// ── 댓글 ──
export const commentApi = {
  tree: (postId: string) => api.get<CommentTree>(`/posts/${postId}/comments`).then((r) => r.data),
  create: (postId: string, content: string, parentId?: string | null) =>
    api.post(`/posts/${postId}/comments`, { content, parentId: parentId ?? undefined }),
  update: (id: string, content: string) => api.patch(`/comments/${id}`, { content }),
  remove: (id: string) => api.delete(`/comments/${id}`),
  accept: (id: string) => api.post(`/comments/${id}/accept`),
};

// ── 검색 ──
export const searchApi = {
  posts: (q: string, cursor?: string | null) =>
    api.get<Page<PostCard>>("/search", { params: { q, type: "post", ...pageParams(cursor) } }).then((r) => r.data),
  users: (q: string, cursor?: string | null) =>
    api.get<Page<UserSummary>>("/search", { params: { q, type: "user", ...pageParams(cursor) } }).then((r) => r.data),
  tags: (q: string) =>
    api.get<Page<TagResult>>("/search", { params: { q, type: "tag", cursor: "" } }).then((r) => r.data),
  recent: () => api.get<{ items: RecentSearch[] }>("/search/recent").then((r) => r.data.items),
  removeRecent: (keyword: string) => api.delete(`/search/recent/${encodeURIComponent(keyword)}`),
  clearRecent: () => api.delete("/search/recent"),
  trending: () => api.get<{ items: TrendingKeyword[]; computedAt: string }>("/search/trending").then((r) => r.data),
};

// ── 사용자 ──
export const userApi = {
  profile: (id: string) => api.get<UserProfile>(`/users/${id}`).then((r) => r.data),
  posts: (id: string, cursor?: string | null) =>
    api.get<Page<PostCard>>(`/users/${id}/posts`, { params: pageParams(cursor) }).then((r) => r.data),
  feeds: (id: string, cursor?: string | null) =>
    api.get<Page<FeedItem>>(`/users/${id}/feeds`, { params: pageParams(cursor) }).then((r) => r.data),
  comments: (id: string, cursor?: string | null) =>
    api.get<Page<MyComment>>(`/users/${id}/comments`, { params: pageParams(cursor) }).then((r) => r.data),
  scraps: (id: string, cursor?: string | null) =>
    api.get<Page<PostCard>>(`/users/${id}/scraps`, { params: pageParams(cursor) }).then((r) => r.data),
  // 서버가 목록 전체를 한 번에 내려준다 (nextCursor는 항상 null)
  followers: (id: string) => api.get<Page<UserSummary>>(`/users/${id}/followers`, { params: { limit: 50 } }).then((r) => r.data),
  following: (id: string) => api.get<Page<UserSummary>>(`/users/${id}/following`, { params: { limit: 50 } }).then((r) => r.data),
  /** 나를 팔로우하는 사람을 내 팔로워에서 삭제 */
  removeFollower: (id: string) => api.delete(`/users/followers/${id}`),
  follow: (id: string) => api.post<{ isFollowing: boolean; followerCount: number }>(`/users/${id}/follow`).then((r) => r.data),
  unfollow: (id: string) => api.delete<{ isFollowing: boolean; followerCount: number }>(`/users/${id}/follow`).then((r) => r.data),
  block: (id: string) => api.post(`/users/${id}/block`),
  unblock: (id: string) => api.delete(`/users/${id}/block`),
};

// ── 알림 ──
export const notificationApi = {
  list: (cursor?: string | null) =>
    api.get<Page<NotificationItem>>("/notifications", { params: pageParams(cursor) }).then((r) => r.data),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count").then((r) => r.data.count),
  read: (id: string) => api.patch(`/notifications/${id}/read`),
  readAll: () => api.patch("/notifications/read-all"),
};

// ── 신고 ──
export const reportApi = {
  create: (data: { targetType: "post" | "comment" | "user"; targetId: string; reason: string; detail?: string }) =>
    api.post("/reports", data),
};

// ── 건의사항 ──
export const inquiryApi = {
  create: (data: { title: string; content: string }) => api.post("/inquiries", data),
  mine: () => api.get<InquiryItem[]>("/inquiries/mine").then((r) => r.data),
  cancel: (id: string) => api.delete(`/inquiries/${id}`),
  // 관리자
  all: () => api.get<InquiryItem[]>("/inquiries").then((r) => r.data),
  resolve: (id: string, response?: string) => api.patch(`/inquiries/${id}`, { status: "resolved", response }),
};

export const myReportApi = {
  mine: () => api.get<ReportItem[]>("/reports/mine").then((r) => r.data),
};

// ── 관리자 (서버가 isAdmin이 아니면 403) ──
export type SanctionInput =
  | { type: "warning"; reason: string }
  | { type: "ban"; reason: string; banType: "permanent" | "temporary"; days?: number }
  | { type: "commentRestriction"; reason: string; days: number }
  | { type: "forceWithdraw"; reason: string };

const SANCTION_PATH: Record<SanctionType, string> = {
  warning: "warn",
  ban: "ban",
  commentRestriction: "restrict-comments",
  forceWithdraw: "withdraw",
};

export const adminApi = {
  reports: () => api.get<ReportItem[]>("/reports").then((r) => r.data),
  reportTarget: (id: string) => api.get<AdminReportTarget>(`/reports/${id}/target`).then((r) => r.data),
  resolveReport: (id: string, note?: string) => api.patch(`/reports/${id}`, { status: "resolved", note }),
  users: (q: string, page = 1) =>
    api.get<{ users: AdminUser[]; total: number; hasMore: boolean }>("/admin/users", { params: { q, page, limit: 30 } }).then((r) => r.data),
  sanction: (userId: string, input: SanctionInput, reportId?: string) => {
    const { type, ...body } = input;
    return api.post(`/admin/users/${userId}/${SANCTION_PATH[type]}`, { ...body, reportId });
  },
  sanctions: () => api.get<SanctionItem[]>("/admin/sanctions").then((r) => r.data),
  liftSanction: (id: string) => api.patch(`/admin/sanctions/${id}/lift`),
  setEventAdmin: (userId: string, canPostEvents: boolean) => api.patch(`/admin/users/${userId}/event-admin`, { canPostEvents }),
};
