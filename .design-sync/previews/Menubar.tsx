import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 320,
};

export function Open() {
  return (
    <div style={stage}>
      <Menubar defaultValue="board">
        <MenubarMenu value="board">
          <MenubarTrigger>게시판</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              새 글 작성 <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>내가 쓴 글</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>신고 내역</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>회원</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>내 프로필</MenubarItem>
            <MenubarItem>알림 설정</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>관리</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>회원 관리</MenubarItem>
            <MenubarItem>신고 처리</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
