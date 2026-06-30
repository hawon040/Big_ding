import { useState } from "react";
import { Eye, EyeOff, GraduationCap, ChevronRight } from "lucide-react";

interface LoginScreenProps {
  onLogin: (isFirstLogin: boolean) => void;
  onRegister: () => void; // 회원가입 버튼 클릭 시
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<"login" | "info">("login");

  const handleSubmit = async () => {
  if (!studentId || !password) {
    alert("모든 항목을 입력해주세요.");
    return;
  }
  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, password }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message); return; }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    onLogin(data.isFirstLogin);
  } catch {
    alert("서버 연결 실패");
  }
};

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 py-10"
      style={{ background: "linear-gradient(160deg, #fdf0e0 0%, #fde8cc 60%, #f5d5a8 100%)" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-lg"
          style={{ background: "var(--primary)" }}
        >
          <GraduationCap size={44} color="white" strokeWidth={2} />
        </div>
        <h1 className="text-[26px] font-bold" style={{ color: "var(--foreground)" }}>
          AI BigData Community
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          AI빅데이터전공 학생 전용 커뮤니티
        </p>
      </div>

      {/* Form */}
      <div
        className="w-full rounded-3xl p-6 shadow-xl"
        style={{ background: "var(--card)" }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
          로그인
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--muted-foreground)" }}>
          학번과 담당 교수님 고유번호로 로그인하세요
        </p>

        <div className="flex flex-col gap-4">
          {/* 학번 */}
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

          {/* 비밀번호 */}
          <div>
            <label className="text-sm mb-1 block font-medium" style={{ color: "var(--muted-foreground)" }}>
              초기 비밀번호
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="EX): 20230001 + 01"
              className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
              style={{
                background: "var(--input-background)",
                color: "var(--foreground)",
                border: "1.5px solid var(--border)",
              }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
               학번 + 사용자 고유 ID
            </p>
          </div>

         

          <button
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm mt-1 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: "var(--primary)", color: "white" }}
          >
            로그인
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

{/* 회원가입 버튼 */}
<button
  onClick={() => onRegister()}
  className="w-full py-3 rounded-2xl font-semibold text-sm border-2 transition-all active:scale-95"
  style={{
    background: "transparent",
    color: "var(--primary)",
    border: "2px solid var(--primary)",
  }}
>
  회원가입
</button>

      {/* 안내 박스 */}
      <div
        className="w-full mt-4 rounded-2xl p-4"
        style={{ background: "rgba(224, 123, 57, 0.1)", border: "1px solid rgba(224, 123, 57, 0.3)" }}
      >
        <p className="text-xs font-semibold mb-1" style={{ color: "var(--primary)" }}>
          📋 이용 안내
        </p>
        <ul className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
          <li>• 개인정보 제공에 동의하신 AI빅데이터전공 학우만 이용 가능합니다</li>
          <li>• 담당 교수님께 고유번호를 받아 학번과 합쳐 입력하세요</li>
          <li>• 로그인 후 초기 비밀번호를 반드시 변경해주세요</li>
          <li>• 문의사항은 학부 사무실로 연락주세요</li>
        </ul>
      </div>
    </div>
  );
}
