import { useState } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import api from "@/api";


interface LoginScreenProps {
  onLogin: (isFirstLogin: boolean) => void;
  onRegister: () => void;
}

export function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      localStorage.setItem("autoLogin", autoLogin ? "true" : "false");
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
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              
            </p>
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
      </div>

    </div>
  );
}