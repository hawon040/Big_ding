import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { storyApi } from "@/api/aplan";
import { PrimaryButton } from "./PrimaryButton";

const CAPTION_MAX = 100;

interface StoryAddProps {
  onClose: () => void;
  onPosted: () => void;
}

// 스토리에 추가: 갤러리에서 사진 1장을 고르고(열자마자 선택창이 뜬다), 문구(선택)를 적어 공유한다.
export function StoryAdd({ onClose, onPosted }: StoryAddProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    fileRef.current?.click();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await storyApi.create(file, caption.trim());
      onPosted();
    } catch (err: any) {
      setError(err?.response?.data?.message || "올리지 못했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="스토리에 추가" className="fixed inset-0 z-[70] flex justify-center" style={{ background: "#000" }}>
      <div className="flex h-full w-full max-w-[var(--a-screen-max)] flex-col" style={{ fontFamily: "var(--a-font-sans)" }}>
        <header className="flex shrink-0 items-center gap-[12px] px-[16px] py-[14px]">
          <button type="button" onClick={onClose} aria-label="닫기" className="flex border-0 bg-transparent p-0">
            <X size={26} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
          </button>
          <h1 className="m-0 min-w-px flex-1 text-center text-[17px] leading-[20px] font-bold" style={{ color: "#fff" }}>스토리에 추가</h1>
          <span className="size-[26px]" aria-hidden />
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-[12px]">
          {preview ? (
            <img src={preview} alt="선택한 사진" className="max-h-full max-w-full object-contain" style={{ borderRadius: "var(--a-radius-card)" }} />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-[10px] border-0 bg-transparent p-[24px]"
              style={{ color: "#fff" }}
            >
              <ImagePlus size={40} strokeWidth={1.5} aria-hidden />
              <span className="text-[15px] leading-[18px] font-[500]">사진 선택</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFile(f); }} />

        <div className="flex shrink-0 flex-col gap-[10px] px-[16px] pt-[12px] pb-[20px]">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={CAPTION_MAX}
            placeholder="문구 입력… (선택)"
            aria-label="문구"
            disabled={!file}
            className="w-full border border-solid bg-transparent px-[14px] py-[12px] text-[14px] leading-[17px] outline-none disabled:opacity-40"
            style={{ borderColor: "rgba(255,255,255,0.35)", borderRadius: "var(--a-radius-control)", color: "#fff" }}
          />
          {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "#ff7a7a" }}>{error}</p>}
          <div className="flex gap-[8px]">
            {file && (
              <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 border border-solid bg-transparent px-[16px] py-[15px] text-[14px] leading-[18px] font-[500]" style={{ borderColor: "rgba(255,255,255,0.35)", borderRadius: "var(--a-radius-control)", color: "#fff" }}>
                다시 선택
              </button>
            )}
            <PrimaryButton disabled={!file} loading={busy} onClick={share} style={{ borderRadius: "var(--a-radius-control)", background: "#fff", color: "#000", opacity: file ? 1 : 0.4 }}>
              스토리 공유
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
