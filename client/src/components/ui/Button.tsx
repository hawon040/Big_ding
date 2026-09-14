import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: blue-deep fill (main CTA). secondary: blue-soft fill. ghost: no fill, text only. */
  variant?: "primary" | "secondary" | "ghost";
  /** Button height in px — 44 is the minimum accessible touch target, 52 for hero CTAs. */
  size?: 44 | 52;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[var(--blue-deep)] text-white hover:brightness-95",
  secondary: "bg-[var(--blue-soft)] text-[var(--blue-deep)] hover:brightness-[0.98]",
  ghost: "bg-transparent text-[var(--text-body)] hover:bg-[var(--blue-soft)]",
};

/** Shared primary/secondary/ghost button — see client/src/dev/DesignPreview.tsx for a live sample of every variant. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = 44, loading = false, fullWidth = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] px-5 text-sm font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)] focus-visible:ring-offset-2",
        "disabled:opacity-60 disabled:pointer-events-none active:scale-[0.99]",
        VARIANT_CLASS[variant],
        size === 52 ? "h-[52px] rounded-[var(--r-lg)]" : "h-[44px]",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  );
});
