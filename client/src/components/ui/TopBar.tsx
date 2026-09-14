import * as React from "react";
import { Bell, Menu, Search } from "lucide-react";
import { IconButton } from "./IconButton";

export interface TopBarProps {
  title?: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onNotificationClick?: () => void;
  /** Shows a small dot on the notification icon. */
  hasNotification?: boolean;
}

/** Hamburger · logo text · search + notification icon buttons. */
export function TopBar({
  title = "Big Ding",
  onMenuClick,
  onSearchClick,
  onNotificationClick,
  hasNotification = false,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconButton aria-label="메뉴 열기" onClick={onMenuClick}>
          <Menu size={18} />
        </IconButton>
        <span className="text-lg font-extrabold tracking-tight text-[var(--text-strong)]">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <IconButton aria-label="검색" onClick={onSearchClick}>
          <Search size={18} />
        </IconButton>
        <div className="relative">
          <IconButton aria-label="알림" onClick={onNotificationClick}>
            <Bell size={18} />
          </IconButton>
          {hasNotification && (
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full border border-white"
              style={{ background: "var(--danger)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
