import { useState, type FormEvent } from "react";
import api from "@/api";
import { TextField } from "@/aplan/components/TextField";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import "@/styles/aplan-tokens.css";

interface LoginScreenProps {
  onLogin: () => void;
  onRegister: () => void;
  onFindPassword: () => void;
}

type FieldErrors = { studentId?: string; password?: string };

// A-02 로그인 (Figma 2:34). 로그인 아이디는 학번이다(학교 이메일 인증은 범위 밖).
// - 상태바(9:41)·폰 테두리는 제외
// - "또는" 구분선과 소셜 로그인 버튼 3개(2:25, 2:29)는 소셜 로그인 기능이 없어 넣지 않았다
// - 모바일 앱처럼 로그인 상태를 유지한다(autoLogin). 기존 화면의 자동 로그인 체크박스는 A안에 없다
export function LoginScreen({ onLogin, onRegister, onFindPassword }: LoginScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!studentId.trim()) next.studentId = "학번을 입력해주세요.";
    if (!password) next.password = "비밀번호를 입력해주세요.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", { studentId: studentId.trim(), password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("autoLogin", "true");
      onLogin();
    } catch (err: any) {
      const status = err?.response?.status;
      const message: string = err?.response?.data?.message || "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
      // 서버 메시지로 어느 칸의 문제인지 구분해서 해당 칸 아래에 보여준다.
      if (status === 401 && message.includes("학번")) setErrors({ studentId: message });
      else setErrors({ password: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="a-screen flex flex-col">
      {/* data-node-id 2:41 Body */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex min-h-dvh flex-1 flex-col items-start gap-[14px] px-[20px] py-[12px]"
      >
        {/* 2:10 위쪽 여백. Figma 원본엔 이 아래 소셜 로그인 버튼 3개가 더 있어서(주석 참고, 넣지 않음)
            위아래를 flex-1로 반씩 나누면 소셜 로그인만큼 위로 더 밀려 내려간다. 실제 배치와 맞도록
            Figma 사각형 높이(119.5px) 그대로 고정하고, 아래쪽만 flex-1로 나머지 공간을 흡수한다. */}
        <div className="h-[119.5px] shrink-0" aria-hidden />
        {/* 2:11 제목 */}
        <h1 className="m-0 w-full text-[26px] leading-[31px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          다시 만나서
          <br />
          반가워요
        </h1>
        {/* 2:12 부제 (Figma "학교 이메일로 로그인하세요" → 학번 로그인) */}
        <p className="m-0 w-full text-[14px] leading-[17px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
          학번으로 로그인하세요
        </p>
        {/* 2:14 학번 */}
        <TextField
          label="학번"
          placeholder="학번"
          inputMode="numeric"
          autoComplete="username"
          maxLength={8}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          error={errors.studentId}
        />
        {/* 2:16 비밀번호 */}
        <TextField
          label="비밀번호"
          placeholder="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {/* 2:19 비밀번호 찾기 */}
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={onFindPassword}
            className="border-0 bg-transparent p-0 text-[12px] leading-[14px] font-normal"
            style={{ color: "var(--a-color-text-secondary)" }}
          >
            비밀번호 찾기
          </button>
        </div>
        {/* 2:21 로그인 */}
        <PrimaryButton type="submit" loading={submitting}>
          로그인
        </PrimaryButton>
        {/* 2:30 아래쪽 여백 */}
        <div className="min-h-px flex-1" aria-hidden />
        {/* 2:33 회원가입 */}
        <div className="flex w-full items-center justify-center gap-[6px] pb-[24px] text-[13px] leading-[16px] whitespace-nowrap">
          <span className="font-normal" style={{ color: "var(--a-color-text-secondary)" }}>아직 회원이 아니신가요?</span>
          <button
            type="button"
            onClick={onRegister}
            className="border-0 bg-transparent p-0 text-[13px] leading-[16px] font-bold"
            style={{ color: "var(--a-color-text-primary)" }}
          >
            회원가입
          </button>
        </div>
      </form>
    </div>
  );
}
