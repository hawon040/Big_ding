import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { feedPostApi } from "@/api/aplan";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import type { FeedItem } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

const CONTENT_MAX = 1000;

interface FeedEditScreenProps {
  feed: FeedItem;
  onBack: () => void;
  onSaved: (updated: FeedItem) => void;
}

// 피드 수정: 사진은 그대로 두고 글(#태그 포함)만 고친다.
export function FeedEditScreen({ feed, onBack, onSaved }: FeedEditScreenProps) {
  const [content, setContent] = useState(feed.content);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      onSaved(await feedPostApi.update(feed.id, content.trim()));
    } catch (err: any) {
      setError(err?.response?.data?.message || "수정하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="a-screen fixed inset-0 z-[70] mx-auto flex flex-col overflow-hidden">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>피드 수정</h1>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
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
        <PrimaryButton loading={submitting} onClick={submit}>저장</PrimaryButton>
      </div>
    </div>
  );
}