import { useEffect, useState } from "react";
import { inquiryApi, myReportApi } from "@/api/aplan";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { TextField } from "@/aplan/components/TextField";
import { ScreenHeader, StatusBadge, formatDate } from "@/aplan/components/ScreenHeader";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import type { InquiryItem, ReportItem } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

const errMsg = (err: any, fallback: string) => err?.response?.data?.message || fallback;

// 건의사항: 새로 작성하고, 내가 보낸 건의의 처리 상태·관리자 답변을 확인한다(미처리 건은 취소 가능).
export function InquiryScreen({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    inquiryApi.mine().then(setItems).catch((err) => setError(errMsg(err, "불러오지 못했어요.")));
  };
  useEffect(load, []);

  const submit = () => {
    if (!title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    setFormError(null);
    inquiryApi.create({ title: title.trim(), content: content.trim() })
      .then(() => { setTitle(""); setContent(""); load(); })
      .catch((err) => setFormError(errMsg(err, "접수하지 못했어요.")))
      .finally(() => setSubmitting(false));
  };

  const cancel = (id: string) => inquiryApi.cancel(id).then(load).catch((err) => setError(errMsg(err, "취소하지 못했어요.")));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="건의사항" onBack={onBack} />
      <main className="flex min-h-0 w-full flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] pb-[24px]">
        <section className="flex w-full flex-col gap-[12px]">
          <TextField label="제목" placeholder="제목을 입력하세요" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="건의 내용을 입력하세요"
            aria-label="건의 내용"
            rows={5}
            maxLength={1000}
            className="a-text-field w-full resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[18px] outline-none"
            style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)", fontFamily: "var(--a-font-sans)" }}
          />
          {formError && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{formError}</p>}
          <PrimaryButton onClick={submit} disabled={!title.trim() || !content.trim()} loading={submitting}>접수하기</PrimaryButton>
        </section>

        <h2 className="m-0 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>내 건의 내역</h2>
        {error && <ErrorState message={error} onRetry={load} />}
        {!error && !items && <Skeleton className="h-[64px] w-full" />}
        {!error && items?.length === 0 && <EmptyState title="접수한 건의가 없어요" />}
        {!error && items?.map((it) => (
          <article key={it._id} className="flex w-full flex-col gap-[6px] border-0 border-b border-solid pb-[14px]" style={{ borderColor: "var(--a-color-border)" }}>
            <div className="flex items-center gap-[8px]">
              <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{it.title}</span>
              <StatusBadge done={it.status === "resolved"}>{it.status === "resolved" ? "처리 완료" : "처리 중"}</StatusBadge>
            </div>
            <p className="m-0 whitespace-pre-wrap text-[13px] leading-[18px]" style={{ color: "var(--a-color-text-primary)" }}>{it.content}</p>
            {it.adminResponse && (
              <p className="m-0 whitespace-pre-wrap px-[12px] py-[10px] text-[13px] leading-[18px]" style={{ background: "var(--a-color-surface-muted)", borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)" }}>
                관리자 답변: {it.adminResponse}
              </p>
            )}
            <div className="flex items-center gap-[8px]">
              <span className="min-w-px flex-1 text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{formatDate(it.createdAt)}</span>
              {it.status === "pending" && (
                <button type="button" onClick={() => cancel(it._id)} className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-bold" style={{ color: "var(--a-color-danger)" }}>취소</button>
              )}
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}

const TARGET_LABEL = { post: "게시글", comment: "댓글", user: "사용자" } as const;
const SANCTION_LABEL: Record<string, string> = { warning: "경고", ban: "차단", commentRestriction: "댓글 작성 제한", forceWithdraw: "강제 탈퇴" };

// 신고 내역: 내가 접수한 신고와 처리 결과
export function MyReportsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    myReportApi.mine().then(setItems).catch((err) => setError(errMsg(err, "불러오지 못했어요.")));
  };
  useEffect(load, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="신고 내역" onBack={onBack} />
      <main className="flex min-h-0 w-full flex-1 flex-col gap-[14px] overflow-y-auto px-[20px] pb-[24px]">
        {error && <ErrorState message={error} onRetry={load} />}
        {!error && !items && <Skeleton className="h-[56px] w-full" />}
        {!error && items?.length === 0 && <EmptyState title="접수한 신고가 없어요" />}
        {!error && items?.map((r) => (
          <article key={r._id} className="flex w-full flex-col gap-[6px] border-0 border-b border-solid pb-[14px]" style={{ borderColor: "var(--a-color-border)" }}>
            <div className="flex items-center gap-[8px]">
              <span className="min-w-px flex-1 truncate text-[15px] leading-[18px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{TARGET_LABEL[r.targetType]} 신고 · {r.reason}</span>
              <StatusBadge done={r.status === "resolved"}>{r.status === "resolved" ? "처리 완료" : "처리 중"}</StatusBadge>
            </div>
            {r.detail && <p className="m-0 whitespace-pre-wrap text-[13px] leading-[18px]" style={{ color: "var(--a-color-text-primary)" }}>{r.detail}</p>}
            <span className="text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>
              {formatDate(r.createdAt)}{r.sanctionApplied && r.sanctionType ? ` · ${SANCTION_LABEL[r.sanctionType]} 조치됨` : ""}
            </span>
          </article>
        ))}
      </main>
    </div>
  );
}
