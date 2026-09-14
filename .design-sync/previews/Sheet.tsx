import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 420,
};

export function Default() {
  return (
    <div style={stage}>
      <Sheet open>
        <SheetTrigger asChild>
          <Button variant="outline">필터</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>게시물 필터</SheetTitle>
            <SheetDescription>
              원하는 조건으로 게시물을 좁혀서 볼 수 있습니다.
            </SheetDescription>
          </SheetHeader>
          <div style={{ padding: "0 16px", fontSize: 14, color: "var(--muted-foreground)" }}>
            교과군, 학년, 인기순 등 다양한 조건을 선택하세요.
          </div>
          <SheetFooter>
            <Button variant="outline">초기화</Button>
            <Button>적용하기</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
