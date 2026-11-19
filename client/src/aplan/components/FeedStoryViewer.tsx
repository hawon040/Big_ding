import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, X } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { formatTime } from "@/utils";
import type { FeedItem } from "@/types/aplan";
import { Avatar } from "./Avatar";

interface FeedStoryViewerProps {
  /** 지금 홈에 불러와져 있는 피드 목록 그대로 (페이지네이션으로 더 불러와도 이 값이 갱신되면 같이 늘어난다) */
  feeds: FeedItem[];
  startFeedIndex: number;
  startImageIndex?: number;
  onClose: () => void;
  onToggleLike: (feed: FeedItem) => void;
  onOpenUser: (id: string) => void;
  /** 댓글 아이콘을 누르면 뷰어를 닫고 그 피드의 상세(댓글)로 이동 */
  onOpenComments: (id: string) => void;
}

// 홈 피드 사진을 인스타 스토리처럼 전체화면으로 넘겨보는 뷰어.
// 한 게시물 안 여러 장은 물론, 마지막 장에서 더 넘기면 다음 게시물의 첫 장으로 자연스럽게 이어진다
// (= 피드 전체를 사진 한 장씩 끝까지 옆으로 넘기며 볼 수 있다).
export function FeedStoryViewer({ feeds, startFeedIndex, startImageIndex = 0, onClose, onToggleLike, onOpenUser, onOpenComments }: FeedStoryViewerProps) {
  // 피드 전체를 "몇 번째 피드의 몇 번째 사진"이 아니라 하나의 평평한 사진 목록으로 펴서,
  // 게시물 경계를 신경 쓰지 않고 그냥 가로로 스크롤 스냅만 쓰면 되게 만든다.
  const flat = useMemo(
    () => feeds.flatMap((feed, feedIdx) => feed.images.map((src, imgIdx) => ({ feed, feedIdx, imgIdx, src }))),
    [feeds]
  );
  const startFlat = Math.max(
    0,
    flat.findIndex((f) => f.feedIdx === startFeedIndex && f.imgIdx === startImageIndex)
  );
  const [flatIndex, setFlatIndex] = useState(startFlat);
  const trackRef = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el || i < 0 || i >= flat.length) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  // 처음 연 사진 위치로 애니메이션 없이 바로 이동
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = el.clientWidth * startFlat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(flatIndex - 1);
      else if (e.key === "ArrowRight") go(flatIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 뒤 화면이 같이 스크롤되지 않게 막는다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const current = flat[flatIndex];
  if (!current) return null; // 피드가 비었으면(이론상 없음) 그릴 게 없다
  const { feed, imgIdx } = current;
  const idle = "rgba(255,255,255,0.7)";

  return (
    <div role="dialog" aria-modal="true" aria-label="피드 전체화면 보기" className="fixed inset-0 z-[80] flex justify-center" style={{ background: "#000" }}>
      <div className="relative flex h-full w-full max-w-[var(--a-screen-max)] flex-col">
        <div
          ref={trackRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== flatIndex) setFlatIndex(i);
          }}
        >
          {flat.map((f, i) => (
            <div key={`${f.feed.id}-${f.imgIdx}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
              <img
                src={resolveAssetUrl(f.src)}
                alt={`${f.feed.content || "피드 사진"} ${f.imgIdx + 1}/${f.feed.images.length}`}
                className="max-h-full max-w-full object-contain"
                loading={Math.abs(i - flatIndex) <= 2 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* 위: 현재 게시물 안에서의 사진 진행 막대 (여러 장일 때만) + 닫기 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-[10px] px-[12px] pt-[12px] pb-[24px]" style={{ background: "linear-gradient(rgba(0,0,0,0.55), transparent)" }}>
          {feed.images.length > 1 && (
            <div className="flex gap-[4px]" aria-hidden>
              {feed.images.map((_, i) => (
                <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.35)" }}>
                  <span className="block h-full" style={{ width: i <= imgIdx ? "100%" : "0%", background: "#fff" }} />
                </span>
              ))}
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-[10px]">
            <button type="button" disabled={!feed.author} onClick={() => feed.author && onOpenUser(feed.author.id)} className="flex items-center gap-[10px] border-0 bg-transparent p-0">
              <Avatar src={feed.author?.profileImage} size={32} />
              <span className="text-[14px] leading-[17px] font-bold" style={{ color: "#fff" }}>{feed.author?.nickname ?? "알 수 없음"}</span>
            </button>
            <span className="text-[12px] leading-[14px]" style={{ color: idle }}>{formatTime(feed.createdAt)}</span>
            <span className="min-w-px flex-1" aria-hidden />
            <button type="button" onClick={onClose} aria-label="닫기" className="flex border-0 bg-transparent p-0">
              <X size={26} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
            </button>
          </div>
        </div>

        {/* 아래: 본문 + 좋아요·댓글 (게시물 상세와 똑같은 동작) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[10px] px-[16px] pt-[40px] pb-[28px]" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
          {feed.content && (
            <p className="m-0 line-clamp-3 text-[14px] leading-[20px] break-words whitespace-pre-wrap" style={{ color: "#fff" }}>{feed.content}</p>
          )}
          <div className="pointer-events-auto flex items-center gap-[16px]">
            <button type="button" aria-pressed={feed.isLiked} aria-label="좋아요" onClick={() => onToggleLike(feed)} className="flex items-center gap-[6px] border-0 bg-transparent p-0">
              <Heart size={20} strokeWidth={1.5} fill={feed.isLiked ? "#fff" : "none"} style={{ color: "#fff" }} aria-hidden />
              <span className="text-[13px] leading-[16px] font-[500]" style={{ color: "#fff" }}>{feed.likeCount}</span>
            </button>
            <button type="button" aria-label="댓글" onClick={() => onOpenComments(feed.id)} className="flex items-center gap-[6px] border-0 bg-transparent p-0">
              <MessageCircle size={20} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
              <span className="text-[13px] leading-[16px] font-[500]" style={{ color: "#fff" }}>{feed.commentCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
