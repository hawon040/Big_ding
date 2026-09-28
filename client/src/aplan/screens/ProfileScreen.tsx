import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { userApi, reportApi } from "@/api/aplan";
import { TOPIC_MAP } from "@/constants/topics";
import { Avatar } from "@/aplan/components/Avatar";
import { IconButton } from "@/aplan/components/IconButton";
import { CompactPostRow } from "@/aplan/components/CompactPostRow";
import { MyCommentListItem } from "@/aplan/components/MyCommentListItem";
import { BottomSheet, SheetItem } from "@/aplan/components/BottomSheet";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import type { UserProfile } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

type ProfileTab = "posts" | "comments";
const REPORT_REASONS = ["스팸/광고", "욕설·혐오 표현", "음란물", "기타"];

interface ProfileScreenProps {
  userId: string;
  onBack: () => void;
  onOpenPost: (id: string) => void;
}

// 다른 사용자 프로필 (Figma에 없는 화면 — 5개 시안 모두 09-상세까지만 있다).
// 마이페이지(A-07)와 같은 톤으로 구성하되 프로필 수정 대신 팔로우 버튼, 차단·신고 메뉴를 둔다.
// 스크랩 탭은 본인만 볼 수 있어(server/routes/users/content.js) 여기서는 뺐다.
export function ProfileScreen({ userId, onBack, onOpenPost }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [followBusy, setFollowBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const load = () => {
    setError(null);
    setProfile(null);
    userApi.profile(userId).then(setProfile).catch((err) => setError(err?.response?.data?.message || "불러오지 못했어요."));
  };
  useEffect(load, [userId]);

  const empty = { items: [], nextCursor: null };
  const canViewContent = !!profile && !profile.isWithdrawn && (profile.isMe || !profile.isPrivate || profile.isMutualFollow);
  const posts = useInfiniteList(
    (cursor) => (tab === "posts" && canViewContent ? userApi.posts(userId, cursor) : Promise.resolve(empty)),
    [tab, userId, canViewContent],
  );
  const comments = useInfiniteList(
    (cursor) => (tab === "comments" && canViewContent ? userApi.comments(userId, cursor) : Promise.resolve(empty)),
    [tab, userId, canViewContent],
  );

  const toggleFollow = () => {
    if (!profile || followBusy) return;
    const next = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: next, followerCount: profile.followerCount + (next ? 1 : -1) });
    setFollowBusy(true);
    (next ? userApi.follow(userId) : userApi.unfollow(userId))
      .catch(load)
      .finally(() => setFollowBusy(false));
  };

  const toggleBlock = () => {
    setMenuOpen(false);
    (blocked ? userApi.unblock(userId) : userApi.block(userId)).then(() => setBlocked((b) => !b));
  };

  const submitReport = (reason: string) => {
    setReportOpen(false);
    reportApi.create({ targetType: "user", targetId: userId, reason });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <span className="min-w-px flex-1" aria-hidden />
        {profile && !profile.isMe && <IconButton icon={MoreVertical} label="더보기" onClick={() => setMenuOpen(true)} />}
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[20px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {error && <ErrorState message={error} onRetry={load} />}

        {!error && profile?.isWithdrawn && <EmptyState title="탈퇴한 사용자예요" />}

        {!error && profile && !profile.isWithdrawn && (
          <>
            <section className="flex w-full items-center gap-[14px]">
              <Avatar src={profile.profileImage} size={64} />
              <div className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
                <span className="text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{profile.nickname}</span>
                <span className="text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                  {[profile.department, profile.grade ? `${profile.grade}학년` : null].filter(Boolean).join(" · ") || "학과 정보 없음"}
                </span>
              </div>
              {!profile.isMe && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  className="shrink-0 border-0 px-[14px] py-[8px] text-[13px] leading-[16px] font-[500] whitespace-nowrap"
                  style={{
                    borderRadius: "var(--a-radius-pill)",
                    background: profile.isFollowing ? "var(--a-color-surface-muted)" : "var(--a-color-surface-inverse)",
                    color: profile.isFollowing ? "var(--a-color-icon)" : "var(--a-color-on-inverse)",
                  }}
                >
                  {profile.isFollowing ? "팔로잉" : "팔로우"}
                </button>
              )}
            </section>

            {profile.bio && (
              <p className="m-0 -mt-[8px] w-full text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{profile.bio}</p>
            )}

            <section className="flex w-full items-stretch border border-solid" style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)" }}>
              {([
                { label: "게시글", value: profile.postCount },
                { label: "팔로워", value: profile.followerCount },
                { label: "팔로잉", value: profile.followingCount },
              ] as const).map((s, i) => (
                <div key={s.label} className="flex min-w-px flex-1 flex-col items-center gap-[2px] py-[14px]" style={i > 0 ? { borderLeft: "1px solid var(--a-color-border)" } : undefined}>
                  <span className="text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{s.value}</span>
                  <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{s.label}</span>
                </div>
              ))}
            </section>

            {profile.interests.length > 0 && (
              <section className="flex w-full flex-col gap-[8px]">
                <h2 className="m-0 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>관심 분야</h2>
                <div className="flex w-full flex-wrap gap-[8px]">
                  {profile.interests.map((k) => (
                    <span key={k} className="px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap" style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}>
                      {TOPIC_MAP[k]?.label ?? k}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {!canViewContent ? (
              <EmptyState title="비공개 계정이에요" description="맞팔로우하면 글을 볼 수 있어요" />
            ) : (
              <>
                <div className="flex w-full shrink-0" role="tablist" aria-label="게시물">
                  {([{ key: "posts", label: "글" }, { key: "comments", label: "댓글" }] as const).map((t) => {
                    const selected = t.key === tab;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setTab(t.key)}
                        className="flex-1 border-0 border-b-2 border-solid bg-transparent py-[10px] text-[14px] leading-[17px]"
                        style={{ borderColor: selected ? "var(--a-color-text-primary)" : "var(--a-color-border)", color: selected ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)", fontWeight: selected ? 700 : 400 }}
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
                      {posts.status === "ready" && posts.items.map((post) => (
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
                      {comments.status === "ready" && comments.items.map((c) => (
                        <Fragment key={c.id}>
                          <MyCommentListItem comment={c} onOpen={onOpenPost} />
                          <Divider />
                        </Fragment>
                      ))}
                      {comments.loadingMore && <ListSkeleton count={1} />}
                      {comments.hasMore && <div ref={comments.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {!error && !profile && <ProfileSkeleton />}
      </main>

      <BottomSheet open={menuOpen} title="더보기" onClose={() => setMenuOpen(false)}>
        <SheetItem danger onClick={toggleBlock}>{blocked ? "차단 해제" : "차단하기"}</SheetItem>
        <SheetItem danger onClick={() => { setMenuOpen(false); setReportOpen(true); }}>신고</SheetItem>
      </BottomSheet>

      <BottomSheet open={reportOpen} title="신고 사유" onClose={() => setReportOpen(false)}>
        {REPORT_REASONS.map((reason) => (
          <SheetItem key={reason} onClick={() => submitReport(reason)}>{reason}</SheetItem>
        ))}
      </BottomSheet>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />;
}

function ProfileSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-[20px]">
      <div className="flex w-full items-center gap-[14px]">
        <Skeleton className="size-[64px]" style={{ borderRadius: "50%" }} />
        <div className="flex flex-1 flex-col gap-[4px]">
          <Skeleton className="h-[17px] w-[100px]" />
          <Skeleton className="h-[12px] w-[140px]" />
        </div>
      </div>
      <Skeleton className="h-[64px] w-full" style={{ borderRadius: 14 }} />
    </div>
  );
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
