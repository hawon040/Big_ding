import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 필드 아래 인라인 오류 메시지 */
  error?: string | null;
  /** 화면에 보이지 않는 라벨 (디자인에 라벨이 없고 placeholder만 있을 때 접근성용) */
  label: string;
}

// A안 입력칸 (Figma 2:14 Input): 1px #D9D9D9 테두리, radius 12, 좌우 14·상하 13, 14px 글자.
// 포커스 시 테두리를 본문색으로 바꾸고, 오류가 있으면 테두리와 아래 메시지를 오류색으로 표시한다.
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { error, label, className = "", ...props },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex w-full flex-col gap-[6px] ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="a-text-field w-full border border-solid px-[14px] py-[13px] text-[14px] leading-[17px] font-normal outline-none"
        style={{
          borderRadius: "var(--a-radius-control)",
          borderColor: error ? "var(--a-color-danger)" : undefined,
          color: "var(--a-color-text-primary)",
          background: "var(--a-color-bg)",
        }}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
});
