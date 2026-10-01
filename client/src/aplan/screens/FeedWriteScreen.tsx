import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { feedPostApi } from "@/api/aplan";
import { MAX_POST_TOPICS, TOPICS, type TopicKey } from "@/constants/topics";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { TopicSelectChip } from "@/aplan/components/TopicSelectChip";
import "@/styles/aplan-tokens.css";

const MAX_IMAGES = 10;
const CONTENT_MAX = 1000;

interface FeedWriteScreenProps {
  onBack: () => void;
  onDone: () => void;
}

// 피드 올리기: 사진 1~10장이 반드시 있어야 올릴 수 있다. 글(최대 1000자)과 주제(최대 3개)는 선택.
// 커뮤니티 글쓰기(WriteScreen)와 달리 게시판·제목이 없고, 저장도 별도 컬렉션(feeds)에 된다.
export function FeedWriteScreen({ onBack, onDone }: FeedWriteScreenProps) {
  const [images, setImages] = useState<File[]>([]);
  const [content, setContent] = useState("");
  const [topics, setTopics] = useState<TopicKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (images.length + incoming.length > MAX_IMAGES) setError(`사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
    else setError(null);
    setImages((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES));
  };

  const toggleTopic = (key: TopicKey) =>
    setTopics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < MAX_POST_TOPICS ? [...prev, key] : prev));

  const submit = async () => {
    if (images.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await feedPostApi.create({ images, content: content.trim(), topics });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.message || "올리지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>피드 올리기</h1>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        <section className="flex w-full flex-col gap-[8px]">
          <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>
            사진 (1~{MAX_IMAGES}장 필수) · {images.length}/{MAX_IMAGES}
          </span>
          <div className="flex w-full flex-wrap gap-[8px]">
            {previews.map((src, i) => (
              <span key={src} className="relative block size-[96px] shrink-0 overflow-hidden border border-solid" style={{ borderColor: "var(--a-color-border)", borderRadius: 8 }}>
                <img src={src} alt={`선택한 사진 ${i + 1}`} className="block size-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 px-[6px] py-[2px] text-[10px] leading-[12px] font-bold" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>대표</span>
                )}
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-[4px] right-[4px] flex size-[20px] items-center justify-center border-0 p-0"
                  style={{ borderRadius: "50%", background: "rgba(0,0,0,0.6)" }}
                >
                  <X size={12} strokeWidth={2} style={{ color: "#fff" }} aria-hidden />
                </button>
              </span>
            ))}
            {images.length < MAX_IMAGES && (
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
          placeholder="사진에 대한 이야기를 적어보세요 (선택)"
          rows={5}
          maxLength={CONTENT_MAX}
          aria-label="내용"
          className="a-text-field w-full resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[18px] font-normal outline-none"
          style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)", fontFamily: "var(--a-font-sans)" }}
        />

        <section className="flex w-full flex-col gap-[8px]">
          <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>주제 (선택, 최대 {MAX_POST_TOPICS}개)</span>
          <div className="flex w-full flex-wrap gap-[8px]">
            {TOPICS.map((t) => (
              <TopicSelectChip key={t.key} selected={topics.includes(t.key)} onClick={() => toggleTopic(t.key)}>
                {t.label}
              </TopicSelectChip>
            ))}
          </div>
        </section>

        {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>}
      </main>

      <div className="shrink-0 px-[20px] pt-[8px] pb-[20px]">
        <PrimaryButton disabled={images.length === 0} loading={submitting} onClick={submit}>
          {images.length === 0 ? "사진을 선택해주세요" : "올리기"}
        </PrimaryButton>
      </div>
    </div>
  );
}
