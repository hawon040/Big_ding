import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./utils";

export interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional label rendered above the grouped rows. */
  title?: string;
}

/** Grouped-row container (bg-card, r-lg, dividers between children) — the settings-menu section shape. */
export function List({ title, className, children, ...props }: ListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && (
        <p className="px-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {title}
        </p>
      )}
      <div
        className={cn("overflow-hidden rounded-[var(--r-lg)]", className)}
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export interface ListItemProps {
  icon?: React.ReactNode;
  label: string;
  /** Row navigates/acts on press — rendered as an inner button around icon+label (never wraps `trailing`, so an interactive trailing element like <Switch> never nests inside a <button>). Omit for a non-pressable row (e.g. a toggle row). */
  onPress?: () => void;
  /** Trailing content — a <Switch>, a value string, etc. Defaults to a chevron when `onPress` is set. */
  trailing?: React.ReactNode;
  /** Renders the label in --danger instead of --text-body. */
  danger?: boolean;
  last?: boolean;
}

/** One row inside <List> — icon, label, trailing content. Min 44px tall. */
export function ListItem({ icon, label, onPress, trailing, danger = false, last = false }: ListItemProps) {
  const labelColor = danger ? "var(--danger)" : "var(--text-body)";
  const content = (
    <>
      {icon}
      <span className="flex-1 text-sm text-left" style={{ color: labelColor }}>
        {label}
      </span>
    </>
  );

  return (
    <div
      className={cn("flex min-h-11 w-full items-center gap-3 px-4 py-3", !last && "border-b")}
      style={{ borderColor: last ? "transparent" : "var(--border-subtle)" }}
    >
      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)] rounded-[var(--r-sm)]"
        >
          {content}
        </button>
      ) : (
        content
      )}
      {trailing ?? (onPress && <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />)}
    </div>
  );
}
