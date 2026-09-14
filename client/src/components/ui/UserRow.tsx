import * as React from "react";
import { Check } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "./utils";

export interface UserRowProps {
  avatarSrc?: string | null;
  fallbackSrc: string;
  name: string;
  /** e.g. student id, shown as a smaller line under the name. */
  secondaryText?: string;
  /** Row navigates/acts on press — wraps avatar+text in an inner button (never wraps `trailing`, so an interactive trailing element never nests inside a <button>). */
  onPress?: () => void;
  /** Trailing content — a follow Button, a remove IconButton, etc. Ignored when `selectable` is set. */
  trailing?: React.ReactNode;
  /** Renders a circular checkmark instead of custom trailing — for multi-select pickers (invite/create group chat). */
  selectable?: boolean;
  selected?: boolean;
}

/** Avatar + name(+secondary line) row — search results, reaction lists, notifications, chat pickers. */
export function UserRow({ avatarSrc, fallbackSrc, name, secondaryText, onPress, trailing, selectable = false, selected = false }: UserRowProps) {
  const content = (
    <>
      <Avatar src={avatarSrc} fallbackSrc={fallbackSrc} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium" style={{ color: "var(--text-strong)" }}>{name}</p>
        {secondaryText && (
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{secondaryText}</p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-[var(--r-lg)] p-2.5" style={{ background: "var(--bg-card)" }}>
      {onPress ? (
        <button type="button" onClick={onPress} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {content}
        </button>
      ) : (
        content
      )}
      {selectable ? (
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-transparent text-white" : "border-[var(--border-subtle)]",
          )}
          style={{ background: selected ? "var(--blue-deep)" : "transparent" }}
        >
          {selected && <Check size={12} />}
        </span>
      ) : (
        trailing
      )}
    </div>
  );
}
