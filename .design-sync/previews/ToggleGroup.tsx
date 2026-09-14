import { ToggleGroup, ToggleGroupItem } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Single() {
  return (
    <div style={stage}>
      <ToggleGroup type="single" defaultValue="latest">
        <ToggleGroupItem value="latest">최신순</ToggleGroupItem>
        <ToggleGroupItem value="popular">인기순</ToggleGroupItem>
        <ToggleGroupItem value="comments">댓글순</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function Multiple() {
  return (
    <div style={stage}>
      <ToggleGroup type="multiple" defaultValue={["notice", "review"]} variant="outline">
        <ToggleGroupItem value="notice">공지</ToggleGroupItem>
        <ToggleGroupItem value="review">강의평</ToggleGroupItem>
        <ToggleGroupItem value="free">자유게시판</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
