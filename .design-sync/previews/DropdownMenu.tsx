import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  buttonVariants,
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
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
          게시물 관리
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>게시물 작업</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            수정하기
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>고정하기</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">삭제하기</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
