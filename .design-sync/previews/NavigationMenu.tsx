import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 260,
};

export function Open() {
  return (
    <div style={stage}>
      <NavigationMenu defaultValue="board" viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem value="board">
            <NavigationMenuTrigger>게시판</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, minWidth: 200 }}>
                <NavigationMenuLink href="#">자유게시판</NavigationMenuLink>
                <NavigationMenuLink href="#">강의평 게시판</NavigationMenuLink>
                <NavigationMenuLink href="#">취업/진로 게시판</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>커뮤니티</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, minWidth: 200 }}>
                <NavigationMenuLink href="#">동아리</NavigationMenuLink>
                <NavigationMenuLink href="#">스터디</NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
