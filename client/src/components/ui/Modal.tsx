import * as React from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /** Adds a second, secondary button before Confirm (e.g. "취소") — omit for the single-button alert shape. */
  cancelText?: string;
  onCancel?: () => void;
}

let titleUid = 0;

/** Restyle of the app's existing alert/confirm popups, on the new light tokens. One button by default (alert); pass cancelText+onCancel for a confirm dialog. */
export function Modal({
  open,
  title,
  onClose,
  children,
  confirmText = "확인",
  onConfirm,
  confirmDisabled = false,
  cancelText,
  onCancel,
}: ModalProps) {
  const titleId = React.useRef(`modal-title-${++titleUid}`).current;
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center px-6" style={{ background: "rgba(15,23,42,0.45)" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm overflow-hidden rounded-[var(--r-lg)]"
        style={{ background: "var(--bg-card)", boxShadow: "0 12px 32px rgba(15,23,42,0.16)" }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-[var(--text-strong)]">
            {title}
          </h2>
          <IconButton aria-label="닫기" onClick={onClose} className="h-9 w-9">
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-5 py-2 text-sm leading-relaxed text-[var(--text-body)]">{children}</div>
        <div className="flex gap-2 border-t p-4" style={{ borderColor: "var(--border-subtle)" }}>
          {cancelText && (
            <button
              type="button"
              onClick={onCancel ?? onClose}
              className="h-11 flex-1 rounded-[var(--r-md)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)]"
              style={{ background: "var(--blue-soft)", color: "var(--blue-deep)" }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm ?? onClose}
            disabled={confirmDisabled}
            className="h-11 flex-1 rounded-[var(--r-md)] text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-primary)] focus-visible:ring-offset-2"
            style={{ background: "var(--blue-deep)" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
