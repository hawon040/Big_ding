import * as React from "react";
import { SquarePen, type LucideIcon } from "lucide-react";
import { cn } from "./utils";

export interface BottomTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Small red count badge on the icon (e.g. unread chat count). Shows "99+" above 99. */
  badgeCount?: number;
}

export interface BottomTabProps {
  /** Two tabs rendered left of the center action. */
  leftItems: [BottomTabItem, BottomTabItem];
  /** Two tabs rendered right of the center action. */
  rightItems: [BottomTabItem, BottomTabItem];
  activeId: string;
  onChange: (id: string) => void;
  /** Center floating action (write/compose) — a distinct action, not a 5th tab. */
  onWriteClick?: () => void;
}

/** 5-slot bottom nav: 2 tabs, a raised blue-primary write button, 2 tabs. */
export function BottomTab({ leftItems, rightItems, activeId, onChange, onWriteClick }: BottomTabProps) {
  const renderItem = (item: BottomTabItem) => {
    const isActive = activeId === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange(item.id)}
        aria-current={isActive ? "page" : undefined}
        className="flex min-w-11 flex-col items-center gap-0.5 rounded-[var(--r-md)] px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)]"
        style={{ color: isActive ? "var(--blue-deep)" : "var(--text-muted)" }}
      >
        <span className="relative">
          <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
          {!!item.badgeCount && (
            <span
              className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
              style={{ background: "var(--danger)" }}
            >
              {item.badgeCount > 99 ? "99+" : item.badgeCount}
            </span>
          )}
        </span>
        <span className="text-[11px] font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <div
      className="relative z-[90] flex items-center justify-between px-4 pt-2 pb-3"
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-1">
        {renderItem(leftItems[0])}
        {renderItem(leftItems[1])}
      </div>

      <button
        type="button"
        onClick={onWriteClick}
        aria-label="글쓰기"
        className={cn(
          "absolute left-1/2 -top-5 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-deep)] focus-visible:ring-offset-2",
        )}
        style={{ background: "var(--blue-primary-2)" }}
      >
        <SquarePen size={22} />
      </button>

      <div className="flex items-center gap-1">
        {renderItem(rightItems[0])}
        {renderItem(rightItems[1])}
      </div>
    </div>
  );
}
