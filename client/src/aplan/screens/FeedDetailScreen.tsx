import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Send, Trash2 } from "lucide-react";
import { feedPostApi } from "@/api/aplan";
import { formatTime } from "@/utils";
import type { FeedComment, FeedItem } from "@/types/aplan";
import { Avatar } from "@/aplan/components/Avatar";
import { FeedCard } from "@/aplan/components/FeedCard";
import { TextField } from "@/aplan/components/TextField";
import { ErrorState } from "@/aplan/components/States";
import { useFeedActions } from "@/aplan/hooks/useFeedActions";
import { alertDialog, confirmDialog } from "@/aplan/components/Dialog";
import { FeedEditScreen } from "@/aplan/screens/FeedEditScreen";
import "@/styles/aplan-tokens.css";

interface FeedDetailScreenProps {
  feedId: string;
  onBack: () => void;
  onOpenUser: (id: string) => void;
}

// 피드(게시물) 상세: 사진·본문 전체 + 댓글 목록/작성. ⋮ 메뉴로 내 피드는 수정·삭제, 다른 사람 피드는 신고한다.
export function FeedDetailScreen({ feedId, onBack, onOpenUser }: FeedDetailScreenProps) {
  const [feedList, setFeedList] = useState<FeedItem[]>([]);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const feed = feedList[0] ?? null;
  const { toggleLike, patch } = useFeedActions(setFeedList);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([feedPostApi.get(feedId), feedPostApi.comments(feedId)])
      .then(([f, c]) => {
        setFeedList([f]);
        setComments(c);
      })
      .catch((err) => setError(err?.response?.data?.message || "불러오지 못했어요."));
  }, [feedId]);
  useEffect(load, [load]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !feed) return;
    setSending(true);
    setCommentError(null);
    try {
      const created = await feedPostApi.addComment(feedId, text);
      setComments((prev) => [...prev, created]);
      setFeedList(([f]) => [{ ...f, commentCount: f.commentCount + 1 }]);
      setInput("");
    } catch (err: any) {
      setCommentError(err?.response?.data?.message || "댓글을 등록하지 못했어요.");
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (c: FeedComment) => {
        if (!(await confirmDialog({ title: "댓글을 삭제할까요?", confirmText: "삭제", danger: true }))) return;
    try {
      await feedPostApi.removeComment(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setFeedList(([f]) => [{ ...f, commentCount: Math.max(0, f.commentCount - 1) }]);
    } catch (err: any) {
            alertDialog(err?.response?.data?.message || "삭제하지 못했어요.");
    }
  };

  const removeFeed = async () => {
        if (!(await confirmDialog({ title: "이 피드를 삭제할까요?", message: "삭제하면 되돌릴 수 없어요.", confirmText: "삭제", danger: true }))) return;
    try {
      await feedPostApi.remove(feedId);
      onBack();
    } catch (err: any) {
            alertDialog(err?.response?.data?.message || "삭제하지 못했어요.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>피드</h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] pb-[16px]">
        {error && <ErrorState message={error} onRetry={load} />}
        {!error && !feed && <p role="status" className="m-0 py-[32px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>불러오는 중…</p>}
        {feed && (
          <>
            <FeedCard feed={feed} expanded onToggleLike={toggleLike} onOpenUser={onOpenUser} onEdit={() => setEditing(true)} onDelete={removeFeed} />
            <section aria-label="댓글" className="flex flex-col gap-[4px] pt-[8px]" style={{ borderTop: "1px solid var(--a-color-border)" }}>
              <h2 className="m-0 py-[8px] text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>댓글 {feed.commentCount}</h2>
              {comments.length === 0 && <p className="m-0 py-[12px] text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>첫 댓글을 남겨보세요.</p>}
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-[10px] py-[8px]">
                  <button type="button" disabled={!c.author} onClick={() => c.author && onOpenUser(c.author.id)} aria-label={`${c.author?.nickname ?? "알 수 없음"} 프로필`} className="border-0 bg-transparent p-0">
                    <Avatar src={c.author?.profileImage} size={28} />
                  </button>
                  <div className="flex min-w-px flex-1 flex-col gap-[2px]">
                    <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
                      {c.author?.nickname ?? "알 수 없음"}
                      <span className="ml-[6px] text-[11px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{formatTime(c.createdAt)}</span>
                    </span>
                    <p className="m-0 text-[13px] leading-[18px] break-words whitespace-pre-wrap" style={{ color: "var(--a-color-text-primary)" }}>{c.content}</p>
                  </div>
                  {c.isMine && (
                    <button type="button" aria-label="댓글 삭제" onClick={() => removeComment(c)} className="border-0 bg-transparent p-0">
                      <Trash2 size={14} strokeWidth={1.5} style={{ color: "var(--a-color-text-secondary)" }} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      {commentError && <p role="alert" className="m-0 px-[20px] pb-[4px] text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{commentError}</p>}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex shrink-0 items-center gap-[10px] px-[20px] py-[10px]"
        style={{ borderTop: "1px solid var(--a-color-border)" }}
      >
        <TextField label="댓글" placeholder="댓글을 입력하세요" value={input} maxLength={300} autoComplete="off" disabled={!feed} onChange={(e) => setInput(e.target.value)} className="min-w-px flex-1" />
        <button type="submit" disabled={!input.trim() || sending || !feed} aria-label="댓글 등록" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0 disabled:opacity-40">
          <Send size={22} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} aria-hidden />
        </button>
      </form>

      {editing && feed && (
        <FeedEditScreen
          feed={feed}
          onBack={() => setEditing(false)}
          onSaved={(updated) => {
            patch(updated.id, { content: updated.content, tags: updated.tags });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
