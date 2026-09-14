import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import "@/styles/tokens.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

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

  const validateNickname = (value: string): string | null => {
    if (!value.trim()) {
      return "닉네임을 작성해주세요.";
    }
    // 한글/영문/숫자/띄어쓰기만 허용, 특수문자 및 길이 10자(띄어쓰기 포함) 제한
    const validPattern = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s]+$/;
    if (!validPattern.test(value) || value.length > 10) {
      return "특수문자를 제외한 띄어쓰기 포함 10자 이내로 적어주세요.";
    }
    return null;
  };

  const checkNickname = async () => {
    const error = validateNickname(name);
    if (error) {
      showAlert(error);
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

      if (res.ok && data.available) {
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
      className="relative flex h-full flex-1 flex-col items-center px-5 py-4"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full rounded-[var(--r-lg)] p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

        <button
          type="button"
          onClick={onSkip}
          className="-ml-1 mb-1 flex items-center gap-1 px-1 py-1 text-xs font-medium transition-all active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={16} />
          뒤로가기
        </button>

        <div className="mb-3 flex flex-col items-center">
          <h2 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>
            회원가입
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {/* 학번 */}
          <Input
            label="학번"
            type="text"
            placeholder="예) 20210001"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={verified}
            maxLength={8}
          />

          {/* 닉네임 */}
          <div>
            <div className="flex gap-2">
              <Input
                label="닉네임"
                type="text"
                placeholder="닉네임 (예: 홍길동)"
                value={name}
                disabled={verified}
                onChange={(e) => {
                  setName(e.target.value);
                  setNicknameChecked(false);
                }}
                className="flex-1"
              />
              <Button size={44} className="mt-[22px] h-11 px-3" disabled={verified} onClick={checkNickname}>
                중복확인
              </Button>
            </div>
          </div>

          {/* 담당 교수 */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium" style={{ color: "var(--text-body)" }}>담당 교수</label>
            <select
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              disabled={verified}
              className="w-full rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--blue-primary)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
              style={{ color: professor ? "var(--text-body)" : "var(--text-muted)" }}
            >
              <option value="">교수님을 선택하세요</option>
              <option value="유진호">유진호 교수</option>
              <option value="차대현">차대현 교수</option>
              <option value="홍진근">홍진근 교수</option>
            </select>
          </div>

          {/* 인증번호 */}
          <div>
            <div className="flex gap-2">
              <Input
                label="인증번호 (교수님께 받은 2자리)"
                type="text"
                disabled={verified}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={2}
                className="flex-1"
              />
              <Button size={44} className="mt-[22px] h-11 px-3" variant={verified ? "secondary" : "primary"} disabled={verified} onClick={handleVerify}>
                인증 확인
              </Button>
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="relative">
            <Input
              label="비밀번호"
              type={showPassword ? "text" : "password"}
              placeholder="8자 이상 / 영문 / 숫자 / 특수문자 포함"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute bottom-2.5 right-3"
              style={{ color: "var(--text-muted)" }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* 비밀번호 확인 */}
          <div className="relative">
            <Input
              label="비밀번호 확인"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute bottom-2.5 right-3"
              style={{ color: "var(--text-muted)" }}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Button
            size={52}
            fullWidth
            className="mt-1"
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
          >
            가입 완료
          </Button>
        </div>
      </div>

      <Modal open={!!alertMessage} title="알림" onClose={closeAlert}>
        {alertMessage}
      </Modal>
    </div>
  );
}
