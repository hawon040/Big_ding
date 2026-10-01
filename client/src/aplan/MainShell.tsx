import { useEffect, useState, type ReactNode } from "react";
import api from "@/api";
import { meApi, notificationApi } from "@/api/aplan";
import type { ChatTarget, GroupChat } from "@/api/chat";
import { BottomTabBar, type MainTab } from "@/aplan/components/BottomTabBar";
import { HomeScreen } from "@/aplan/screens/HomeScreen";
import { CommunityScreen } from "@/aplan/screens/CommunityScreen";
import { SearchScreen } from "@/aplan/screens/SearchScreen";
import { MyScreen } from "@/aplan/screens/MyScreen";
import { NotificationScreen } from "@/aplan/screens/NotificationScreen";
import { PostDetailScreen } from "@/aplan/screens/PostDetailScreen";
import { WriteScreen } from "@/aplan/screens/WriteScreen";
import { SettingsScreen } from "@/aplan/screens/SettingsScreen";
import { OnboardingScreen } from "@/aplan/screens/OnboardingScreen";
import { ProfileScreen } from "@/aplan/screens/ProfileScreen";
import { FeedWriteScreen } from "@/aplan/screens/FeedWriteScreen";
import { FeedDetailScreen } from "@/aplan/screens/FeedDetailScreen";
import { ChatListScreen } from "@/aplan/screens/ChatListScreen";
import { ChatRoomScreen } from "@/aplan/screens/ChatRoomScreen";
import { GroupChatPickerScreen } from "@/aplan/screens/GroupChatPickerScreen";
import { EmptyState } from "@/aplan/components/States";
import type { BoardKey } from "@/constants/boards";
import type { TopicKey } from "@/constants/topics";
import "@/styles/aplan-tokens.css";

type WriteTarget = { mode: "create"; board: BoardKey | null } | { mode: "edit"; postId: string };

// 채팅은 탭 위에 쌓이는 화면: 목록 → 대화방 / 단체 만들기 / 친구 초대
type ChatView =
  | { view: "list" }
  | { view: "room"; target: ChatTarget }
  | { view: "create" }
  | { view: "invite"; chat: GroupChat };

const UNREAD_POLL_MS = 30_000;

interface MainShellProps {
  initialTab?: MainTab;
}

