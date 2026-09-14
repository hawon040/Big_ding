import * as React from "react";
import { Heart } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "./utils";

export interface MessageBubbleProps {
  isMine: boolean;
  /** First message in a run of consecutive same-sender messages — rounds the leading corner. */
  isFirstInCluster: boolean;
  /** Last message in a run of consecutive same-sender messages — rounds the trailing corner and shows the avatar. */
  isLastInCluster: boolean;
  /** Text content. Omit (or leave falsy) for an image-only message. */
  content?: string;
  /** Image content. A message can have content, an image, or both. */
  imageSrc?: string;
  onImageClick?: () => void;
  avatarSrc?: string | null;
  fallbackSrc?: string;
  onAvatarClick?: () => void;
  /** Group chat: sender name shown above the bubble on the first message of an incoming cluster. */
  senderName?: string;
  /** Double-click/tap toggles a like reaction, shown as a small heart overlapping the bubble's outer corner. */
  liked?: boolean;
  onToggleLike?: () => void;
  /** Click toggles the revealed-time line below the bubble. */
  onToggleTime?: () => void;
  /** Text shown below the bubble — pass only when the time (and/or read receipt) should be visible. */
  revealedText?: string;
  /** Outline the bubble — used by delete/report select modes. */
  selected?: boolean;
  /** Outline color: blue for a neutral selection (e.g. delete), danger for a report-evidence selection. */
  selectedTone?: "blue" | "danger";
  /** Leading slot before the bubble (a select-mode checkbox). */
  leading?: React.ReactNode;
}

const ROUND = "20px";
const TIGHT = "6px";

/** Chat message bubble shared by 1:1 and group chat — clustering, tap-to-reveal time, double-tap like, image variant. */
export function MessageBubble({
  isMine,
  isFirstInCluster,
  isLastInCluster,
  content,
  imageSrc,
  onImageClick,
  avatarSrc,
  fallbackSrc = "",
  onAvatarClick,
  senderName,
  liked,
  onToggleLike,
  onToggleTime,
  revealedText,
  selected = false,
  selectedTone = "blue",
  leading,
}: MessageBubbleProps) {
  const outline = selected ? `2px solid ${selectedTone === "danger" ? "var(--danger)" : "var(--blue-primary)"}` : "none";
  const radius: React.CSSProperties = isMine
    ? {
        borderTopRightRadius: isFirstInCluster ? ROUND : TIGHT,
        borderBottomRightRadius: isLastInCluster ? ROUND : TIGHT,
        borderTopLeftRadius: ROUND,
        borderBottomLeftRadius: ROUND,
      }
    : {
        borderTopLeftRadius: isFirstInCluster ? ROUND : TIGHT,
        borderBottomLeftRadius: isLastInCluster ? ROUND : TIGHT,
        borderTopRightRadius: ROUND,
        borderBottomRightRadius: ROUND,
      };

  const likeBadge = liked && (
    <span
      className="absolute -bottom-2 flex h-5 w-5 items-center justify-center rounded-full"
      style={{ background: "var(--bg-base)", ...(isMine ? { left: -4 } : { right: -4 }) }}
    >
      <Heart size={12} fill="var(--danger)" color="var(--danger)" />
    </span>
  );

  return (
    <div className={cn("flex items-end gap-2", isMine ? "justify-end" : "justify-start", isLastInCluster ? "mb-2.5" : "mb-0.5")}>
      {leading}
      {!isMine && (
        isLastInCluster ? (
          <button onClick={onAvatarClick} className="shrink-0">
            <Avatar src={avatarSrc} fallbackSrc={fallbackSrc} size="sm" className="h-6 w-6" />
          </button>
        ) : (
          <div className="w-6 shrink-0" />
        )
      )}
      <div className={cn("flex max-w-[70%] flex-col gap-1", isMine ? "items-end" : "items-start")}>
        {senderName && isFirstInCluster && (
          <span className="px-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            {senderName}
          </span>
        )}
        {content && (
          <div className="relative" onClick={onToggleTime} onDoubleClick={onToggleLike}>
            <div
              className="cursor-pointer select-none px-3.5 py-2 text-[14px] leading-snug"
              style={{
                background: isMine ? "var(--blue-deep)" : "var(--bg-card)",
                color: isMine ? "white" : "var(--text-strong)",
                outline,
                ...radius,
              }}
            >
              <p>{content}</p>
            </div>
            {likeBadge}
          </div>
        )}
        {imageSrc && (
          <div className="relative">
            <img
              src={imageSrc}
              alt="사진"
              onClick={onImageClick}
              onDoubleClick={onToggleLike}
              className="max-w-full cursor-pointer rounded-[var(--r-lg)]"
              style={{ maxHeight: "200px", outline }}
            />
            {likeBadge}
          </div>
        )}
        {revealedText && (
          <p className="text-[10px] opacity-70" style={{ color: "var(--text-muted)" }}>
            {revealedText}
          </p>
        )}
      </div>
    </div>
  );
}
