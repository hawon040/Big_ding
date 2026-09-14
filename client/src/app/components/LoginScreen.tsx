import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import api from "@/api";
import "@/styles/tokens.css";

const PROFESSORS = ["유진호", "차대현", "홍진근"];

// Light-theme token set for this screen, extracted from the community
// reference. Kept local to LoginScreen (not the shared dark --background
// etc. tokens other screens still use) until the rest of the app adopts
// the same palette.
const LOGIN_TOKENS: Record<string, string> = {
  "--login-bg": "#F4F7FB",
  "--login-surface": "#FFFFFF",
  "--login-border": "#DCE8FA",
  "--login-tint": "#DCE8FA",
  "--login-accent": "#3B82F6",
  "--login-accent-2": "#4F8DF7",
  "--login-accent-strong": "#1D4ED8",
  "--login-text": "#0B0F19",
  "--login-text-body": "#1F2937",
  "--login-text-muted": "#64748B",
  "--login-danger": "#DC2626",
};

interface LoginScreenProps {
  onLogin: (isFirstLogin: boolean) => void;
  onRegister: () => void;
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 비밀번호 찾기
  const [showFindPassword, setShowFindPassword] = useState(false);
  const [findPwStudentId, setFindPwStudentId] = useState("");
  const [findPwProfessor, setFindPwProfessor] = useState("");
  const [showFindPwProfessorDropdown, setShowFindPwProfessorDropdown] = useState(false);
  const [findPwCode, setFindPwCode] = useState("");
  const [findPwNewPassword, setFindPwNewPassword] = useState("");
  const [findPwConfirmPassword, setFindPwConfirmPassword] = useState("");

  const resetFindPasswordForm = () => {
    setFindPwStudentId("");
    setFindPwProfessor("");
    setFindPwCode("");
    setFindPwNewPassword("");
    setFindPwConfirmPassword("");
    setShowFindPwProfessorDropdown(false);
  };

