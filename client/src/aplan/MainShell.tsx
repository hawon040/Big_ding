import { useEffect, useState, type ReactNode } from "react";
import api from "@/api";
import { notificationApi } from "@/api/aplan";
import { BottomTabBar, type MainTab } from "@/aplan/components/BottomTabBar";
import { HomeScreen } from "@/aplan/screens/HomeScreen";
import { EmptyState } from "@/aplan/components/States";
import "@/styles/aplan-tokens.css";

const UNREAD_POLL_MS = 30_000;

interface MainShellProps {
  initialTab?: MainTab;
  /** 아직 A안으로 옮기지 않은 화면(메시지 등)으로 이동할 때 호출 */
  onOpenLegacy?: (target: "messages") => void;
}

// A안 메인 화면 틀: 탭별 화면 + 하단 탭바(홈·검색·커뮤니티·알림·MY).
// 미읽음 알림·메시지 수는 탭 진입 시와 30초 간격으로 새로 불러온다(실시간 푸시는 범위 밖).
export function MainShell({ initialTab = "home", onOpenLegacy }: MainShellProps) {
  const [tab, setTab] = useState<MainTab>(initialTab);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      notificationApi.unreadCount().then((n) => !cancelled && setUnreadNotifications(n)).catch(() => {});
      api.get<{ count: number }>("/chat/unread-count").then((r) => !cancelled && setUnreadMessages(r.data.count)).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tab]);

  let content: ReactNode;
  switch (tab) {
    case "home":
      content = (
        <HomeScreen
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          onOpenPost={() => {
            /* A-09 상세 구현 후 연결 */
          }}
          onOpenMessages={() => onOpenLegacy?.("messages")}
          onOpenNotifications={() => setTab("notifications")}
          onMore={() => setTab("community")}
        />
      );
      break;
    default:
      // 아직 구현 전인 탭 (A-05 검색, A-06 커뮤니티, 알림, A-07 MY)
      content = (
        <main className="flex flex-1 items-center justify-center px-[20px]">
          <EmptyState title="준비 중인 화면이에요" />
        </main>
      );
  }

  return (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      {content}
      <BottomTabBar active={tab} onChange={setTab} unreadNotifications={unreadNotifications} />
    </div>
  );
}
