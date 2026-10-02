import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import api from "@/api";
import { TextField } from "@/aplan/components/TextField";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { alertDialog } from "@/aplan/components/Dialog";
import "@/styles/aplan-tokens.css";

// 담당 교수 (서버 routes/auth.js의 교수별 인증번호와 같은 이름이어야 한다)
const PROFESSORS = ["유진호", "차대현", "홍진근"] as const;
const GRADES = [1, 2, 3, 4] as const;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
const PHONE_RULE = /^01[016789]\d{7,8}$/;
const NICKNAME_RULE = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s]+$/;
const NICKNAME_MAX = 10;

type Field = "studentId" | "nickname" | "professor" | "code" | "phone" | "password" | "confirmPassword";
type Errors = Partial<Record<Field, string>>;

interface RegisterScreenProps {
  onBack: () => void;
  /** 가입 완료 → 로그인 화면으로 */
  onDone: () => void;
}

// 회원가입. 기존 기능(닉네임 중복확인 → 교수님 인증번호 확인 → 가입)을 그대로 두고
// A-02 로그인 · 비밀번호 찾기 화면과 같은 톤으로 옮겼다. Figma에 없는 화면이라 같은 입력칸·버튼·글자 크기를 쓴다.
// - 안내·오류는 팝업 대신 해당 칸 아래에 보여주고, 가입 완료만 확인 창으로 알린다
// - 인증이 끝나면 학번·닉네임·교수·인증번호는 잠근다(전화번호·학과·비밀번호는 계속 고칠 수 있다)
export function RegisterScreen({ onBack, onDone }: RegisterScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [nickname, setNickname] = useState("");
  const [professor, setProfessor] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const setError = (field: Field, message?: string) => setErrors((prev) => ({ ...prev, [field]: message }));
  const serverMessage = (err: any) => err?.response?.data?.message || "서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.";

  const checkNickname = async () => {
    const value = nickname.trim();
    if (!value) return setError("nickname", "닉네임을 입력해주세요.");
    if (!NICKNAME_RULE.test(value) || value.length > NICKNAME_MAX) {
      return setError("nickname", `특수문자 없이 띄어쓰기 포함 ${NICKNAME_MAX}자 이내로 적어주세요.`);
    }
    setCheckingNickname(true);
    try {
      const { data } = await api.post("/auth/check-nickname", { nickname: value });
      setNicknameChecked(!!data.available);
      setError("nickname", data.available ? undefined : data.message);
    } catch (err) {
      setError("nickname", serverMessage(err));
    } finally {
      setCheckingNickname(false);
    }
  };

  const verifyCode = async () => {
    const next: Errors = {};
    if (!studentId.trim()) next.studentId = "학번을 입력해주세요.";
    if (!nicknameChecked) next.nickname = "닉네임 중복확인을 먼저 해주세요.";
    if (!professor) next.professor = "담당 교수님을 선택해주세요.";
    if (!code.trim()) next.code = "교수님께 받은 인증번호를 입력해주세요.";
    setErrors((prev) => ({ ...prev, studentId: undefined, professor: undefined, code: undefined, ...next }));
    if (Object.keys(next).length) return;

    setVerifying(true);
    try {
      await api.post("/auth/verify-code", { studentId: studentId.trim(), professor, code: code.trim() });
      setVerified(true);
    } catch (err) {
      const message = serverMessage(err);
      // "이미 가입된 학번입니다"는 학번 칸, 나머지(인증번호 틀림·시도 횟수 초과 등)는 인증번호 칸에
      setError(message.includes("학번") ? "studentId" : "code", message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!nicknameChecked) next.nickname = "닉네임 중복확인을 먼저 해주세요.";
    if (!verified) next.code = "인증번호 확인을 먼저 해주세요.";
    const digits = phone.replace(/\D/g, "");
    if (!digits) next.phone = "비밀번호를 잊었을 때 본인 확인에 쓸 전화번호를 입력해주세요.";
    else if (!PHONE_RULE.test(digits)) next.phone = "올바른 휴대전화 번호를 입력해주세요.";
    if (!PASSWORD_RULE.test(password)) next.password = "8자 이상, 영문·숫자·특수문자를 모두 넣어주세요.";
    if (!confirmPassword) next.confirmPassword = "비밀번호를 한 번 더 입력해주세요.";
    else if (password !== confirmPassword) next.confirmPassword = "비밀번호가 일치하지 않아요.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.post("/auth/register", {
        studentId: studentId.trim(),
        name: nickname.trim(),
        professor,
        code: code.trim(),
        phone,
        password,
        department: department.trim() || undefined,
        grade: grade ?? undefined,
      });
      await alertDialog("회원가입이 완료됐어요", "가입한 학번으로 로그인해주세요.");
      onDone();
    } catch (err) {
      alertDialog("가입하지 못했어요", serverMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="a-screen flex flex-col">
      <form onSubmit={handleSubmit} noValidate className="flex min-h-dvh flex-col gap-[20px] px-[20px] py-[12px] pb-[32px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="-ml-[4px] flex size-[30px] items-center justify-center border-0 bg-transparent p-0"
        >
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} />
        </button>

        <div className="flex flex-col gap-[14px]">
          <h1 className="m-0 text-[26px] leading-[31px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
            회원가입
          </h1>
          <p className="m-0 text-[14px] leading-[17px] [word-break:keep-all]" style={{ color: "var(--a-color-text-secondary)" }}>
            학번과 교수님께 받은 인증번호로 가입해요
          </p>
        </div>

        <Field label="학번">
          <TextField
            label="학번"
            placeholder="예) 20210001"
            inputMode="numeric"
            autoComplete="username"
            maxLength={8}
            value={studentId}
            disabled={verified}
            error={errors.studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setError("studentId");
            }}
          />
        </Field>

        <Field label="닉네임" hint={nicknameChecked ? "사용할 수 있는 닉네임이에요" : undefined}>
          <InlineAction
            done={nicknameChecked}
            busy={checkingNickname}
            disabled={verified}
            actionLabel="중복확인"
            doneLabel="확인됨"
            onAction={checkNickname}
          >
            <TextField
              label="닉네임"
              placeholder={`${NICKNAME_MAX}자 이내 (예: 홍길동)`}
              maxLength={NICKNAME_MAX}
              value={nickname}
              disabled={verified}
              error={errors.nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNicknameChecked(false);
                setError("nickname");
              }}
            />
          </InlineAction>
        </Field>

        <Field label="담당 교수" error={errors.professor}>
          <div className="flex w-full flex-wrap gap-[8px]" role="radiogroup" aria-label="담당 교수">
            {PROFESSORS.map((p) => (
              <Chip
                key={p}
                selected={professor === p}
                disabled={verified}
                onClick={() => {
                  setProfessor(p);
                  setError("professor");
                }}
              >
                {p} 교수님
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="인증번호" hint={errors.code ? undefined : verified ? "인증이 완료됐어요" : "교수님께 받은 2자리 번호예요"}>
          <InlineAction
            done={verified}
            busy={verifying}
            disabled={verified}
            actionLabel="인증 확인"
            doneLabel="인증 완료"
            onAction={verifyCode}
          >
            <TextField
              label="인증번호"
              placeholder="2자리"
              inputMode="numeric"
              maxLength={2}
              value={code}
              disabled={verified}
              error={errors.code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("code");
              }}
            />
          </InlineAction>
        </Field>

        <Field label="전화번호" hint={errors.phone ? undefined : "비밀번호를 잊었을 때 본인 확인에만 써요"}>
          <TextField
            label="전화번호"
            placeholder="01012345678"
            type="tel"
            autoComplete="tel"
            maxLength={13}
            value={phone}
            error={errors.phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("phone");
            }}
          />
        </Field>

        <Field label="학과" optional>
          <TextField
            label="학과"
            placeholder="예) AI빅데이터학과"
            maxLength={50}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </Field>

        <Field label="학년" optional>
          <div className="flex w-full flex-wrap gap-[8px]" role="radiogroup" aria-label="학년">
            {[null, ...GRADES].map((g) => (
              <Chip key={g ?? "none"} selected={grade === g} onClick={() => setGrade(g)}>
                {g ? `${g}학년` : "선택 안 함"}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="비밀번호">
          <div className="relative w-full">
            <TextField
              label="비밀번호"
              placeholder="8자 이상, 영문·숫자·특수문자 포함"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              error={errors.password}
              className="[&_input]:pr-[44px]"
              onChange={(e) => {
                setPassword(e.target.value);
                setError("password");
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              className="absolute top-[13px] right-[12px] flex size-[20px] items-center justify-center border-0 bg-transparent p-0"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.5} style={{ color: "var(--a-color-text-secondary)" }} />
              ) : (
                <Eye size={18} strokeWidth={1.5} style={{ color: "var(--a-color-text-secondary)" }} />
              )}
            </button>
          </div>
          <TextField
            label="비밀번호 확인"
            placeholder="비밀번호 확인"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            error={errors.confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("confirmPassword");
            }}
          />
        </Field>

        <PrimaryButton type="submit" loading={submitting} className="mt-[4px]">
          가입 완료
        </PrimaryButton>
      </form>
    </div>
  );
}

