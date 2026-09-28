import { Avatar } from "@/aplan/components/Avatar";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useInfiniteList } from "@/aplan/hooks/useInfiniteList";
import { notificationApi } from "@/api/aplan";
import { formatTime } from "@/utils";
import type { NotificationItem, NotificationType } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface NotificationScreenProps {
  onOpenPost: (id: string) => void;
  onOpenUser: (id: string) => void;
}

const ADMIN_TYPES: NotificationType[] = ["adminWarning", "adminBan", "adminCommentRestriction", "reportResolved", "inquiryResolved"];

// 알림 (Figma에 없는 신규 화면 — Figma의 A-08은 설정 화면이다. A안 톤으로 새로 구성).
// 유형별 문구는 기존 앱(app/components/CommunityScreen.tsx 알림 패널)의 표현을 A안 말투("~해요")로 옮겼다.
export function NotificationScreen({ onOpenPost, onOpenUser }: NotificationScreenProps) {
  const list = useInfiniteList((cursor) => notificationApi.list(cursor), []);

  const markAllRead = () => {
    list.setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationApi.readAll().catch(() => {});
  };

  const openNotification = (n: NotificationItem) => {
    if (!n.isRead) {
      list.setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
      notificationApi.read(n.id).catch(() => {});
    }
    if (n.type === "follow" && n.actor) onOpenUser(n.actor.id);
    else if (n.post) onOpenPost(n.post.id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          알림
        </h1>
        <button
          type="button"
          onClick={markAllRead}
          className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal"
          style={{ color: "var(--a-color-text-secondary)" }}
        >
          모두 읽음
        </button>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {list.status === "loading" && <ListSkeleton />}
        {list.status === "error" && <ErrorState message={list.error ?? undefined} onRetry={list.reload} />}
        {list.status === "ready" && list.items.length === 0 && <EmptyState title="아직 알림이 없어요" />}
        {list.status === "ready" && list.items.map((n) => <NotificationRow key={n.id} n={n} onOpen={() => openNotification(n)} />)}
        {list.loadingMore && <ListSkeleton count={1} />}
        {list.hasMore && <div ref={list.sentinelRef} className="h-px w-full shrink-0" aria-hidden />}
      </main>
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: NotificationItem; onOpen: () => void }) {
  const isAdmin = ADMIN_TYPES.includes(n.type);
  const name = isAdmin ? "관리자" : n.actor?.nickname ?? "알 수 없음";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-[10px] border-0 px-[8px] py-[10px] text-left"
      style={{ borderRadius: "var(--a-radius-card)", background: n.isRead ? "transparent" : "var(--a-color-surface-muted)" }}
    >
      <Avatar src={isAdmin ? null : n.actor?.profileImage} size={40} />
      <span className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
        <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>
          <strong className="font-bold">{name}</strong>
          {notifTail(n)}
        </span>
        <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
          {formatTime(n.createdAt)}
        </span>
      </span>
      {!n.isRead && <span className="mt-[6px] size-[6px] shrink-0 rounded-full" style={{ background: "var(--a-color-danger)" }} aria-hidden />}
    </button>
  );
}

function notifTail(n: NotificationItem): string {
  const preview = n.commentContent ? (n.commentContent.length > 20 ? `${n.commentContent.slice(0, 20)}…` : n.commentContent) : null;
  switch (n.type) {
    case "follow":
      return "님이 회원님을 팔로우하기 시작했어요.";
    case "join":
      return "님이 회원님의 모임에 참여했어요.";
    case "leave":
      return "님이 회원님의 모임 참여를 취소했어요.";
    case "comment":
      return preview ? `님이 "${preview}"라는 댓글을 남겼어요.` : "님이 글에 댓글을 남겼어요.";
    case "reply":
      return preview ? `님이 댓글에 "${preview}"라는 답글을 남겼어요.` : "님이 댓글에 답글을 남겼어요.";
    case "like":
      return n.actorCount > 1 ? `님 외 ${n.actorCount - 1}명이 좋아요를 눌렀어요.` : "님이 좋아요를 눌렀어요.";
    case "dislike":
      return "님이 싫어요를 눌렀어요.";
    case "scrap":
      return "님이 글을 스크랩했어요.";
    case "accepted":
      return "님이 회원님의 댓글을 채택했어요.";
    case "study_recruit":
      return "님이 관심 분야에 맞는 모집글을 올렸어요.";
    case "adminWarning":
      return `에게 경고를 받았어요.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`;
    case "adminBan":
      return `에게 계정이 ${n.until ? `${new Date(n.until).toLocaleDateString("ko-KR")}까지` : "영구"} 정지되었어요.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`;
    case "adminCommentRestriction":
      return `에게 ${n.until ? new Date(n.until).toLocaleDateString("ko-KR") : ""}까지 댓글 작성이 제한되었어요.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`;
    case "reportResolved":
      return `가 신고 처리 결과를 보내왔어요: ${n.message ?? "-"}`;
    case "inquiryResolved":
      return `가 건의사항에 답변했어요: ${n.message ?? "-"}`;
    default:
      return "님과 관련된 새 알림이 있어요.";
  }
}

function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[4px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-[10px] px-[8px] py-[10px]">
          <Skeleton className="size-[40px]" style={{ borderRadius: "50%" }} />
          <div className="flex flex-1 flex-col gap-[4px]">
            <Skeleton className="h-[13px] w-full" />
            <Skeleton className="h-[11px] w-[60px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
