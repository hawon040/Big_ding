import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { meApi, userApi } from "@/api/aplan";
import { Avatar } from "@/aplan/components/Avatar";
import { ImageViewer } from "@/aplan/components/ImageViewer";
import { IconButton } from "@/aplan/components/IconButton";
import { FeedGrid, PostRows, ProfileStats, UnderlineTabs, type ProfileTab } from "@/aplan/components/ProfileParts";
import { ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import { useProfileCountsLive } from "@/aplan/hooks/useProfileCountsLive";
import { TOPIC_MAP, type TopicKey } from "@/constants/topics";
import type { Me } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface MyScreenProps {
  onOpenPost: (id: string) => void;
  onOpenFeed: (id: string) => void;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onOpenFollows: (userId: string, tab: "followers" | "following") => void;
  /** 관심 기술 다시 고르기 (A-03 온보딩을 edit 모드로 재사용). 지금 선택된 관심 분야를 함께 넘긴다 */
  onEditInterests: (current: TopicKey[]) => void;
}

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "feeds", label: "내 피드글" },
  { key: "posts", label: "내 커뮤니티 글" },
];

// A-07 마이페이지 (Figma 2:400).
// 프로필 요약 + 숫자(피드글·게시글·팔로워·팔로잉, 실시간) + 관심 기술 + 내 피드글·내 커뮤니티 글 탭.
export function MyScreen({ onOpenPost, onOpenFeed, onEditProfile, onOpenSettings, onOpenFollows, onEditInterests }: MyScreenProps) {
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>("feeds");
  const [photoOpen, setPhotoOpen] = useState(false);

  const loadMe = () => {
    setMeError(null);
    setMe(null);
    meApi.get().then(setMe).catch((err) => setMeError(err?.response?.data?.message || null));
  };
  useEffect(loadMe, []);

  const empty = { items: [], nextCursor: null };
  const feeds = useInfiniteList(
    (cursor) => (tab === "feeds" && me ? userApi.feeds(me.id, cursor) : Promise.resolve(empty)),
    [tab, me?.id],
  );
  const posts = useInfiniteList(
    (cursor) => (tab === "posts" && me ? userApi.posts(me.id, cursor) : Promise.resolve(empty)),
    [tab, me?.id],
  );

  // 누가 나를 팔로우/언팔로우하거나 다른 기기에서 글을 올리면 숫자만 조용히 새로 고친다 (스켈레톤 없이)
  const refreshCounts = useCallback(() => {
    meApi.get().then((next) => setMe((prev) => (prev ? { ...prev, counts: next.counts } : next))).catch(() => {});
  }, []);
  useProfileCountsLive(refreshCounts);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          마이페이지
        </h1>
        <IconButton icon={Settings} label="설정" onClick={onOpenSettings} />
      </header>

      {/* Figma 2:407 Body: 좌우 20·상하 12, 간격 16 */}
      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[12px] pb-[24px]">
        {meError && <ErrorState message={meError} onRetry={loadMe} />}

        {!meError && (
          <>
            {/* 프로필 요약 */}
            <section className="flex w-full items-center gap-[16px]">
              {me ? (
                <button
                  type="button"
                  onClick={() => me.profileImage && setPhotoOpen(true)}
                  disabled={!me.profileImage}
                  aria-label="프로필 사진 크게 보기"
                  className="shrink-0 border-0 bg-transparent p-0 disabled:cursor-default"
                >
                  <Avatar src={me.profileImage} size={80} />
                </button>
              ) : (
                <Skeleton className="size-[80px]" style={{ borderRadius: "50%" }} />
              )}
              <div className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
                {me ? (
                  <>
                    <span className="text-[20px] leading-[24px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{me.nickname}</span>
                    <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                      {[me.department, me.grade ? `${me.grade}학년` : null].filter(Boolean).join(" · ") || "학과 정보 없음"}
                    </span>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-[24px] w-[100px]" />
                    <Skeleton className="h-[12px] w-[140px]" />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onEditProfile}
                disabled={!me}
                // Figma 2:340 Chip: #F2F2F2 채움, 테두리 없음, 좌우 12·상하 6, 12px Medium #666
                className="shrink-0 border-0 px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] disabled:opacity-50"
                style={{ background: "var(--a-color-surface-muted)", borderRadius: "var(--a-radius-pill)", color: "var(--a-color-icon)" }}
              >
                프로필 수정
              </button>
            </section>

            {me?.bio && (
              <p className="m-0 -mt-[8px] w-full text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{me.bio}</p>
            )}

            {/* 숫자 (Figma 2:400 활동 통계) — 팔로워·팔로잉은 눌러서 목록으로 */}
            <ProfileStats
              stats={[
                { label: "피드글", value: me?.counts.feeds },
                { label: "게시글", value: me?.counts.posts },
                { label: "팔로워", value: me?.counts.followers, onClick: me ? () => onOpenFollows(me.id, "followers") : undefined },
                { label: "팔로잉", value: me?.counts.following, onClick: me ? () => onOpenFollows(me.id, "following") : undefined },
              ]}
            />

            {/* 관심 기술 (Figma 2:356 제목 17px + 2:365 칩). 커뮤니티 추천·스터디 모집 알림에 쓰인다 */}
            <div className="flex w-full items-center gap-[8px]">
              <h2 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>관심 기술</h2>
              <button
                type="button"
                onClick={() => onEditInterests(me?.interests ?? [])}
                disabled={!me}
                className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal disabled:opacity-50"
                style={{ color: "var(--a-color-text-secondary)" }}
              >
                수정
              </button>
            </div>
            <div className="flex w-full flex-wrap content-center items-center gap-[8px]">
              {!me && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[26px] w-[64px]" style={{ borderRadius: "var(--a-radius-pill)" }} />)}
              {me && me.interests.length === 0 && (
                <span className="text-[12px] leading-[14px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>아직 선택한 관심 기술이 없어요</span>
              )}
              {me?.interests.map((k) => (
                <span
                  key={k}
                  className="px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                  style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
                >
                  {TOPIC_MAP[k]?.label ?? k}
                </span>
              ))}
            </div>

            <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} label="내 활동" />

            <div className="flex w-full flex-1 flex-col items-start gap-[4px]">
              {tab === "feeds" && <FeedGrid list={feeds} emptyTitle="올린 피드가 없어요" onOpen={onOpenFeed} />}
              {tab === "posts" && <PostRows list={posts} emptyTitle="작성한 커뮤니티 글이 없어요" onOpen={onOpenPost} />}
            </div>
          </>
        )}
      </main>

      {photoOpen && me?.profileImage && <ImageViewer src={me.profileImage} alt="프로필 사진" onClose={() => setPhotoOpen(false)} />}
    </div>
  );
}
