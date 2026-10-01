import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { feedPostApi } from "@/api/aplan";
import type { FeedItem } from "@/types/aplan";

// 피드 좋아요: 화면을 먼저 바꾸고(낙관적 업데이트) 서버 값으로 맞춘다. 실패하면 되돌리고, 진행 중인 글의 연타는 무시한다.
export function useFeedActions(setItems: Dispatch<SetStateAction<FeedItem[]>>) {
  const pending = useRef(new Set<string>());

  const patch = useCallback(
    (id: string, changes: Partial<FeedItem>) => setItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f))),
    [setItems],
  );

  const toggleLike = useCallback(
    async (feed: FeedItem) => {
      if (pending.current.has(feed.id)) return;
      pending.current.add(feed.id);
      const next = !feed.isLiked;
      patch(feed.id, { isLiked: next, likeCount: feed.likeCount + (next ? 1 : -1) });
      try {
        const res = await (next ? feedPostApi.like(feed.id) : feedPostApi.unlike(feed.id));
        patch(feed.id, { isLiked: res.isLiked, likeCount: res.likeCount });
      } catch {
        patch(feed.id, { isLiked: feed.isLiked, likeCount: feed.likeCount });
      } finally {
        pending.current.delete(feed.id);
      }
    },
    [patch],
  );

  return { toggleLike, patch };
}
