import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

// A안 주 버튼 (Figma 2:21 Button): #212121 채움, radius 12, 좌우 16·상하 15, 15px Bold 흰 글자.
export function PrimaryButton({ loading = false, disabled, children, className = "", ...props }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading}
      className={`flex w-full items-center justify-center gap-[6px] border-0 px-[16px] py-[15px] text-[15px] leading-[18px] font-bold transition-opacity disabled:cursor-not-allowed ${className}`}
      style={{
        borderRadius: "var(--a-radius-control)",
        background: "var(--a-color-surface-inverse)",
        color: "var(--a-color-on-inverse)",
        opacity: isDisabled && !loading ? 0.4 : 1,
      }}
      {...props}
    >
      {loading && <Loader2 size={18} strokeWidth={1.5} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
