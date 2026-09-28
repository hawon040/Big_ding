import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  /** 아이콘 크기(px). 헤더 22 (Figma 2:95) */
  size?: number;
  /** 0보다 크면 오른쪽 위에 미읽음 배지 */
  badge?: number;
}

// 헤더 아이콘 버튼. 선 두께 1.5, 색 #666 (Figma 2:95·2:96)
export function IconButton({ icon: Icon, label, size = 22, badge = 0, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={badge > 0 ? `${label} (새 항목 ${badge}개)` : label}
      className="relative flex shrink-0 items-center justify-center border-0 bg-transparent p-0"
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon size={size} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
      {badge > 0 && <Badge count={badge} />}
    </button>
  );
}

// 미읽음 배지 (Figma에 없어 A안 톤으로 추가: #212121 원 + 흰 숫자 10px)
export function Badge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -top-[5px] -right-[7px] flex h-[16px] min-w-[16px] items-center justify-center px-[4px] text-[10px] leading-[12px] font-bold"
      style={{
        borderRadius: "var(--a-radius-pill)",
        background: "var(--a-color-surface-inverse)",
        color: "var(--a-color-on-inverse)",
        boxShadow: "0 0 0 2px var(--a-color-bg)",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
