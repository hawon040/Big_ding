import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { CommunityScreen } from "./components/CommunityScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { BottomNav } from "./components/BottomNav";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen";

type Tab = "community" | "chat" | "profile" | "settings";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("community");
  const [showChatPanel, setShowChatPanel] = useState(false);

  const handleTabChange = (tab: Tab) => {
    if (tab === "chat") {
      if (activeTab === "chat") {
        setShowChatPanel((prev) => !prev);
      } else {
        setActiveTab("chat");
        setShowChatPanel(true);
      }
    } else {
      setActiveTab(tab);
      setShowChatPanel(false); // + 채팅 탭 벗어나면 패널도 닫기
    }
  };
  const [darkMode, setDarkMode] = useState(false);
  const [showRegister, setShowRegister] = useState(false); // 회원가입 화면
  const [showConsentModal, setShowConsentModal] = useState(false); // 개인정보 동의 팝업
  const [nickname, setNickname] = useState("데이터새내기");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setCurrentTime(formatted);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000 * 10);

    return () => clearInterval(timer);
  }, []);


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

        {/* 개인정보 수집 동의 팝업 */}
        {showConsentModal && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            <div
              className="w-full rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div
                className="px-5 py-4 text-base font-semibold"
                style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
              >
                Code
              </div>
              <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                이름, 학번에 대한 개인 정보 수집 및 이용에 동의하시겠습니까?
              </div>
              <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <button
                  className="flex-1 py-3 text-sm font-medium"
                  style={{ color: "var(--foreground)", borderRight: "1px solid rgba(255,255,255,0.1)" }}
                  onClick={() => {
                    setShowConsentModal(false);
                    setShowRegister(true);
                  }}
                >
                  확인
                </button>
                <button
                  className="flex-1 py-3 text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                  onClick={() => setShowConsentModal(false)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 회원가입 화면
  if (showRegister) {
    return phoneFrame(
      <div className="flex-1 mt-7">
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
          onRegister={() => setShowConsentModal(true)}
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
       <span>{currentTime}</span>
        <div className="flex items-center gap-1">
          <span>●●●</span>
          <span>WiFi</span>
          <span>🔋</span>
        </div>
      </div>

      {/* Screen content */}
     <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* CommunityScreen은 항상 마운트, 탭이 다를 땐 display:none으로만 숨김 */}
        <div
          className="relative flex flex-col flex-1 overflow-hidden"
          style={{
            display: activeTab === "community" || activeTab === "chat" ? "flex" : "none",
          }}
        >
          <CommunityScreen
            showChat={showChatPanel}
            setShowChat={setShowChatPanel}
            selectedPostId={selectedPostId}
            isActive={activeTab === "community" || activeTab === "chat"}
            onViewOwnProfile={() => handleTabChange("profile")}
          />
        </div>

        {/* 프로필/설정은 위에 덮어씌우는 방식으로 렌더링 */}
        {activeTab === "profile" && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ background: "var(--background)" }}
          >
            <ProfileScreen nickname={nickname} setNickname={setNickname} />
          </div>
        )}
        {activeTab === "settings" && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ background: "var(--background)" }}
          >
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
              onNavigateToPost={(postId) => {
                setSelectedPostId(postId);
                setActiveTab("community");
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
      />

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