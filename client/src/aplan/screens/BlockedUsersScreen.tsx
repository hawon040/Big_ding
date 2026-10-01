import { useEffect, useState } from "react";
import { meApi, userApi } from "@/api/aplan";
import { Avatar } from "@/aplan/components/Avatar";
import { ScreenHeader } from "@/aplan/components/ScreenHeader";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import type { BlockedUser } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

// 차단 내역: 내가 차단한 사용자 목록과 차단 해제
export function BlockedUsersScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    meApi.blocks().then((p) => setItems(p.items)).catch((err) => setError(err?.response?.data?.message || "불러오지 못했어요."));
  };
  useEffect(load, []);

  const unblock = (id: string) => {
    setBusyId(id);
    userApi.unblock(id)
      .then(() => setItems((prev) => prev?.filter((u) => u.id !== id) ?? null))
      .catch((err) => setError(err?.response?.data?.message || "차단을 해제하지 못했어요."))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="차단 내역" onBack={onBack} />
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-[20px] pb-[24px]">
        {error && <ErrorState message={error} onRetry={load} />}
        {!error && !items && <Skeleton className="h-[48px] w-full" />}
        {!error && items?.length === 0 && <EmptyState title="차단한 사용자가 없어요" />}
        {!error && items?.map((u) => (
          <div key={u.id} className="flex w-full items-center gap-[12px] py-[10px]">
            <Avatar src={u.profileImage} size={40} />
            <div className="flex min-w-px flex-1 flex-col gap-[2px]">
              <span className="truncate text-[15px] leading-[18px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>{u.nickname}</span>
              {u.department && <span className="truncate text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{u.department}</span>}
            </div>
            <button
              type="button"
              disabled={busyId === u.id}
              onClick={() => unblock(u.id)}
              className="shrink-0 border border-solid bg-transparent px-[14px] py-[8px] text-[13px] leading-[16px] font-bold disabled:opacity-40"
              style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)" }}
            >
              차단 해제
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
