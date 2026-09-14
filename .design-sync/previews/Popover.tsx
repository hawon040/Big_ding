import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 320,
};

export function Default() {
  return (
    <div style={stage}>
      <Popover open>
        <PopoverTrigger asChild>
          <Button variant="outline">빠른 신고</Button>
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>신고 사유 선택</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              허위 정보, 욕설/비방, 광고성 게시물 중 하나를 선택하세요.
            </div>
            <Button size="sm">신고 제출</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
