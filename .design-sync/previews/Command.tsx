import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandEmpty,
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
      <Command style={{ width: 320, border: "1px solid var(--border)" }}>
        <CommandInput placeholder="강의명으로 검색..." />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="인기 강의">
            <CommandItem>자료구조</CommandItem>
            <CommandItem>운영체제</CommandItem>
            <CommandItem>데이터베이스</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="최근 검색">
            <CommandItem>알고리즘</CommandItem>
            <CommandItem>컴퓨터네트워크</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
