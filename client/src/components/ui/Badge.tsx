import * as React from "react";
import { cn } from "./utils";

/** Mirrors CommunityScreen's BoardType (app/components/CommunityScreen.tsx) so this badge can drop in as-is once that screen migrates. */
export type BoardTone = "free" | "qna" | "contest" | "event" | "lecture" | "meeting" | "alumni";
/** Status tones for admin/moderation labels ("관리자", "영구차단", "탈퇴", "미처리"...) — unrelated to board categories. */
export type StatusTone = "info" | "danger" | "muted" | "success";
export type BadgeTone = BoardTone | StatusTone;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
}

/** Tag pill — softened bg/fg pair per tone, see tokens.css --tag-<tone>-bg/-fg. */
export function Badge({ tone, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-[var(--r-pill)] px-2.5 py-1 text-[11px] font-semibold", className)}
      style={{ background: `var(--tag-${tone}-bg)`, color: `var(--tag-${tone}-fg)` }}
      {...props}
    >
      {children}
    </span>
  );
}