// 칸 하나: 위에 굵은 라벨(+선택), 아래에 회색 안내 또는 빨간 오류
function Field({
  label,
  optional = false,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-[8px]">
      <span className="text-[13px] leading-[16px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
        {label}
        {optional && (
          <span className="ml-[4px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
            (선택)
          </span>
        )}
      </span>
      {children}
      {error ? (
        <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>
      ) : hint ? (
        <p className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{hint}</p>
      ) : null}
    </div>
  );
}

// 입력칸 + 오른쪽 확인 버튼 (닉네임 중복확인, 인증 확인). 완료되면 회색 "확인됨"으로 바뀐다
function InlineAction({
  children,
  done,
  busy,
  disabled,
  actionLabel,
  doneLabel,
  onAction,
}: {
  children: ReactNode;
  done: boolean;
  busy: boolean;
  disabled: boolean;
  actionLabel: string;
  doneLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex w-full items-start gap-[8px]">
      <div className="min-w-px flex-1">{children}</div>
      <button
        type="button"
        onClick={onAction}
        disabled={done || busy || disabled}
        className="h-[45px] shrink-0 border-0 px-[14px] text-[13px] leading-[16px] font-bold whitespace-nowrap"
        style={{
          borderRadius: "var(--a-radius-control)",
          background: done ? "var(--a-color-surface-muted)" : "var(--a-color-surface-inverse)",
          color: done ? "var(--a-color-text-secondary)" : "var(--a-color-on-inverse)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {done ? doneLabel : actionLabel}
      </button>
    </div>
  );
}

// 교수·학년 선택 칩 (온보딩 관심 분야 칩과 같은 모양)
function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 border-0 px-[16px] py-[9px] text-[14px] leading-[17px] font-[500] whitespace-nowrap transition-colors"
      style={{
        borderRadius: "var(--a-radius-pill)",
        background: selected ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
        color: selected ? "var(--a-color-on-inverse)" : "var(--a-color-icon)",
        opacity: disabled && !selected ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}