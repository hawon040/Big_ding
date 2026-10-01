import { useState, useEffect } from "react";
import { LoginScreen } from "@/aplan/screens/LoginScreen";
import { FindPasswordScreen } from "@/aplan/screens/FindPasswordScreen";
import { MainShell } from "@/aplan/MainShell";
import { PasswordChangeScreen } from "./components/PasswordChangeScreen";
import "@/styles/tokens.css";
import { Modal } from "@/components/ui/Modal";
import { SplashScreen } from "@/aplan/screens/SplashScreen";
import { OnboardingScreen } from "@/aplan/screens/OnboardingScreen";
import { meApi } from "@/api/aplan";
import type { Me } from "@/types/aplan";

const SPLASH_MIN_MS = 1000;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false); // 회원가입 화면
  const [showConsentModal, setShowConsentModal] = useState(false); // 개인정보 동의 팝업
  const [authView, setAuthView] = useState<"login" | "findPassword">("login");
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // 앱 시작: 스플래시(A-01)를 최소 1초 보여주면서 토큰을 확인한다 → 자동 로그인
  const [booting, setBooting] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem("token");
    const autoLogin = localStorage.getItem("autoLogin");
    const minDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
    let check: Promise<Me | null>;
    if (token && autoLogin === "true") {
      // 토큰이 아직 유효한지 서버에 확인한다 (만료됐으면 api 인터셉터가 로그아웃 처리)
      check = meApi.get().catch(() => null);
    } else {
      // 자동 로그인을 선택하지 않았다면 이전 토큰은 정리
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      check = Promise.resolve(null);
    }
    let cancelled = false;
    Promise.all([check, minDelay]).then(([me]) => {
      if (cancelled) return;
      // 미로그인 → 로그인(A-02) / 온보딩 미완료 → 온보딩(A-03) / 완료 → 메인
      setLoggedIn(!!me);
      setNeedsOnboarding(!!me && !me.onboardingCompleted);
      setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 개인정보 수집 동의 팝업 (로그인 화면의 "회원가입" → 동의 → 회원가입 화면)
  const consentModal = (
    <Modal
      open={showConsentModal}
      title="개인정보 수집 동의"
      onClose={() => setShowConsentModal(false)}
      cancelText="취소"
      onCancel={() => setShowConsentModal(false)}
      confirmText="확인"
      onConfirm={() => {
        setShowConsentModal(false);
        setShowRegister(true);
      }}
    >
      이름, 학번, 전화번호에 대한 개인 정보 수집 및 이용에 동의하시겠습니까?
    </Modal>
  );

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
          background: "var(--bg-base)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-50"
          style={{ width: "126px", height: "30px", background: "#05070f", borderRadius: "0 0 20px 20px" }}
        />
        {children}
        {consentModal}
      </div>
    </div>
  );

  if (booting) return <SplashScreen />;

  // 관심 분야 온보딩 (A-03) — 기존 사용자도 온보딩을 마치지 않았으면 로그인 후 여기로 온다.
  if (loggedIn && needsOnboarding) {
    return <OnboardingScreen onDone={() => setNeedsOnboarding(false)} />;
  }

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

  // 로그인 (A-02) / 비밀번호 찾기 — A안 화면이라 폰 목업 프레임 없이 그린다.
  if (!loggedIn) {
    return (
      <div className="relative min-h-dvh">
        {authView === "findPassword" ? (
          <FindPasswordScreen
            onBack={() => setAuthView("login")}
            onDone={(message) => {
              setAuthView("login");
              setAuthNotice(message);
            }}
          />
        ) : (
          <LoginScreen
            onLogin={async () => {
              const me = await meApi.get().catch(() => null);
              setNeedsOnboarding(!!me && !me.onboardingCompleted);
              setLoggedIn(true);
            }}
            onRegister={() => setShowConsentModal(true)}
            onFindPassword={() => setAuthView("findPassword")}
          />
        )}
        <Modal
          open={!!authNotice}
          title="알림"
          onClose={() => setAuthNotice(null)}
          confirmText="확인"
          onConfirm={() => setAuthNotice(null)}
        >
          {authNotice}
        </Modal>
        {consentModal}
      </div>
    );
  }

  // 메인 화면(A안): 하단 5탭(홈·검색·커뮤니티·알림·MY)과 채팅은 MainShell이 전부 그린다.
  return (
    <div className="relative min-h-dvh">
      <MainShell />
    </div>
  );
}
