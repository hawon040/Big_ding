import * as React from "react";
import { cn } from "./utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

/** bg-card + border-subtle + r-lg + shadow-card — the base surface for every new-language panel. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card({ className, style, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--r-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4",
        className,
      )}
      style={{ boxShadow: "var(--shadow-card)", ...style }}
      {...props}
    />
  );
});
