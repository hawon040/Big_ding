import { ChevronLeft } from "lucide-react";

// 설정 하위 화면 공용 상단바: 뒤로 가기 + 제목
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
      <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
        <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
      </button>
      <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{title}</h1>
    </header>
  );
}

// 상태 배지 (처리 중 / 처리 완료 등)
export function StatusBadge({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      className="shrink-0 px-[8px] py-[3px] text-[11px] leading-[13px] font-bold"
      style={{
        borderRadius: "var(--a-radius-pill)",
        background: done ? "var(--a-color-surface-muted)" : "var(--a-color-surface-inverse)",
        color: done ? "var(--a-color-text-secondary)" : "var(--a-color-on-inverse)",
      }}
    >
      {children}
    </span>
  );
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
