import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveAssetUrl } from "@/api";

type ImageViewerProps = {
  alt?: string;
  onClose: () => void;
} & (
  | { /** 사진 한 장 (프로필 사진 등) */ src: string; images?: never; startIndex?: never }
  | { /** 여러 장: 옆으로 넘겨 본다 */ images: string[]; startIndex?: number; src?: never }
);

// 공용 사진 전체화면 상세보기 (피드·커뮤니티·프로필 공용).
// 어두운 배경 위에 사진을 크게 보여주고, 여러 장이면 스와이프·←/→ 키·좌우 버튼으로 넘긴다. 배경·X 버튼·Esc로 닫는다.
export function ImageViewer({ alt = "사진", onClose, ...rest }: ImageViewerProps) {
  const images = rest.images ?? [rest.src];
  const [index, setIndex] = useState(() => Math.min(Math.max(rest.startIndex ?? 0, 0), images.length - 1));
  const trackRef = useRef<HTMLDivElement>(null);
  const multi = images.length > 1;

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el || i < 0 || i >= images.length) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  // 처음 연 사진 위치로 바로 이동 (애니메이션 없이)
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = el.clientWidth * index;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 뒤 화면이 같이 스크롤되지 않게 막는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const navButton = "absolute top-1/2 z-10 hidden size-[36px] -translate-y-1/2 items-center justify-center border-0 p-0 disabled:opacity-0 sm:flex";
  const navStyle = { borderRadius: "50%", background: "rgba(255,255,255,0.15)" };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[90]"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute top-[16px] right-[16px] z-10 flex size-[36px] items-center justify-center border-0 p-0"
        style={{ borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
      >
        <X size={20} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
      </button>

      <div
        ref={trackRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) setIndex(i);
        }}
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            <img
              src={resolveAssetUrl(src)}
              alt={multi ? `${alt} ${i + 1}/${images.length}` : alt}
              className="max-h-[90dvh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>

      {multi && (
        <>
          <button
            type="button"
            aria-label="이전 사진"
            disabled={index === 0}
            onClick={(e) => { e.stopPropagation(); go(index - 1); }}
            className={`${navButton} left-[16px]`}
            style={navStyle}
          >
            <ChevronLeft size={22} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="다음 사진"
            disabled={index === images.length - 1}
            onClick={(e) => { e.stopPropagation(); go(index + 1); }}
            className={`${navButton} right-[16px]`}
            style={navStyle}
          >
            <ChevronRight size={22} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="absolute bottom-[24px] left-1/2 -translate-x-1/2 px-[12px] py-[4px] text-[12px] leading-[14px] font-[600]"
            style={{ borderRadius: "var(--a-radius-pill)", background: "rgba(255,255,255,0.18)", color: "#fff" }}
          >
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}
