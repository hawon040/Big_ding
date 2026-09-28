// 게시판 목록. 기존 7개 key는 그대로 두고(기존 글의 board 값은 바뀌지 않는다),
// A안 커뮤니티 탭용 게시판을 추가했다. 기존 qna(작품 전시)/contest(꿀팁)와 뜻이 겹치지
// 않도록 A안의 Q&A/공모전은 question/competition이라는 새 key를 쓴다.
// client/src/constants/boards.ts와 반드시 같은 내용으로 유지할 것.
//
// primary: A안 커뮤니티 상단 탭에 노출 (나머지는 "더보기")
// recruit: 모집 정보(recruit) 사용 / accept: 댓글 채택 사용
const BOARDS = [
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
];

const BOARD_KEYS = BOARDS.map((b) => b.key);
const RECRUIT_BOARDS = BOARDS.filter((b) => b.recruit).map((b) => b.key);
const ACCEPT_BOARDS = BOARDS.filter((b) => b.accept).map((b) => b.key);

module.exports = { BOARDS, BOARD_KEYS, RECRUIT_BOARDS, ACCEPT_BOARDS };
