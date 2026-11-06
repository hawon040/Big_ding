import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { feedPostApi } from "@/api/aplan";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import type { FeedItem } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

const CONTENT_MAX = 1000;
const MAX_IMAGES = 10;

interface FeedEditScreenProps {
  feed: FeedItem;
  onBack: () => void;
  onSaved: (updated: FeedItem) => void;
}

// 피드 수정: 글(#태그 포함)과 사진을 고친다. 사진은 1~10장이어야 하고,
// 남긴 기존 사진 뒤에 새로 추가한 사진이 붙는다(서버 PUT /api/feeds/:id 규칙과 같음).
export function FeedEditScreen({ feed, onBack, onSaved }: FeedEditScreenProps) {
  const [content, setContent] = useState(feed.content);
  const [kept, setKept] = useState<string[]>(feed.images);
  const [added, setAdded] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const addedPreviews = useMemo(() => added.map((f) => URL.createObjectURL(f)), [added]);
  useEffect(() => () => addedPreviews.forEach((u) => URL.revokeObjectURL(u)), [addedPreviews]);
  const total = kept.length + added.length;
  const imagesChanged = added.length > 0 || kept.length !== feed.images.length || kept.some((u, i) => u !== feed.images[i]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files); // input을 비우기 전에 복사
    if (total + incoming.length > MAX_IMAGES) setError(`사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
    else setError(null);
    setAdded((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES - kept.length));
  };
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting || total === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      onSaved(await feedPostApi.update(feed.id, content.trim(), imagesChanged ? { keep: kept, files: added } : undefined));
    } catch (err: any) {
      setError(err?.response?.data?.message || "수정하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="a-screen fixed inset-0 z-[70] mx-auto flex flex-col overflow-hidden">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex h-[31px] w-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>피드 수정</h1>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        <section className="flex w-full flex-col gap-[8px]">
          <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>
            사진 (1~{MAX_IMAGES}장 필수) · {total}/{MAX_IMAGES}
          </span>
          <div className="flex w-full flex-wrap gap-[8px]">
            {[...kept.map((src) => ({ src, remove: () => setKept((prev) => prev.filter((u) => u !== src)) })),
              ...addedPreviews.map((src, i) => ({ src, remove: () => setAdded((prev) => prev.filter((_, idx) => idx !== i)) }))].map(({ src, remove }, i) => (
              <span key={src} className="relative block size-[96px] shrink-0 overflow-hidden border border-solid" style={{ borderColor: "var(--a-color-border)", borderRadius: 8 }}>
                <img src={src} alt={`사진 ${i + 1}`} className="block size-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 px-[6px] py-[2px] text-[10px] leading-[12px] font-bold" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>대표</span>
                )}
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={() => { remove(); setError(null); }}
                  className="absolute top-[4px] right-[4px] flex size-[20px] items-center justify-center border-0 p-0"
                  style={{ borderRadius: "50%", background: "rgba(0,0,0,0.6)" }}
                >
                  <X size={12} strokeWidth={2} style={{ color: "#fff" }} aria-hidden />
                </button>
              </span>
            ))}
            {total < MAX_IMAGES && (
              <button
                type="button"
                aria-label="사진 추가"
                onClick={() => fileRef.current?.click()}
                className="flex size-[96px] shrink-0 items-center justify-center border border-dashed p-0"
                style={{ borderColor: "var(--a-color-border)", borderRadius: 8, background: "var(--a-color-surface-muted)" }}
              >
                <Plus size={24} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
        </section>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="사진에 대한 이야기를 적어보세요 — #태그를 붙이면 태그가 돼요"
          rows={8}
          maxLength={CONTENT_MAX}
          aria-label="내용"
          className="a-text-field w-full shrink-0 resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[18px] font-normal outline-none"
          style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)", fontFamily: "var(--a-font-sans)" }}
        />
        {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>}
      </main>

      <div className="shrink-0 px-[20px] pt-[8px] pb-[20px]">
        <PrimaryButton disabled={total === 0} loading={submitting} onClick={submit}>{total === 0 ? "사진을 선택해주세요" : "저장"}</PrimaryButton>
      </div>
    </div>
  );
}