import { useEffect, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// 화면 아래에서 올라오는 시트 (Figma에 없어 A안 톤으로 구성: 흰 배경, 위쪽 radius 14)
// A안 화면 컬럼(최대 480px) 폭에 맞춰 가운데 정렬한다.
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[var(--a-screen-max)] px-[20px] pt-[12px] pb-[28px]"
        style={{ background: "var(--a-color-bg)", borderRadius: "var(--a-radius-card) var(--a-radius-card) 0 0", fontFamily: "var(--a-font-sans)" }}
      >
        <div className="mx-auto mb-[12px] h-[4px] w-[36px] rounded-[2px]" style={{ background: "var(--a-color-border)" }} aria-hidden />
        <h2 className="m-0 mb-[8px] text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// 시트 안의 한 줄 선택 항목
export function SheetItem({ children, onClick, danger = false, selected = false }: { children: ReactNode; onClick: () => void; danger?: boolean; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center border-0 bg-transparent py-[14px] px-0 text-left text-[15px] leading-[18px] ${selected ? "font-bold" : "font-normal"}`}
      style={{ color: danger ? "var(--a-color-danger)" : "var(--a-color-text-primary)" }}
    >
      {children}
    </button>
  );
}
