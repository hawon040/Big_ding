import { useState } from "react";
import { GraduationCap } from "lucide-react";

interface RegisterScreenProps {
  onComplete: () => void; // 회원가입 완료 → 로그인 화면으로
  onSkip: () => void;
}

export function PasswordChangeScreen({ onComplete }: RegisterScreenProps) {
  // 단계: info(기본정보) → verify(인증) → password(비밀번호설정)
  const [step, setStep] = useState<"info" | "verify" | "password">("info");

  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 인증번호 확인
  const handleVerify = async () => {
    if (!studentId || !name || !professor) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, professor, code }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      // 인증 성공 → 비밀번호 설정 단계로
      setStep("password");
    } catch {
      alert("서버 연결 실패");
    }
  };

  // 회원가입 완료
  const handleRegister = async () => {
    if (!password || !confirmPassword) {
      alert("비밀번호를 입력해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 8) {
      alert("비밀번호는 8자 이상 입력해주세요.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name, professor, code, password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("회원가입이 완료되었습니다! 로그인해주세요.");
      onComplete(); // 로그인 화면으로
    } catch {
      alert("서버 연결 실패");
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 mt-7"
      style={{ background: "linear-gradient(160deg, #fdf0e0 0%, #fde8cc 60%, #f5d5a8 100%)" }}
    >
      <div className="w-full rounded-3xl p-6 shadow-xl" style={{ background: "var(--card)" }}>

        {/* 상단 아이콘 + 제목 */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "var(--primary)" }}
          >
            <GraduationCap size={30} color="white" />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            {step === "password" ? "비밀번호 설정" : "회원가입"}
          </h2>
          <p className="text-xs mt-1 text-center" style={{ color: "var(--muted-foreground)" }}>
            {step === "password" ? "사용할 비밀번호를 설정하세요" : "정보를 입력하고 인증을 완료하세요"}
          </p>
        </div>

        <div className="flex flex-col gap-3">

          {/* 1단계: 기본 정보 + 인증번호 */}
          {step !== "password" && (
            <>
              {/* 학번 */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  학번
                </label>
                <input
                  type="text"
                  placeholder="예) 20210001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  maxLength={8}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>

              {/* 이름 */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  이름
                </label>
                <input
                  type="text"
                  placeholder="실명을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>

              {/* 담당 교수 선택 */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  담당 교수
                </label>
                <select
                  value={professor}
                  onChange={(e) => setProfessor(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
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
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  인증번호 (교수님께 받은 2자리)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="예) 11"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={2}
                    className="flex-1 px-4 py-3 rounded-2xl outline-none text-sm"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                  />
                  {/* 인증 확인 버튼 */}
                  <button
                    onClick={handleVerify}
                    className="px-4 py-3 rounded-2xl font-semibold text-sm"
                    style={{ background: "var(--primary)", color: "white", whiteSpace: "nowrap" }}
                  >
                    인증 확인
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 2단계: 비밀번호 설정 */}
          {step === "password" && (
            <>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  새 비밀번호
                </label>
                <input
                  type="password"
                  placeholder="8자 이상 영문, 숫자, 특수문자 조합"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
              {/* 가입 완료 버튼 */}
              <button
                onClick={handleRegister}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm shadow-md mt-1"
                style={{ background: "var(--primary)", color: "white" }}
              >
                가입 완료
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}