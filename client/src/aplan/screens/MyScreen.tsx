import { Fragment, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { meApi, userApi } from "@/api/aplan";
import { TOPIC_MAP, type TopicKey } from "@/constants/topics";
import { Avatar } from "@/aplan/components/Avatar";
import { IconButton } from "@/aplan/components/IconButton";
import { CompactPostRow } from "@/aplan/components/CompactPostRow";
import { MyCommentListItem } from "@/aplan/components/MyCommentListItem";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import type { Me } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

type MyTab = "posts" | "comments" | "scraps";

interface MyScreenProps {
  onOpenPost: (id: string) => void;
  onEditProfile: () => void;
  /** 관심 분야 다시 고르기 (A-03 온보딩을 edit 모드로 재사용). 지금 선택된 관심 분야를 함께 넘긴다 */
  onEditInterests: (current: TopicKey[]) => void;
  onOpenSettings: () => void;
}

// A-07 마이페이지 (Figma 2:400).
// 프로필 요약 + 활동 통계 + 관심 분야 + 내 글·댓글·스크랩 탭.
export function MyScreen({ onOpenPost, onEditProfile, onEditInterests, onOpenSettings }: MyScreenProps) {
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [tab, setTab] = useState<MyTab>("posts");

  const loadMe = () => {
    setMeError(null);
    setMe(null);
    meApi.get().then(setMe).catch((err) => setMeError(err?.response?.data?.message || null));
  };
  useEffect(loadMe, []);

  const empty = { items: [], nextCursor: null };
  const posts = useInfiniteList(
    (cursor) => (tab === "posts" && me ? userApi.posts(me.id, cursor) : Promise.resolve(empty)),
    [tab, me?.id],
  );
  const comments = useInfiniteList(
    (cursor) => (tab === "comments" && me ? userApi.comments(me.id, cursor) : Promise.resolve(empty)),
    [tab, me?.id],
  );
  const scraps = useInfiniteList(
    (cursor) => (tab === "scraps" && me ? userApi.scraps(me.id, cursor) : Promise.resolve(empty)),
    [tab, me?.id],
  );

  const tabs: { key: MyTab; label: string }[] = [
    { key: "posts", label: "내 글" },
    { key: "comments", label: "댓글" },
    { key: "scraps", label: "스크랩" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          마이페이지
        </h1>
        <IconButton icon={Settings} label="설정" onClick={onOpenSettings} />
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {meError && <ErrorState message={meError} onRetry={loadMe} />}

        {!meError && (
          <>
            {/* 프로필 요약 */}
            <section className="flex w-full items-center gap-[14px]">
              {me ? <Avatar src={me.profileImage} size={64} /> : <Skeleton className="size-[64px]" style={{ borderRadius: "50%" }} />}
              <div className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
                {me ? (
                  <>
                    <span className="text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{me.nickname}</span>
                    <span className="text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                      {[me.department, me.grade ? `${me.grade}학년` : null].filter(Boolean).join(" · ") || "학과 정보 없음"}
                    </span>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-[17px] w-[100px]" />
                    <Skeleton className="h-[12px] w-[140px]" />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onEditProfile}
                className="shrink-0 border border-solid px-[12px] py-[7px] text-[12px] leading-[14px] font-[500]"
                style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-pill)", color: "var(--a-color-text-primary)" }}
              >
                프로필 수정
              </button>
            </section>

            {me?.bio && (
              <p className="m-0 -mt-[8px] w-full text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{me.bio}</p>
            )}

            {/* 활동 통계 (Figma 2:400) */}
            <section
              className="flex w-full items-stretch border border-solid"
              style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)" }}
            >
              {([
                { label: "게시글", value: me?.counts.posts },
                { label: "댓글", value: me?.counts.comments },
                { label: "스크랩", value: me?.counts.scraps },
                { label: "팔로워", value: me?.counts.followers },
              ] as const).map((s, i) => (
                <div
                  key={s.label}
                  className="flex min-w-px flex-1 flex-col items-center gap-[2px] py-[14px]"
                  style={i > 0 ? { borderLeft: "1px solid var(--a-color-border)" } : undefined}
                >
                  {s.value === undefined ? (
                    <Skeleton className="h-[20px] w-[24px]" />
                  ) : (
                    <span className="text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{s.value}</span>
                  )}
                  <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{s.label}</span>
                </div>
              ))}
            </section>

            {/* 관심 분야 */}
            <section className="flex w-full flex-col gap-[8px]">
              <div className="flex w-full items-center gap-[8px]">
                <h2 className="m-0 min-w-px flex-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
                  관심 분야
                </h2>
                <button type="button" onClick={() => onEditInterests(me?.interests ?? [])} className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                  수정
                </button>
              </div>
              <div className="flex w-full flex-wrap gap-[8px]">
                {!me && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[26px] w-[64px]" style={{ borderRadius: "var(--a-radius-pill)" }} />)}
                {me && me.interests.length === 0 && (
                  <span className="text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>아직 선택한 관심 분야가 없어요</span>
                )}
                {me?.interests.map((k) => (
                  <span
                    key={k}
                    className="px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                    style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
                  >
                    {TOPIC_MAP[k]?.label ?? k}
                  </span>
                ))}
              </div>
            </section>

            {/* 내 글 · 댓글 · 스크랩 탭 (Figma는 언더라인 탭 스타일) */}
            <div className="flex w-full shrink-0" role="tablist" aria-label="내 활동">
              {tabs.map((t) => {
                const selected = t.key === tab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(t.key)}
                    className="flex-1 border-0 border-b-2 border-solid bg-transparent py-[10px] text-[14px] leading-[17px] whitespace-nowrap"
                    style={{
                      borderColor: selected ? "var(--a-color-text-primary)" : "var(--a-color-border)",
                      color: selected ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)",
                      fontWeight: selected ? 700 : 400,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex w-full flex-1 flex-col items-start gap-[4px]">
              {tab === "posts" && (
                <>
                  {posts.status === "loading" && <ListSkeleton />}
                  {posts.status === "error" && <ErrorState message={posts.error ?? undefined} onRetry={posts.reload} />}
                  {posts.status === "ready" && posts.items.length === 0 && <EmptyState title="작성한 글이 없어요" />}
                  {posts.status === "ready" &&
                    posts.items.map((post) => (
                      <Fragment key={post.id}>
                        <CompactPostRow post={post} onOpen={onOpenPost} />
                        <Divider />
                      </Fragment>
                    ))}
                  {posts.loadingMore && <ListSkeleton count={1} />}
                  {posts.hasMore && <div ref={posts.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
                </>
              )}

              {tab === "comments" && (
                <>
                  {comments.status === "loading" && <ListSkeleton />}
                  {comments.status === "error" && <ErrorState message={comments.error ?? undefined} onRetry={comments.reload} />}
                  {comments.status === "ready" && comments.items.length === 0 && <EmptyState title="작성한 댓글이 없어요" />}
                  {comments.status === "ready" &&
                    comments.items.map((c) => (
                      <Fragment key={c.id}>
                        <MyCommentListItem comment={c} onOpen={onOpenPost} />
                        <Divider />
                      </Fragment>
                    ))}
                  {comments.loadingMore && <ListSkeleton count={1} />}
                  {comments.hasMore && <div ref={comments.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
                </>
              )}

              {tab === "scraps" && (
                <>
                  {scraps.status === "loading" && <ListSkeleton />}
                  {scraps.status === "error" && <ErrorState message={scraps.error ?? undefined} onRetry={scraps.reload} />}
                  {scraps.status === "ready" && scraps.items.length === 0 && <EmptyState title="스크랩한 글이 없어요" />}
                  {scraps.status === "ready" &&
                    scraps.items.map((post) => (
                      <Fragment key={post.id}>
                        <CompactPostRow post={post} onOpen={onOpenPost} />
                        <Divider />
                      </Fragment>
                    ))}
                  {scraps.loadingMore && <ListSkeleton count={1} />}
                  {scraps.hasMore && <div ref={scraps.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />;
}

function ListSkeleton({ count = 4 }: { count?: number }) {
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
