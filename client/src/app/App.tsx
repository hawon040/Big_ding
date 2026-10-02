import { useState, useEffect } from "react";
import { LoginScreen } from "@/aplan/screens/LoginScreen";
import { FindPasswordScreen } from "@/aplan/screens/FindPasswordScreen";
import { MainShell } from "@/aplan/MainShell";
import { RegisterScreen } from "@/aplan/screens/RegisterScreen";
import { alertDialog, confirmDialog } from "@/aplan/components/Dialog";
import "@/styles/tokens.css";
import { SplashScreen } from "@/aplan/screens/SplashScreen";
import { OnboardingScreen } from "@/aplan/screens/OnboardingScreen";
import { meApi } from "@/api/aplan";
import type { Me } from "@/types/aplan";

const SPLASH_MIN_MS = 1000;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  // 로그인 전 화면: 로그인(A-02) / 비밀번호 찾기 / 회원가입
  const [authView, setAuthView] = useState<"login" | "findPassword" | "register">("login");

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

  // 로그인 화면의 "회원가입" → 개인정보 수집 동의(공용 확인 창) → 회원가입 화면
  const openRegister = async () => {
    const agreed = await confirmDialog({
      title: "개인정보 수집 동의",
      message: "이름, 학번, 전화번호에 대한 개인 정보 수집 및 이용에 동의하시겠습니까?",
      confirmText: "동의",
    });
    if (agreed) setAuthView("register");
  };

  if (booting) return <SplashScreen />;

  // 관심 분야 온보딩 (A-03) — 기존 사용자도 온보딩을 마치지 않았으면 로그인 후 여기로 온다.
  if (loggedIn && needsOnboarding) {
    return <OnboardingScreen onDone={() => setNeedsOnboarding(false)} />;
  }

  // 로그인 (A-02) / 비밀번호 찾기 / 회원가입 — 모두 A안 화면이라 폰 목업 프레임 없이 그린다.
  if (!loggedIn) {
    return (
      <div className="relative min-h-dvh">
        {authView === "register" ? (
          <RegisterScreen onBack={() => setAuthView("login")} onDone={() => setAuthView("login")} />
        ) : authView === "findPassword" ? (
          <FindPasswordScreen
            onBack={() => setAuthView("login")}
            onDone={(message) => {
              setAuthView("login");
              alertDialog(message);
            }}
          />
        ) : (
          <LoginScreen
            onLogin={async () => {
              const me = await meApi.get().catch(() => null);
              setNeedsOnboarding(!!me && !me.onboardingCompleted);
              setLoggedIn(true);
            }}
            onRegister={openRegister}
            onFindPassword={() => setAuthView("findPassword")}
          />
        )}
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