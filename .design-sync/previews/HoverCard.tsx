import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 260,
};

export function Default() {
  return (
    <div style={stage}>
      <HoverCard open>
        <HoverCardTrigger asChild>
          <a href="#" style={{ color: "var(--primary)", fontWeight: 600 }}>
            @haewon_kim
          </a>
        </HoverCardTrigger>
        <HoverCardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontWeight: 600 }}>김하원</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              데이터사이언스학과 · 게시물 42 · 가입일 2024.03
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
