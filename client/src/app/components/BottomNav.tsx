import { Users, MessageCircle, User, Settings } from "lucide-react";
import "@/styles/tokens.css";
import { BottomTab } from "@/components/ui/BottomTab";

type Tab = "community" | "chat" | "profile" | "settings" | "lunch";

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  onTabClick?: (tab: Tab) => void;
  unreadChatCount?: number;
  onWriteClick?: () => void;
}

export function BottomNav({
  active,
  onChange,
  unreadChatCount = 0,
  onWriteClick,
}: BottomNavProps) {
  return (
    <BottomTab
      activeId={active}
      onChange={(id) => onChange(id as Tab)}
      onWriteClick={onWriteClick}
      leftItems={[
        { id: "community", label: "커뮤니티", icon: Users },
        { id: "chat", label: "채팅", icon: MessageCircle, badgeCount: unreadChatCount },
      ]}
      rightItems={[
        { id: "profile", label: "프로필", icon: User },
        { id: "settings", label: "설정", icon: Settings },
      ]}
    />
  );
}
