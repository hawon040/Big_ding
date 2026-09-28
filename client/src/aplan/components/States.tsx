// 목록 화면 공통 상태: 로딩 스켈레톤 / 빈 상태 / 에러 상태 (Figma에 없어 A안 톤으로 구성)

// 회색 블록. 로딩 중에는 은은하게 깜빡인다.
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse ${className}`}
      style={{ background: "var(--a-color-surface-muted)", borderRadius: 4, ...style }}
    />
  );
}

// PostCard(2:157, 이미지 없는 카드)와 같은 크기·구조의 스켈레톤
export function PostCardSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-[10px] border border-solid p-[16px]"
      style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)" }}
    >
      <div className="flex items-center gap-[10px]">
        <Skeleton className="size-[32px]" style={{ borderRadius: "50%" }} />
        <div className="flex flex-col gap-[4px]">
          <Skeleton className="h-[12px] w-[90px]" />
          <Skeleton className="h-[11px] w-[70px]" />
        </div>
      </div>
      <Skeleton className="h-[18px] w-[80%]" />
      <Skeleton className="h-[8px] w-full" />
      <Skeleton className="h-[8px] w-[200px]" />
      <Skeleton className="h-[16px] w-[90px]" />
    </div>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-[16px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => <PostCardSkeleton key={i} />)}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-[8px] py-[48px] text-center">
      <p className="m-0 text-[15px] leading-[18px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{title}</p>
      {description && (
        <p className="m-0 text-[13px] leading-[16px]" style={{ color: "var(--a-color-text-secondary)" }}>{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-[8px] border border-solid bg-transparent px-[14px] py-[8px] text-[13px] leading-[16px] font-[500]"
          style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-pill)", color: "var(--a-color-text-primary)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        title="불러오지 못했어요"
        description={message || "잠시 후 다시 시도해주세요."}
        action={{ label: "다시 시도", onClick: onRetry }}
      />
    </div>
  );
}
