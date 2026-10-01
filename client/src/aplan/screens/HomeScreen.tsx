import { useEffect, useState } from "react";
import { Bell, BellOff, Plus, Send } from "lucide-react";
import { feedPostApi, tagAlertApi } from "@/api/aplan";
import { IconButton } from "@/aplan/components/IconButton";
import { TopicSelectChip } from "@/aplan/components/TopicSelectChip";
import { FeedCard } from "@/aplan/components/FeedCard";
import { EmptyState, ErrorState, PostCardSkeleton, PostListSkeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import { useFeedActions } from "@/aplan/hooks/useFeedActions";
import "@/styles/aplan-tokens.css";

interface HomeScreenProps {
  unreadMessages: number;
  unreadNotifications: number;
  onOpenFeed: (id: string) => void;
  onOpenUser: (id: string) => void;
  onWriteFeed: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
}

// A-04 홈 (Figma 2:174). 주제 칩 + 피드(사진 필수 게시물, 최신순). 커뮤니티 글과는 별개 데이터(/api/feeds)다.
// 상태바는 제외, 하단 탭바는 MainShell이 그린다.
export function HomeScreen({ unreadMessages, unreadNotifications, onOpenFeed, onOpenUser, onWriteFeed, onOpenMessages, onOpenNotifications }: HomeScreenProps) {
  // 보고 있는 #태그(null이면 전체)와 알림을 받는 태그 목록
  const [tag, setTag] = useState<string | null>(null);
  const [alertTags, setAlertTags] = useState<string[]>([]);
  const [alertBusy, setAlertBusy] = useState(false);

  useEffect(() => {
    tagAlertApi.list().then(setAlertTags).catch(() => {});
  }, []);

  const feed = useInfiniteList((cursor) => feedPostApi.list(tag, cursor), [tag]);
  const { toggleLike } = useFeedActions(feed.setItems);

  const subscribed = tag !== null && alertTags.includes(tag);
  const toggleAlert = () => {
    if (!tag || alertBusy) return;
    setAlertBusy(true);
    (subscribed ? tagAlertApi.remove(tag) : tagAlertApi.add(tag))
      .then(setAlertTags)
      .catch((err) => window.alert(err?.response?.data?.message || "알림을 바꾸지 못했어요."))
      .finally(() => setAlertBusy(false));
  };

  // 칩: 전체 + 알림 받는 태그 + (구독하지 않았지만 지금 보고 있는) 태그
  const chipTags = tag && !alertTags.includes(tag) ? [...alertTags, tag] : alertTags;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 2:97 헤더: 로고 + [메시지] [알림] */}
      <header className="flex w-full shrink-0 items-center gap-[14px] px-[20px] py-[10px]">
        <h1 className="m-0 text-[22px] leading-[26px] font-bold whitespace-nowrap" style={{ color: "var(--a-color-text-primary)" }}>
          Big Ding
        </h1>
        <span className="min-w-px flex-1" aria-hidden />
        <IconButton icon={Plus} label="피드 올리기" onClick={onWriteFeed} />
        <IconButton icon={Send} label="메시지" badge={unreadMessages} onClick={onOpenMessages} />
        <IconButton icon={Bell} label="알림" badge={unreadNotifications} onClick={onOpenNotifications} />
      </header>

      {/* 2:181 Body (스크롤) */}
      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[12px]">
        {/* 태그 칩 (가로 스크롤) */}
        <div className="-mx-[20px] w-[calc(100%+40px)] shrink-0 overflow-x-auto px-[20px] [scrollbar-width:none]">
          <div className="flex w-max gap-[8px]" role="group" aria-label="태그">
            <TopicSelectChip selected={tag === null} onClick={() => setTag(null)}>전체</TopicSelectChip>
            {chipTags.map((t) => (
              <TopicSelectChip key={t} selected={tag === t} onClick={() => setTag(t)}>#{t}</TopicSelectChip>
            ))}
          </div>
        </div>

        {tag && (
          <div className="flex w-full shrink-0 items-center gap-[8px]">
            <h2 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>#{tag}</h2>
            <button
              type="button"
              onClick={toggleAlert}
              disabled={alertBusy}
              aria-pressed={subscribed}
              className="flex items-center gap-[4px] border border-solid bg-transparent px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] disabled:opacity-50"
              style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-pill)", color: "var(--a-color-text-primary)" }}
            >
              {subscribed ? <BellOff size={14} strokeWidth={1.5} aria-hidden /> : <Bell size={14} strokeWidth={1.5} aria-hidden />}
              {subscribed ? "알림 끄기" : "알림 받기"}
            </button>
          </div>
        )}

        {/* 피드 목록 */}
        {feed.status === "loading" && <PostListSkeleton />}
        {feed.status === "error" && <ErrorState message={feed.error ?? undefined} onRetry={feed.reload} />}
        {feed.status === "ready" && feed.items.length === 0 && (
          <EmptyState title={tag ? `#${tag} 피드가 아직 없어요` : "아직 올라온 피드가 없어요"} description="사진과 함께 첫 피드를 올려보세요" action={{ label: "피드 올리기", onClick: onWriteFeed }} />
        )}
        {feed.status === "ready" &&
          feed.items.map((item) => (
            <FeedCard key={item.id} feed={item} onOpen={onOpenFeed} onOpenUser={onOpenUser} onTagClick={setTag} onToggleLike={toggleLike} />
          ))}
        {feed.loadingMore && <PostCardSkeleton />}
        {feed.hasMore && <div ref={feed.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
      </main>
    </div>
  );
}
