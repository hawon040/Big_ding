// 개발 전용: A안 미리보기(/__aplan/...)에서 서버 대신 응답하는 가짜 API.
// 내용은 Figma 시안의 예시(제목·숫자·주제)와 같게 맞춰 비교 스크린샷을 찍을 수 있게 한다.
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import type { Page, PostCard, TopicChipItem } from "@/types/aplan";

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
    (c): Page<PostCard> => {
      const board = c.params?.board;
      const items = !board || board === "all" ? communityPosts : communityPosts.filter((p) => p.board === board);
      return { items, nextCursor: null };
    },
  ],
  [/^\/notifications\/unread-count$/, () => ({ count: 0 })],
  [/^\/chat\/unread-count$/, () => ({ count: 0 })],
  [/^\/posts\/[^/]+\/(like|scrap)$/, (c) => ({ isLiked: c.method === "post", likeCount: 25, isScrapped: c.method === "post", scrapCount: 4 })],
];

export const fixtureAdapter: AxiosAdapter = async (config) => {
  const path = (config.url || "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "").split("?")[0];
  const match = routes.find(([re]) => re.test(path));
  if (!match) {
    return Promise.reject({ config, response: { status: 404, data: { message: `미리보기에 없는 API: ${path}` } } });
  }
  return { data: match[1](config), status: 200, statusText: "OK", headers: {}, config };
};
