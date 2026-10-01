// A안에서 추가하는 인덱스 정의. 운영 DB에 앱 기동만으로 자동 생성되지 않도록 스키마에는
// 선언하지 않고, scripts/indexes-a-plan.js가 현재 인덱스와 비교해서 보여준 뒤 --apply로 만든다.
//
// collection: MongoDB 컬렉션 이름 / key: 인덱스 키 / options: createIndex 옵션
// danger: 생성 즉시 기존 데이터에 영향을 주는 인덱스(TTL 등)에 대한 설명
const DAY = 24 * 60 * 60;

module.exports = [
  // Post — 커뮤니티 게시판별 최신순 / 홈 주제별 인기순 / 전체 인기순 / 내 글 / 태그 검색
  { collection: "posts", key: { board: 1, createdAt: -1 }, options: { name: "board_1_createdAt_-1" } },
  { collection: "posts", key: { topics: 1, popularityScore: -1 }, options: { name: "topics_1_popularityScore_-1" } },
  { collection: "posts", key: { popularityScore: -1 }, options: { name: "popularityScore_-1" } },
  { collection: "posts", key: { author: 1, createdAt: -1 }, options: { name: "author_1_createdAt_-1" } },
  { collection: "posts", key: { tags: 1 }, options: { name: "tags_1" } },

  // Comment — 글별 댓글 트리 / 내 댓글
  { collection: "comments", key: { post: 1, createdAt: 1 }, options: { name: "post_1_createdAt_1" } },
  { collection: "comments", key: { author: 1, createdAt: -1 }, options: { name: "author_1_createdAt_-1" } },

  // Feed(홈 피드) — 최신순 / 주제별 최신순, FeedComment — 피드별 댓글
  { collection: "feeds", key: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  { collection: "feeds", key: { tags: 1, createdAt: -1 }, options: { name: "tags_1_createdAt_-1" } },
  { collection: "feedcomments", key: { feed: 1, createdAt: 1 }, options: { name: "feed_1_createdAt_1" } },

  // Story(스토리) — 작성자별 최신순 조회
  { collection: "stories", key: { author: 1, createdAt: -1 }, options: { name: "author_1_createdAt_-1" } },

  // User — 스터디 모집 알림 대상(관심 주제가 겹치는 사용자) 조회
  { collection: "users", key: { interests: 1 }, options: { name: "interests_1" } },
  { collection: "users", key: { tagAlerts: 1 }, options: { name: "tagAlerts_1" } },

  // Notification — 미읽음 목록/개수, expiresAt 시각에 자동 삭제 (제재·처리 결과 알림은 expiresAt 없음)
  { collection: "notifications", key: { recipient: 1, read: 1, createdAt: -1 }, options: { name: "recipient_1_read_1_createdAt_-1" } },
  {
    collection: "notifications",
    key: { expiresAt: 1 },
    options: { name: "expiresAt_ttl", expireAfterSeconds: 0 },
    danger: "생성 직후 expiresAt이 지난 알림이 자동 삭제됩니다 (migrate-a-plan.js가 기존 일반 알림에 생성일+90일을 채움).",
  },

  // PostView — 하루 1회 조회수 (unique + 24시간 TTL)
  { collection: "postviews", key: { post: 1, user: 1 }, options: { name: "post_1_user_1_unique", unique: true } },
  { collection: "postviews", key: { createdAt: 1 }, options: { name: "createdAt_ttl_1d", expireAfterSeconds: DAY } },

  // SearchLog — 인기 검색어 집계(최근 1시간), 7일 TTL
  { collection: "searchlogs", key: { createdAt: 1 }, options: { name: "createdAt_ttl_7d", expireAfterSeconds: 7 * DAY } },

  // TrendingSnapshot — 최신 스냅샷 조회
  { collection: "trendingsnapshots", key: { computedAt: -1 }, options: { name: "computedAt_-1" } },

  // JobState — 작업 key 유일
  { collection: "jobstates", key: { key: 1 }, options: { name: "key_1_unique", unique: true } },

  // Report — 같은 대상 중복 신고 확인
  { collection: "reports", key: { reporter: 1, targetType: 1, targetId: 1 }, options: { name: "reporter_1_targetType_1_targetId_1" } },
];
