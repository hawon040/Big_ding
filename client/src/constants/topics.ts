// 관심 주제(온보딩 15개). server/constants/topics.js와 반드시 같은 내용으로 유지할 것.
export const TOPICS = [
  { key: "python", label: "Python", shortLabel: "Python" },
  { key: "sql", label: "SQL", shortLabel: "SQL" },
  { key: "ml", label: "머신러닝", shortLabel: "ML" },
  { key: "dl", label: "딥러닝", shortLabel: "DL" },
  { key: "dataviz", label: "데이터 시각화", shortLabel: "시각화" },
  { key: "stats", label: "통계", shortLabel: "통계" },
  { key: "r", label: "R", shortLabel: "R" },
  { key: "spark", label: "Spark", shortLabel: "Spark" },
  { key: "hadoop", label: "Hadoop", shortLabel: "Hadoop" },
  { key: "tableau", label: "Tableau", shortLabel: "Tableau" },
  { key: "kaggle", label: "Kaggle", shortLabel: "Kaggle" },
  { key: "competition", label: "공모전", shortLabel: "공모전" },
  { key: "paper", label: "논문 스터디", shortLabel: "논문" },
  { key: "career", label: "취업·인턴", shortLabel: "취업" },
  { key: "bigdata-cert", label: "빅분기 자격증", shortLabel: "빅분기" },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"];

export const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.key, t])) as Record<
  TopicKey,
  (typeof TOPICS)[number]
>;

export const MIN_INTERESTS = 3;
export const MAX_POST_TOPICS = 3;
export const MAX_POST_TAGS = 10;
