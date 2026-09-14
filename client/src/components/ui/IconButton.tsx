import * as React from "react";
import { cn } from "./utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only control — always pass a real aria-label describing the action. */
  "aria-label": string;
  active?: boolean;
}

/** Line icon inside a blue-soft rounded box (top-bar search/notification style). 44x44 minimum touch target. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { active = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-sm)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)]",
        active ? "bg-[var(--blue-primary)] text-white" : "bg-[var(--blue-soft)] text-[var(--blue-deep)] hover:brightness-[0.98]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
