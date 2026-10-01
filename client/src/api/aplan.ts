// A안 화면용 API 호출. 공통 axios 인스턴스(토큰 첨부·401 처리)를 그대로 쓴다.
import api from "./index";
import type { BoardKey } from "@/constants/boards";
import type { TopicKey } from "@/constants/topics";
import type {
  CommentTree, FeedComment, FeedItem, Me, MyComment, NotificationItem, Page, PostCard, PostDetail, RecentSearch,
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
  blocks: () => api.get<Page<{ id: string; nickname: string; profileImage: string | null; department: string | null }>>("/users/me/blocks").then((r) => r.data),
  withdraw: (password: string) => api.delete("/users/account", { data: { password } }),
};

// ── 피드 ──
export const feedApi = {
  topics: () => api.get<{ items: TopicChipItem[] }>("/feed/topics").then((r) => r.data.items),
  list: (topic: TopicKey | "all", cursor?: string | null) =>
    api.get<Page<PostCard>>("/feed", { params: { topic, ...pageParams(cursor) } }).then((r) => r.data),
};

// ── 홈 피드 게시물 (사진 필수, 커뮤니티 글과 별개) ──
export const feedPostApi = {
  list: (topic: TopicKey | "all", cursor?: string | null) =>
    api.get<Page<FeedItem>>("/feeds", { params: { topic, ...pageParams(cursor) } }).then((r) => r.data),
  get: (id: string) => api.get<FeedItem>(`/feeds/${id}`).then((r) => r.data),
  create: (input: { images: File[]; content: string; topics: TopicKey[] }) => {
    const form = new FormData();
    input.images.forEach((file) => form.append("images", file));
    if (input.content) form.append("content", input.content);
    form.append("topics", JSON.stringify(input.topics));
    return api.post<FeedItem>("/feeds", form).then((r) => r.data);
  },
  remove: (id: string) => api.delete(`/feeds/${id}`),
  like: (id: string) => api.post<{ likeCount: number; isLiked: boolean }>(`/feeds/${id}/like`).then((r) => r.data),
  unlike: (id: string) => api.delete<{ likeCount: number; isLiked: boolean }>(`/feeds/${id}/like`).then((r) => r.data),
  comments: (id: string) => api.get<{ items: FeedComment[] }>(`/feeds/${id}/comments`).then((r) => r.data.items),
  addComment: (id: string, content: string) => api.post<FeedComment>(`/feeds/${id}/comments`, { content }).then((r) => r.data),
  removeComment: (commentId: string) => api.delete(`/feeds/comments/${commentId}`),
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
}

const toFormData = (input: PostInput) => {
  const form = new FormData();
  form.append("board", input.board);
  form.append("title", input.title);
  form.append("content", input.content);
  form.append("topics", JSON.stringify(input.topics));
  form.append("tags", JSON.stringify(input.tags));
  if (input.recruit) form.append("recruit", JSON.stringify(input.recruit));
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
  comments: (id: string, cursor?: string | null) =>
    api.get<Page<MyComment>>(`/users/${id}/comments`, { params: pageParams(cursor) }).then((r) => r.data),
  scraps: (id: string, cursor?: string | null) =>
    api.get<Page<PostCard>>(`/users/${id}/scraps`, { params: pageParams(cursor) }).then((r) => r.data),
  followers: (id: string) => api.get<Page<UserSummary>>(`/users/${id}/followers`, { params: { limit: 50 } }).then((r) => r.data),
  following: (id: string) => api.get<Page<UserSummary>>(`/users/${id}/following`, { params: { limit: 50 } }).then((r) => r.data),
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
