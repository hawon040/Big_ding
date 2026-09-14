import * as React from "react";
import { cn } from "./utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Filter pill — selected: blue-soft fill + blue-primary text, unselected: white + subtle border. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center rounded-[var(--r-pill)] px-3 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)]",
        selected
          ? "bg-[var(--blue-soft)] text-[var(--blue-deep)]"
          : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
