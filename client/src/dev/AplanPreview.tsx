// 개발 전용: /__aplan/<화면> 경로로 A안 화면을 단독 렌더링한다 (Figma 비교 스크린샷용).
// main.tsx에서 import.meta.env.DEV일 때만 동적으로 불러오므로 배포 번들에는 포함되지 않는다.
import type { ReactElement } from "react";
import { SplashScreen } from "@/aplan/screens/SplashScreen";
import { LoginScreen } from "@/aplan/screens/LoginScreen";
import { FindPasswordScreen } from "@/aplan/screens/FindPasswordScreen";

const noop = () => {};

const SCREENS: Record<string, () => ReactElement> = {
  "a01-splash": () => <SplashScreen />,
  "a02-login": () => <LoginScreen onLogin={noop} onRegister={noop} onFindPassword={noop} />,
  "a02-find-password": () => <FindPasswordScreen onBack={noop} onDone={noop} />,
};

export default function AplanPreview({ name }: { name: string }) {
  const Screen = SCREENS[name];
  if (!Screen) {
    return <p style={{ padding: 16 }}>알 수 없는 화면: {name} (가능: {Object.keys(SCREENS).join(", ")})</p>;
  }
  return <Screen />;
}
