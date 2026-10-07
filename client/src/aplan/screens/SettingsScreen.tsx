import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { meApi, tagAlertApi } from "@/api/aplan";
import { Toggle } from "@/aplan/components/Toggle";
import { TextField } from "@/aplan/components/TextField";
import { BottomSheet } from "@/aplan/components/BottomSheet";
import { alertDialog } from "@/aplan/components/Dialog";
import { ErrorState, Skeleton } from "@/aplan/components/States";
import { BlockedUsersScreen } from "@/aplan/screens/BlockedUsersScreen";
import { InquiryScreen, MyReportsScreen } from "@/aplan/screens/InquiryScreen";
import { AdminScreen } from "@/aplan/screens/AdminScreen";
import { EditProfileScreen } from "@/aplan/screens/EditProfileScreen";
import { applyTheme } from "@/aplan/theme";
import type { Me } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface SettingsScreenProps {
  onBack: () => void;
  /** 아직 없는 화면들 — 만들어지면 연결 */
  onEditProfile?: () => void;
  onChangePassword?: () => void;
  onOpenAnnouncements?: () => void;
}

// A-08 설정 (Figma 2:465).
export function SettingsScreen({ onBack, onOpenAnnouncements }: SettingsScreenProps) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  // 설정 위에 쌓이는 하위 화면
  const [sub, setSub] = useState<"blocked" | "inquiry" | "reports" | "admin" | "profile" | null>(null);

  const load = () => {
    setError(null);
    meApi.get().then((m) => { setMe(m); applyTheme(m.appSettings.darkMode); }).catch((err) => setError(err?.response?.data?.message || "불러오지 못했어요."));
  };
  useEffect(load, []);

  const patchSettings = (patch: Parameters<typeof meApi.updateSettings>[0]) => {
    if (!me) return;
    // 낙관적 업데이트 후 서버 값으로 맞춘다
    setMe({
      ...me,
      notificationSettings: { ...me.notificationSettings, ...patch.notificationSettings },
      appSettings: { ...me.appSettings, ...patch.appSettings },
    });
    meApi.updateSettings(patch).then(setMe).catch(load);
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };

  if (sub) {
    const close = () => setSub(null);
    return sub === "profile" ? <EditProfileScreen onBack={close} onDone={(m) => { setMe(m); close(); }} />
      : sub === "blocked" ? <BlockedUsersScreen onBack={close} />
      : sub === "inquiry" ? <InquiryScreen onBack={close} />
      : sub === "reports" ? <MyReportsScreen onBack={close} />
      : <AdminScreen onBack={close} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[18px] leading-[22px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>설정</h1>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {error && <ErrorState message={error} onRetry={load} />}

        {!error && (
          <>
            <SectionTitle>계정</SectionTitle>
            <LinkRow label="프로필 정보" onClick={() => setSub("profile")} />
            <StaticRow label="학교 인증" value="인증 완료" />
            <LinkRow label="비밀번호 변경" onClick={() => setPwOpen(true)} />

            <Divider />

            <SectionTitle>알림</SectionTitle>
            {!me ? (
              <ToggleSkeletonRows count={2} />
            ) : (
              <>
                <ToggleRow
                  label="댓글·답글 알림"
                  checked={me.notificationSettings.comment}
                  onChange={(v) => patchSettings({ notificationSettings: { comment: v } })}
                />
                <ToggleRow
                  label="스터디 모집 알림"
                  checked={me.notificationSettings.studyRecruit}
                  onChange={(v) => patchSettings({ notificationSettings: { studyRecruit: v } })}
                />
                
              </>
            )}

            <TagAlertSection />

            <Divider />

            <SectionTitle>앱 설정</SectionTitle>
            {!me ? (
              <ToggleSkeletonRows count={1} />
            ) : (
              <ToggleRow
                label="다크 모드"
                checked={me.appSettings.darkMode}
                onChange={(v) => { applyTheme(v); patchSettings({ appSettings: { darkMode: v } }); }}
              />
            )}
            <StaticRow label="언어" value="한국어" />

            <Divider />

            <SectionTitle>안전·지원</SectionTitle>
            <LinkRow label="차단 내역" onClick={() => setSub("blocked")} />
            <LinkRow label="신고 내역" onClick={() => setSub("reports")} />
            <LinkRow label="건의사항" onClick={() => setSub("inquiry")} />
            {me?.isAdmin && <LinkRow label="관리자" onClick={() => setSub("admin")} />}

            <Divider />

            <LinkRow label="공지사항" onClick={onOpenAnnouncements} />
            <button type="button" onClick={logout} className="flex w-full appearance-none items-center border-0 bg-transparent py-[12px] px-0 text-left">
              <span className="text-[15px] leading-[18px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>로그아웃</span>
            </button>
            <button type="button" onClick={() => setWithdrawOpen(true)} className="flex w-full appearance-none items-center border-0 bg-transparent py-[4px] px-0 text-left">
              <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>회원 탈퇴</span>
            </button>
          </>
        )}
      </main>

      <WithdrawSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

// 피드 #태그 알림: 구독한 태그가 달린 새 피드가 올라오면 알림을 받는다 (홈에서 태그를 눌러 켜고 끌 수도 있다)
function TagAlertSection() {
  const [tags, setTags] = useState<string[] | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tagAlertApi.list().then(setTags).catch(() => setTags([]));
  }, []);

  const add = () => {
    const tag = input.trim().replace(/^#+/, "");
    if (!tag) return;
    setError(null);
    tagAlertApi.add(tag).then((items) => { setTags(items); setInput(""); }).catch((err) => setError(err?.response?.data?.message || "추가하지 못했어요."));
  };
  const remove = (tag: string) => tagAlertApi.remove(tag).then(setTags).catch(() => {});

  return (
    <div className="flex w-full flex-col gap-[8px] pt-[8px]">
      <span className="text-[15px] leading-[18px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>태그 알림</span>
      <span className="text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>이 #태그가 달린 새 피드가 올라오면 알려줘요.</span>
      {tags && tags.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
          {tags.map((t) => (
            <li key={t} className="flex items-center gap-[4px] py-[6px] pr-[8px] pl-[12px] text-[13px] leading-[16px] font-[500]" style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-text-primary)" }}>
              #{t}
              <button type="button" aria-label={`#${t} 알림 끄기`} onClick={() => remove(t)} className="flex border-0 bg-transparent p-0">
                <X size={14} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex w-full items-start gap-[8px]">
        <TextField label="추가할 태그" placeholder="#태그 추가" value={input} maxLength={31} error={error} onChange={(e) => setInput(e.target.value)} className="min-w-px flex-1" />
        <button type="submit" disabled={!input.trim()} className="shrink-0 border-0 px-[16px] py-[13px] text-[14px] leading-[17px] font-bold disabled:opacity-40" style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}>추가</button>
      </form>
    </div>
  );
}
function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setCurrent(""); setNext(""); setConfirm("");
    setCurrentError(null); setNextError(null);
    onClose();
  };

  const submit = () => {
    if (submitting) return;
    setCurrentError(null);
    setNextError(null);
    if (next.length < 8) return setNextError("새 비밀번호는 8자 이상이어야 해요.");
    if (next !== confirm) return setNextError("새 비밀번호가 일치하지 않아요.");

    setSubmitting(true);
    meApi.changePassword(current, next)
      .then(() => alertDialog("비밀번호 변경", "비밀번호가 변경되었어요.").then(close))
      .catch((err) => {
        const msg = err?.response?.data?.message || "변경하지 못했어요.";
        if (err?.response?.status === 401 || msg.includes("현재")) setCurrentError(msg);
        else setNextError(msg);
      })
      .finally(() => setSubmitting(false));
  };

  const disabled = !current || !next || !confirm || submitting;

  return (
    <BottomSheet open={open} title="비밀번호 변경" onClose={close}>
      <TextField label="현재 비밀번호" type="password" placeholder="현재 비밀번호" value={current} onChange={(e) => setCurrent(e.target.value)} error={currentError} />
      <div className="h-[12px]" aria-hidden />
      <TextField label="새 비밀번호" type="password" placeholder="새 비밀번호 (8자 이상)" value={next} onChange={(e) => setNext(e.target.value)} />
      <div className="h-[12px]" aria-hidden />
      <TextField label="새 비밀번호 확인" type="password" placeholder="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={nextError} />
      <div className="h-[12px]" aria-hidden />
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        aria-busy={submitting}
        className="flex w-full items-center justify-center border-0 px-[16px] py-[15px] text-[15px] leading-[18px] font-bold disabled:cursor-not-allowed"
        style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)", opacity: disabled ? 0.5 : 1 }}
      >
        {submitting ? "처리 중..." : "변경하기"}
      </button>
    </BottomSheet>
  );
}
function WithdrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    meApi.withdraw(password)
      .then(() => {
        localStorage.removeItem("token");
        window.location.reload();
      })
      .catch((err) => setError(err?.response?.data?.message || "탈퇴하지 못했어요."))
      .finally(() => setSubmitting(false));
  };

  return (
    <BottomSheet open={open} title="회원 탈퇴" onClose={onClose}>
      <p className="m-0 mb-[12px] text-[13px] leading-[16px]" style={{ color: "var(--a-color-text-secondary)" }}>
        탈퇴하면 되돌릴 수 없어요. 본인 확인을 위해 비밀번호를 입력해주세요.
      </p>
      <TextField
        label="비밀번호"
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <div className="h-[12px]" aria-hidden />
      <button
        type="button"
        onClick={submit}
        disabled={!password || submitting}
        aria-busy={submitting}
        className="flex w-full items-center justify-center gap-[6px] border-0 px-[16px] py-[15px] text-[15px] leading-[18px] font-bold disabled:cursor-not-allowed"
        style={{ borderRadius: "var(--a-radius-control)", background: "var(--a-color-danger)", color: "#fff", opacity: !password || submitting ? 0.5 : 1 }}
      >
        {submitting ? "처리 중..." : "탈퇴하기"}
      </button>
    </BottomSheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 w-full pt-[16px] pb-[4px] text-[12px] leading-[14px] font-bold" style={{ color: "var(--a-color-text-secondary)" }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-[4px] h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />;
}

function LinkRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full appearance-none items-center gap-[12px] border-0 bg-transparent py-[12px] px-0 text-left disabled:cursor-default"
    >
      <span className="min-w-px flex-1 text-[15px] leading-[18px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>{label}</span>
      <ChevronRight size={20} strokeWidth={1.5} style={{ color: "var(--a-color-text-secondary)" }} aria-hidden />
    </button>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-[12px] py-[12px]">
      <span className="min-w-px flex-1 text-[15px] leading-[18px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>{label}</span>
      <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex w-full items-center gap-[12px] py-[12px]">
      <span className="min-w-px flex-1 text-[15px] leading-[18px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

function ToggleSkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-full items-center gap-[12px] py-[12px]">
          <Skeleton className="h-[18px] flex-1" />
          <Skeleton className="h-[26px] w-[46px]" style={{ borderRadius: "var(--a-radius-pill)" }} />
        </div>
      ))}
    </>
  );
}
