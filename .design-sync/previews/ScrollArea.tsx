import { ScrollArea } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

const items = [
  "김하늘 님이 회원님의 강의평에 댓글을 남겼습니다.",
  "\"데이터구조론\" 강의평이 채택되어 포인트가 지급되었습니다.",
  "신고하신 게시물이 처리되어 삭제되었습니다.",
  "수강신청 정정 기간이 9월 20일부터 시작됩니다.",
  "박서준 님이 회원님을 팔로우하기 시작했습니다.",
  "\"운영체제\" 게시판에 새 공지가 등록되었습니다.",
  "작성하신 건의사항에 답변이 등록되었습니다.",
  "이번 주 인기 게시물 TOP 5를 확인해보세요.",
  "계정 비밀번호가 변경되었습니다.",
  "\"빅데이터처리\" 팀플 모집글에 지원자가 있습니다.",
  "게시물이 신고 3회 누적되어 검토 대기 중입니다.",
  "관리자가 공지사항을 수정했습니다.",
  "회원님의 댓글에 답글이 달렸습니다.",
  "새로운 학기 강의평 이벤트가 시작됩니다.",
  "저장한 검색어에 새 게시물이 등록되었습니다.",
];

export function Default() {
  return (
    <div style={stage}>
      <ScrollArea type="always" style={{ height: 200, width: 320 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ fontSize: 13, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {t}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
