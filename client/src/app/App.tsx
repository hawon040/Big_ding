import { useState, useEffect } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { CommunityScreen, getCurrentUser } from "./components/CommunityScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { BottomNav } from "./components/BottomNav";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen";
import { LunchScreen } from "./components/LunchScreen";
import { Utensils, Plus } from "lucide-react";
import api from "@/api";
import { useSocket } from "@/hooks/useSocket";

type Tab = "community" | "chat" | "profile" | "settings" | "lunch";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("community");
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [writeSignal, setWriteSignal] = useState(0);
const [navSignal, setNavSignal] = useState(0);
// 게시물 상세/작성자 프로필처럼 하단에 댓글 입력창이 고정된 화면이 열려 있는지 여부.
// true인 동안은 점심메뉴 플로팅 버튼이 그 입력창 위에 겹치지 않도록 숨긴다.
const [communityDetailOpen, setCommunityDetailOpen] = useState(false);
// 우측 하단 돌림판(FAB) 메뉴가 펼쳐져 있는지 여부. 탭을 벗어나면 자동으로 닫는다.
const [showFabMenu, setShowFabMenu] = useState(false);
useEffect(() => {
  if (activeTab !== "community" || showChatPanel) setShowFabMenu(false);
}, [activeTab, showChatPanel]);
  const handleWriteClick = () => {
    setActiveTab("community");
    setShowChatPanel(false);
    setWriteSignal((n) => n + 1);
  };

 // 커뮤니티에서 "내 프로필"을 눌러 프로필 화면으로 넘어온 경우에만 true.
  // 하단 네비게이션에서 직접 "프로필" 탭을 눌렀을 때는 false로 유지되어,
  // 프로필 화면에 뒤로가기 버튼이 필요한 경우와 아닌 경우를 구분한다.
  const [profileFromCommunity, setProfileFromCommunity] = useState(false);

  const handleTabChange = (tab: Tab) => {
    setNavSignal((n) => n + 1);
    // 하단 네비게이션을 직접 눌러 이동하는 것이므로, 커뮤니티에서 넘어온 상태는 초기화한다.
    setProfileFromCommunity(false);
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

  // 커뮤니티 화면(게시물/댓글 작성자 아바타)에서 "내 프로필"을 눌렀을 때 호출된다.
  // handleTabChange와 달리 profileFromCommunity를 true로 남겨서, 프로필 화면에
  // 뒤로가기 버튼이 뜨고 누르면 다시 커뮤니티로 돌아가도록 한다.
  const openOwnProfileFromCommunity = () => {
    setProfileFromCommunity(true);
    setActiveTab("profile");
    setShowChatPanel(false);
  };

  // 하단 네비게이션이 아니라 패널 핸들을 직접 드래그/탭해서 열고 닫을 때도
  // 하단 네비게이션의 활성 탭 표시가 패널 상태를 그대로 따라가게 한다.
  useEffect(() => {
    if (showChatPanel && activeTab !== "chat") {
      setActiveTab("chat");
    } else if (!showChatPanel && activeTab === "chat") {
      setActiveTab("community");
    }
  }, [showChatPanel]);
  const [darkMode, setDarkMode] = useState(false);
  const [showRegister, setShowRegister] = useState(false); // 회원가입 화면
  const [showConsentModal, setShowConsentModal] = useState(false); // 개인정보 동의 팝업
  // 프로필/설정 화면에 보여줄 닉네임은 회원가입 때 설정한 실제 닉네임을 기본값으로 쓴다.
  const [nickname, setNickname] = useState(() => getCurrentUser()?.nickname ?? "");

  // 안 읽은 채팅 메시지 총 개수 (하단 네비게이션 채팅 탭 뱃지용).
  // 채팅 탭에 들어가 있는 동안(showChatPanel === true)은 메시지를 열면 바로 읽음 처리되므로
  // 그 사이엔 폴링을 잠깐 멈춰도 되지만, 여기선 단순하게 로그인 상태에서 항상 폴링한다.
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  useEffect(() => {
    if (!loggedIn) {
      setUnreadChatCount(0);
      return;
    }
    let cancelled = false;
    const fetchUnreadCount = () => {
      api.get("/chat/unread-count")
        .then((res) => { if (!cancelled) setUnreadChatCount(res.data.count); })
        .catch(() => {});
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loggedIn]);

  // 소켓으로 메시지가 도착하면 2초 폴링을 기다리지 않고 뱃지 숫자를 즉시 다시 불러온다.
  const chatSocketToken = loggedIn ? localStorage.getItem("token") : null;
  const chatSocket = useSocket(chatSocketToken);
  useEffect(() => {
    if (!chatSocket) return;
    const handleReceiveMessage = () => {
      api.get("/chat/unread-count")
        .then((res) => setUnreadChatCount(res.data.count))
        .catch(() => {});
    };
    chatSocket.on("receive_message", handleReceiveMessage);
    return () => {
      chatSocket.off("receive_message", handleReceiveMessage);
    };
  }, [chatSocket]);
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
      <div className="flex-1 overflow-y-auto mt-7 no-scrollbar">
        <LoginScreen
          onLogin={() => {
            setNickname(getCurrentUser()?.nickname ?? "");
            setLoggedIn(true);
          }}
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
  isActive={activeTab === "community" || activeTab === "chat"}
  onViewOwnProfile={openOwnProfileFromCommunity}
  openWriteSignal={writeSignal}
  navSignal={navSignal}
  onDetailViewChange={setCommunityDetailOpen}
/>
        </div>

        {/* 프로필/설정은 위에 덮어씌우는 방식으로 렌더링 */}
        {activeTab === "profile" && (
          <div
            className="absolute inset-0 overflow-hidden flex flex-col"
            style={{ background: "var(--background)" }}
          >
            <ProfileScreen
              nickname={nickname}
              setNickname={setNickname}
              onBack={
                profileFromCommunity
                  ? () => {
                      setProfileFromCommunity(false);
                      setActiveTab("community");
                    }
                  : undefined
              }
            />
          </div>
        )}
        {activeTab === "lunch" && (
          <div
            className="absolute inset-0 overflow-hidden flex flex-col"
            style={{ background: "var(--background)" }}
          >
            <LunchScreen onBack={() => setActiveTab("community")} />
          </div>
        )}
        {activeTab === "settings" && (
          <div
            className="absolute inset-0 overflow-hidden flex flex-col"
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
            />
          </div>
        )}

        {/* 메뉴 돌림판(FAB): 커뮤니티 메인 화면에서만 보이고, 다른 탭/채팅/게시물 상세에서는 숨긴다 */}
        {activeTab === "community" && !showChatPanel && !communityDetailOpen && (
          <div className="absolute bottom-3 right-3 z-40 flex flex-col items-end gap-3">
            {showFabMenu && (
              <button
                onClick={() => {
                  setShowFabMenu(false);
                  handleTabChange("lunch");
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  background: "var(--primary)",
                  animation: "fab-pop 0.18s ease-out",
                }}
                aria-label="점심메뉴 추천 룰렛"
              >
                <Utensils size={20} color="white" />
              </button>
            )}
            <button
              onClick={() => setShowFabMenu((v) => !v)}
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200"
              style={{
                background: "var(--primary)",
                transform: showFabMenu ? "rotate(135deg)" : "rotate(0deg)",
              }}
              aria-label="메뉴 열기"
            >
              <Plus size={24} color="white" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav
        active={activeTab}
        onChange={handleTabChange}
        unreadChatCount={unreadChatCount}
        onWriteClick={handleWriteClick}
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