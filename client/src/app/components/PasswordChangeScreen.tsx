import { useState } from "react";
import { ChevronLeft, Eye, EyeOff, X } from "lucide-react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";

interface RegisterScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function PasswordChangeScreen({ onComplete, onSkip }: RegisterScreenProps) {
  const [verified, setVerified] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 커스텀 알림 팝업 상태
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertCallback, setAlertCallback] = useState<(() => void) | null>(null);

  const showAlert = (message: string, callback?: () => void) => {
    setAlertMessage(message);
    setAlertCallback(() => callback || null);
  };

  const closeAlert = () => {
    setAlertMessage(null);
    if (alertCallback) {
      alertCallback();
    }
    setAlertCallback(null);
  };

  const checkNickname = async () => {
    if (!name) {
      showAlert("닉네임을 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/check-nickname", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: name,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNicknameChecked(true);
      }

      showAlert(data.message);
    } catch {
      showAlert("서버 연결 실패");
    }
  };

  const handleVerify = async () => {
    if (!studentId || !name || !professor) {
      showAlert("모든 항목을 입력해주세요.");
      return;
    }

    if (!nicknameChecked) {
      showAlert("닉네임 중복확인을 먼저 해주세요.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, professor, code }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert(data.message); return; }
      setVerified(true);
      showAlert("인증이 완료되었습니다.");
    } catch {
      showAlert("서버 연결 실패");
    }
  };

  const handleRegister = async () => {
    if (!password || !confirmPassword) {
      showAlert("비밀번호를 입력해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("비밀번호가 일치하지 않습니다.");
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      showAlert("비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name, professor, code, password }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert(data.message); return; }

      showAlert("회원가입이 완료되었습니다! 로그인해주세요.", () => {
        setNicknameChecked(false);
        setVerified(false);
        onComplete();
      });
    } catch {
      showAlert("서버 연결 실패");
    }
  };

  return (
    <div
      className="relative flex-1 flex flex-col items-center px-5 py-4 h-full"
      style={{ background: "linear-gradient(160deg, #0a0f1f 0%, #0d1426 60%, #111a30 100%)" }}
    >
      <div className="w-full rounded-3xl p-4 shadow-xl" style={{ background: "var(--card)" }}>

        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1 mb-1 -ml-1 px-1 py-1 text-xs font-medium transition-all active:scale-95"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ChevronLeft size={16} />
          뒤로가기
        </button>

        <div className="flex flex-col items-center mb-3">
          <div className="w-14 h-14 rounded-2xl mb-1.5 overflow-hidden">
            <img src={bigRoadingIcon} alt="Big Roading" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            회원가입
          </h2>
        </div>

        <div className="flex flex-col gap-2">

          <>
            {/* 학번 */}
            <div>
              <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
                학번
              </label>
              <input
                type="text"
                placeholder="예) 20210001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={verified}
                maxLength={8}
                className="w-full px-3 py-2 rounded-xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
            </div>

            {/* 닉네임 */}
            <div>
              <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
                닉네임
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="닉네임 (예: 홍길동)"
                  value={name}
                  disabled={verified}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNicknameChecked(false);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />

                <button
                  type="button"
                  disabled={verified}
                  onClick={checkNickname}
                  className="px-3 py-2 rounded-xl font-semibold text-xs"
                  style={{ background: "var(--primary)", color: "white", whiteSpace: "nowrap" }}
                >
                  중복확인
                </button>
              </div>
            </div>

            {/* 담당 교수 */}
            <div>
              <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
                담당 교수
              </label>
              <select
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                disabled={verified}
                className="w-full px-3 py-2 rounded-xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: professor ? "var(--foreground)" : "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
              >
                <option value="">교수님을 선택하세요</option>
                <option value="유진호">유진호 교수</option>
                <option value="차대현">차대현 교수</option>
                <option value="홍진근">홍진근 교수</option>
              </select>
            </div>

            {/* 인증번호 */}
            <div>
              <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
                인증번호 (교수님께 받은 2자리)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={verified}
                  placeholder="예) 11"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={2}
                  className="flex-1 px-3 py-2 rounded-xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
                <button
                  onClick={handleVerify}
                  disabled={verified}
                  className="px-3 py-2 rounded-xl font-semibold text-xs"
                  style={{
                    background: verified ? "#999999" : "var(--primary)",
                    color: "white",
                    whiteSpace: "nowrap",
                    cursor: verified ? "not-allowed" : "pointer",
                  }}
                >
                  인증 확인
                </button>
              </div>
            </div>
          </>

          {/* 비밀번호 */}
          <div>
            <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="8자 이상 / 영문 / 숫자 / 특수문자 포함"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호 확인
            </label>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-xl outline-none text-sm"
                style={{
                  background: "var(--input-background)",
                  color: "var(--foreground)",
                  border: "1.5px solid var(--border)"
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              if (!nicknameChecked) {
                showAlert("닉네임 중복확인을 먼저 해주세요.");
                return;
              }

              if (!verified) {
                showAlert("먼저 인증번호 확인을 완료해주세요.");
                return;
              }

              handleRegister();
            }}
            className="w-full py-2.5 rounded-xl font-semibold text-sm shadow-md mt-1"
            style={{ background: "var(--primary)", color: "white" }}
          >
            가입 완료
          </button>

        </div>
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
              <button onClick={closeAlert} style={{ color: "var(--muted-foreground)" }}>
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
                onClick={closeAlert}
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