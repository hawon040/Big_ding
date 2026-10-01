import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Type, X } from "lucide-react";
import { storyApi } from "@/api/aplan";
import type { StoryText } from "@/types/aplan";
import { PrimaryButton } from "./PrimaryButton";
import { StoryCanvas } from "./StoryCanvas";

const MAX_TEXTS = 5;
const TEXT_MAX = 100;
const SIZE_MIN = 0.04;
const SIZE_MAX = 0.16;
const DEFAULT_SIZE = 0.08;
const COLORS = ["#ffffff", "#000000", "#ffe066", "#ff6b9d", "#4dabf7", "#69db7c"];
const COLOR_NAMES: Record<string, string> = {
  "#ffffff": "흰색", "#000000": "검정", "#ffe066": "노랑", "#ff6b9d": "분홍", "#4dabf7": "파랑", "#69db7c": "초록",
};

interface StoryAddProps {
  /** 홈에서 +를 눌러 이미 고른 사진 */
  initialFile: File;
  onClose: () => void;
  onPosted: () => void;
}

// 스토리에 추가: 사진 위에 글을 여러 개 얹을 수 있다. 글은 끌어서 위치를 옮기고, 선택하면 아래 패널에서
// 내용·크기·색을 바꾸거나 지운다. 위치·크기는 사진 대비 비율로 저장돼 보는 쪽 화면에서도 같은 모양이다.
export function StoryAdd({ initialFile, onClose, onPosted }: StoryAddProps) {
  const [file, setFile] = useState<File>(initialFile);
  const [texts, setTexts] = useState<StoryText[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = selected !== null ? texts[selected] : null;
  const patch = (index: number, changes: Partial<StoryText>) =>
    setTexts((prev) => prev.map((t, i) => (i === index ? { ...t, ...changes } : t)));

  const addText = () => {
    if (texts.length >= MAX_TEXTS) return;
    setTexts((prev) => [...prev, { text: "", x: 0.5, y: 0.5, size: DEFAULT_SIZE, color: COLORS[0] }]);
    setSelected(texts.length);
    // 새 글을 바로 입력할 수 있게 입력칸에 포커스 (패널이 그려진 다음 프레임)
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

  const removeText = () => {
    if (selected === null) return;
    setTexts((prev) => prev.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const filled = texts.filter((t) => t.text.trim()).map((t) => ({ ...t, text: t.text.trim() }));
      await storyApi.create(file, filled);
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
          <button
            type="button"
            onClick={addText}
            disabled={texts.length >= MAX_TEXTS}
            aria-label="글 추가"
            className="flex border-0 bg-transparent p-0 disabled:opacity-40"
          >
            <Type size={26} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 px-[12px]">
          <StoryCanvas
            src={preview}
            texts={texts}
            alt="선택한 사진"
            editor={{ selected, onSelect: setSelected, onMove: (i, x, y) => patch(i, { x, y }), placeholder: "글 입력" }}
          />
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFile(f); }} />

        <div className="flex shrink-0 flex-col gap-[10px] px-[16px] pt-[12px] pb-[20px]">
          {current && selected !== null ? (
            <div className="flex flex-col gap-[10px]" role="group" aria-label="선택한 글 편집">
              <div className="flex items-center gap-[8px]">
                <input
                  ref={textInputRef}
                  value={current.text}
                  onChange={(e) => patch(selected, { text: e.target.value })}
                  maxLength={TEXT_MAX}
                  placeholder="사진 위에 올릴 글"
                  aria-label="글 내용"
                  className="min-w-px flex-1 border border-solid bg-transparent px-[14px] py-[11px] text-[14px] leading-[17px] outline-none"
                  style={{ borderColor: "rgba(255,255,255,0.35)", borderRadius: "var(--a-radius-control)", color: "#fff" }}
                />
                <button type="button" onClick={removeText} aria-label="이 글 삭제" className="flex shrink-0 border-0 bg-transparent p-[6px]">
                  <Trash2 size={20} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
                </button>
              </div>
              <label className="flex items-center gap-[10px] text-[12px] leading-[14px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                <span className="shrink-0">크기</span>
                <input
                  type="range"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  step={0.005}
                  value={current.size}
                  onChange={(e) => patch(selected, { size: Number(e.target.value) })}
                  aria-label="글자 크기"
                  className="min-w-px flex-1"
                />
              </label>
              <div className="flex items-center gap-[10px]" role="radiogroup" aria-label="글자 색">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={current.color === c}
                    aria-label={COLOR_NAMES[c]}
                    onClick={() => patch(selected, { color: c })}
                    className="size-[28px] shrink-0 p-0"
                    style={{ borderRadius: "50%", background: c, border: current.color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.4)", boxShadow: current.color === c ? "0 0 0 2px #000 inset" : undefined }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="m-0 text-center text-[12px] leading-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {texts.length === 0 ? "오른쪽 위 Aa로 사진 위에 글을 올릴 수 있어요" : "글을 끌어서 옮기고, 눌러서 수정하세요"}
            </p>
          )}

          {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "#ff7a7a" }}>{error}</p>}
          <div className="flex gap-[8px]">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="사진 다시 선택" className="flex shrink-0 items-center justify-center border border-solid bg-transparent px-[16px] py-[15px]" style={{ borderColor: "rgba(255,255,255,0.35)", borderRadius: "var(--a-radius-control)", color: "#fff" }}>
              <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
            </button>
            <PrimaryButton loading={busy} onClick={share} style={{ borderRadius: "var(--a-radius-control)", background: "#fff", color: "#000" }}>
              스토리 공유
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
