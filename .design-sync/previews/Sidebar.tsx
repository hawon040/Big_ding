import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 0,
  borderRadius: 8,
  height: 420,
  overflow: "hidden" as const,
  position: "relative" as const,
  width: 720,
};

const navItems = ["홈", "게시판", "강의평", "마이페이지"];

export function Default() {
  return (
    <div style={stage}>
      <SidebarProvider style={{ minHeight: "100%" }}>
        <Sidebar collapsible="none">
          <SidebarHeader>
            <div style={{ fontWeight: 600, padding: 8 }}>Bigdata Community</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.map((label, i) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton isActive={i === 1}>
                    {label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div style={{ fontSize: 12, opacity: 0.7, padding: 8 }}>
              하원 · 학생회원
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: 0 }}>게시판</h3>
            <p style={{ fontSize: 14, opacity: 0.8 }}>
              최근 등록된 게시물 목록이 여기에 표시됩니다.
            </p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
