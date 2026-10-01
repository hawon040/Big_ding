import { Plus } from "lucide-react";
import type { StoryTrayItem } from "@/types/aplan";
import { Avatar } from "./Avatar";

interface StoryTrayProps {
  items: StoryTrayItem[];
  /** 누른 항목(보기). 내 스토리가 없으면 올리기로 연결된다 */
  onOpen: (index: number) => void;
  onAdd: () => void;
}

const RING_UNSEEN = "linear-gradient(45deg, #f9ce34, #ee2a7b 55%, #6228d7)";

// 홈 상단 스토리 줄: 맨 앞 "내 스토리"(+ 배지로 올리기), 이어서 팔로우하는 사람들.
// 안 본 스토리가 있으면 그라데이션 링, 다 봤으면 회색 링, 내 스토리가 없으면 링 없이 + 배지만.
export function StoryTray({ items, onOpen, onAdd }: StoryTrayProps) {
  return (
    <div className="-mx-[20px] w-[calc(100%+40px)] shrink-0 overflow-x-auto px-[20px] [scrollbar-width:none]">
      <ul className="m-0 flex w-max list-none gap-[14px] p-0" aria-label="스토리">
        {items.map((item, index) => {
          const name = item.isMe ? "내 스토리" : item.user?.nickname ?? "알 수 없음";
          const hasStory = item.count > 0;
          const ring = item.isMe ? (hasStory ? "var(--a-color-border)" : "transparent") : item.hasUnseen ? RING_UNSEEN : "var(--a-color-border)";
          return (
            <li key={item.user?.id ?? `me-${index}`} className="flex w-[68px] flex-col items-center gap-[6px]">
              <span className="relative">
                <button
                  type="button"
                  onClick={() => (hasStory ? onOpen(index) : item.isMe ? onAdd() : undefined)}
                  aria-label={item.isMe ? (hasStory ? "내 스토리 보기" : "스토리 올리기") : `${name} 스토리 보기${item.hasUnseen ? " (새 스토리)" : ""}`}
                  className="flex size-[64px] items-center justify-center border-0 p-[2px]"
                  style={{ borderRadius: "50%", background: ring }}
                >
                  <span className="flex size-full items-center justify-center rounded-full p-[2px]" style={{ background: "var(--a-color-bg)" }}>
                    <Avatar src={item.user?.profileImage} size={54} />
                  </span>
                </button>
                {item.isMe && (
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label="스토리 올리기"
                    className="absolute -right-[8px] -bottom-[8px] flex size-[34px] items-center justify-center border-0 bg-transparent p-0"
                  >
                    <span className="flex size-[22px] items-center justify-center" style={{ borderRadius: "50%", background: "var(--a-color-surface-inverse)", boxShadow: "0 0 0 2px var(--a-color-bg)" }}>
                      <Plus size={14} strokeWidth={2.5} style={{ color: "var(--a-color-on-inverse)" }} aria-hidden />
                    </span>
                  </button>
                )}
              </span>
              <span
                className={`w-full truncate text-center text-[11px] leading-[13px] ${item.hasUnseen ? "font-bold" : "font-normal"}`}
                style={{ color: item.isMe || !item.hasUnseen ? "var(--a-color-text-secondary)" : "var(--a-color-text-primary)" }}
              >
                {name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
