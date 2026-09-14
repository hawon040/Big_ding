import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
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
      <ResizablePanelGroup
        direction="horizontal"
        style={{ height: 200, border: "1px solid var(--border)", borderRadius: 8 }}
      >
        <ResizablePanel defaultSize={50}>
          <div style={{ padding: 16 }}>게시글 목록</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <div style={{ padding: 16 }}>게시글 미리보기</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
