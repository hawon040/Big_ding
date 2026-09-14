import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./utils";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** chip (default): compact filter pill for feed/filter bars. field: full-width form-field select for write/edit forms. */
  variant?: "chip" | "field";
  /** field variant only: shown instead of a raw value when nothing matches yet (e.g. "학년을 먼저 선택해주세요"). */
  placeholder?: string;
  disabled?: boolean;
}

/** Self-contained toggle + option panel (sort order, category filter, form selects) — manages its own open state, closes on select or outside click. */
export function Dropdown({ options, value, onChange, className, variant = "chip", placeholder, disabled = false }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  const isField = variant === "field";

  return (
    <div className={cn("relative", isField && "w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-50",
          isField
            ? "w-full justify-between rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm"
            : "rounded-[var(--r-pill)] px-3 py-1.5 text-xs",
        )}
        style={
          isField
            ? { color: current ? "var(--text-body)" : "var(--text-muted)" }
            : { background: "var(--blue-soft)", color: "var(--blue-deep)" }
        }
      >
        {current?.label ?? placeholder ?? value}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute top-full z-20 mt-1 overflow-hidden rounded-[var(--r-md)] py-1",
              isField ? "left-0 right-0 max-h-48 overflow-y-auto" : "right-0 min-w-[110px]",
            )}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn("w-full px-3 py-2 text-left", isField ? "text-sm" : "text-xs")}
                style={{ color: opt.value === value ? "var(--blue-deep)" : "var(--text-body)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
