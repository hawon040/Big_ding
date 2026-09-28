import circle from "@/assets/figma/topic-circle.svg";
import circleSelected from "@/assets/figma/topic-circle-selected.svg";

interface TopicCircleChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

// 홈 주제 원형 칩 (Figma 2:100): 58px 원 + 6 간격 + 11px Medium 라벨.
// 선택: #212121 원(2:98 에셋) / 미선택: #D9D9D9 원(2:101 에셋)
export function TopicCircleChip({ label, selected, onClick }: TopicCircleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-[6px] border-0 bg-transparent p-0"
    >
      <img src={selected ? circleSelected : circle} alt="" className="block size-[58px]" />
      <span className="text-[11px] leading-[13px] font-[500] whitespace-nowrap" style={{ color: "var(--a-color-text-primary)" }}>
        {label}
      </span>
    </button>
  );
}
