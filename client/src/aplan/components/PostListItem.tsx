import { resolveAssetUrl } from "@/api";
import { formatTime } from "@/utils";
import { BOARDS } from "@/constants/boards";
import type { PostCard } from "@/types/aplan";

interface PostListItemProps {
  post: PostCard;
  onOpen: (id: string) => void;
  /** 검색 결과에서 제목의 검색어를 굵게 표시 */
  highlight?: string;
}

const boardLabel = (key: string) => BOARDS.find((b) => b.key === key)?.label ?? key;

// 커뮤니티 목록 아이템 (Figma 2:278): 위아래 12, 왼쪽 글 + 오른쪽 68px 썸네일(간격 12).
// [게시판] 11px Bold #666 / 제목 15px Medium 최대 2줄 / "닉네임 · 시간 · 댓글 N · 조회 N" 11px #999
// 썸네일(2:277)은 사진이 없으면 숨긴다. 모집·채택 배지는 게시판 라벨 줄(13px) 안에 넣었다.
export function PostListItem({ post, onOpen, highlight }: PostListItemProps) {
  const meta = [
    post.author?.nickname ?? "알 수 없음",
    formatTime(post.createdAt),
    `댓글 ${post.commentCount}`,
    `조회 ${post.viewCount}`,
  ].join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(post.id)}
      className="flex w-full shrink-0 items-center gap-[12px] border-0 bg-transparent py-[12px] px-0 text-left"
    >
      <span className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
        <span className="flex items-center gap-[4px] text-[11px] leading-[13px] font-bold whitespace-nowrap" style={{ color: "var(--a-color-icon)" }}>
          [{boardLabel(post.board)}]
          <StatusBadges post={post} />
        </span>
        <span className="line-clamp-2 w-full text-[15px] leading-[18px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
          <Highlighted text={post.title} query={highlight} />
        </span>
        <span className="text-[11px] leading-[13px] font-normal whitespace-nowrap" style={{ color: "var(--a-color-text-secondary)" }}>
          {meta}
        </span>
      </span>
      {post.thumbnail && (
        <span
          className="block size-[68px] shrink-0 overflow-hidden border border-solid"
          style={{ borderColor: "var(--a-color-border)", borderRadius: 8, background: "var(--a-color-surface-muted)" }}
        >
          <img src={resolveAssetUrl(post.thumbnail)} alt="" loading="lazy" className="block size-full object-cover" />
        </span>
      )}
    </button>
  );
}

// 모집중 2/4명 · 마감 · 채택 완료 (Figma에 없어 A안 톤으로 추가: 13px 높이 작은 배지)
function StatusBadges({ post }: { post: PostCard }) {
  const badges: { text: string; strong: boolean }[] = [];
  if (post.recruit) {
    const open = post.recruit.status === "open";
    badges.push({ text: `${open ? "모집중" : "마감"} ${post.recruit.current}/${post.recruit.capacity}명`, strong: open });
  }
  if (post.isAnswered) badges.push({ text: "채택 완료", strong: true });
  if (post.rating) badges.push({ text: `★ ${post.rating.toFixed(1)}`, strong: false });
  return (
    <>
      {badges.map((b) => (
        <span
          key={b.text}
          className="inline-flex h-[13px] items-center px-[4px] text-[10px] leading-[13px] font-bold"
          style={{
            borderRadius: 3,
            background: b.strong ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
            color: b.strong ? "var(--a-color-on-inverse)" : "var(--a-color-text-secondary)",
          }}
        >
          {b.text}
        </span>
      ))}
    </>
  );
}

// 검색어와 일치하는 부분을 굵게 (대소문자 무시)
export function Highlighted({ text, query }: { text: string; query?: string }) {
  const q = query?.replace(/^#/, "").trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: { t: string; hit: boolean }[] = [];
  let i = 0;
  for (let at = lower.indexOf(q.toLowerCase()); at !== -1; at = lower.indexOf(q.toLowerCase(), i)) {
    if (at > i) parts.push({ t: text.slice(i, at), hit: false });
    parts.push({ t: text.slice(at, at + q.length), hit: true });
    i = at + q.length;
  }
  if (i < text.length) parts.push({ t: text.slice(i), hit: false });
  return <>{parts.map((p, k) => (p.hit ? <mark key={k} className="bg-transparent font-bold" style={{ color: "inherit" }}>{p.t}</mark> : <span key={k}>{p.t}</span>))}</>;
}
