import { Star } from "lucide-react";

const STARS = [1, 2, 3, 4, 5];

// 별점 표시(readOnly) / 입력. 0.5 단위: 각 별의 왼쪽 절반을 누르면 x.5, 오른쪽 절반을 누르면 x.0
export function StarRating({ value, onChange, size = 14 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-[2px]"
      role={onChange ? "radiogroup" : "img"}
      aria-label={onChange ? "별점 선택" : `별점 ${value.toFixed(1)}점`}
    >
      {STARS.map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} strokeWidth={1.5} style={{ color: "var(--a-color-border)" }} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }} aria-hidden>
              <Star size={size} strokeWidth={1.5} fill="#FFB400" style={{ color: "#FFB400" }} />
            </span>
            {onChange && (
              <>
                <button type="button" role="radio" aria-checked={value === n - 0.5} aria-label={`${n - 0.5}점`} onClick={() => onChange(n - 0.5)} className="absolute top-0 left-0 h-full w-1/2 border-0 bg-transparent p-0" />
                <button type="button" role="radio" aria-checked={value === n} aria-label={`${n}점`} onClick={() => onChange(n)} className="absolute top-0 right-0 h-full w-1/2 border-0 bg-transparent p-0" />
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}
