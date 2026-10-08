import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { userApi, reportApi } from "@/api/aplan";
import { TOPIC_MAP } from "@/constants/topics";
import { Avatar } from "@/aplan/components/Avatar";
import { ImageViewer } from "@/aplan/components/ImageViewer";
import { IconButton } from "@/aplan/components/IconButton";
import { FeedGrid, PostRows, ProfileStats, UnderlineTabs, type ProfileTab } from "@/aplan/components/ProfileParts";
import { BottomSheet, SheetItem } from "@/aplan/components/BottomSheet";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import { useProfileCountsLive } from "@/aplan/hooks/useProfileCountsLive";
import type { UserProfile } from "@/types/aplan";
import { alertDialog } from "@/aplan/components/Dialog";
import "@/styles/aplan-tokens.css";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "feeds", label: "피드글" },
  { key: "posts", label: "커뮤니티 글" },
];
const REPORT_REASONS = ["스팸/광고", "욕설·혐오 표현", "음란물", "기타"];

interface ProfileScreenProps {
  userId: string;
  onBack: () => void;
  onOpenPost: (id: string) => void;
  onOpenFeed: (id: string) => void;
  onOpenFollows: (userId: string, tab: "followers" | "following") => void;
}

// 다른 사용자 프로필 (Figma에 없는 화면 — 5개 시안 모두 09-상세까지만 있다).
// 마이페이지(A-07)와 같은 톤으로 구성하되 프로필 수정 대신 팔로우 버튼, 차단·신고 메뉴를 둔다.
// 탭은 마이페이지와 같이 피드글 / 커뮤니티 글. 팔로워·팔로잉 숫자를 누르면 목록으로 간다.
export function ProfileScreen({ userId, onBack, onOpenPost, onOpenFeed, onOpenFollows }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>("feeds");
  const [followBusy, setFollowBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const load = () => {
    setError(null);
    setProfile(null);
    userApi.profile(userId).then(setProfile).catch((err) => setError(err?.response?.data?.message || "불러오지 못했어요."));
  };
  useEffect(load, [userId]);

  const empty = { items: [], nextCursor: null };
  const canViewContent = !!profile && !profile.isWithdrawn && (profile.isMe || !profile.isPrivate || profile.isMutualFollow);
  const feeds = useInfiniteList(
    (cursor) => (tab === "feeds" && canViewContent ? userApi.feeds(userId, cursor) : Promise.resolve(empty)),
    [tab, userId, canViewContent],
  );
  const posts = useInfiniteList(
    (cursor) => (tab === "posts" && canViewContent ? userApi.posts(userId, cursor) : Promise.resolve(empty)),
    [tab, userId, canViewContent],
  );

  // 숫자·팔로우 상태만 조용히 새로 고친다 (팔로우 직후, 실시간 이벤트, 앱 복귀)
  const refreshProfile = useCallback(() => {
    userApi.profile(userId).then((next) => setProfile((prev) => (prev ? next : prev))).catch(() => {});
  }, [userId]);
  useProfileCountsLive(refreshProfile);

  // 버튼은 바로 바꾸고(낙관적), 서버 응답이 오면 실제 숫자·맞팔 여부로 다시 맞춘다.
  const toggleFollow = () => {
    if (!profile || followBusy) return;
    const next = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: next, followerCount: Math.max(0, profile.followerCount + (next ? 1 : -1)) });
    setFollowBusy(true);
    (next ? userApi.follow(userId) : userApi.unfollow(userId))
      .then(refreshProfile)
      .catch((err) => {
                alertDialog(err?.response?.data?.message || "팔로우 상태를 바꾸지 못했어요.");
        refreshProfile();
      })
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
              <button
                type="button"
                disabled={!profile.profileImage}
                onClick={() => setPhotoOpen(true)}
                aria-label="프로필 사진 크게 보기"
                className="shrink-0 border-0 bg-transparent p-0 disabled:cursor-default"
              >
                <Avatar src={profile.profileImage} size={64} />
              </button>
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

            {/* 비공개 계정은 맞팔로우가 아니면 목록을 볼 수 없어서(서버 403) 숫자만 보여준다 */}
            <ProfileStats
              stats={[
                { label: "피드글", value: profile.feedCount },
                { label: "게시글", value: profile.postCount },
                { label: "팔로워", value: profile.followerCount, onClick: canViewContent ? () => onOpenFollows(userId, "followers") : undefined },
                { label: "팔로잉", value: profile.followingCount, onClick: canViewContent ? () => onOpenFollows(userId, "following") : undefined },
              ]}
            />

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
                <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} label="게시물" />

                <div className="flex w-full flex-1 flex-col items-start gap-[4px]">
                  {tab === "feeds" && <FeedGrid list={feeds} emptyTitle="올린 피드가 없어요" onOpen={onOpenFeed} />}
                  {tab === "posts" && <PostRows list={posts} emptyTitle="작성한 커뮤니티 글이 없어요" onOpen={onOpenPost} />}
                </div>
              </>
            )}
          </>
        )}

        {!error && !profile && <ProfileSkeleton />}
      </main>

      {photoOpen && profile?.profileImage && <ImageViewer src={profile.profileImage} alt="프로필 사진" onClose={() => setPhotoOpen(false)} />}

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
