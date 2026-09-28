// 게시판 목록. server/constants/boards.js와 반드시 같은 내용으로 유지할 것.
// primary: A안 커뮤니티 상단 탭 / recruit: 모집 정보 / accept: 댓글 채택
export const BOARDS = [
  { key: "free", label: "자유", primary: true },
  { key: "question", label: "Q&A", primary: true, accept: true },
  { key: "study", label: "스터디", primary: true, recruit: true },
  { key: "competition", label: "공모전", primary: true, recruit: true },
  { key: "career", label: "취업", primary: true },
  { key: "event", label: "공지사항", primary: false },
  { key: "qna", label: "선배들 작품 전시 공간", primary: false },
  { key: "contest", label: "꿀팁 게시판", primary: false },
  { key: "lecture", label: "전공 강의평가", primary: false },
  { key: "meeting", label: "공강모임", primary: false },
  { key: "alumni", label: "졸업생 게시판", primary: false },
] as const;

export type BoardKey = (typeof BOARDS)[number]["key"];

export const PRIMARY_BOARDS = BOARDS.filter((b) => b.primary);
export const RECRUIT_BOARDS: BoardKey[] = ["study", "competition"];
export const ACCEPT_BOARDS: BoardKey[] = ["question"];
