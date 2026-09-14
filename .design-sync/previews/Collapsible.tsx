import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

export function Default() {
  return (
    <div style={{ ...stage, width: 340 }}>
      <Collapsible open>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>신고 처리 기준 자세히 보기</span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              펼치기
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <p style={{ fontSize: 13, marginTop: 8, color: "var(--muted-foreground)" }}>
            동일 게시물이 3회 이상 신고되면 자동으로 노출이 제한되며,
            운영진 검토 후 최종 삭제 여부가 결정됩니다.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