// A안 메인 화면 틀: 탭별 화면 + 하단 탭바(홈·검색·커뮤니티·알림·MY).
// 미읽음 알림·메시지 수는 탭 진입 시와 30초 간격으로 새로 불러온다(실시간 푸시는 범위 밖).
export function MainShell({ initialTab = "home" }: MainShellProps) {
  const [tab, setTab] = useState<MainTab>(initialTab);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // 탭 위에 쌓이는 상세 화면(A-09). null이면 탭 콘텐츠를 그대로 보여준다.
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  // 상세 위에 또 쌓이는 글쓰기/수정 화면
  const [writeTarget, setWriteTarget] = useState<WriteTarget | null>(null);
  // 홈 피드(사진 필수 게시물): 올리기 / 상세(댓글)
  const [feedWriting, setFeedWriting] = useState(false);
  const [openFeedId, setOpenFeedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatView, setChatView] = useState<ChatView | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  // 온보딩(edit 모드) 재진입 — 여는 시점의 관심 분야를 들고 있는다
  const [editingInterests, setEditingInterests] = useState<TopicKey[] | null>(null);
  // 프로필 위에서 다른 글을 열면(openPost) 프로필을 닫는다 — 실제 내비게이션 스택이 없어서
  // 열려 있는 화면이 openUserId > openPostId 우선순위로만 하나 쌓이기 때문
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const openPost = (id: string) => {
    setOpenUserId(null);
    setOpenFeedId(null);
    setOpenPostId(id);
  };
  const openUser = (id: string) => setOpenUserId(id);

  // 채팅 화면은 내 id가 있어야 말풍선 좌우를 정할 수 있어서, 처음 채팅을 열 때 한 번 불러온다.
  useEffect(() => {
    if (chatView && !myId) meApi.get().then((me) => setMyId(me.id)).catch(() => setChatView(null));
  }, [chatView, myId]);

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
  }, [tab, chatView]);

  let content: ReactNode;
  switch (tab) {
    case "home":
      content = (
        <HomeScreen
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          onOpenFeed={setOpenFeedId}
          onOpenUser={openUser}
          onWriteFeed={() => setFeedWriting(true)}
          onOpenMessages={() => setChatView({ view: "list" })}
          onOpenNotifications={() => setTab("notifications")}
        />
      );
      break;
    case "community":
      content = (
        <CommunityScreen
          onOpenPost={openPost}
          onOpenSearch={() => setTab("search")}
          onWrite={(board) => setWriteTarget({ mode: "create", board })}
        />
      );
      break;
    case "search":
      content = (
        <SearchScreen onOpenPost={openPost} onOpenUser={openUser} />
      );
      break;
    case "my":
      content = (
        <MyScreen
          onOpenPost={openPost}
          onEditProfile={() => {
            /* 프로필 수정 화면 구현 후 연결 */
          }}
          onEditInterests={setEditingInterests}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      );
      break;
    case "notifications":
      content = (
        <NotificationScreen onOpenPost={openPost} onOpenFeed={setOpenFeedId} onOpenUser={openUser} />
      );
      break;
    default:
      // 도달할 일 없음: 모든 탭 구현됨 (타입 좁히기용 안전망)
      content = (
        <main className="flex flex-1 items-center justify-center px-[20px]">
          <EmptyState title="준비 중인 화면이에요" />
        </main>
      );
  }

  if (feedWriting) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <FeedWriteScreen onBack={() => setFeedWriting(false)} onDone={() => setFeedWriting(false)} />
      </div>
    );
  }

  if (writeTarget) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <WriteScreen
          initialBoard={writeTarget.mode === "create" ? writeTarget.board : undefined}
          editPostId={writeTarget.mode === "edit" ? writeTarget.postId : undefined}
          onBack={() => setWriteTarget(null)}
          onDone={(postId) => {
            setWriteTarget(null);
            setOpenPostId(postId);
          }}
        />
      </div>
    );
  }

  if (openUserId) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <ProfileScreen userId={openUserId} onBack={() => setOpenUserId(null)} onOpenPost={openPost} />
      </div>
    );
  }

  if (openFeedId) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <FeedDetailScreen feedId={openFeedId} onBack={() => setOpenFeedId(null)} onOpenUser={openUser} />
      </div>
    );
  }

  if (openPostId) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <PostDetailScreen
          postId={openPostId}
          onBack={() => setOpenPostId(null)}
          onOpenUser={openUser}
          onEditPost={(id) => setWriteTarget({ mode: "edit", postId: id })}
        />
      </div>
    );
  }

  if (chatView) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        {!myId ? null : chatView.view === "list" ? (
          <ChatListScreen
            myId={myId}
            onBack={() => setChatView(null)}
            onOpenRoom={(target) => setChatView({ view: "room", target })}
            onCreateGroup={() => setChatView({ view: "create" })}
          />
        ) : chatView.view === "room" ? (
          <ChatRoomScreen
            key={chatView.target.kind === "direct" ? chatView.target.user._id : chatView.target.chat._id}
            myId={myId}
            target={chatView.target}
            onBack={() => setChatView({ view: "list" })}
            onOpenUser={openUser}
            onInvite={(chat) => setChatView({ view: "invite", chat })}
          />
        ) : (
          <GroupChatPickerScreen
            mode={chatView.view === "invite" ? { kind: "invite", chat: chatView.chat } : { kind: "create" }}
            onBack={() => setChatView(chatView.view === "invite" ? { view: "room", target: { kind: "group", chat: chatView.chat } } : { view: "list" })}
            onCreated={(target) => setChatView({ view: "room", target })}
            onInvited={(chat) => setChatView({ view: "room", target: { kind: "group", chat } })}
          />
        )}
      </div>
    );
  }

  if (settingsOpen) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <SettingsScreen onBack={() => setSettingsOpen(false)} />
      </div>
    );
  }

  if (editingInterests) {
    return (
      <OnboardingScreen
        mode="edit"
        initialInterests={editingInterests}
        onBack={() => setEditingInterests(null)}
        onDone={() => setEditingInterests(null)}
      />
    );
  }

  return (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      {content}
      <BottomTabBar active={tab} onChange={setTab} unreadNotifications={unreadNotifications} />
    </div>
  );
}
