import { Fragment, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { postApi } from "@/api/aplan";
import { BOARDS, PRIMARY_BOARDS, type BoardKey } from "@/constants/boards";
import { IconButton } from "@/aplan/components/IconButton";
import { PostListItem } from "@/aplan/components/PostListItem";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import "@/styles/aplan-tokens.css";

interface CommunityScreenProps {
  initialBoard?: BoardKey | "all";
  onOpenPost: (id: string) => void;
  onOpenSearch: () => void;
  /** 글쓰기 (현재 탭 게시판을 기본 선택) */
  onWrite: (board: BoardKey | null) => void;
}

// A-06 커뮤니티 (Figma 2:320). 게시판 탭(전체·자유·Q&A·스터디·공모전·취업) + 최신순 목록 + 글쓰기 버튼.
// A안 탭에 없는 기존 게시판(공지사항·작품 전시·꿀팁·강의평가·공강모임·졸업생)은 헤더의 [전체 게시판]에서 고른다.
export function CommunityScreen({ initialBoard = "all", onOpenPost, onOpenSearch, onWrite }: CommunityScreenProps) {
  const [board, setBoard] = useState<BoardKey | "all">(initialBoard);
  const [moreOpen, setMoreOpen] = useState(false);
  const list = useInfiniteList((cursor) => postApi.list(board, cursor), [board]);

  const tabs: { key: BoardKey | "all"; label: string }[] = [
    { key: "all", label: "전체" },
    ...PRIMARY_BOARDS.map((b) => ({ key: b.key, label: b.label })),
  ];
  
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* 2:258 헤더 */}
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          커뮤니티
        </h1>
        <div className="flex items-center gap-[14px]">
          <IconButton icon={Search} label="검색" onClick={onOpenSearch} />
        </div>
      </header>

      {/* 2:271 게시판 탭 (가로 스크롤) */}
      <div className="w-full shrink-0 overflow-x-auto px-[20px] pb-[8px] [scrollbar-width:none]">
        <div className="flex w-max gap-[8px]" role="tablist" aria-label="게시판">
          {tabs.map((t) => {
            const selected = t.key === board;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setBoard(t.key)}
                className="shrink-0 border-0 px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                style={{
                  borderRadius: "var(--a-radius-pill)",
                  background: selected ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
                  color: selected ? "var(--a-color-on-inverse)" : "var(--a-color-icon)",
                }}
              >
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-label={moreOpen ? "게시판 더보기 닫기" : "게시판 더보기"}
            onClick={() => setMoreOpen((v) => !v)}
            className="flex shrink-0 items-center justify-center border-0 px-[10px] py-[6px]"
            style={{
              borderRadius: "var(--a-radius-pill)",
              background: "var(--a-color-surface-muted)",
              color: "var(--a-color-icon)",
            }}
          >
            {moreOpen ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
          </button>
        </div>
      </div>
      
      {/* + 를 누르면 나오는 기존 6개 외 게시판 */}
      {moreOpen && (
        <div className="flex w-full shrink-0 flex-wrap gap-[8px] px-[20px] pb-[8px]">
          {BOARDS.filter((b) => !b.primary).map((b) => {
            const selected = b.key === board;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBoard(b.key)}
                className="shrink-0 border-0 px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                style={{
                  borderRadius: "var(--a-radius-pill)",
                  background: selected ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
                  color: selected ? "var(--a-color-on-inverse)" : "var(--a-color-icon)",
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      )}
      {/* 2:327 목록 */}
            <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[4px] overflow-y-auto no-scrollbar px-[20px] py-[12px] pb-[96px]">
        {list.status === "loading" && <ListSkeleton />}
        {list.status === "error" && <ErrorState message={list.error ?? undefined} onRetry={list.reload} />}
        {list.status === "ready" && list.items.length === 0 && (
          <EmptyState
            title="아직 글이 없어요"
            description="첫 번째 글을 남겨보세요"
            action={{ label: "글쓰기", onClick: () => onWrite(board === "all" ? null : board) }}
          />
        )}
        {list.status === "ready" &&
          list.items.map((post) => (
            <Fragment key={post.id}>
              <PostListItem post={post} onOpen={onOpenPost} />
              <Divider />
            </Fragment>
          ))}
        {list.loadingMore && <ListSkeleton count={1} />}
        {list.hasMore && <div ref={list.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
      </main>

      {/* 2:330 글쓰기 버튼: 탭바 위 26px, 프레임 오른쪽 끝에서 20px (화면 좌우 1px 여백 안쪽 기준 19px) */}
      <button
        type="button"
        aria-label="글쓰기"
        onClick={() => onWrite(board === "all" ? null : board)}
        className="absolute right-[19px] bottom-[26px] flex size-[56px] items-center justify-center border-0 p-0 text-[26px] leading-[31px] font-normal"
        style={{ borderRadius: 28, background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}
      >
        +
      </button>
    </div>
  );
}

// 2:279 구분선
function Divider() {
  return <div className="h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />;
}

function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[4px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>
          <div className="flex w-full items-center gap-[12px] py-[12px]">
            <div className="flex flex-1 flex-col gap-[4px]">
              <Skeleton className="h-[13px] w-[40px]" />
              <Skeleton className="h-[18px] w-[80%]" />
              <Skeleton className="h-[13px] w-[170px]" />
            </div>
            <Skeleton className="size-[68px]" style={{ borderRadius: 8 }} />
          </div>
          <Divider />
        </Fragment>
      ))}
    </div>
  );
}
