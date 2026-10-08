import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

// 앱 공용 확인·알림 창 (window.confirm / window.alert 대체).
// 브라우저 기본 창은 OS 스타일로 떠서 A안 디자인과 맞지 않아서, 같은 토큰으로 그린 창을 띄운다.
//
// 사용법 (어느 파일에서든 import만 하면 된다 — 창은 App 최상단의 <DialogHost />가 그린다)
//   if (!(await confirmDialog({ title: "게시물을 삭제할까요?", message: "되돌릴 수 없어요.", confirmText: "삭제", danger: true }))) return;
//   alertDialog("삭제하지 못했어요.");
//
// window.confirm과 달리 코드 실행을 멈추지 않으므로, 반드시 await으로 결과를 기다린 뒤 진행한다.

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 삭제·탈퇴처럼 되돌릴 수 없는 동작이면 확인 버튼을 빨간색으로 */
  danger?: boolean;
}

interface DialogRequest extends ConfirmOptions {
  kind: "confirm" | "alert";
  resolve: (ok: boolean) => void;
}

// 여러 창이 한꺼번에 요청되면 순서대로 하나씩 띄운다
const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const open = (req: Omit<DialogRequest, "resolve">) =>
  new Promise<boolean>((resolve) => {
    queue.push({ ...req, resolve });
    notify();
  });

export const confirmDialog = (options: ConfirmOptions) => open({ kind: "confirm", ...options });

export const alertDialog = (title: string, message?: string) =>
  open({ kind: "alert", title, message }).then(() => undefined);

export function DialogHost() {
  const [, rerender] = useState(0);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const current = queue[0];

  const close = (ok: boolean) => {
    const req = queue.shift();
    req?.resolve(ok);
    notify();
  };

  useEffect(() => {
    if (!current) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(current.kind === "alert");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;
  const isConfirm = current.kind === "confirm";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-[40px]"
      style={{ background: "rgba(0,0,0,0.48)", backdropFilter: "blur(3px)" }}
      onClick={() => close(!isConfirm)}
    >
      <div
        role={isConfirm ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="a-dialog-title"
        aria-describedby={current.message ? "a-dialog-message" : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[320px] flex-col gap-[20px] border border-solid px-[20px] pt-[24px] pb-[16px]"
        style={{ background: "var(--a-color-bg)", borderColor: "var(--a-color-border)", borderRadius: 20, boxShadow: "0 18px 48px rgba(0,0,0,0.2)", fontFamily: "var(--a-font-sans)" }}
      >
        <div className="flex flex-col gap-[8px] text-center">
          {current.danger && (
            <span className="mx-auto flex size-[44px] items-center justify-center" style={{ borderRadius: "50%", background: "color-mix(in srgb, var(--a-color-danger) 12%, transparent)" }}>
              <AlertTriangle size={21} strokeWidth={1.8} style={{ color: "var(--a-color-danger)" }} aria-hidden />
            </span>
          )}
          <h2 id="a-dialog-title" className="m-0 text-[16px] leading-[22px] font-bold whitespace-pre-line" style={{ color: "var(--a-color-text-primary)" }}>
            {current.title}
          </h2>
          {current.message && (
            <p id="a-dialog-message" className="m-0 text-[13px] leading-[18px] font-normal whitespace-pre-line" style={{ color: "var(--a-color-text-secondary)" }}>
              {current.message}
            </p>
          )}
        </div>

        <div className="flex w-full gap-[8px]">
          {isConfirm && (
            <button
              type="button"
              onClick={() => close(false)}
              className="min-w-px flex-1 border-0 py-[12px] text-[14px] leading-[17px] font-[500]"
              style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
            >
              {current.cancelText ?? "취소"}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close(true)}
            className="min-w-px flex-1 border-0 py-[12px] text-[14px] leading-[17px] font-bold"
            style={{
              borderRadius: "var(--a-radius-control)",
              background: current.danger ? "var(--a-color-danger)" : "var(--a-color-surface-inverse)",
              color: "var(--a-color-on-inverse)",
            }}
          >
            {current.confirmText ?? "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}