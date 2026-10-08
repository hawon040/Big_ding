import { House, Search, User, Users, type LucideIcon } from "lucide-react";

export type MainTab = "home" | "search" | "community" | "notifications" | "my";

// 알림은 하단 탭이 아니라 홈 헤더의 알림 버튼에서만 연다 (MainShell의 notificationsOpen)
const TABS: { id: Exclude<MainTab, "notifications">; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "홈", icon: House },
  { id: "search", label: "검색", icon: Search },
  { id: "community", label: "커뮤니티", icon: Users },
  { id: "my", label: "MY", icon: User },
];

interface BottomTabBarProps {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}

// 하단 탭바 (Figma 2:173 TabBar): 흰 배경, 위 1px #D9D9D9, 위 10·아래 28 여백, 4칸 균등.
// 아이콘 22 (선 1.5) + 4 간격 + 10px 라벨. 선택: #212121·Bold / 미선택: #999·Regular
export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="flex w-full shrink-0 items-center border-0 border-t border-solid pt-[10px] pb-[28px]"
      style={{ background: "var(--a-color-bg)", borderColor: "var(--a-color-border)" }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const selected = id === active;
        const color = selected ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)";
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(id)}
            className="flex min-w-px flex-1 flex-col items-center gap-[4px] border-0 bg-transparent p-0"
          >
            <span className="relative flex size-[22px] items-center justify-center">
              <Icon size={22} strokeWidth={1.5} style={{ color }} aria-hidden />
            </span>
            <span className={`text-[10px] leading-[12px] whitespace-nowrap ${selected ? "font-bold" : "font-normal"}`} style={{ color }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
