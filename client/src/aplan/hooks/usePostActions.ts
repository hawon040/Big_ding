import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { postApi } from "@/api/aplan";
import type { PostCard } from "@/types/aplan";

// 목록의 좋아요·스크랩: 화면을 먼저 바꾸고(낙관적 업데이트) 서버 응답으로 맞춘다. 실패하면 되돌린다.
// 같은 글에 요청이 진행 중이면 연타를 무시한다(좋아요 POST는 서버에서 토글이라 중복 요청을 막아야 함).
export function usePostActions<T extends PostCard>(setItems: Dispatch<SetStateAction<T[]>>) {
  const pending = useRef(new Set<string>());

  const patch = useCallback(
    (id: string, changes: Partial<PostCard>) =>
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p))),
    [setItems],
  );

  const run = useCallback(
    async (key: string, optimistic: Partial<PostCard>, rollback: Partial<PostCard>, id: string, request: () => Promise<Partial<PostCard>>) => {
      if (pending.current.has(key)) return;
      pending.current.add(key);
      patch(id, optimistic);
      try {
        patch(id, await request());
      } catch {
        patch(id, rollback);
      } finally {
        pending.current.delete(key);
      }
    },
    [patch],
  );

  const toggleLike = useCallback(
    (post: PostCard) => {
      const next = !post.isLiked;
      return run(
        `like:${post.id}`,
        { isLiked: next, likeCount: post.likeCount + (next ? 1 : -1) },
        { isLiked: post.isLiked, likeCount: post.likeCount },
        post.id,
        () => (next ? postApi.like(post.id) : postApi.unlike(post.id)).then((r) => ({ isLiked: r.isLiked, likeCount: r.likeCount })),
      );
    },
    [run],
  );

  const toggleScrap = useCallback(
    (post: PostCard) => {
      const next = !post.isScrapped;
      return run(
        `scrap:${post.id}`,
        { isScrapped: next, scrapCount: post.scrapCount + (next ? 1 : -1) },
        { isScrapped: post.isScrapped, scrapCount: post.scrapCount },
        post.id,
        () => (next ? postApi.scrap(post.id) : postApi.unscrap(post.id)).then((r) => ({ isScrapped: r.isScrapped, scrapCount: r.scrapCount })),
      );
    },
    [run],
  );

  return { toggleLike, toggleScrap };
}
