import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/types/aplan";

type Status = "loading" | "ready" | "error";

// 커서 페이지네이션 목록 + 무한 스크롤. sentinelRef를 목록 끝에 붙이면 보일 때 다음 페이지를 불러온다.
// deps가 바뀌면(예: 주제·게시판 탭 변경) 처음부터 다시 불러온다.
export function useInfiniteList<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const reload = useCallback(() => {
    const id = ++requestId.current;
    setStatus("loading");
    setError(null);
    fetchRef.current(null)
      .then((page) => {
        if (id !== requestId.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err?.response?.data?.message || null);
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(reload, [reload]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore || status !== "ready") return;
    const id = requestId.current;
    setLoadingMore(true);
    fetchRef.current(nextCursor)
      .then((page) => {
        if (id !== requestId.current) return;
        setItems((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        /* 다음 페이지 실패는 조용히 두고, 다시 스크롤하면 재시도한다 */
      })
      .finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore, status]);

  // 목록 끝 감지 (IntersectionObserver)
  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      }, { rootMargin: "200px" });
      observer.current.observe(node);
    },
    [loadMore],
  );

  return { items, setItems, status, error, reload, hasMore: !!nextCursor, loadingMore, sentinelRef };
}
