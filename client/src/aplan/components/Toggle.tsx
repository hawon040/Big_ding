interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

// 설정 화면 토글 스위치 (Figma 2:432 Toggle): 46×26 알약, 켜짐 #212121 + 흰 원, 꺼짐 #D9D9D9 + 흰 원.
export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex h-[26px] w-[46px] shrink-0 items-center border-0 p-0 disabled:opacity-50"
      style={{ borderRadius: "var(--a-radius-pill)", background: checked ? "var(--a-color-surface-inverse)" : "var(--a-color-border)", transition: "background-color 0.15s" }}
    >
      <span
        aria-hidden
        className="absolute block size-[22px] rounded-full bg-white"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)", transition: "transform 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
      />
    </button>
  );
}
