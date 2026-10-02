import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Trash2, X } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { storyApi } from "@/api/aplan";
import { formatTime } from "@/utils";
import type { AuthorSummary, StoryItem, StoryTrayItem } from "@/types/aplan";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { StoryCanvas } from "./StoryCanvas";
import { alertDialog, confirmDialog } from "@/aplan/components/Dialog";

const STORY_MS = 5000;
const TAP_MAX_MS = 220;

interface StoryViewerProps {
  /** 스토리가 있는 사람들(트레이 순서). 끝나면 다음 사람으로 넘어간다 */
  users: StoryTrayItem[];
  startIndex: number;
  /** 닫을 때, 보거나 지운 게 있어 트레이를 새로 불러와야 하면 true */
  onClose: (changed: boolean) => void;
}

// 인스타그램식 스토리 뷰어: 위쪽 진행 막대, 5초 자동 넘김, 왼쪽 탭=이전 / 오른쪽 탭=다음, 누르고 있으면 일시정지.
// 내 스토리는 본 사람 수·목록과 삭제를 보여 준다. 사람이 끝나면 다음 사람으로, 마지막이면 닫는다.
export function StoryViewer({ users, startIndex, onClose }: StoryViewerProps) {
  const [userIdx, setUserIdx] = useState(startIndex);
  const [owner, setOwner] = useState<AuthorSummary | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<AuthorSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const changed = useRef(false);
  const elapsed = useRef(0);
  const pressedAt = useRef(0);

  const current = users[userIdx];
  const story = stories[storyIdx] ?? null;
  const paused = holding || viewersOpen;

  // 사람이 바뀌면 그 사람의 스토리를 불러온다. 안 본 첫 스토리부터 시작하고, 없거나 실패하면 다음 사람으로 건너뛴다.
  useEffect(() => {
    let cancelled = false;
    setStories([]);
    setStoryIdx(0);
    setFailed(false);
    storyApi
      .ofUser(current.user!.id)
      .then(({ user, items }) => {
        if (cancelled) return;
        if (items.length === 0) return skipUser();
        setOwner(user);
        setStories(items);
        const firstUnseen = items.findIndex((s) => !s.viewed);
        setStoryIdx(firstUnseen === -1 ? 0 : firstUnseen);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdx]);

  // 스토리가 바뀔 때마다 진행을 0으로 되돌리고, 남의 스토리면 "봤다"고 기록한다.
  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
    if (!story || story.viewed) return;
    changed.current = true;
    storyApi.view(story.id).catch(() => {});
    setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s)));
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipUser = useCallback(() => {
    if (userIdx < users.length - 1) setUserIdx(userIdx + 1);
    else onClose(changed.current);
  }, [userIdx, users.length, onClose]);

  const next = useCallback(() => {
    if (storyIdx < stories.length - 1) setStoryIdx(storyIdx + 1);
    else skipUser();
  }, [storyIdx, stories.length, skipUser]);

  const prev = useCallback(() => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (userIdx > 0) setUserIdx(userIdx - 1);
    else {
      elapsed.current = 0;
      setProgress(0);
    }
  }, [storyIdx, userIdx]);

  // 자동 넘김 타이머 (일시정지 중에는 멈춘다)
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!story || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = Math.min(1, elapsed.current / STORY_MS);
      setProgress(p);
      if (p >= 1) nextRef.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(changed.current);
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setHolding(false);
    if (performance.now() - pressedAt.current > TAP_MAX_MS) return; // 길게 눌렀다 뗀 건 이동하지 않는다
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };

  const openViewers = () => {
    if (!story) return;
    setViewers(null);
    setViewersOpen(true);
    storyApi.viewers(story.id).then(setViewers).catch(() => setViewers([]));
  };

  const remove = async () => {
        if (!story) return;
    // 확인 창이 떠 있는 동안 스토리가 다음 장으로 넘어가지 않게 먼저 멈춘다
    // (window.confirm은 실행 자체를 멈췄지만 confirmDialog는 멈추지 않는다)
    setHolding(true);
    if (!(await confirmDialog({ title: "이 스토리를 삭제할까요?", confirmText: "삭제", danger: true }))) {
      setHolding(false);
      return;
    }
    try {
      await storyApi.remove(story.id);
      changed.current = true;
      const rest = stories.filter((s) => s.id !== story.id);
      if (rest.length === 0) return skipUser();
      setStories(rest);
      setStoryIdx(Math.min(storyIdx, rest.length - 1));
    } catch (err: any) {
            alertDialog(err?.response?.data?.message || "삭제하지 못했어요.");
    } finally {
      setHolding(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="스토리" className="fixed inset-0 z-[70] flex justify-center" style={{ background: "#000" }}>
      <div className="relative flex h-full w-full max-w-[var(--a-screen-max)] flex-col select-none" style={{ fontFamily: "var(--a-font-sans)" }}>
        {story && (
          <div
            className="absolute inset-0 touch-none"
            onPointerDown={() => { pressedAt.current = performance.now(); setHolding(true); }}
            onPointerUp={onPointerUp}
            onPointerLeave={() => setHolding(false)}
            onPointerCancel={() => setHolding(false)}
          >
            <StoryCanvas src={resolveAssetUrl(story.image) ?? ""} texts={story.texts ?? []} alt={story.caption || "스토리 사진"} />
          </div>
        )}

        {/* 위: 진행 막대 + 작성자 + 닫기 */}
        <div className="pointer-events-none relative z-10 flex flex-col gap-[10px] px-[12px] pt-[12px] pb-[24px]" style={{ background: "linear-gradient(rgba(0,0,0,0.55), transparent)" }}>
          <div className="flex gap-[4px]" aria-hidden>
            {stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.35)" }}>
                <span className="block h-full" style={{ width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%`, background: "#fff" }} />
              </span>
            ))}
          </div>
          <div className="pointer-events-auto flex items-center gap-[10px]">
            <Avatar src={owner?.profileImage ?? current.user?.profileImage} size={32} />
            <span className="text-[14px] leading-[17px] font-bold" style={{ color: "#fff" }}>{current.isMe ? "내 스토리" : owner?.nickname ?? current.user?.nickname}</span>
            {story && <span className="text-[12px] leading-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>{formatTime(story.createdAt)}</span>}
            <span className="min-w-px flex-1" aria-hidden />
            <button type="button" onClick={() => onClose(changed.current)} aria-label="닫기" className="flex border-0 bg-transparent p-0">
              <X size={26} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
            </button>
          </div>
        </div>

        {!story && (
          <p role="status" className="absolute inset-0 m-0 flex items-center justify-center text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            {failed ? (
              <button type="button" onClick={skipUser} className="border-0 bg-transparent p-[12px] text-[13px]" style={{ color: "#fff" }}>불러오지 못했어요 · 다음으로</button>
            ) : "불러오는 중…"}
          </p>
        )}

        {/* 아래: 문구 + (내 스토리) 본 사람·삭제 */}
        {story && (
          <div className="pointer-events-none relative z-10 mt-auto flex flex-col gap-[10px] px-[16px] pt-[40px] pb-[24px]" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
            {story.caption && (
              <p className="m-0 text-center text-[15px] leading-[21px] break-words whitespace-pre-wrap" style={{ color: "#fff" }}>{story.caption}</p>
            )}
            {story.isMine && (
              <div className="pointer-events-auto flex items-center">
                <button type="button" onClick={openViewers} className="flex items-center gap-[6px] border-0 bg-transparent p-0 text-[13px] leading-[16px] font-[500]" style={{ color: "#fff" }}>
                  <Eye size={18} strokeWidth={1.5} aria-hidden /> {story.viewerCount ?? 0}명이 봤어요
                </button>
                <span className="min-w-px flex-1" aria-hidden />
                <button type="button" onClick={remove} aria-label="스토리 삭제" className="flex border-0 bg-transparent p-0">
                  <Trash2 size={20} strokeWidth={1.5} style={{ color: "#fff" }} aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomSheet open={viewersOpen} title="본 사람" onClose={() => setViewersOpen(false)}>
        {viewers === null && <p className="m-0 py-[16px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>불러오는 중…</p>}
        {viewers?.length === 0 && <p className="m-0 py-[16px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>아직 본 사람이 없어요.</p>}
        <ul className="m-0 flex max-h-[50dvh] list-none flex-col overflow-y-auto p-0">
          {viewers?.map((u) => (
            <li key={u.id} className="flex items-center gap-[12px] py-[10px]">
              <Avatar src={u.profileImage} size={36} />
              <span className="text-[14px] leading-[17px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>{u.nickname}</span>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
