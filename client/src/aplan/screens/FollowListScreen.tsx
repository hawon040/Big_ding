import { useCallback, useEffect, useState } from "react";
import { meApi, userApi } from "@/api/aplan";
import { Avatar } from "@/aplan/components/Avatar";
import { ScreenHeader } from "@/aplan/components/ScreenHeader";
import { UnderlineTabs } from "@/aplan/components/ProfileParts";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useProfileCountsLive } from "@/aplan/hooks/useProfileCountsLive";
import type { UserSummary } from "@/types/aplan";
import { alertDialog, confirmDialog } from "@/aplan/components/Dialog";
import "@/styles/aplan-tokens.css";

export type FollowTab = "followers" | "following";

interface FollowListScreenProps {
  userId: string;
  initialTab: FollowTab;
  onBack: () => void;
  onOpenUser: (id: string) => void;
}

const TABS: { key: FollowTab; label: string }[] = [
  { key: "followers", label: "팔로워" },
  { key: "following", label: "팔로잉" },
];

type Status = "loading" | "ready" | "error";

// 팔로워 / 팔로잉 목록 (Figma에 없는 화면 — 인스타 방식).
// 각 줄에서 바로 팔로우·언팔로우할 수 있고, 내 팔로워 목록에서는 "삭제"로 팔로워를 내보낼 수 있다.
// 비공개 계정은 본인·맞팔로우가 아니면 서버가 403을 준다.
export function FollowListScreen({ userId, initialTab, onBack, onOpenUser }: FollowListScreenProps) {
  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [myId, setMyId] = useState<string | null>(null);
  const [lists, setLists] = useState<Record<FollowTab, UserSummary[]>>({ followers: [], following: [] });
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  // 진행 중인 요청이 있는 사용자 id (버튼 중복 클릭 방지)
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    meApi.get().then((me) => setMyId(me.id)).catch(() => {});
  }, []);
  const isMine = myId === userId;

  // silent면 스켈레톤 없이 목록만 바꾼다 (실시간 갱신·앱 복귀)
  const load = useCallback((silent = false) => {
    if (!silent) {
      setStatus("loading");
      setError(null);
    }
    Promise.all([userApi.followers(userId), userApi.following(userId)])
      .then(([followers, following]) => {
        setLists({ followers: followers.items, following: following.items });
        setStatus("ready");
      })
      .catch((err) => {
        if (silent) return;
        setError(err?.response?.data?.message || "불러오지 못했어요.");
        setStatus("error");
      });
  }, [userId]);
  useEffect(() => load(), [load]);
  useProfileCountsLive(useCallback(() => load(true), [load]));

  const withBusy = (id: string, task: Promise<unknown>) => {
    setBusy((s) => new Set(s).add(id));
    return task.finally(() =>
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      }),
    );
  };

  // 같은 사람이 두 목록에 다 있을 수 있어서(맞팔) 양쪽 목록의 팔로우 표시를 함께 바꾼다
  const setFollowing = (id: string, value: boolean) =>
    setLists((prev) => ({
      followers: prev.followers.map((u) => (u.id === id ? { ...u, isFollowing: value } : u)),
      following: prev.following.map((u) => (u.id === id ? { ...u, isFollowing: value } : u)),
    }));

  const toggleFollow = (user: UserSummary) => {
    if (busy.has(user.id)) return;
    const next = !user.isFollowing;
    setFollowing(user.id, next);
    withBusy(user.id, next ? userApi.follow(user.id) : userApi.unfollow(user.id)).catch((err) => {
      setFollowing(user.id, !next);
            alertDialog(err?.response?.data?.message || "팔로우 상태를 바꾸지 못했어요.");
    });
  };

    const removeFollower = async (user: UserSummary) => {
    if (busy.has(user.id)) return;
    if (!(await confirmDialog({ title: `${user.nickname}님을 팔로워에서 삭제할까요?`, message: "상대에게 알림은 가지 않아요.", confirmText: "삭제", danger: true }))) return;
    const before = lists.followers;
    setLists((prev) => ({ ...prev, followers: prev.followers.filter((u) => u.id !== user.id) }));
    withBusy(user.id, userApi.removeFollower(user.id)).catch((err) => {
      setLists((prev) => ({ ...prev, followers: before }));
            alertDialog(err?.response?.data?.message || "삭제하지 못했어요.");
    });
  };

  const items = lists[tab];
  const tabsWithCount = TABS.map((t) => ({ ...t, label: status === "ready" ? `${t.label} ${lists[t.key].length}` : t.label }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title={isMine ? "내 팔로우" : "팔로우"} onBack={onBack} />
      <div className="w-full shrink-0 px-[20px]">
        <UnderlineTabs tabs={tabsWithCount} active={tab} onChange={setTab} label="팔로우 목록" />
      </div>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {status === "loading" && <RowsSkeleton />}
        {status === "error" && <ErrorState message={error ?? undefined} onRetry={() => load()} />}
        {status === "ready" && items.length === 0 && (
          <EmptyState title={tab === "followers" ? "아직 팔로워가 없어요" : "아직 팔로우하는 사람이 없어요"} />
        )}
        {status === "ready" &&
          items.map((u) => {
            const isSelf = u.id === myId;
            const meta = [u.department, u.bio].filter(Boolean).join(" · ");
            return (
              <div key={u.id} className="flex w-full shrink-0 items-center gap-[12px] py-[10px]">
                <button
                  type="button"
                  onClick={() => onOpenUser(u.id)}
                  className="flex min-w-px flex-1 items-center gap-[12px] border-0 bg-transparent p-0 text-left"
                >
                  <Avatar src={u.profileImage} size={44} />
                  <span className="flex min-w-px flex-1 flex-col items-start gap-[2px]">
                    <span className="line-clamp-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{u.nickname}</span>
                    {meta && (
                      <span className="line-clamp-1 w-full text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{meta}</span>
                    )}
                  </span>
                </button>
                {!isSelf && isMine && tab === "followers" ? (
                  <div className="flex shrink-0 gap-[6px]">
                    {!u.isFollowing && (
                      <PillButton filled disabled={busy.has(u.id)} onClick={() => toggleFollow(u)}>맞팔로우</PillButton>
                    )}
                    <PillButton disabled={busy.has(u.id)} onClick={() => removeFollower(u)}>삭제</PillButton>
                  </div>
                ) : (
                  !isSelf && (
                    <PillButton filled={!u.isFollowing} disabled={busy.has(u.id)} onClick={() => toggleFollow(u)}>
                      {u.isFollowing ? "팔로잉" : "팔로우"}
                    </PillButton>
                  )
                )}
              </div>
            );
          })}
      </main>
    </div>
  );
}

function PillButton({ filled = false, disabled, onClick, children }: { filled?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 border-0 px-[14px] py-[7px] text-[12px] leading-[14px] font-[500] whitespace-nowrap disabled:opacity-50"
      style={{
        borderRadius: "var(--a-radius-pill)",
        background: filled ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
        color: filled ? "var(--a-color-on-inverse)" : "var(--a-color-icon)",
      }}
    >
      {children}
    </button>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex w-full flex-col" role="status" aria-label="불러오는 중">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-[12px] py-[10px]">
          <Skeleton className="size-[44px]" style={{ borderRadius: "50%" }} />
          <div className="flex flex-1 flex-col gap-[4px]">
            <Skeleton className="h-[14px] w-[90px]" />
            <Skeleton className="h-[12px] w-[140px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
