import { useEffect, useState } from "react";
import { ChevronRight, Eye, EyeOff, X } from "lucide-react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import api from "@/api";

const PROFESSORS = ["유진호", "차대현", "홍진근"];

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
    try {
      const res = await api.post("/auth/login", { studentId, password });
      const data = res.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("autoLogin", autoLogin ? "true" : "false");
      onLogin(data.isFirstLogin);
    } catch (err: any) {
      setAlertMessage(err.response?.data?.message || "서버 연결 실패");
    }
  };

  // 포커스가 입력창이 아니라 자동 로그인 체크박스나 빈 화면에 있어도
  // Enter를 누르면 로그인이 시도되도록 화면 전체에서 감지한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (showFindPassword) handleFindPassword();
        else handleSubmit();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [studentId, password, autoLogin, showFindPassword, findPwStudentId, findPwProfessor, findPwCode, findPwNewPassword, findPwConfirmPassword]);

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-full px-6 py-10"
      style={{ background: "linear-gradient(160deg, #0a0f1f 0%, #0d1426 60%, #111a30 100%)" }}
    >
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-3xl mb-3 overflow-hidden">
  <img src={bigRoadingIcon} alt="Big Roading" className="w-full h-full object-cover" />
</div>
        <h1 className="text-[26px] font-bold" style={{ color: "var(--foreground)" }}>
          빅딩
        </h1>
      </div>

      <div
        className="w-full rounded-3xl p-6 shadow-xl"
        style={{ background: "var(--card)" }}
      >
        {showFindPassword ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => { setShowFindPassword(false); resetFindPasswordForm(); }}
                style={{ color: "var(--muted-foreground)" }}
              >
                ←
              </button>
              <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                비밀번호 찾기
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
              가입할 때와 동일한 학번, 담당 교수, 인증번호로 본인 확인 후 비밀번호를 새로 설정합니다.
            </p>
            <div className="flex flex-col gap-4" onClick={() => setShowFindPwProfessorDropdown(false)}>
              <div>
                <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>학번</label>
                <input
                  value={findPwStudentId}
                  onChange={(e) => setFindPwStudentId(e.target.value)}
                  placeholder="EX): 20210001"
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>담당 교수</label>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setShowFindPwProfessorDropdown((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
                    style={{
                      background: "var(--input-background)",
                      color: findPwProfessor ? "var(--foreground)" : "var(--muted-foreground)",
                      border: "1.5px solid var(--border)",
                    }}
                  >
                    {findPwProfessor || "담당 교수 선택"}
                    <ChevronRight size={16} style={{ transform: showFindPwProfessorDropdown ? "rotate(90deg)" : "rotate(-90deg)" }} />
                  </button>
                  {showFindPwProfessorDropdown && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      {PROFESSORS.map((p) => (
                        <button
                          key={p}
                          onClick={() => { setFindPwProfessor(p); setShowFindPwProfessorDropdown(false); }}
                          className="w-full px-4 py-2.5 text-sm text-left"
                          style={{ color: findPwProfessor === p ? "var(--primary)" : "var(--foreground)" }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>교수님 인증번호 (2자리)</label>
                <input
                  value={findPwCode}
                  onChange={(e) => setFindPwCode(e.target.value)}
                  maxLength={2}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>새 비밀번호</label>
                <input
                  type="password"
                  value={findPwNewPassword}
                  onChange={(e) => setFindPwNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>새 비밀번호 확인</label>
                <input
                  type="password"
                  value={findPwConfirmPassword}
                  onChange={(e) => setFindPwConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              <button
                onClick={handleFindPassword}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm mt-1 shadow-md transition-all active:scale-95"
                style={{ background: "var(--primary)", color: "white" }}
              >
                비밀번호 재설정
              </button>
            </div>
          </>
        ) : (
          <>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          로그인
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>
              학번
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="EX): 20210001"
              maxLength={8}
              className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
              style={{
                background: "var(--input-background)",
                color: "var(--foreground)",
                border: "1.5px solid var(--border)",
              }}
            />
          </div>

          <div>
            <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>
              비밀번호
            </label>
            <div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="암호를 입력해주세요"
    className="w-full px-4 py-3 pr-11 rounded-2xl outline-none text-sm"
    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
  />
  <button
    type="button"
    onClick={() => setShowPassword((v) => !v)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
    style={{ color: "var(--muted-foreground)" }}
    tabIndex={-1}
  >
    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
</div>
            <div className="flex justify-end mt-1">
              <button
                onClick={() => setShowFindPassword(true)}
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 -mt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="w-4 h-4 rounded accent-current cursor-pointer"
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              자동 로그인
            </span>
          </label>

          <button
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm mt-1 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: "var(--primary)", color: "white" }}
          >
            로그인
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => onRegister()}
            className="w-full text-xs text-center mt-1 py-1 transition-all active:scale-95"
            style={{ color: "var(--muted-foreground)" }}
          >
            계정이 없으신가요? <span style={{ color: "var(--primary)" }}>회원가입</span>
          </button>
        </div>
          </>
        )}
      </div>

      {/* 커스텀 알림 팝업 */}
      {alertMessage && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 text-base font-semibold"
              style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
            >
              Code
              <button onClick={() => setAlertMessage(null)} style={{ color: "var(--muted-foreground)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
              {alertMessage}
            </div>
            <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <button
                className="w-full py-3 text-sm font-medium"
                style={{ color: "var(--foreground)" }}
                onClick={() => setAlertMessage(null)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}