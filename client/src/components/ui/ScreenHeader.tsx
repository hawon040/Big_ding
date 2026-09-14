import * as React from "react";
import { ArrowLeft, X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** back: ArrowLeft icon box (drill-down navigation). close: X icon box (dismissing an overlay/modal-screen). */
  icon?: "back" | "close";
  /** Trailing slot — a text action button ("완료"/"등록"/"만들기") or any custom node. */
  action?: React.ReactNode;
}

/** Full-screen sub-view header: icon-box back/close + title + optional trailing action. */
export function ScreenHeader({ title, onBack, icon = "back", action }: ScreenHeaderProps) {
  const Icon = icon === "close" ? X : ArrowLeft;
  return (
    <div className="flex shrink-0 items-center gap-3 px-4 py-4">
      <IconButton aria-label={icon === "close" ? "닫기" : "뒤로 가기"} onClick={onBack}>
        <Icon size={16} />
      </IconButton>
      <h2 className="flex-1 truncate text-base font-semibold" style={{ color: "var(--text-strong)" }}>
        {title}
      </h2>
      {action}
    </div>
  );
}
