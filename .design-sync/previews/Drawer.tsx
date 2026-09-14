import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
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
      <Drawer open>
        <DrawerTrigger asChild>
          <Button variant="outline">메뉴 열기</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>커뮤니티 메뉴</DrawerTitle>
            <DrawerDescription>
              게시판, 강의평, 알림으로 빠르게 이동하세요.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>게시판으로 이동</Button>
            <Button variant="outline">닫기</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
