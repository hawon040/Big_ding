import * as React from "react";
import { FileText } from "lucide-react";
import { Card } from "./Card";

export interface PollOption {
  label: string;
  percent: number;
}

export interface PollCardProps {
  title: string;
  options: PollOption[];
  participantCount: number;
  /** Makes each option a vote button instead of a static bar. */
  onSelect?: (index: number) => void;
  /** Index of the option the current user already voted for, if any. */
  selectedIndex?: number;
  /** Skips the Card wrapper (no border/shadow/padding of its own) — for a poll already nested inside another Card, e.g. a feed post. */
  bare?: boolean;
}

/** Vote bars filled by percent, with the option label and percentage inside the bar. Pass onSelect to make it an interactive ballot. */
export function PollCard({ title, options, participantCount, onSelect, selectedIndex, bare = false }: PollCardProps) {
  const Wrapper: React.ElementType = bare ? "div" : Card;
  return (
    <Wrapper className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
        <FileText size={16} style={{ color: "var(--blue-primary)" }} />
        {title}
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const filled = option.percent > 0;
          const isMine = i === selectedIndex;
          const barStyle: React.CSSProperties = {
            borderColor: isMine ? "var(--blue-primary)" : filled ? "transparent" : "var(--border-subtle)",
            background: filled ? "var(--bg-input)" : "var(--bg-card)",
          };
          const barContent = (
            <>
              <div
                className="absolute inset-y-0 left-0 rounded-[var(--r-sm)] transition-[width]"
                style={{ width: `${option.percent}%`, background: "var(--blue-primary-2)" }}
              />
              <div className="relative flex h-full items-center justify-between px-3 text-[13px] font-medium">
                <span style={{ color: filled && option.percent > 20 ? "white" : "var(--text-body)" }}>
                  {option.label}{isMine ? " ✓" : ""}
                </span>
                <span style={{ color: filled && option.percent > 85 ? "white" : "var(--text-muted)" }}>
                  {option.percent}%
                </span>
              </div>
            </>
          );
          return onSelect ? (
            <button
              key={option.label}
              type="button"
              onClick={() => onSelect(i)}
              className="relative h-9 w-full overflow-hidden rounded-[var(--r-sm)] border text-left"
              style={barStyle}
            >
              {barContent}
            </button>
          ) : (
            <div key={option.label} className="relative h-9 overflow-hidden rounded-[var(--r-sm)] border" style={barStyle}>
              {barContent}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)]">{participantCount}명 참여</p>
    </Wrapper>
  );
}
