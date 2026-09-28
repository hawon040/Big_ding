// 개발 전용: /__aplan/<화면> 경로로 A안 화면을 단독 렌더링한다 (Figma 비교 스크린샷용).
// main.tsx에서 import.meta.env.DEV일 때만 동적으로 불러오므로 배포 번들에는 포함되지 않는다.
import type { ReactElement } from "react";
import { SplashScreen } from "@/aplan/screens/SplashScreen";
import { LoginScreen } from "@/aplan/screens/LoginScreen";
import { FindPasswordScreen } from "@/aplan/screens/FindPasswordScreen";
import { OnboardingScreen } from "@/aplan/screens/OnboardingScreen";
import { PostDetailScreen } from "@/aplan/screens/PostDetailScreen";
import { SettingsScreen } from "@/aplan/screens/SettingsScreen";
import { ProfileScreen } from "@/aplan/screens/ProfileScreen";
import { MainShell } from "@/aplan/MainShell";
import api from "@/api";
import { fixtureAdapter } from "./aplanFixtures";

// 미리보기에서는 서버 대신 가짜 응답을 쓴다 (Figma와 같은 예시 데이터)
api.defaults.adapter = fixtureAdapter;

const noop = () => {};

const SCREENS: Record<string, () => ReactElement> = {
  "a01-splash": () => <SplashScreen />,
  "a02-login": () => <LoginScreen onLogin={noop} onRegister={noop} onFindPassword={noop} />,
  "a02-find-password": () => <FindPasswordScreen onBack={noop} onDone={noop} />,
  "a03-onboarding": () => <OnboardingScreen initialInterests={["python", "sql", "ml", "dataviz"]} onDone={noop} />,
  "a03-onboarding-edit": () => <OnboardingScreen mode="edit" initialInterests={["python", "sql"]} onDone={noop} onBack={noop} />,
  "a04-home": () => <MainShell />,
  "a05-search": () => <MainShell initialTab="search" />,
  "a06-community": () => <MainShell initialTab="community" />,
  "a07-my": () => <MainShell initialTab="my" />,
  "a09-detail": () => (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      <PostDetailScreen postId="p1" onBack={noop} onOpenUser={noop} />
    </div>
  ),
  "a08-settings": () => (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      <SettingsScreen onBack={noop} />
    </div>
  ),
  "profile": () => (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      <ProfileScreen userId="u2" onBack={noop} onOpenPost={noop} />
    </div>
  ),
  // Figma 번호 없음 (Figma의 A-08은 설정 화면)
  "notifications": () => <MainShell initialTab="notifications" />,
};

export default function AplanPreview({ name }: { name: string }) {
  const Screen = SCREENS[name];
  if (!Screen) {
    return <p style={{ padding: 16 }}>알 수 없는 화면: {name} (가능: {Object.keys(SCREENS).join(", ")})</p>;
  }
  return <Screen />;
}
