import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
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
      <ContextMenu open>
        <ContextMenuTrigger
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            padding: 24,
            fontSize: 13,
            color: "var(--muted-foreground)",
          }}
        >
          게시물을 우클릭하면 메뉴가 열립니다
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>게시물 관리</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem>수정하기</ContextMenuItem>
          <ContextMenuItem>스크랩</ContextMenuItem>
          <ContextMenuItem variant="destructive">삭제하기</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
