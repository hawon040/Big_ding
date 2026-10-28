import { Fragment } from "react";
import { Copy } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import type { FeedItem, PostCard } from "@/types/aplan";
import { CompactPostRow } from "./CompactPostRow";
import { EmptyState, ErrorState, Skeleton } from "./States";
import type { useInfiniteList } from "@/aplan/hooks/useInfiniteList";

// 마이페이지(A-07)와 타인 프로필이 같이 쓰는 조각들: 상단 숫자, 피드글/커뮤니티 글 탭, 목록.

export type ProfileTab = "feeds" | "posts";

export interface ProfileStat {
  label: string;
  value: number | undefined;
  /** 있으면 눌러서 이동할 수 있다 (팔로워·팔로잉 목록) */
  onClick?: () => void;
}

// 상단 숫자 칸 (Figma 2:354): 1px 테두리·둥글기 14 상자 안에 칸 구분선 없이 4칸, 상하 16, 숫자 18px 굵게 + 11px 이름
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <section
      className="flex w-full items-stretch border border-solid"
      style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)" }}
    >
      {stats.map((s) => {
        const body = (
          <>
            {s.value === undefined ? (
              <Skeleton className="h-[22px] w-[24px]" />
            ) : (
              <span className="text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{s.value}</span>
            )}
            <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{s.label}</span>
          </>
        );
        const className = "flex min-w-px flex-1 flex-col items-center gap-[2px] border-0 bg-transparent px-0 py-[16px]";
        const style = undefined;
        return s.onClick ? (
          <button key={s.label} type="button" onClick={s.onClick} className={className} style={style} aria-label={`${s.label} 목록 보기`}>
            {body}
          </button>
        ) : (
          <div key={s.label} className={className} style={style}>
            {body}
          </div>
        );
      })}
    </section>
  );
}

// 언더라인 탭 (Figma 2:375): 글자 아래 8px 띄워 선택 탭은 2px 진한 선, 나머지는 1px 회색 선(아래쪽 정렬)
export function UnderlineTabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div className="flex w-full shrink-0 items-end" role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className="flex min-w-px flex-1 flex-col items-center gap-[8px] border-0 bg-transparent p-0 text-[14px] leading-[17px] whitespace-nowrap"
            style={{
              color: selected ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)",
              fontWeight: selected ? 700 : 400,
            }}
          >
            {t.label}
            <span
              aria-hidden
              className="block w-full"
              style={{ height: selected ? 2 : 1, background: selected ? "var(--a-color-text-primary)" : "var(--a-color-border)" }}
            />
          </button>
        );
      })}
    </div>
  );
}

type ListState<T> = ReturnType<typeof useInfiniteList<T>>;

// 피드글 탭: 3열 정사각 썸네일 (사진이 여러 장이면 오른쪽 위에 표시)
export function FeedGrid({ list, emptyTitle, onOpen }: { list: ListState<FeedItem>; emptyTitle: string; onOpen: (id: string) => void }) {
  if (list.status === "loading") return <GridSkeleton />;
  if (list.status === "error") return <ErrorState message={list.error ?? undefined} onRetry={list.reload} />;
  if (list.items.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <>
      <div className="grid w-full grid-cols-3 gap-[2px]">
        {list.items.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpen(f.id)}
            aria-label={f.content ? `피드: ${f.content.slice(0, 30)}` : "피드 보기"}
            className="relative aspect-square w-full overflow-hidden border-0 p-0"
            style={{ background: "var(--a-color-surface-muted)" }}
          >
            <img src={resolveAssetUrl(f.images[0])} alt="" loading="lazy" className="block size-full object-cover" />
            {f.images.length > 1 && (
              <Copy size={16} strokeWidth={2} className="absolute top-[6px] right-[6px]" style={{ color: "#fff", filter: "drop-shadow(0 0 2px rgba(0,0,0,.5))" }} aria-hidden />
            )}
          </button>
        ))}
      </div>
      {list.loadingMore && <GridSkeleton count={3} />}
      {list.hasMore && <div ref={list.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
    </>
  );
}

// 커뮤니티 글 탭
export function PostRows({ list, emptyTitle, onOpen }: { list: ListState<PostCard>; emptyTitle: string; onOpen: (id: string) => void }) {
  return (
    <>
      {list.status === "loading" && <ListSkeleton />}
      {list.status === "error" && <ErrorState message={list.error ?? undefined} onRetry={list.reload} />}
      {list.status === "ready" && list.items.length === 0 && <EmptyState title={emptyTitle} />}
      {list.status === "ready" &&
        list.items.map((post) => (
          <Fragment key={post.id}>
            <CompactPostRow post={post} onOpen={onOpen} />
            <Divider />
          </Fragment>
        ))}
      {list.loadingMore && <ListSkeleton count={1} />}
      {list.hasMore && <div ref={list.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
    </>
  );
}

export function Divider() {
  return <div className="h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />;
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[4px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>
          <div className="flex w-full flex-col gap-[4px] py-[12px]">
            <Skeleton className="h-[18px] w-[80%]" />
            <Skeleton className="h-[13px] w-[170px]" />
          </div>
          <Divider />
        </Fragment>
      ))}
    </div>
  );
}

function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-3 gap-[2px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full" style={{ borderRadius: 0 }} />
      ))}
    </div>
  );
}
