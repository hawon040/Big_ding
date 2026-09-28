// 개발 전용: A안 미리보기(/__aplan/...)에서 서버 대신 응답하는 가짜 API.
// 내용은 Figma 시안의 예시(제목·숫자·주제)와 같게 맞춰 비교 스크린샷을 찍을 수 있게 한다.
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import type {
  CommentTree, Me, MyComment, NotificationItem, Page, PostCard, PostDetail,
  RecentSearch, TopicChipItem, TrendingKeyword, UserSummary,
} from "@/types/aplan";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// 사진 대신 쓰는 단색 이미지 (외부 네트워크 없이)
const sampleImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="568" height="260"><rect width="568" height="260" fill="#cfd8e3"/><path d="M40 220 L140 150 L230 180 L330 90 L430 130 L530 60" stroke="#5b6b80" stroke-width="8" fill="none"/></svg>`,
  );

const author = { id: "u1", nickname: "데이터곰", department: "통계학과", profileImage: null, isWithdrawn: false };

export const feedPosts: PostCard[] = [
  {
    id: "p1", board: "free", title: "Pandas로 공공데이터 EDA 해본 후기 공유합니다",
    contentPreview: "서울시 공공자전거 대여 데이터를 Pandas로 정리하고 시간대별·요일별 패턴을 시각화해봤어요. 전처리에서 막혔던 부분 위주로 정리합니다.",
    thumbnail: sampleImage, imageCount: 1, author, topics: ["python"], tags: ["pandas", "eda"],
    createdAt: minutesAgo(10), likeCount: 24, commentCount: 8, scrapCount: 3, viewCount: 120,
    isLiked: false, isScrapped: false, recruit: null, isAnswered: false,
  },
  {
    id: "p2", board: "career", title: "빅데이터분석기사 실기 2주 합격 루트",
    contentPreview: "필기 붙고 실기까지 2주 남았을 때 어떤 순서로 공부했는지, 작업형 1·2·3유형별로 자주 나오는 코드 패턴을 정리했습니다.",
    thumbnail: null, imageCount: 0, author, topics: ["bigdata-cert"], tags: ["빅분기"],
    createdAt: minutesAgo(10), likeCount: 24, commentCount: 8, scrapCount: 5, viewCount: 98,
    isLiked: false, isScrapped: false, recruit: null, isAnswered: false,
  },
];

const listItem = (id: string, board: PostCard["board"], title: string, extra: Partial<PostCard> = {}): PostCard => ({
  id, board, title, contentPreview: "", thumbnail: sampleImage, imageCount: 1,
  author: { ...author, nickname: "닉네임" }, topics: ["ml"], tags: [],
  createdAt: minutesAgo(5), likeCount: 3, commentCount: 12, scrapCount: 0, viewCount: 230,
  isLiked: false, isScrapped: false, recruit: null, isAnswered: false, ...extra,
});

export const communityPosts: PostCard[] = [
  listItem("c1", "question", "XGBoost 파라미터 튜닝 질문 있습니다"),
  listItem("c2", "free", "데이터 직무 대학원 vs 취업 고민"),
  listItem("c3", "study", "[모집] 주 2회 캐글 스터디 4명", { recruit: { status: "open", capacity: 4, current: 2 } }),
  listItem("c4", "competition", "공공데이터 활용 공모전 팀원 구해요"),
];

const allPosts = [...feedPosts, ...communityPosts];

const sampleUsers: UserSummary[] = [
  { id: "u1", nickname: "데이터곰", department: "통계학과", profileImage: null, isWithdrawn: false, bio: "숫자로 세상 읽기", isFollowing: false },
  { id: "u2", nickname: "판다마스터", department: "산업공학과", profileImage: null, isWithdrawn: false, bio: "Pandas 3년차", isFollowing: true },
];

let recentSearches: RecentSearch[] = [
  { keyword: "판다스", searchedAt: minutesAgo(60) },
  { keyword: "빅분기", searchedAt: minutesAgo(120) },
];

const sampleMe: Me = {
  id: "u1", studentId: "202012345", nickname: "데이터곰", profileImage: null,
  department: "통계학과", grade: 3, bio: "데이터로 세상을 읽어보려 합니다.",
  interests: ["python", "sql", "ml", "dataviz"], onboardingCompleted: true,
  notificationSettings: { comment: true, studyRecruit: true, marketing: false },
  appSettings: { darkMode: false }, isPrivate: false, isAdmin: false, canPostEvents: false,
  counts: { posts: 2, comments: 2, scraps: 1, followers: 12, following: 8 },
  createdAt: minutesAgo(60 * 24 * 30),
};

const myComments: MyComment[] = [
  {
    id: "cm1", content: "저도 비슷한 문제 겪었는데, learning_rate 먼저 줄여보세요!", parentId: null,
    isAccepted: true, createdAt: minutesAgo(30), post: { id: "c1", title: "XGBoost 파라미터 튜닝 질문 있습니다", board: "question" },
  },
  {
    id: "cm2", content: "좋은 정리 감사합니다, 저장해둘게요.", parentId: null,
    isAccepted: false, createdAt: minutesAgo(90), post: { id: "p1", title: "Pandas로 공공데이터 EDA 해본 후기 공유합니다", board: "free" },
  },
];

const sampleActor = { id: "u2", nickname: "판다마스터", department: "산업공학과", profileImage: null, isWithdrawn: false };

// A-09 상세 미리보기용 (p1: Figma 예시와 같은 Pandas EDA 글 — 코드 블록 포함)
const postDetails: Record<string, PostDetail> = {
  p1: {
    ...feedPosts[0],
    content:
      "서울시 공공자전거 대여 데이터를 Pandas로 정리하고 시간대별·요일별 패턴을 시각화해봤어요.\n\n" +
      "학과별 평균 점수를 구할 때는 이렇게 groupby를 씁니다.\n\n" +
      '```python\ndf.groupby("dept")["score"]\n  .mean().plot(kind="bar")\n```\n\n' +
      "전처리에서 막혔던 부분 위주로 정리했으니 궁금한 점은 댓글로 남겨주세요!",
    images: [sampleImage],
    visibility: "all",
    acceptedCommentId: null,
    updatedAt: feedPosts[0].createdAt,
    isMine: false,
    isFollowingAuthor: false,
  },
};

const commentTrees: Record<string, CommentTree> = {
  p1: {
    commentCount: 2,
    acceptedCommentId: null,
    items: [
      {
        id: "cm10", parentId: null, author: { ...sampleActor, nickname: "파이썬러버" },
        content: "시각화는 seaborn 쓰셨나요?", isDeleted: false, isHidden: false, isAccepted: false, isMine: false,
        createdAt: minutesAgo(3), updatedAt: minutesAgo(3),
        replies: [
          {
            id: "cm11", parentId: "cm10", author, content: "네 맞아요, sns.barplot 썼습니다!",
            isDeleted: false, isHidden: false, isAccepted: false, isMine: true,
            createdAt: minutesAgo(1), updatedAt: minutesAgo(1),
          },
        ],
      },
    ],
  },
};

const detailOf = (id: string): PostDetail => {
  if (postDetails[id]) return postDetails[id];
  const card = allPosts.find((p) => p.id === id) ?? feedPosts[0];
  return { ...card, content: card.contentPreview, images: [], visibility: "all", acceptedCommentId: null, updatedAt: card.createdAt, isMine: false, isFollowingAuthor: false };
};

const commentsOf = (id: string): CommentTree => commentTrees[id] ?? { items: [], commentCount: 0, acceptedCommentId: null };

const notifications: NotificationItem[] = [
  {
    id: "n1", type: "comment", actor: sampleActor, actorCount: 1,
    post: { id: "c1", title: "XGBoost 파라미터 튜닝 질문 있습니다", board: "question" },
    commentId: "cm1", commentContent: "learning_rate 먼저 줄여보세요!", message: null, until: null,
    isRead: false, createdAt: minutesAgo(5),
  },
  {
    id: "n2", type: "like", actor: sampleActor, actorCount: 3,
    post: { id: "p1", title: "Pandas로 공공데이터 EDA 해본 후기 공유합니다", board: "free" },
    commentId: null, commentContent: null, message: null, until: null,
    isRead: false, createdAt: minutesAgo(20),
  },
  {
    id: "n3", type: "follow", actor: sampleActor, actorCount: 1,
    post: null, commentId: null, commentContent: null, message: null, until: null,
    isRead: true, createdAt: minutesAgo(120),
  },
  {
    id: "n4", type: "accepted", actor: sampleActor, actorCount: 1,
    post: { id: "c1", title: "XGBoost 파라미터 튜닝 질문 있습니다", board: "question" },
    commentId: "cm1", commentContent: null, message: null, until: null,
    isRead: true, createdAt: minutesAgo(200),
  },
  {
    id: "n5", type: "adminWarning", actor: null, actorCount: 1,
    post: null, commentId: null, commentContent: null, message: "부적절한 표현 사용", until: null,
    isRead: false, createdAt: minutesAgo(400),
  },
];

const trendingKeywords: TrendingKeyword[] = [
  { keyword: "판다스", rank: 1, change: "up" },
  { keyword: "캐글", rank: 2, change: "same" },
  { keyword: "SQL 스터디", rank: 3, change: "new" },
  { keyword: "빅분기", rank: 4, change: "down" },
];

const feedTopics: TopicChipItem[] = [
  { key: "all", label: "전체", shortLabel: "전체" },
  { key: "python", label: "Python", shortLabel: "Python" },
  { key: "ml", label: "머신러닝", shortLabel: "ML" },
  { key: "sql", label: "SQL", shortLabel: "SQL" },
  { key: "dataviz", label: "데이터 시각화", shortLabel: "시각화" },
  { key: "stats", label: "통계", shortLabel: "통계" },
];

type Handler = (config: InternalAxiosRequestConfig) => unknown;

const routes: [RegExp, Handler][] = [
  [/^\/feed\/topics$/, () => ({ items: feedTopics })],
  [/^\/feed$/, (): Page<PostCard> => ({ items: feedPosts, nextCursor: null })],
  [
    /^\/posts$/,
    (c) => {
      if (c.method === "post") {
        const data = c.data as FormData;
        const id = `new${Date.now()}`;
        const board = String(data.get("board") || "free") as PostCard["board"];
        const created: PostCard = {
          id, board, title: String(data.get("title") || ""), contentPreview: String(data.get("content") || "").slice(0, 100),
          thumbnail: null, imageCount: 0, author,
          topics: JSON.parse(String(data.get("topics") || "[]")), tags: JSON.parse(String(data.get("tags") || "[]")),
          createdAt: new Date().toISOString(), likeCount: 0, commentCount: 0, scrapCount: 0, viewCount: 0,
          isLiked: false, isScrapped: false, recruit: null, isAnswered: false,
        };
        communityPosts.unshift(created);
        postDetails[id] = { ...created, content: created.contentPreview, images: [], visibility: "all", acceptedCommentId: null, updatedAt: created.createdAt, isMine: true, isFollowingAuthor: false };
        return { _id: id };
      }
      const board = c.params?.board;
      const items = !board || board === "all" ? communityPosts : communityPosts.filter((p) => p.board === board);
      return { items, nextCursor: null } satisfies Page<PostCard>;
    },
  ],
  [
    /^\/search$/,
    (c) => {
      const q: string = (c.params?.q || "").trim();
      const type: string = c.params?.type || "post";
      const isTagQuery = q.startsWith("#");
      const term = (isTagQuery ? q.slice(1) : q).toLowerCase();

      if (type === "post") {
        if (!c.params?.cursor) {
          recentSearches = [{ keyword: q, searchedAt: new Date().toISOString() }, ...recentSearches.filter((r) => r.keyword !== q)].slice(0, 10);
        }
        const items = allPosts.filter((p) =>
          isTagQuery ? p.tags.some((t) => t.toLowerCase() === term) : p.title.toLowerCase().includes(term) || p.tags.some((t) => t.toLowerCase().includes(term)),
        );
        return { items, nextCursor: null } satisfies Page<PostCard>;
      }
      if (type === "user") {
        const items = sampleUsers.filter((u) => u.nickname.toLowerCase().includes(term));
        return { items, nextCursor: null } satisfies Page<UserSummary>;
      }
      // type === "tag"
      const counts = new Map<string, number>();
      allPosts.forEach((p) => p.tags.forEach((t) => t.toLowerCase().startsWith(term) && counts.set(t, (counts.get(t) || 0) + 1)));
      const items = [...counts.entries()].map(([tag, postCount]) => ({ tag, postCount })).sort((a, b) => b.postCount - a.postCount);
      return { items, nextCursor: null };
    },
  ],
  [/^\/search\/recent$/, (c) => (c.method === "delete" ? ((recentSearches = []), { message: "삭제되었습니다." }) : { items: recentSearches })],
  [/^\/search\/recent\/[^/]+$/, (c) => {
    const keyword = decodeURIComponent((c.url || "").split("?")[0].split("/").pop() || "");
    recentSearches = recentSearches.filter((r) => r.keyword !== keyword);
    return { message: "삭제되었습니다." };
  }],
  [/^\/search\/trending$/, () => ({ items: trendingKeywords, computedAt: new Date().toISOString() })],
  [/^\/users\/me$/, (): Me => sampleMe],
  [/^\/users\/[^/]+\/posts$/, (): Page<PostCard> => ({ items: allPosts.filter((p) => p.author?.id === sampleMe.id), nextCursor: null })],
  [/^\/users\/[^/]+\/comments$/, (): Page<MyComment> => ({ items: myComments, nextCursor: null })],
  [/^\/users\/[^/]+\/scraps$/, (): Page<PostCard> => ({ items: communityPosts.slice(0, 1), nextCursor: null })],
  [/^\/notifications$/, (): Page<NotificationItem> => ({ items: notifications, nextCursor: null })],
  [/^\/notifications\/read-all$/, () => {
    notifications.forEach((n) => (n.isRead = true));
    return { message: "읽음 처리되었습니다." };
  }],
  [/^\/notifications\/[^/]+\/read$/, (c) => {
    const id = (c.url || "").split("?")[0].split("/").slice(-2, -1)[0];
    const target = notifications.find((n) => n.id === id);
    if (target) target.isRead = true;
    return { message: "읽음 처리되었습니다." };
  }],
  [/^\/notifications\/unread-count$/, () => ({ count: notifications.filter((n) => !n.isRead).length })],
  [/^\/chat\/unread-count$/, () => ({ count: 0 })],
  [/^\/posts\/[^/]+\/(like|scrap)$/, (c) => ({ isLiked: c.method === "post", likeCount: 25, isScrapped: c.method === "post", scrapCount: 4 })],
  [/^\/posts\/[^/]+\/comments$/, (c) => {
    const id = (c.url || "").split("?")[0].split("/")[2];
    if (c.method !== "post") return commentsOf(id);
    const tree = commentTrees[id] ?? (commentTrees[id] = { items: [], commentCount: 0, acceptedCommentId: null });
    const data = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
    const node = {
      id: `cm${Date.now()}`, parentId: data?.parentId ?? null, author,
      content: data?.content ?? "", isDeleted: false, isHidden: false, isAccepted: false, isMine: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    if (node.parentId) {
      const parent = tree.items.find((i) => i.id === node.parentId);
      if (parent) parent.replies = [...(parent.replies || []), node];
    } else {
      tree.items = [node, ...tree.items];
    }
    tree.commentCount += 1;
    return {};
  }],
  [/^\/posts\/[^/]+$/, (c) => {
    const id = (c.url || "").split("?")[0].split("/").pop() || "";
    if (c.method === "patch") {
      const data = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
      const detail = postDetails[id] ?? detailOf(id);
      const updated: PostDetail = {
        ...detail,
        title: data?.title ?? detail.title,
        content: data?.content ?? detail.content,
        topics: data?.topics ?? detail.topics,
        tags: data?.tags ?? detail.tags,
      };
      postDetails[id] = updated;
      const listItemIndex = communityPosts.findIndex((p) => p.id === id);
      if (listItemIndex >= 0) communityPosts[listItemIndex] = { ...communityPosts[listItemIndex], title: updated.title, tags: updated.tags, topics: updated.topics };
      return updated;
    }
    if (c.method === "delete") {
      delete postDetails[id];
      const idx = communityPosts.findIndex((p) => p.id === id);
      if (idx >= 0) communityPosts.splice(idx, 1);
      return { message: "삭제되었습니다." };
    }
    return detailOf(id) satisfies PostDetail;
  }],
  [/^\/comments\/[^/]+\/accept$/, (c) => {
    const id = (c.url || "").split("?")[0].split("/")[2];
    for (const tree of Object.values(commentTrees)) {
      const target = tree.items.find((i) => i.id === id) || tree.items.flatMap((i) => i.replies || []).find((r) => r.id === id);
      if (target) {
        target.isAccepted = true;
        tree.acceptedCommentId = id;
      }
    }
    return { postId: "p1", acceptedCommentId: id };
  }],
  [/^\/comments\/[^/]+$/, (c) => {
    const id = (c.url || "").split("?")[0].split("/").pop() || "";
    for (const tree of Object.values(commentTrees)) {
      if (c.method === "delete") {
        const target = tree.items.find((i) => i.id === id) || tree.items.flatMap((i) => i.replies || []).find((r) => r.id === id);
        if (target) target.isDeleted = true;
      } else if (c.method === "patch") {
        const data = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        const target = tree.items.find((i) => i.id === id) || tree.items.flatMap((i) => i.replies || []).find((r) => r.id === id);
        if (target) target.content = data?.content ?? target.content;
      }
    }
    return { id, content: "", updatedAt: new Date().toISOString() };
  }],
  [/^\/users\/[^/]+\/follow$/, (c) => ({ message: "ok", isFollowing: c.method === "post", followerCount: 13 })],
  [/^\/reports$/, () => ({ message: "신고가 접수되었습니다." })],
];

export const fixtureAdapter: AxiosAdapter = async (config) => {
  const path = (config.url || "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "").split("?")[0];
  const match = routes.find(([re]) => re.test(path));
  if (!match) {
    return Promise.reject({ config, response: { status: 404, data: { message: `미리보기에 없는 API: ${path}` } } });
  }
  return { data: match[1](config), status: 200, statusText: "OK", headers: {}, config };
};
