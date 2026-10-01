import { useCallback, useEffect, useState, type ReactNode } from "react";
import { adminApi, inquiryApi, type SanctionInput } from "@/api/aplan";
import { BottomSheet } from "@/aplan/components/BottomSheet";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { TextField } from "@/aplan/components/TextField";
import { Toggle } from "@/aplan/components/Toggle";
import { ScreenHeader, StatusBadge, formatDate } from "@/aplan/components/ScreenHeader";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import type { AdminReportTarget, AdminUser, InquiryItem, ReportItem, SanctionItem, SanctionType } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

type Tab = "reports" | "inquiries" | "users" | "sanctions";
const TABS: { key: Tab; label: string }[] = [
  { key: "reports", label: "신고" },
  { key: "inquiries", label: "건의" },
  { key: "users", label: "회원" },
  { key: "sanctions", label: "제재" },
];

const SANCTION_LABEL: Record<SanctionType, string> = { warning: "경고", ban: "차단", commentRestriction: "댓글 제한", forceWithdraw: "강제 탈퇴" };
const TARGET_LABEL = { post: "게시글", comment: "댓글", user: "사용자" } as const;
const errMsg = (err: any, fallback: string) => err?.response?.data?.message || fallback;

// 관리자 화면: 신고 처리 · 건의 답변 · 회원 제재 · 제재 해제. 서버는 isAdmin이 아니면 403을 돌려준다.
export function AdminScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="관리자" onBack={onBack} />
      <div role="tablist" aria-label="관리 항목" className="flex w-full shrink-0 gap-[8px] px-[20px] pb-[8px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className="border-0 px-[14px] py-[8px] text-[13px] leading-[16px] font-bold"
            style={{
              borderRadius: "var(--a-radius-pill)",
              background: tab === t.key ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
              color: tab === t.key ? "var(--a-color-on-inverse)" : "var(--a-color-text-secondary)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <main className="flex min-h-0 w-full flex-1 flex-col gap-[14px] overflow-y-auto px-[20px] pb-[24px]">
        {tab === "reports" && <ReportsTab />}
        {tab === "inquiries" && <InquiriesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "sanctions" && <SanctionsTab />}
      </main>
    </div>
  );
}

