import { useState } from "react";
import { GraduationCap, ChevronRight } from "lucide-react";
import api from "@/api";

interface LoginScreenProps {
  onLogin: (isFirstLogin: boolean) => void;
  onRegister: () => void;
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    if (!studentId || !password) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    try {
      const res = await api.post("/auth/login", { studentId, password });
      const data = res.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.isFirstLogin);
    } catch (err: any) {
      alert(err.response?.data?.message || "서버 연결 실패");
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 py-10"
      style={{ background: "linear-gradient(160deg, #0a0f1f 0%, #0d1426 60%, #111a30 100%)" }}
    >
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-lg"
          style={{ background: "var(--primary)" }}
        >
          <GraduationCap size={44} color="white" strokeWidth={2} />
        </div>
        <h1 className="text-[26px] font-bold" style={{ color: "var(--foreground)" }}>
          빅딩
        </h1>
      </div>

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
              조기 비밀번호
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

          <button
            onClick={() => onRegister()}
            className="w-full text-xs text-center mt-1 py-1 transition-all active:scale-95"
            style={{ color: "var(--muted-foreground)" }}
          >
            계정이 없으신가요? <span style={{ color: "var(--primary)" }}>회원가입</span>
          </button>
        </div>
      </div>

      <div
        className="w-full mt-4 rounded-2xl p-4"
        style={{ background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.3)" }}
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