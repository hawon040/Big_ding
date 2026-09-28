import { useLayoutEffect, useRef, type ButtonHTMLAttributes } from "react";

interface TopicSelectChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

// 온보딩 관심 분야 칩 (Figma 2:50 Chip): 좌우 16·상하 9, 완전 둥근 모서리, 14px Medium.
// 선택: #212121 채움 + 흰 글자 / 미선택: #F2F2F2 채움 + #666 글자
export function TopicSelectChip({ selected, children, ...props }: TopicSelectChipProps) {
  const labelRef = useFigmaTextWidth();
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="shrink-0 border-0 px-[16px] py-[9px] text-[14px] leading-[17px] font-[500] whitespace-nowrap transition-colors"
      style={{
        borderRadius: "var(--a-radius-pill)",
        background: selected ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
        color: selected ? "var(--a-color-on-inverse)" : "var(--a-color-icon)",
      }}
      {...props}
    >
      <span ref={labelRef} className="inline-block">{children}</span>
    </button>
  );
}

// Figma는 글자 폭에 맞춘 텍스트 상자의 너비를 정수 px로 올림한다(예: 48.3px → 49px).
// 브라우저는 소수점 폭을 그대로 써서 칩이 조금씩 좁아지고, 여러 줄로 감쌀 때 줄바꿈 위치가
// Figma와 달라진다. 웹폰트가 로드된 뒤 글자 폭을 재서 올림한 값으로 고정한다.
function useFigmaTextWidth() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      el.style.width = "";
      el.style.width = `${Math.ceil(el.getBoundingClientRect().width)}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      cancelled = true;
    };
  });
  return ref;
}
