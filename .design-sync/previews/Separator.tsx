import { Separator } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Horizontal() {
  return (
    <div style={{ ...stage, width: 320 }}>
      <div style={{ fontSize: 14 }}>강의평</div>
      <Separator style={{ margin: "12px 0" }} />
      <div style={{ fontSize: 14 }}>수강신청 Q&A</div>
    </div>
  );
}

export function Vertical() {
  return (
    <div style={{ ...stage, display: "flex", alignItems: "center", height: 40, gap: 12 }}>
      <span style={{ fontSize: 14 }}>공지사항</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 14 }}>자유게시판</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 14 }}>강의평</span>
    </div>
  );
}
