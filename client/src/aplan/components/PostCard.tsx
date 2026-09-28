import { Bookmark, Heart, MessageCircle } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { formatTime } from "@/utils";
import { TOPIC_MAP } from "@/constants/topics";
import { BOARDS } from "@/constants/boards";
import type { PostCard as PostCardData } from "@/types/aplan";
import { Avatar } from "./Avatar";

interface PostCardProps {
  post: PostCardData;
  onOpen: (id: string) => void;
  onToggleLike: (post: PostCardData) => void;
  onToggleScrap: (post: PostCardData) => void;
}

// 카드 부제에 붙는 주제 이름: 첫 번째 주제, 없으면 게시판 이름
const topicText = (post: PostCardData) =>
  (post.topics[0] && TOPIC_MAP[post.topics[0]]?.label) || BOARDS.find((b) => b.key === post.board)?.label || "";

// 홈 인기글 카드 (Figma 2:139 / 이미지 없는 카드 2:157)
// 1px #D9D9D9 테두리, radius 14, 안쪽 16, 요소 간격 10.
// - 회색 막대 2개(2:126·2:127) 자리에 본문 미리보기 2줄 (같은 높이 26px 안에 12px 글자 2줄)
// - IMAGE 상자(2:129, 높이 130·radius 10)에 첫 번째 사진. 사진이 없으면 상자를 숨긴다
export function PostCard({ post, onOpen, onToggleLike, onToggleScrap }: PostCardProps) {
  const author = post.author;
  const authorLine = author ? [author.nickname, author.department].filter(Boolean).join(" · ") : "알 수 없음";
  const metaLine = [formatTime(post.createdAt), topicText(post)].filter(Boolean).join(" · ");
  const activeColor = "var(--a-color-text-primary)";
  const idleColor = "var(--a-color-text-secondary)";

  return (
    <article
      className="flex w-full flex-col items-start gap-[10px] border border-solid p-[16px]"
      style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)", background: "var(--a-color-bg)" }}
    >
      {/* 본문 영역 전체를 누르면 상세로 (좋아요·스크랩 버튼은 따로) */}
      <button
        type="button"
        onClick={() => onOpen(post.id)}
        className="flex w-full flex-col items-start gap-[10px] border-0 bg-transparent p-0 text-left"
      >
        {/* 2:124 작성자 */}
        <span className="flex items-center gap-[10px]">
          <Avatar src={author?.profileImage} size={32} />
          <span className="flex flex-col items-start gap-[2px] whitespace-nowrap">
            <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>{authorLine}</span>
            <span className="text-[11px] leading-[13px] font-normal" style={{ color: idleColor }}>{metaLine}</span>
          </span>
        </span>
        {/* 2:125 제목 (최대 2줄) */}
        <span className="line-clamp-2 w-full text-[15px] leading-[18px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          {post.title}
        </span>
        {/* 2:126·2:127 → 본문 미리보기 2줄 */}
        {post.contentPreview && (
          <span className="line-clamp-2 h-[26px] w-full text-[12px] leading-[13px] font-normal" style={{ color: "var(--a-color-icon)" }}>
            {post.contentPreview}
          </span>
        )}
        {/* 2:129 이미지 */}
        {post.thumbnail && (
          <span
            className="block h-[130px] w-full overflow-hidden border border-solid"
            style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-image)", background: "var(--a-color-surface-muted)" }}
          >
            <img src={resolveAssetUrl(post.thumbnail)} alt="" loading="lazy" className="block size-full object-cover" />
          </span>
        )}
      </button>

      {/* 2:138 좋아요 · 댓글 · 스크랩 */}
      <div className="flex w-full items-center gap-[14px]">
        <button
          type="button"
          aria-pressed={post.isLiked}
          aria-label={`좋아요 ${post.likeCount}`}
          onClick={() => onToggleLike(post)}
          className="flex items-center gap-[4px] border-0 bg-transparent p-0"
        >
          <Heart size={14} strokeWidth={1.5} fill={post.isLiked ? activeColor : "none"} style={{ color: post.isLiked ? activeColor : idleColor }} aria-hidden />
          <span className="text-[12px] leading-[14px] font-normal" style={{ color: idleColor }}>{post.likeCount}</span>
        </button>
        <span className="flex items-center gap-[4px]" aria-label={`댓글 ${post.commentCount}`}>
          <MessageCircle size={14} strokeWidth={1.5} style={{ color: idleColor }} aria-hidden />
          <span className="text-[12px] leading-[14px] font-normal" style={{ color: idleColor }}>{post.commentCount}</span>
        </span>
        <span className="min-w-px flex-1" aria-hidden />
        <button
          type="button"
          aria-pressed={post.isScrapped}
          aria-label="스크랩"
          onClick={() => onToggleScrap(post)}
          className="flex size-[16px] items-center justify-center border-0 bg-transparent p-0"
        >
          <Bookmark size={16} strokeWidth={1.5} fill={post.isScrapped ? activeColor : "none"} style={{ color: post.isScrapped ? activeColor : idleColor }} aria-hidden />
        </button>
      </div>
    </article>
  );
}
