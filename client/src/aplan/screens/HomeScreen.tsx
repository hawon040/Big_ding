import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { feedApi } from "@/api/aplan";
import type { TopicKey } from "@/constants/topics";
import type { TopicChipItem } from "@/types/aplan";
import { IconButton } from "@/aplan/components/IconButton";
import { TopicCircleChip } from "@/aplan/components/TopicCircleChip";
import { PostCard } from "@/aplan/components/PostCard";
import { EmptyState, ErrorState, PostCardSkeleton, PostListSkeleton, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import { usePostActions } from "@/aplan/hooks/usePostActions";
import "@/styles/aplan-tokens.css";

interface HomeScreenProps {
  unreadMessages: number;
  unreadNotifications: number;
  onOpenPost: (id: string) => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  /** "더보기" → 커뮤니티 전체 */
  onMore: () => void;
}

// A-04 홈 (Figma 2:174). 관심 주제 칩 + "지금 인기 있는 글"(관심 주제 인기순, 부족하면 전체 인기글).
// 상태바는 제외, 하단 탭바는 MainShell이 그린다.
export function HomeScreen({ unreadMessages, unreadNotifications, onOpenPost, onOpenMessages, onOpenNotifications, onMore }: HomeScreenProps) {
  const [topics, setTopics] = useState<TopicChipItem[] | null>(null);
  const [topic, setTopic] = useState<TopicKey | "all">("all");

  useEffect(() => {
    feedApi.topics().then(setTopics).catch(() => setTopics([{ key: "all", label: "전체", shortLabel: "전체" }]));
  }, []);

  const feed = useInfiniteList((cursor) => feedApi.list(topic, cursor), [topic]);
  const { toggleLike, toggleScrap } = usePostActions(feed.setItems);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 2:97 헤더: 로고 + [메시지] [알림] */}
      <header className="flex w-full shrink-0 items-center gap-[14px] px-[20px] py-[10px]">
        <h1 className="m-0 text-[22px] leading-[26px] font-bold whitespace-nowrap" style={{ color: "var(--a-color-text-primary)" }}>
          빅딩
        </h1>
        <span className="min-w-px flex-1" aria-hidden />
        <IconButton icon={Send} label="메시지" badge={unreadMessages} onClick={onOpenMessages} />
        <IconButton icon={Bell} label="알림" badge={unreadNotifications} onClick={onOpenNotifications} />
      </header>

      {/* 2:181 Body (스크롤) */}
      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[12px]">
        {/* 2:116 주제 칩 (가로 스크롤) */}
        <div className="-mx-[20px] w-[calc(100%+40px)] shrink-0 overflow-x-auto px-[20px] [scrollbar-width:none]">
          <div className="flex w-max gap-[14px]" role="group" aria-label="주제">
            {topics
              ? topics.map((t) => (
                <TopicCircleChip key={t.key} label={t.shortLabel} selected={t.key === topic} onClick={() => setTopic(t.key)} />
              ))
              : Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex flex-col items-center gap-[6px]">
                  <Skeleton className="size-[58px]" style={{ borderRadius: "50%" }} />
                  <Skeleton className="h-[13px] w-[30px]" />
                </div>
              ))}
          </div>
        </div>

        {/* 2:119 섹션 제목 */}
        <div className="flex w-full shrink-0 items-center gap-[8px]">
          <h2 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
            지금 인기 있는 글
          </h2>
          <button
            type="button"
            onClick={onMore}
            className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal whitespace-nowrap"
            style={{ color: "var(--a-color-text-secondary)" }}
          >
            더보기
          </button>
        </div>

        {/* 인기글 목록 */}
        {feed.status === "loading" && <PostListSkeleton />}
        {feed.status === "error" && <ErrorState message={feed.error ?? undefined} onRetry={feed.reload} />}
        {feed.status === "ready" && feed.items.length === 0 && (
          <EmptyState title="아직 인기 글이 없어요" description="커뮤니티에서 첫 글을 남겨보세요" action={{ label: "커뮤니티 가기", onClick: onMore }} />
        )}
        {feed.status === "ready" &&
          feed.items.map((post) => (
            <PostCard key={post.id} post={post} onOpen={onOpenPost} onToggleLike={toggleLike} onToggleScrap={toggleScrap} />
          ))}
        {feed.loadingMore && <PostCardSkeleton />}
        {feed.hasMore && <div ref={feed.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
      </main>
    </div>
  );
}
