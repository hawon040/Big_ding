import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Search as SearchIcon, X } from "lucide-react";
import { searchApi } from "@/api/aplan";
import { PostListItem } from "@/aplan/components/PostListItem";
import { UserListItem } from "@/aplan/components/UserListItem";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import type { RecentSearch, TagResult, TrendingKeyword } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

const DEBOUNCE_MS = 400;

type ResultTab = "post" | "user" | "tag";

interface SearchScreenProps {
  onOpenPost: (id: string) => void;
  onOpenUser: (id: string) => void;
}

// A-05 검색 (Figma 2:245).
// 입력 후 잠시 멈추면(디바운스) 게시글·유저·태그 3개 결과를 함께 불러온다.
// 검색 기록은 서버가 "게시글 탭 첫 페이지 요청"에서만 남기므로(server/routes/search.js),
// 탭을 오가도 최근 검색어에 중복으로 쌓이지 않는다.
export function SearchScreen({ onOpenPost, onOpenUser }: SearchScreenProps) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ResultTab>("post");
  const [recent, setRecent] = useState<RecentSearch[] | null>(null);
  const [trending, setTrending] = useState<TrendingKeyword[] | null>(null);
  const [trendingComputedAt, setTrendingComputedAt] = useState<string | null>(null);
  const [tagState, setTagState] = useState<{ status: "idle" | "loading" | "ready" | "error"; items: TagResult[] }>({
    status: "idle",
    items: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const loadRecent = useCallback(() => {
    searchApi.recent().then(setRecent).catch(() => setRecent([]));
  }, []);

  // 검색창이 비어있을 때(처음 진입 포함) 최근 검색어를 새로 불러온다
  useEffect(() => {
    if (!query) loadRecent();
  }, [query, loadRecent]);

  useEffect(() => {
    searchApi.trending()
      .then((r) => {
        setTrending(r.items);
        setTrendingComputedAt(r.computedAt);
      })
      .catch(() => setTrending([]));
  }, []);

  const posts = useInfiniteList(
    (cursor) => (query ? searchApi.posts(query, cursor) : Promise.resolve({ items: [], nextCursor: null })),
    [query],
  );
  const users = useInfiniteList(
    (cursor) => (query ? searchApi.users(query, cursor) : Promise.resolve({ items: [], nextCursor: null })),
    [query],
  );

  const [tagReloadKey, setTagReloadKey] = useState(0);
  useEffect(() => {
    if (!query) {
      setTagState({ status: "idle", items: [] });
      return;
    }
    let cancelled = false;
    setTagState({ status: "loading", items: [] });
    searchApi
      .tags(query)
      .then((page) => !cancelled && setTagState({ status: "ready", items: page.items }))
      .catch(() => !cancelled && setTagState({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
  }, [query, tagReloadKey]);

  const runQuery = (keyword: string) => {
    setInput(keyword);
    setQuery(keyword);
    setTab("post");
  };

  const removeRecent = (keyword: string) => {
    setRecent((prev) => prev?.filter((r) => r.keyword !== keyword) ?? prev);
    searchApi.removeRecent(keyword).catch(loadRecent);
  };

  const clearRecent = () => {
    setRecent([]);
    searchApi.clearRecent().catch(loadRecent);
  };

  const tabs: { key: ResultTab; label: string }[] = [
    { key: "post", label: "게시글" },
    { key: "user", label: "유저" },
    { key: "tag", label: "태그" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 검색창 + 취소 */}
      <header className="flex w-full shrink-0 items-center gap-[10px] px-[20px] py-[12px]">
        <span
          className="flex h-[40px] min-w-px flex-1 items-center gap-[8px] px-[12px]"
          style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)" }}
        >
          <SearchIcon size={18} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runQuery(input.trim())}
            placeholder="키워드, #태그, 사용자 검색"
            aria-label="검색어"
            className="min-w-px flex-1 border-0 bg-transparent p-0 text-[14px] leading-[17px] outline-none"
            style={{ color: "var(--a-color-text-primary)", fontFamily: "var(--a-font-sans)" }}
          />
          {input && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                setInput("");
                inputRef.current?.focus();
              }}
              className="flex size-[18px] shrink-0 items-center justify-center border-0 bg-transparent p-0"
            >
              <X size={16} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
            </button>
          )}
        </span>
        {/* Figma는 검색어가 비어 있을 때도 항상 "취소"를 보여준다 */}
        <button
          type="button"
          onClick={() => {
            setInput("");
            setQuery("");
            inputRef.current?.blur();
          }}
          className="shrink-0 border-0 bg-transparent p-0 text-[14px] leading-[17px] font-normal"
          style={{ color: "var(--a-color-text-secondary)" }}
        >
          취소
        </button>
      </header>

      {!query ? (
        <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[24px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
          <RecentSearches items={recent} onRun={runQuery} onRemove={removeRecent} onClear={clearRecent} />
          <TrendingSearches items={trending} computedAt={trendingComputedAt} onRun={runQuery} />
        </main>
      ) : (
        <>
          {/* 결과 탭 */}
          <div className="flex w-full shrink-0 gap-[8px] px-[20px] pb-[8px]" role="tablist" aria-label="검색 결과">
            {tabs.map((t) => {
              const selected = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.key)}
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
          </div>

          <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[4px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
            {tab === "post" && (
              <>
                {posts.status === "loading" && <ListSkeleton />}
                {posts.status === "error" && <ErrorState message={posts.error ?? undefined} onRetry={posts.reload} />}
                {posts.status === "ready" && posts.items.length === 0 && <EmptyState title="검색 결과가 없어요" />}
                {posts.status === "ready" &&
                  posts.items.map((post) => <PostListItem key={post.id} post={post} onOpen={onOpenPost} highlight={query} />)}
                {posts.loadingMore && <ListSkeleton count={1} />}
                {posts.hasMore && <div ref={posts.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
              </>
            )}

            {tab === "user" && (
              <>
                {users.status === "loading" && <UserListSkeleton />}
                {users.status === "error" && <ErrorState message={users.error ?? undefined} onRetry={users.reload} />}
                {users.status === "ready" && users.items.length === 0 && <EmptyState title="검색 결과가 없어요" />}
                {users.status === "ready" && users.items.map((u) => <UserListItem key={u.id} user={u} onOpen={onOpenUser} />)}
                {users.loadingMore && <UserListSkeleton count={1} />}
                {users.hasMore && <div ref={users.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
              </>
            )}

            {tab === "tag" && (
              <>
                {tagState.status === "loading" && <UserListSkeleton />}
                {tagState.status === "error" && <ErrorState onRetry={() => setTagReloadKey((k) => k + 1)} />}
                {tagState.status === "ready" && tagState.items.length === 0 && <EmptyState title="검색 결과가 없어요" />}
                {tagState.status === "ready" &&
                  tagState.items.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => runQuery(`#${t.tag}`)}
                      className="flex w-full items-center gap-[8px] border-0 bg-transparent py-[12px] px-0 text-left"
                    >
                      <span className="min-w-px flex-1 text-[14px] leading-[17px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
                        #{t.tag}
                      </span>
                      <span className="shrink-0 text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                        게시글 {t.postCount}
                      </span>
                    </button>
                  ))}
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}

function RecentSearches({
  items,
  onRun,
  onRemove,
  onClear,
}: {
  items: RecentSearch[] | null;
  onRun: (keyword: string) => void;
  onRemove: (keyword: string) => void;
  onClear: () => void;
}) {
  if (items === null) {
    return (
      <section className="flex w-full flex-col gap-[10px]">
        <Skeleton className="h-[14px] w-[80px]" />
        <div className="flex flex-wrap gap-[8px]">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[30px] w-[72px]" style={{ borderRadius: "var(--a-radius-pill)" }} />)}
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-[10px]">
      <div className="flex w-full items-center gap-[8px]">
        <h2 className="m-0 min-w-px flex-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          최근 검색어
        </h2>
        <button type="button" onClick={onClear} className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
          전체 삭제
        </button>
      </div>
      <div className="flex flex-wrap gap-[8px]">
        {items.map((r) => (
          <span
            key={r.keyword}
            className="flex items-center gap-[6px] py-[7px] pl-[12px] pr-[8px] text-[12px] leading-[14px] font-[500]"
            style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
          >
            <button type="button" onClick={() => onRun(r.keyword)} className="border-0 bg-transparent p-0" style={{ color: "inherit" }}>
              {r.keyword}
            </button>
            <button type="button" aria-label={`${r.keyword} 삭제`} onClick={() => onRemove(r.keyword)} className="flex size-[14px] items-center justify-center border-0 bg-transparent p-0">
              <X size={12} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

function TrendingSearches({
  items,
  computedAt,
  onRun,
}: {
  items: TrendingKeyword[] | null;
  computedAt: string | null;
  onRun: (keyword: string) => void;
}) {
  if (items === null) {
    return (
      <section className="flex w-full flex-col gap-[10px]">
        <Skeleton className="h-[14px] w-[80px]" />
        <div className="flex w-full flex-col gap-[12px]">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[16px] w-full" />)}
        </div>
      </section>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-[10px]">
      <div className="flex w-full items-center gap-[8px]">
        <h2 className="m-0 min-w-px flex-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          실시간 인기 검색어
        </h2>
        {computedAt && (
          <span className="shrink-0 text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
            {hourMinute(computedAt)} 기준
          </span>
        )}
      </div>
      <ol className="m-0 flex w-full flex-col gap-[14px] p-0" style={{ listStyle: "none" }}>
        {items.map((t) => (
          <li key={t.keyword}>
            <button
              type="button"
              onClick={() => onRun(t.keyword)}
              className="flex w-full items-center gap-[10px] border-0 bg-transparent p-0 text-left"
            >
              <span className="w-[16px] shrink-0 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
                {t.rank}
              </span>
              <span className="min-w-px flex-1 text-[14px] leading-[17px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>
                {t.keyword}
              </span>
              <RankChange change={t.change} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

const hourMinute = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function RankChange({ change }: { change: TrendingKeyword["change"] }) {
  const color = "var(--a-color-text-secondary)";
  if (change === "new") {
    return <span className="text-[10px] leading-[12px] font-bold" style={{ color }}>NEW</span>;
  }
  if (change === "same") {
    return <Minus size={12} strokeWidth={1.5} style={{ color }} aria-label="변동 없음" />;
  }
  const Icon = change === "up" ? ArrowUp : ArrowDown;
  return <Icon size={12} strokeWidth={1.5} style={{ color }} aria-label={change === "up" ? "순위 상승" : "순위 하락"} />;
}

function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[4px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-[12px] py-[12px]">
          <div className="flex flex-1 flex-col gap-[4px]">
            <Skeleton className="h-[13px] w-[40px]" />
            <Skeleton className="h-[18px] w-[80%]" />
            <Skeleton className="h-[13px] w-[170px]" />
          </div>
          <Skeleton className="size-[68px]" style={{ borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

function UserListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[4px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-[12px] py-[12px]">
          <Skeleton className="size-[40px]" style={{ borderRadius: "50%" }} />
          <div className="flex flex-1 flex-col gap-[4px]">
            <Skeleton className="h-[14px] w-[100px]" />
            <Skeleton className="h-[12px] w-[140px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
