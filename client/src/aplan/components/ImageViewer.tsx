import { useEffect } from "react";
import { X } from "lucide-react";
import { resolveAssetUrl } from "@/api";

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

// 사진 전체화면 상세보기: 어두운 배경 위에 사진을 크게 보여준다. 배경·X 버튼·Esc로 닫는다.
export function ImageViewer({ src, alt = "프로필 사진", onClose }: ImageViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute top-[16px] right-[16px] flex size-[36px] items-center justify-center border-0 p-0"
        style={{ borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
      >
        <X size={20} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
      </button>
      <img src={resolveAssetUrl(src)} alt={alt} className="max-h-[90dvh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}