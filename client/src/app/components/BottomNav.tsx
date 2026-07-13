import { Users, MessageCircle, User, Settings } from "lucide-react";

type Tab = "community" | "chat" | "profile" | "settings";

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  onTabClick?: (tab: Tab) => void;
  unreadChatCount?: number;
}

const tabs = [
  { id: "community" as Tab, icon: Users, label: "커뮤니티" },
  { id: "chat" as Tab, icon: MessageCircle, label: "채팅" },
  { id: "profile" as Tab, icon: User, label: "프로필" },
  { id: "settings" as Tab, icon: Settings, label: "설정" },
];

export function BottomNav({
  active,
  onChange,
  unreadChatCount = 0,
}: BottomNavProps) {
  return (
    <nav className="flex items-center justify-around bg-card border-t border-border px-2 py-2 safe-area-bottom">
      {tabs.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200"
            style={{
              color: isActive ? "var(--primary)" : "var(--muted-foreground)",
            }}
          >
            <div className="relative">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                fill={isActive ? "var(--primary)" : "none"}
                style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}
              />
              {id === "chat" && unreadChatCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: "#d4183d", lineHeight: 1 }}
                >
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              )}
            </div>
            <span className="text-[10px]" style={{ fontWeight: isActive ? 700 : 400 }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}