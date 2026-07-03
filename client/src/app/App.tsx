import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { CommunityScreen } from "./components/CommunityScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { BottomNav } from "./components/BottomNav";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen";

type Tab = "community" | "profile" | "settings";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("community");
  const [darkMode, setDarkMode] = useState(false);
  const [showRegister, setShowRegister] = useState(false); // 회원가입 화면
  const [nickname, setNickname] = useState("데이터새내기");
  // 앱 시작 시 토큰 확인 → 자동 로그인
  useEffect(() => {
    const token = localStorage.getItem("token");
    const autoLogin = localStorage.getItem("autoLogin");
    if (token && autoLogin === "true") {
      setLoggedIn(true); // 토큰 있고 자동 로그인 동의한 경우에만 바로 메인으로
    } else {
      // 자동 로그인을 선택하지 않았다면 이전 토큰은 정리
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, []);
  if (typeof document !== "undefined") {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  const phoneFrame = (children: React.ReactNode) => (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "linear-gradient(135deg, #0a0f1f 0%, #05070f 100%)" }}
    >
      <div
        className="relative flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: "390px",
          height: "844px",
          borderRadius: "44px",
          border: "8px solid #05070f",
          background: "var(--background)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-50"
          style={{ width: "126px", height: "30px", background: "#05070f", borderRadius: "0 0 20px 20px" }}
        />
        {children}
      </div>
    </div>
  );

  // 회원가입 화면
  if (showRegister) {
    return phoneFrame(
      <div className="flex-1 overflow-y-auto mt-7">
        <PasswordChangeScreen
          onComplete={() => setShowRegister(false)} // 완료 → 로그인 화면
          onSkip={() => setShowRegister(false)}
        />
      </div>
    );
  }

  // 로그인 화면
  if (!loggedIn) {
    return phoneFrame(
      <div className="flex-1 overflow-y-auto mt-7">
        <LoginScreen
          onLogin={() => setLoggedIn(true)}
  onRegister={() => {
    const agree = window.confirm(
      "개인정보 수집 및 이용에 동의하시겠습니까?"
    );

    if (agree) {
      setShowRegister(true);
    }
  }}
        />
      </div>
    );
  }

  return phoneFrame(
    <>
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-8 pt-2 pb-1 mt-8 text-xs font-semibold shrink-0"
        style={{ color: "var(--foreground)" }}
      >
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span>●●●</span>
          <span>WiFi</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "community" && (
          <div className="relative flex flex-col flex-1 overflow-hidden">
            <CommunityScreen />
          </div>
        )}
        {activeTab === "profile" && (
          <div className="flex-1 overflow-hidden">
            <ProfileScreen nickname={nickname} setNickname={setNickname} />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="flex-1 overflow-y-auto">
            <SettingsScreen
              darkMode={darkMode}
              onToggleDark={() => setDarkMode(!darkMode)}
              onLogout={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("autoLogin");
                setLoggedIn(false);
                setActiveTab("community");
                setDarkMode(false);
              }}
              nickname={nickname}
              setNickname={setNickname}
            />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* Home indicator */}
      <div className="flex justify-center pb-2 pt-1 shrink-0">
        <div
          className="w-28 h-1 rounded-full"
          style={{ background: "var(--muted-foreground)", opacity: 0.35 }}
        />
      </div>
    </>
  );
}