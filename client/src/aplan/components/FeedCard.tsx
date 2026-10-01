import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { formatTime } from "@/utils";
import { TOPIC_MAP } from "@/constants/topics";
import type { FeedItem } from "@/types/aplan";
import { Avatar } from "./Avatar";

// 사진 여러 장을 옆으로 넘겨 보는 영역(스크롤 스냅). 2장 이상이면 오른쪽 위에 "1/3"을 표시한다.
export function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="relative w-full overflow-hidden" style={{ borderRadius: "var(--a-radius-image)", background: "var(--a-color-surface-muted)" }}>
      <div
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {images.map((src, i) => (
          <img
            key={src}
            src={resolveAssetUrl(src)}
            alt={`사진 ${i + 1}/${images.length}`}
            loading="lazy"
            className="block aspect-square w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <span
          aria-hidden
          className="absolute top-[8px] right-[8px] px-[8px] py-[3px] text-[11px] leading-[13px] font-[500]"
          style={{ borderRadius: "var(--a-radius-pill)", background: "rgba(0,0,0,0.55)", color: "#fff" }}
        >
          {index + 1}/{images.length}
        </span>
      )}
    </div>
  );
}

interface FeedCardProps {
  feed: FeedItem;
  onToggleLike: (feed: FeedItem) => void;
  /** 댓글·본문을 누르면 상세(댓글)로 */
  onOpen: (id: string) => void;
  onOpenUser: (id: string) => void;
  /** 상세 화면에서는 본문을 줄이지 않는다 */
  expanded?: boolean;
}

// 홈 피드 카드: 작성자 → 사진(여러 장 스와이프) → 좋아요·댓글 → 본문 → 주제. 커뮤니티 PostCard와 다른 게시물이다.
export function FeedCard({ feed, onToggleLike, onOpen, onOpenUser, expanded = false }: FeedCardProps) {
  const author = feed.author;
  const idle = "var(--a-color-text-secondary)";
  const topics = feed.topics.map((t) => TOPIC_MAP[t]?.label).filter(Boolean);

  return (
    <article className="flex w-full flex-col gap-[10px]">
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          disabled={!author}
          onClick={() => author && onOpenUser(author.id)}
          className="flex min-w-px flex-1 items-center gap-[10px] border-0 bg-transparent p-0 text-left"
        >
          <Avatar src={author?.profileImage} size={32} />
          <span className="flex flex-col items-start gap-[2px]">
            <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
              {author ? [author.nickname, author.department].filter(Boolean).join(" · ") : "알 수 없음"}
            </span>
            <span className="text-[11px] leading-[13px]" style={{ color: idle }}>{formatTime(feed.createdAt)}</span>
          </span>
        </button>
      </div>

      <ImageCarousel images={feed.images} />

      <div className="flex w-full items-center gap-[14px]">
        <button
          type="button"
          aria-pressed={feed.isLiked}
          aria-label={`좋아요 ${feed.likeCount}`}
          onClick={() => onToggleLike(feed)}
          className="flex items-center gap-[4px] border-0 bg-transparent p-0"
        >
          <Heart size={18} strokeWidth={1.5} fill={feed.isLiked ? "var(--a-color-text-primary)" : "none"} style={{ color: feed.isLiked ? "var(--a-color-text-primary)" : idle }} aria-hidden />
          <span className="text-[12px] leading-[14px]" style={{ color: idle }}>{feed.likeCount}</span>
        </button>
        <button
          type="button"
          aria-label={`댓글 ${feed.commentCount}`}
          onClick={() => onOpen(feed.id)}
          className="flex items-center gap-[4px] border-0 bg-transparent p-0"
        >
          <MessageCircle size={18} strokeWidth={1.5} style={{ color: idle }} aria-hidden />
          <span className="text-[12px] leading-[14px]" style={{ color: idle }}>{feed.commentCount}</span>
        </button>
      </div>

      {feed.content && (
        <p
          className={`m-0 text-[14px] leading-[20px] break-words whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}
          style={{ color: "var(--a-color-text-primary)" }}
        >
          {feed.content}
        </p>
      )}
      {topics.length > 0 && (
        <p className="m-0 text-[12px] leading-[14px]" style={{ color: idle }}>{topics.map((t) => `#${t}`).join(" ")}</p>
      )}
    </article>
  );
}
