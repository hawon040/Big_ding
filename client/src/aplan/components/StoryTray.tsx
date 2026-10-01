import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { StoryTrayItem } from "@/types/aplan";
import { Avatar } from "./Avatar";

interface StoryTrayProps {
  items: StoryTrayItem[];
  /** 스토리가 있는 항목을 눌렀을 때(보기) */
  onOpen: (index: number) => void;
  /** 올리기: 갤러리에서 사진을 고르면 호출된다 */
  onPickPhoto: (file: File) => void;
}

// 눌렀을 때 갤러리 선택창이 뜨는 영역. JS로 input.click()을 부르지 않고, 투명한 파일 입력창을 위에 덮어
// 사용자의 탭이 입력창에 직접 닿게 한다 — 모바일 사파리·앱 내 브라우저 등 어디서든 막히지 않는다.
// className에는 위치 지정(relative 또는 absolute)을 호출하는 쪽에서 반드시 넣는다(입력창이 이 영역을 덮는다).
function PhotoPicker({ label, onPick, className, children }: { label: string; onPick: (file: File) => void; className?: string; children: ReactNode }) {
  return (
    <span className={className}>
      {children}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </span>
  );
}

const RING_UNSEEN = "linear-gradient(45deg, #f9ce34, #ee2a7b 55%, #6228d7)";

// 홈 상단 스토리 줄: 맨 앞 "내 스토리"(+ 배지로 올리기), 이어서 팔로우하는 사람들.
// 안 본 스토리가 있으면 그라데이션 링, 다 봤으면 회색 링, 내 스토리가 없으면 링 없이 + 배지만.
export function StoryTray({ items, onOpen, onPickPhoto }: StoryTrayProps) {
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
                {item.isMe && !hasStory ? (
                  <PhotoPicker label="스토리 올리기" onPick={onPickPhoto} className="relative flex size-[64px]">
                    <AvatarRing ring={ring} src={item.user?.profileImage} />
                  </PhotoPicker>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpen(index)}
                    aria-label={item.isMe ? "내 스토리 보기" : `${name} 스토리 보기${item.hasUnseen ? " (새 스토리)" : ""}`}
                    className="flex border-0 bg-transparent p-0"
                  >
                    <AvatarRing ring={ring} src={item.user?.profileImage} />
                  </button>
                )}
                {item.isMe && (
                  <PhotoPicker label="스토리 올리기" onPick={onPickPhoto} className="absolute -right-[8px] -bottom-[8px] flex size-[34px] items-center justify-center">
                    <span className="flex size-[22px] items-center justify-center" style={{ borderRadius: "50%", background: "var(--a-color-surface-inverse)", boxShadow: "0 0 0 2px var(--a-color-bg)" }}>
                      <Plus size={14} strokeWidth={2.5} style={{ color: "var(--a-color-on-inverse)" }} aria-hidden />
                    </span>
                  </PhotoPicker>
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

function AvatarRing({ ring, src }: { ring: string; src?: string | null }) {
  return (
    <span className="flex size-[64px] items-center justify-center p-[2px]" style={{ borderRadius: "50%", background: ring }}>
      <span className="flex size-full items-center justify-center rounded-full p-[2px]" style={{ background: "var(--a-color-bg)" }}>
        <Avatar src={src} size={54} />
      </span>
    </span>
  );
}