  const handleFindPassword = async () => {
    if (!findPwStudentId.trim() || !findPwProfessor || !findPwCode.trim()) {
      setAlertMessage("학번, 담당 교수, 인증번호를 모두 입력해주세요.");
      return;
    }
    if (findPwNewPassword.length < 4) {
      setAlertMessage("새 비밀번호를 입력해주세요.");
      return;
    }
    if (findPwNewPassword !== findPwConfirmPassword) {
      setAlertMessage("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      await api.post("/auth/find-password", {
        studentId: findPwStudentId.trim(),
        professor: findPwProfessor,
        code: findPwCode.trim(),
        newPassword: findPwNewPassword,
      });
      setAlertMessage("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.");
      resetFindPasswordForm();
      setShowFindPassword(false);
    } catch (err: any) {
      setAlertMessage(err?.response?.data?.message || "비밀번호 재설정에 실패했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (!studentId || !password) {
      setAlertMessage("모든 항목을 입력해주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post("/auth/login", { studentId, password });
      const data = res.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("autoLogin", autoLogin ? "true" : "false");
      onLogin(data.isFirstLogin);
    } catch (err: any) {
      setAlertMessage(err.response?.data?.message || "서버 연결 실패");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 포커스가 입력창이 아니라 자동 로그인 체크박스나 빈 화면에 있어도
  // Enter를 누르면 로그인이 시도되도록 화면 전체에서 감지한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // 알림 팝업이 떠 있는 동안 Enter를 누르면(확인 버튼을 누르려는 자연스러운 습관) 그
        // 팝업을 닫아야 하는데, 이 체크가 없으면 팝업이 뜬 채로 로그인/비밀번호 찾기를
        // 다시 시도해버려서 팝업이 확인을 누르기도 전에 사라지는 것처럼 보였다.
        if (alertMessage) {
          setAlertMessage(null);
          return;
        }
        if (showFindPassword) handleFindPassword();
        else handleSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [studentId, password, autoLogin, showFindPassword, findPwStudentId, findPwProfessor, findPwCode, findPwNewPassword, findPwConfirmPassword, alertMessage]);

  const labelClass = "text-[13px] mb-1 block font-medium";
  const inputClass =
    "w-full px-4 py-3 rounded-[12px] outline-none text-sm bg-[var(--login-bg)] text-[var(--login-text-body)] border border-[var(--login-border)] placeholder:text-[var(--login-text-muted)] transition-colors focus:bg-[var(--login-tint)] focus:border-[var(--login-accent)] focus:ring-2 focus:ring-[var(--login-accent)]/30";
  const iconBoxClass =
    "flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors";

  return (
    <div
      className="relative flex flex-col items-center min-h-full px-6 pt-16 pb-10"
      style={{ ...(LOGIN_TOKENS as any), background: "var(--login-bg)" }}
    >
      <div className="flex flex-col items-center mb-8">
        <h1 className="notranslate text-[34px] leading-none" translate="no" style={{ color: "var(--login-text)", fontFamily: "var(--font-logo)" }}>
          Big Ding
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--login-text-muted)" }}>
          강의평부터 학교 생활까지
        </p>
      </div>

      <div
        className="w-full max-w-[420px] mx-auto rounded-[16px] p-6"
        style={{
          background: "var(--login-surface)",
          border: "1px solid var(--login-border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {showFindPassword ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => { setShowFindPassword(false); resetFindPasswordForm(); setAlertMessage(null); }}
                className={iconBoxClass}
                style={{ background: "var(--login-tint)" }}
                aria-label="뒤로 가기"
              >
                <ArrowLeft size={16} style={{ color: "var(--login-accent-strong)" }} />
              </button>
              <h2 className="text-lg font-semibold" style={{ color: "var(--login-text)" }}>
                비밀번호 찾기
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--login-text-muted)" }}>
              가입할 때와 동일한 학번, 담당 교수, 인증번호로 본인 확인 후 비밀번호를 새로 설정합니다.
            </p>
            <div className="flex flex-col gap-4" onClick={() => setShowFindPwProfessorDropdown(false)}>
              <div>
                <label htmlFor="findpw-studentid" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  학번
                </label>
                <input
                  id="findpw-studentid"
                  value={findPwStudentId}
                  onChange={(e) => setFindPwStudentId(e.target.value)}
                  placeholder="EX): 20210001"
                  maxLength={8}
                  className={inputClass}
                />
              </div>
              <div>
                <label id="findpw-professor-label" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  담당 교수
                </label>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-labelledby="findpw-professor-label"
                    onClick={() => setShowFindPwProfessorDropdown((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] text-sm border transition-colors focus:outline-none focus:ring-2"
                    style={{
                      background: "var(--login-bg)",
                      color: findPwProfessor ? "var(--login-text-body)" : "var(--login-text-muted)",
                      borderColor: "var(--login-border)",
                    }}
                  >
                    {findPwProfessor || "담당 교수 선택"}
                    <ChevronRight
                      size={16}
                      style={{
                        color: "var(--login-text-muted)",
                        transform: showFindPwProfessorDropdown ? "rotate(90deg)" : "rotate(-90deg)",
                      }}
                    />
                  </button>
                  {showFindPwProfessorDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 z-20 rounded-[12px] py-1"
                      style={{
                        background: "var(--login-surface)",
                        border: "1px solid var(--login-border)",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                      }}
                    >
                      {PROFESSORS.map((p) => (
                        <button
                          key={p}
                          onClick={() => { setFindPwProfessor(p); setShowFindPwProfessorDropdown(false); }}
                          className="w-full px-4 py-2.5 text-sm text-left"
                          style={{ color: findPwProfessor === p ? "var(--login-accent-strong)" : "var(--login-text-body)" }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="findpw-code" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  교수님 인증번호 (2자리)
                </label>
                <input
                  id="findpw-code"
                  value={findPwCode}
                  onChange={(e) => setFindPwCode(e.target.value)}
                  maxLength={2}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="findpw-new-password" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  새 비밀번호
                </label>
                <input
                  id="findpw-new-password"
                  type="password"
                  value={findPwNewPassword}
                  onChange={(e) => setFindPwNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="findpw-confirm-password" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  새 비밀번호 확인
                </label>
                <input
                  id="findpw-confirm-password"
                  type="password"
                  value={findPwConfirmPassword}
                  onChange={(e) => setFindPwConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              {alertMessage && (
                <p className="text-xs -mt-1" style={{ color: "var(--login-danger)" }}>
                  {alertMessage}
                </p>
              )}

              <button
                onClick={handleFindPassword}
                className="w-full h-[52px] rounded-[14px] font-semibold text-sm mt-1 transition-all hover:brightness-95 active:scale-[0.99]"
                style={{ background: "var(--login-accent-strong)", color: "white" }}
              >
                비밀번호 재설정
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--login-text)" }}>
              로그인
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-studentid" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  학번
                </label>
                <input
                  id="login-studentid"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="EX): 20210001"
                  maxLength={8}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="login-password" className={labelClass} style={{ color: "var(--login-text-body)" }}>
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="암호를 입력해주세요"
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className={`${iconBoxClass} absolute right-1.5 top-1/2 -translate-y-1/2`}
                    style={{ background: "var(--login-tint)" }}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff size={16} style={{ color: "var(--login-accent-strong)" }} />
                    ) : (
                      <Eye size={16} style={{ color: "var(--login-accent-strong)" }} />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 -mt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(e) => setAutoLogin(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: "var(--login-accent-strong)" }}
                />
                <span className="text-xs" style={{ color: "var(--login-text-muted)" }}>
                  자동 로그인
                </span>
              </label>

              {alertMessage && (
                <p className="text-xs -mt-1" style={{ color: "var(--login-danger)" }}>
                  {alertMessage}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-[52px] rounded-[14px] font-semibold text-sm mt-1 transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ background: "var(--login-accent-strong)", color: "white" }}
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "로그인"}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm mt-1">
                <button
                  onClick={() => setShowFindPassword(true)}
                  className="transition-opacity active:opacity-70"
                  style={{ color: "var(--login-accent-strong)" }}
                >
                  비밀번호 찾기
                </button>
                <span style={{ color: "var(--login-text-muted)" }}>·</span>
                <button
                  onClick={() => onRegister()}
                  className="transition-opacity active:opacity-70"
                  style={{ color: "var(--login-accent-strong)" }}
                >
                  회원가입
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
