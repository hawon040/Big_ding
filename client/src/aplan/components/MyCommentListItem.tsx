import { formatTime } from "@/utils";
import { BOARDS } from "@/constants/boards";
import type { MyComment } from "@/types/aplan";

interface MyCommentListItemProps {
  comment: MyComment;
  onOpen: (postId: string) => void;
}

const boardLabel = (key: string) => BOARDS.find((b) => b.key === key)?.label ?? key;

// 마이페이지 "내 댓글" 한 줄 (Figma에 없어 A안 톤으로 구성): 원글 제목 + 댓글 내용 미리보기.
export function MyCommentListItem({ comment, onOpen }: MyCommentListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(comment.post.id)}
      className="flex w-full flex-col items-start gap-[4px] border-0 bg-transparent py-[12px] px-0 text-left"
    >
      <span className="line-clamp-1 w-full text-[11px] leading-[13px] font-bold" style={{ color: "var(--a-color-icon)" }}>
        [{boardLabel(comment.post.board)}] {comment.post.title}
      </span>
      <span className="flex w-full items-start gap-[6px]">
        <span className="line-clamp-2 min-w-px flex-1 text-[14px] leading-[17px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>
          {comment.content}
        </span>
        {comment.isAccepted && (
          <span
            className="inline-flex h-[13px] shrink-0 items-center px-[4px] text-[10px] leading-[13px] font-bold"
            style={{ borderRadius: 3, background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}
          >
            채택 완료
          </span>
        )}
      </span>
      <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
        {formatTime(comment.createdAt)}
      </span>
    </button>
  );
}