// 목록 불러오기 공통: 로딩/오류/빈 상태를 한 곳에서 처리
function useList<T>(fetcher: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    fetcher().then(setItems).catch((err) => setError(errMsg(err, "불러오지 못했어요.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);
  return { items, error, load, setError };
}

function ListState({ items, error, load, empty }: { items: unknown[] | null; error: string | null; load: () => void; empty: string }) {
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Skeleton className="h-[64px] w-full" />;
  if (items.length === 0) return <EmptyState title={empty} />;
  return null;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <article className="flex w-full flex-col gap-[8px] border-0 border-b border-solid pb-[14px]" style={{ borderColor: "var(--a-color-border)" }}>
      {children}
    </article>
  );
}

function SmallButton({ children, onClick, danger = false, disabled = false }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border border-solid bg-transparent px-[12px] py-[7px] text-[12px] leading-[14px] font-bold disabled:opacity-40"
      style={{ borderColor: danger ? "var(--a-color-danger)" : "var(--a-color-border)", borderRadius: "var(--a-radius-control)", color: danger ? "var(--a-color-danger)" : "var(--a-color-text-primary)" }}
    >
      {children}
    </button>
  );
}

const muted = { color: "var(--a-color-text-secondary)" } as const;
const primary = { color: "var(--a-color-text-primary)" } as const;

// ── 신고 ──
function ReportsTab() {
  const { items, error, load, setError } = useList<ReportItem>(adminApi.reports);
  const [targets, setTargets] = useState<Record<string, AdminReportTarget | string>>({});
  const [sanctionFor, setSanctionFor] = useState<{ userId: string; nickname: string; reportId: string } | null>(null);

  const viewTarget = (id: string) =>
    adminApi.reportTarget(id).then((t) => setTargets((p) => ({ ...p, [id]: t }))).catch((err) => setTargets((p) => ({ ...p, [id]: errMsg(err, "대상을 불러오지 못했어요.") })));

  const openSanction = async (r: ReportItem) => {
    try {
      const t = await adminApi.reportTarget(r._id);
      const target = t.targetType === "user" ? t.user : t.post?.author;
      if (!target) return setError("제재할 대상을 찾을 수 없어요.");
      setSanctionFor({ userId: target._id, nickname: target.nickname, reportId: r._id });
    } catch (err) {
      setError(errMsg(err, "대상을 불러오지 못했어요."));
    }
  };

  const resolve = (id: string) => adminApi.resolveReport(id).then(load).catch((err) => setError(errMsg(err, "처리하지 못했어요.")));

  return (
    <>
      <ListState items={items} error={error} load={load} empty="접수된 신고가 없어요" />
      {!error && items?.map((r) => {
        const t = targets[r._id];
        return (
          <Card key={r._id}>
            <div className="flex items-center gap-[8px]">
              <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={primary}>{TARGET_LABEL[r.targetType]} 신고 · {r.reason}</span>
              <StatusBadge done={r.status === "resolved"}>{r.status === "resolved" ? "처리 완료" : "대기"}</StatusBadge>
            </div>
            {r.detail && <p className="m-0 whitespace-pre-wrap text-[13px] leading-[18px]" style={primary}>{r.detail}</p>}
            <span className="text-[12px] leading-[14px]" style={muted}>
              {r.reporter?.nickname ?? "알 수 없음"}({r.reporter?.studentId}) · {formatDate(r.createdAt)}
              {r.sanctionType ? ` · ${SANCTION_LABEL[r.sanctionType]} 조치됨` : ""}
            </span>
            {typeof t === "string" && <p role="alert" className="m-0 text-[12px]" style={{ color: "var(--a-color-danger)" }}>{t}</p>}
            {t && typeof t !== "string" && (
              <div className="px-[12px] py-[10px] text-[13px] leading-[18px]" style={{ background: "var(--a-color-surface-muted)", borderRadius: "var(--a-radius-control)", ...primary }}>
                {t.targetType === "user"
                  ? <>사용자: {t.user?.nickname} ({t.user?.studentId})</>
                  : <>
                      <strong>{t.post?.title}</strong> — {t.post?.author?.nickname}
                      <p className="m-0 mt-[4px] line-clamp-4 whitespace-pre-wrap" style={muted}>{t.post?.content}</p>
                    </>}
              </div>
            )}
            <div className="flex flex-wrap gap-[8px]">
              <SmallButton onClick={() => viewTarget(r._id)}>대상 보기</SmallButton>
              {r.status === "pending" && <SmallButton danger onClick={() => openSanction(r)}>제재</SmallButton>}
              {r.status === "pending" && <SmallButton onClick={() => resolve(r._id)}>제재 없이 완료</SmallButton>}
            </div>
          </Card>
        );
      })}
      <SanctionSheet
        target={sanctionFor}
        onClose={() => setSanctionFor(null)}
        onDone={() => { setSanctionFor(null); load(); }}
      />
    </>
  );
}

// ── 건의 ──
function InquiriesTab() {
  const { items, error, load, setError } = useList<InquiryItem>(inquiryApi.all);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const resolve = (id: string) =>
    inquiryApi.resolve(id, answers[id]).then(load).catch((err) => setError(errMsg(err, "처리하지 못했어요.")));

  return (
    <>
      <ListState items={items} error={error} load={load} empty="접수된 건의가 없어요" />
      {!error && items?.map((it) => (
        <Card key={it._id}>
          <div className="flex items-center gap-[8px]">
            <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={primary}>{it.title}</span>
            <StatusBadge done={it.status === "resolved"}>{it.status === "resolved" ? "처리 완료" : "대기"}</StatusBadge>
          </div>
          <p className="m-0 whitespace-pre-wrap text-[13px] leading-[18px]" style={primary}>{it.content}</p>
          <span className="text-[12px] leading-[14px]" style={muted}>{it.user?.nickname ?? "알 수 없음"}({it.user?.studentId}) · {formatDate(it.createdAt)}</span>
          {it.adminResponse && <p className="m-0 text-[13px] leading-[18px]" style={muted}>답변: {it.adminResponse}</p>}
          {it.status === "pending" && (
            <div className="flex items-start gap-[8px]">
              <TextField label="답변" placeholder="답변 (선택, 작성자에게 알림으로 전달돼요)" value={answers[it._id] ?? ""} onChange={(e) => setAnswers((p) => ({ ...p, [it._id]: e.target.value }))} className="min-w-px flex-1" />
              <button type="button" onClick={() => resolve(it._id)} className="shrink-0 border-0 px-[14px] py-[13px] text-[13px] leading-[17px] font-bold" style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}>완료</button>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

// ── 회원 ──
function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sanctionFor, setSanctionFor] = useState<{ userId: string; nickname: string } | null>(null);

  const search = useCallback((query: string) => {
    setError(null);
    adminApi.users(query.trim()).then((r) => setUsers(r.users)).catch((err) => setError(errMsg(err, "불러오지 못했어요.")));
  }, []);
  useEffect(() => search(""), [search]);

  const toggleEvent = (u: AdminUser, v: boolean) => {
    setUsers((prev) => prev?.map((x) => (x._id === u._id ? { ...x, canPostEvents: v } : x)) ?? null);
    adminApi.setEventAdmin(u._id, v).catch((err) => { setError(errMsg(err, "변경하지 못했어요.")); search(q); });
  };

  const status = (u: AdminUser) => {
    if (u.isWithdrawn) return "탈퇴";
    if (u.banned) return u.banType === "temporary" && u.banUntil ? `차단(~${formatDate(u.banUntil)})` : "영구 차단";
    if (u.commentRestrictedUntil && new Date(u.commentRestrictedUntil) > new Date()) return `댓글 제한(~${formatDate(u.commentRestrictedUntil)})`;
    return "정상";
  };

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex w-full items-start gap-[8px]">
        <TextField label="회원 검색" placeholder="학번 또는 닉네임" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-px flex-1" />
        <button type="submit" className="shrink-0 border-0 px-[16px] py-[13px] text-[14px] leading-[17px] font-bold" style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}>검색</button>
      </form>
      <ListState items={users} error={error} load={() => search(q)} empty="회원이 없어요" />
      {!error && users?.map((u) => (
        <Card key={u._id}>
          <div className="flex items-center gap-[8px]">
            <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={primary}>{u.nickname} <span className="font-normal" style={muted}>{u.studentId}</span></span>
            <StatusBadge done={status(u) === "정상"}>{status(u)}</StatusBadge>
          </div>
          <span className="text-[12px] leading-[14px]" style={muted}>경고 {u.warningCount}회 · 차단 {u.banCount}회{u.isAdmin ? " · 관리자" : ""}</span>
          {!u.isWithdrawn && !u.isAdmin && (
            <div className="flex items-center gap-[10px]">
              <SmallButton danger onClick={() => setSanctionFor({ userId: u._id, nickname: u.nickname })}>제재</SmallButton>
              <span className="min-w-px flex-1 text-right text-[12px] leading-[14px]" style={muted}>행사공지 작성</span>
              <Toggle label={`${u.nickname} 행사공지 작성 권한`} checked={u.canPostEvents} onChange={(v) => toggleEvent(u, v)} />
            </div>
          )}
        </Card>
      ))}
      <SanctionSheet target={sanctionFor ? { ...sanctionFor, reportId: undefined } : null} onClose={() => setSanctionFor(null)} onDone={() => { setSanctionFor(null); search(q); }} />
    </>
  );
}

// ── 제재 내역 ──
function SanctionsTab() {
  const { items, error, load, setError } = useList<SanctionItem>(adminApi.sanctions);
  const lift = (id: string) => adminApi.liftSanction(id).then(load).catch((err) => setError(errMsg(err, "해제하지 못했어요.")));

  return (
    <>
      <ListState items={items} error={error} load={load} empty="제재 내역이 없어요" />
      {!error && items?.map((s) => (
        <Card key={s._id}>
          <div className="flex items-center gap-[8px]">
            <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={primary}>{s.user?.nickname ?? "알 수 없음"} · {SANCTION_LABEL[s.type]}</span>
            <StatusBadge done={!s.active}>{s.active ? "적용 중" : "해제됨"}</StatusBadge>
          </div>
          <p className="m-0 text-[13px] leading-[18px]" style={primary}>{s.reason}</p>
          <div className="flex items-center gap-[8px]">
            <span className="min-w-px flex-1 text-[12px] leading-[14px]" style={muted}>{formatDate(s.createdAt)}{s.expiresAt ? ` → ${formatDate(s.expiresAt)}` : ""} · {s.admin?.nickname ?? "관리자"}</span>
            {s.active && s.type !== "forceWithdraw" && <SmallButton onClick={() => lift(s._id)}>해제</SmallButton>}
          </div>
        </Card>
      ))}
    </>
  );
}

// ── 제재 시트 (신고·회원 탭 공용) ──
function SanctionSheet({ target, onClose, onDone }: {
  target: { userId: string; nickname: string; reportId?: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<SanctionType>("warning");
  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary");
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setError(null); setReason(""); }, [target?.userId]);

  const needsDays = type === "commentRestriction" || (type === "ban" && banType === "temporary");

  const submit = () => {
    if (!target || !reason.trim() || submitting) return;
    if (type === "forceWithdraw" && !window.confirm(`${target.nickname}님을 강제 탈퇴시킬까요? 되돌릴 수 없어요.`)) return;
    const input: SanctionInput =
      type === "ban" ? { type, reason: reason.trim(), banType, days: banType === "temporary" ? days : undefined }
      : type === "commentRestriction" ? { type, reason: reason.trim(), days }
      : { type, reason: reason.trim() };
    setSubmitting(true);
    setError(null);
    adminApi.sanction(target.userId, input, target.reportId)
      .then(onDone)
      .catch((err) => setError(errMsg(err, "제재하지 못했어요.")))
      .finally(() => setSubmitting(false));
  };

  const chip = (selected: boolean) => ({
    borderRadius: "var(--a-radius-pill)",
    background: selected ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
    color: selected ? "var(--a-color-on-inverse)" : "var(--a-color-text-secondary)",
  });

  return (
    <BottomSheet open={!!target} title={target ? `${target.nickname} 제재` : "제재"} onClose={onClose}>
      <div className="flex flex-col gap-[12px]">
        <div className="flex flex-wrap gap-[8px]">
          {(Object.keys(SANCTION_LABEL) as SanctionType[]).map((k) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} className="border-0 px-[14px] py-[8px] text-[13px] leading-[16px] font-bold" style={chip(type === k)}>{SANCTION_LABEL[k]}</button>
          ))}
        </div>
        {type === "ban" && (
          <div className="flex gap-[8px]">
            {(["temporary", "permanent"] as const).map((b) => (
              <button key={b} type="button" aria-pressed={banType === b} onClick={() => setBanType(b)} className="border-0 px-[12px] py-[6px] text-[12px] leading-[14px] font-bold" style={chip(banType === b)}>{b === "temporary" ? "기간제" : "영구"}</button>
            ))}
          </div>
        )}
        {needsDays && (
          <label className="flex items-center gap-[10px] text-[13px]" style={primary}>
            기간
            <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Math.floor(Number(e.target.value)) || 1)))} aria-label="제재 기간(일)" className="w-[72px] border border-solid px-[10px] py-[8px] text-center text-[14px] outline-none" style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)" }} />
            일
          </label>
        )}
        <TextField label="제재 사유" placeholder="사유 (대상자에게 알림으로 전달돼요)" value={reason} maxLength={200} error={error} onChange={(e) => setReason(e.target.value)} />
        <PrimaryButton onClick={submit} disabled={!reason.trim()} loading={submitting}>{SANCTION_LABEL[type]} 적용</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
