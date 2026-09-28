import { Avatar } from "./Avatar";
import type { UserSummary } from "@/types/aplan";

interface UserListItemProps {
  user: UserSummary;
  onOpen: (id: string) => void;
}

// 검색 결과의 유저 한 줄 (Figma에 없어 A안 톤으로 구성): 아바타 40 + 닉네임 + 학과·소개 미리보기.
export function UserListItem({ user, onOpen }: UserListItemProps) {
  const meta = [user.department, user.bio].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(user.id)}
      className="flex w-full shrink-0 items-center gap-[12px] border-0 bg-transparent py-[12px] px-0 text-left"
    >
      <Avatar src={user.profileImage} size={40} />
      <span className="flex min-w-px flex-1 flex-col items-start gap-[2px]">
        <span className="text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          {user.nickname}
        </span>
        {meta && (
          <span className="line-clamp-1 w-full text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
            {meta}
          </span>
        )}
      </span>
    </button>
  );
}
