import { useState } from "react";
import { Heart, MessageCircle, MoreVertical } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { reportApi } from "@/api/aplan";
import { formatTime } from "@/utils";
import type { FeedItem } from "@/types/aplan";
import { Avatar } from "./Avatar";
import { BottomSheet, SheetItem } from "./BottomSheet";
import { alertDialog } from "./Dialog";
import { IconButton } from "./IconButton";
import { PrimaryButton } from "./PrimaryButton";
import { ImageViewer } from "./ImageViewer";

const REPORT_REASONS = ["스팸/광고", "욕설·혐오 표현", "음란물", "기타"];
const REPORT_DETAIL_MAX = 500;

// 사진 여러 장을 옆으로 넘겨 보는 영역(스크롤 스냅). 2장 이상이면 오른쪽 위에 "1/3"을 표시한다.
// onImageClick이 있으면 사진을 눌러 전체화면(ImageViewer)으로 볼 수 있다.
export function ImageCarousel({ images, onImageClick }: { images: string[]; onImageClick?: (index: number) => void }) {
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
            className={`block aspect-square w-full shrink-0 snap-center object-cover ${onImageClick ? "cursor-zoom-in" : ""}`}
            onClick={onImageClick && (() => onImageClick(i))}
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
  /** 댓글·본문을 누르면 게시물 상세로 (상세 화면에서는 넘기지 않는다) */
  onOpen?: (id: string) => void;
  onOpenUser: (id: string) => void;
  /** #태그를 누르면 그 태그 피드만 보기 */
  onTagClick?: (tag: string) => void;
  /** 상세 화면에서는 본문을 줄이지 않는다 */
  expanded?: boolean;
  /** 내 피드의 ⋮ 메뉴 항목. 다른 사람 피드의 ⋮ 메뉴에는 신고가 나온다 */
  onEdit?: (feed: FeedItem) => void;
  onDelete?: (feed: FeedItem) => void;
  /** 좋아요 수를 누르면 좋아요 누른 사람 목록을 연다 */
  onOpenLikers?: (feed: FeedItem) => void;
}

