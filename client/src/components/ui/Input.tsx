import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Inline error text rendered below the field in --danger. Also sets aria-invalid. */
  error?: string;
  /** Keeps the label in the accessibility tree (sr-only) without showing it visually — for a search box whose placeholder already conveys its purpose. */
  hideLabel?: boolean;
}

let uid = 0;
function useAutoId(id?: string) {
  const ref = React.useRef(id ?? `field-${++uid}`);
  return id ?? ref.current;
}

/** Labelled text input with focus tint and inline error — see DesignPreview.tsx for the error state. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, hideLabel = false, className, ...props },
  ref,
) {
  const fieldId = useAutoId(id);
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={hideLabel ? "sr-only" : "text-[13px] font-medium text-[var(--text-body)]"}>
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={cn(
          "h-11 w-full rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 text-sm text-[var(--text-body)]",
          "placeholder:text-[var(--text-muted)] outline-none transition-colors",
          "focus:bg-[var(--blue-soft)] focus:border-[var(--blue-primary)] focus:ring-2 focus:ring-[var(--blue-primary)]/30",
          error && "border-[var(--danger)]",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
});
