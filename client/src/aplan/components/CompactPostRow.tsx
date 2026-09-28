import { TOPIC_MAP } from "@/constants/topics";
import { BOARDS } from "@/constants/boards";
import { formatTime } from "@/utils";
import type { PostCard } from "@/types/aplan";

interface CompactPostRowProps {
  post: PostCard;
  onOpen: (id: string) => void;
}

// 마이페이지·프로필의 "글" 목록 한 줄 (Figma 2:400): 작성자 표시 없이 제목 + "주제 · 시간 · 좋아요 N".
// 이미 그 사람의 글만 모아 보여주는 화면이라 커뮤니티 목록(PostListItem)과 달리 작성자를 반복하지 않는다.
export function CompactPostRow({ post, onOpen }: CompactPostRowProps) {
  const topic = (post.topics[0] && TOPIC_MAP[post.topics[0]]?.label) || BOARDS.find((b) => b.key === post.board)?.label || "";
  const meta = [topic, formatTime(post.createdAt), `좋아요 ${post.likeCount}`].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      className="flex w-full flex-col items-start gap-[4px] border-0 bg-transparent py-[12px] px-0 text-left"
    >
      <span className="line-clamp-2 w-full text-[15px] leading-[18px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
        {post.title}
      </span>
      <span className="text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{meta}</span>
    </button>
  );
}
