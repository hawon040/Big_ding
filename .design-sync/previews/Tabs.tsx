import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

export function Default() {
  return (
    <div style={{ ...stage, width: 420 }}>
      <Tabs defaultValue="popular">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="popular">인기</TabsTrigger>
          <TabsTrigger value="recent">최신</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <p style={{ fontSize: 14, margin: "12px 0 0" }}>
            모든 게시판의 글을 최신 순으로 보여줍니다.
          </p>
        </TabsContent>
        <TabsContent value="popular">
          <p style={{ fontSize: 14, margin: "12px 0 0" }}>
            "빅데이터처리 팀플 조원 구합니다" 외 12건이 오늘 인기글로
            올라왔습니다.
          </p>
        </TabsContent>
        <TabsContent value="recent">
          <p style={{ fontSize: 14, margin: "12px 0 0" }}>
            방금 전 "수강신청 정정 기간 안내" 게시물이 등록되었습니다.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
