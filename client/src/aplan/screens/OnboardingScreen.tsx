import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { meApi } from "@/api/aplan";
import { TOPICS, MIN_INTERESTS, type TopicKey } from "@/constants/topics";
import { TopicSelectChip } from "@/aplan/components/TopicSelectChip";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import type { Me } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface OnboardingScreenProps {
  /** 처음 온보딩이면 "onboarding", 마이페이지에서 관심 기술을 고치러 들어오면 "edit" */
  mode?: "onboarding" | "edit";
  initialInterests?: TopicKey[];
  onDone: (me: Me) => void;
  onBack?: () => void;
}

// A-03 온보딩 (Figma 2:84). 15개 관심 분야 중 3개 이상 선택.
// - 진행 바(2:46)는 가입 → 관심 분야 → 시작 중 두 번째 단계로 표시한다
// - 마이페이지에서 다시 들어오면 진행 바 자리에 뒤로 가기를 두고 버튼은 "저장"으로 동작한다
export function OnboardingScreen({ mode = "onboarding", initialInterests = [], onDone, onBack }: OnboardingScreenProps) {
  const [selected, setSelected] = useState<TopicKey[]>(initialInterests);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: TopicKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const remove = (key: TopicKey) => setSelected((prev) => prev.filter((k) => k !== key));

  const canSubmit = selected.length >= MIN_INTERESTS;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await meApi.saveInterests(selected));
    } catch (err: any) {
      setError(err?.response?.data?.message || "저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="a-screen flex min-h-dvh flex-col">
      {mode === "onboarding" ? (
        // 2:46 진행 바
        <div className="flex w-full items-center gap-[6px] px-[20px] py-[10px]" aria-label="3단계 중 2단계: 관심 분야 선택" role="img">
          {[true, true, false].map((done, i) => (
            <div
              key={i}
              className="h-[4px] min-w-px flex-1 rounded-[2px]"
              style={{ background: done ? "var(--a-color-surface-inverse)" : "var(--a-color-border)" }}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-[24px] items-center px-[16px]">
          <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[24px] items-center justify-center border-0 bg-transparent p-0">
            <ChevronLeft size={22} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} />
          </button>
        </div>
      )}

      {/* 2:91 Body */}
      <div className="flex min-h-px flex-1 flex-col items-start gap-[16px] px-[20px] py-[12px]">
        {/* 2:47 */}
        <h1 className="m-0 w-full text-[26px] leading-[31px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          관심 분야를
          <br />
          선택해주세요
        </h1>
        {/* 2:48 */}
        <p className="m-0 w-full text-[14px] leading-[17px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
          선택한 분야로 맞춤 피드를 추천해드려요 ({MIN_INTERESTS}개 이상)
        </p>
        {/* 2:79 칩 목록 */}
        <div className="flex w-full flex-wrap content-center items-center gap-[8px]" role="group" aria-label="관심 분야">
          {TOPICS.map((t) => (
            <div key={t.key} className="flex items-center gap-[4px]">
              <TopicSelectChip selected={selected.includes(t.key)} onClick={() => toggle(t.key)}>
                {t.label}
              </TopicSelectChip>
              {selected.includes(t.key) && (
                <button
                  type="button"
                  aria-label={`${t.label} 관심 분야 삭제`}
                  onClick={() => remove(t.key)}
                  className="flex size-[18px] items-center justify-center border-0 bg-transparent p-0 text-[12px] leading-none"
                  style={{ color: "var(--a-color-text-secondary)" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>
        )}
        {/* 2:80 여백 */}
        <div className="min-h-px flex-1" aria-hidden />
        {/* 2:82 다음 / 저장 */}
        <PrimaryButton onClick={handleSubmit} disabled={!canSubmit} loading={saving}>
          {mode === "edit" ? "저장" : "다음"} ({selected.length}개 선택됨)
        </PrimaryButton>
      </div>
      {/* 2:83 하단 여백 */}
      <div className="h-[20px] shrink-0" aria-hidden />
    </div>
  );
}
