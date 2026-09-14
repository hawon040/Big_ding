import { Input } from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  width: 320,
};

export function States() {
  return (
    <div style={stage}>
      <Input placeholder="게시물 제목을 입력하세요" />
      <Input defaultValue="자료구조 강의평 작성" />
      <Input placeholder="검색어를 입력하세요" disabled />
    </div>
  );
}