// 홈 피드 카드: 작성자 → 사진(여러 장 스와이프, 누르면 전체화면) → 좋아요·댓글 → 본문 → 주제. 커뮤니티 PostCard와 다른 게시물이다.
export function FeedCard({ feed, onToggleLike, onOpen, onOpenUser, onTagClick, expanded = false, onEdit, onDelete, onOpenLikers }: FeedCardProps) {
  // menu: ⋮ 메뉴 / report: 신고 사유 고르기 / reportEtc: "기타" 사유 직접 적기
  const [sheet, setSheet] = useState<"menu" | "report" | "reportEtc" | null>(null);
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const author = feed.author;
  const idle = "var(--a-color-text-secondary)";
  // 내 피드: 수정·삭제가 하나라도 있을 때만 / 다른 사람 피드: 항상 (신고)
  const hasMenu = feed.isMine ? Boolean(onEdit || onDelete) : true;

  const submitReport = async (reason: string, detail?: string) => {
    if (reporting) return;
    setReporting(true);
    try {
      await reportApi.create({ targetType: "feed", targetId: feed.id, reason, detail });
      setSheet(null);
      setReportDetail("");
      alertDialog("신고가 접수됐어요.", "검토 후 조치할게요.");
    } catch (err: any) {
      setSheet(null);
      alertDialog(err?.response?.data?.message || "신고하지 못했어요.");
    } finally {
      setReporting(false);
    }
  };

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
              {author?.nickname ?? "알 수 없음"}
            </span>
            <span className="text-[11px] leading-[13px]" style={{ color: idle }}>{formatTime(feed.createdAt)}</span>
          </span>
        </button>
        {hasMenu && <IconButton icon={MoreVertical} label="더보기" onClick={() => setSheet("menu")} />}
      </div>

      <ImageCarousel images={feed.images} onImageClick={setViewerIndex} />

      <div className="flex w-full items-center gap-[14px]">
        {/* 하트는 좋아요 토글, 숫자는 좋아요 누른 사람 목록 (onOpenLikers가 있을 때) */}
        <div className="flex items-center gap-[4px]">
          <button
            type="button"
            aria-pressed={feed.isLiked}
            aria-label={onOpenLikers ? "좋아요" : `좋아요 ${feed.likeCount}`}
            onClick={() => onToggleLike(feed)}
            className="flex items-center border-0 bg-transparent p-0"
          >
            <Heart size={18} strokeWidth={1.5} fill={feed.isLiked ? "var(--a-color-text-primary)" : "none"} style={{ color: feed.isLiked ? "var(--a-color-text-primary)" : idle }} aria-hidden />
          </button>
          {onOpenLikers ? (
            <button
              type="button"
              aria-label={`좋아요 누른 사람 ${feed.likeCount}명 보기`}
              disabled={feed.likeCount === 0}
              onClick={() => onOpenLikers(feed)}
              className="border-0 bg-transparent p-0 text-[12px] leading-[14px] disabled:cursor-default"
              style={{ color: idle }}
            >
              {feed.likeCount}
            </button>
          ) : (
            <span aria-hidden className="text-[12px] leading-[14px]" style={{ color: idle }}>{feed.likeCount}</span>
          )}
        </div>
        <button
          type="button"
          aria-label={`댓글 ${feed.commentCount}`}
          disabled={!onOpen}
          onClick={() => onOpen?.(feed.id)}
          className="flex items-center gap-[4px] border-0 bg-transparent p-0 disabled:cursor-default"
        >
          <MessageCircle size={18} strokeWidth={1.5} style={{ color: idle }} aria-hidden />
          <span className="text-[12px] leading-[14px]" style={{ color: idle }}>{feed.commentCount}</span>
        </button>
      </div>

      {feed.content &&
        (onOpen && !expanded ? (
          // 목록에서는 본문을 눌러 게시물 상세로 간다
          <button
            type="button"
            onClick={() => onOpen(feed.id)}
            className="m-0 line-clamp-3 border-0 bg-transparent p-0 text-left text-[14px] leading-[20px] break-words whitespace-pre-wrap"
            style={{ color: "var(--a-color-text-primary)" }}
          >
            {feed.content}
          </button>
        ) : (
          <p className="m-0 text-[14px] leading-[20px] break-words whitespace-pre-wrap" style={{ color: "var(--a-color-text-primary)" }}>
            {feed.content}
          </p>
        ))}
      {feed.tags.length > 0 && (
        <p className="m-0 flex flex-wrap gap-x-[8px] gap-y-[2px]">
          {feed.tags.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!onTagClick}
              onClick={() => onTagClick?.(t)}
              className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-[500] disabled:cursor-default"
              style={{ color: "var(--a-color-icon)" }}
            >
              #{t}
            </button>
          ))}
        </p>
      )}

      <BottomSheet open={sheet === "menu"} title="더보기" onClose={() => setSheet(null)}>
        {feed.isMine ? (
          <>
            {onEdit && <SheetItem onClick={() => { setSheet(null); onEdit(feed); }}>수정</SheetItem>}
            {onDelete && <SheetItem danger onClick={() => { setSheet(null); onDelete(feed); }}>삭제</SheetItem>}
          </>
        ) : (
          <SheetItem danger onClick={() => setSheet("report")}>신고</SheetItem>
        )}
      </BottomSheet>
      <BottomSheet open={sheet === "report"} title="신고 사유" onClose={() => setSheet(null)}>
        {REPORT_REASONS.map((reason) => (
          <SheetItem key={reason} onClick={() => (reason === "기타" ? setSheet("reportEtc") : submitReport(reason))}>{reason}</SheetItem>
        ))}
      </BottomSheet>
      <BottomSheet open={sheet === "reportEtc"} title="기타 사유" onClose={() => setSheet(null)}>
        <div className="flex flex-col gap-[12px] pt-[4px]">
          <textarea
            value={reportDetail}
            onChange={(e) => setReportDetail(e.target.value)}
            placeholder="신고 사유를 적어주세요"
            rows={4}
            maxLength={REPORT_DETAIL_MAX}
            autoFocus
            aria-label="기타 신고 사유"
            className="a-text-field w-full resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[18px] font-normal outline-none"
            style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)", fontFamily: "var(--a-font-sans)" }}
          />
          <span className="self-end text-[11px] leading-[13px]" style={{ color: idle }}>{reportDetail.length}/{REPORT_DETAIL_MAX}</span>
          <PrimaryButton disabled={!reportDetail.trim()} loading={reporting} onClick={() => submitReport("기타", reportDetail.trim())}>신고하기</PrimaryButton>
        </div>
      </BottomSheet>

      {viewerIndex !== null && (
        <ImageViewer images={feed.images} startIndex={viewerIndex} alt="피드 사진" onClose={() => setViewerIndex(null)} />
      )}
    </article>
  );
}
