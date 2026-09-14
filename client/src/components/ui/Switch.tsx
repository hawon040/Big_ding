import * as React from "react";
import { cn } from "./utils";

export interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/** Boolean toggle — blue-primary when on, border-subtle track when off. 44x24 hit area via padding. */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, disabled, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-[var(--r-pill)] transition-colors disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)] focus-visible:ring-offset-2",
        className,
      )}
      style={{ background: checked ? "var(--blue-primary)" : "var(--border-subtle)" }}
      {...props}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? "calc(100% - 22px)" : "2px" }}
      />
    </button>
  );
});
