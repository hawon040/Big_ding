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
import { FollowListScreen, type FollowTab } from "@/aplan/screens/FollowListScreen";
import { EditProfileScreen } from "@/aplan/screens/EditProfileScreen";
import { EmptyState } from "@/aplan/components/States";
import type { BoardKey } from "@/constants/boards";
import "@/styles/aplan-tokens.css";

type WriteTarget = { mode: "create"; board: BoardKey | null } | { mode: "edit"; postId: string };

// 채팅은 탭 위에 쌓이는 화면: 목록 → 대화방 / 단체 만들기 / 친구 초대
type ChatView =
  | { view: "list" }
  | { view: "room"; target: ChatTarget }
  | { view: "create" }
  | { view: "invite"; chat: GroupChat };

// 프로필 쪽 화면은 서로 타고 들어갈 수 있어서(프로필 → 팔로워 목록 → 다른 프로필 → 피드 …) 스택으로 쌓고
// 뒤로 가기는 하나씩 꺼낸다. 맨 위 화면만 그린다.
type StackView =
  | { view: "user"; userId: string }
  | { view: "follows"; userId: string; tab: FollowTab }
  | { view: "feed"; feedId: string };

const UNREAD_POLL_MS = 30_000;

interface MainShellProps {
  initialTab?: MainTab;
}

// A안 메인 화면 틀: 탭별 화면 + 하단 탭바(홈·검색·커뮤니티·알림·MY).
// 미읽음 알림·메시지 수는 탭 진입 시와 30초 간격으로 새로 불러온다(실시간 푸시는 범위 밖).
export function MainShell({ initialTab = "home" }: MainShellProps) {
  // 알림은 탭이 아니라 홈 알림 버튼으로 여는 화면이다 (개발 미리보기의 initialTab="notifications"도 이쪽으로 연다)
  const [tab, setTab] = useState<MainTab>(initialTab === "notifications" ? "home" : initialTab);
  const [notificationsOpen, setNotificationsOpen] = useState(initialTab === "notifications");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // 탭 위에 쌓이는 상세 화면(A-09). null이면 탭 콘텐츠를 그대로 보여준다.
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  // 상세 위에 또 쌓이는 글쓰기/수정 화면
  const [writeTarget, setWriteTarget] = useState<WriteTarget | null>(null);
  // 홈 피드(사진 필수 게시물) 올리기
  const [feedWriting, setFeedWriting] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 설정 > 공지사항: 커뮤니티의 "공지사항"(event) 게시판을 설정 위에 쌓아서 보여준다
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [chatView, setChatView] = useState<ChatView | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  // 프로필·팔로우 목록·피드 상세 스택. 커뮤니티 글(openPost)을 열면 스택을 비운다 —
  // 글 상세는 스택 아래에 그려져서, 스택이 남아 있으면 글이 가려지기 때문
  const [stack, setStack] = useState<StackView[]>([]);
  const push = (v: StackView) => setStack((s) => [...s, v]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const openPost = (id: string) => {
    setStack([]);
    setOpenPostId(id);
  };
  const openUser = (userId: string) => push({ view: "user", userId });
  const openFeed = (feedId: string) => push({ view: "feed", feedId });
  const openFollows = (userId: string, tab: FollowTab) => push({ view: "follows", userId, tab });
  const top = stack[stack.length - 1];

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
  }, [tab, chatView, notificationsOpen]);

  let content: ReactNode;
  switch (tab) {
    case "home":
      content = (
        <HomeScreen
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          onOpenFeed={openFeed}
          onOpenUser={openUser}
          onWriteFeed={() => setFeedWriting(true)}
          onOpenMessages={() => setChatView({ view: "list" })}
          onOpenNotifications={() => setNotificationsOpen(true)}
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
          onOpenFeed={openFeed}
          onEditProfile={() => setEditingProfile(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenFollows={openFollows}
        />
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
            const wasEditing = writeTarget.mode === "edit";
            setWriteTarget(null);
            if (wasEditing) setOpenPostId(postId);
            else {
              setTab("community");
              setOpenPostId(null);
            }
          }}
        />
      </div>
    );
  }

  if (editingProfile) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <EditProfileScreen onBack={() => setEditingProfile(false)} onDone={() => setEditingProfile(false)} />
      </div>
    );
  }

  if (top) {
    // key: 같은 종류 화면이 연달아 쌓여도(프로필 → 다른 프로필) 새로 마운트되게
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        {top.view === "user" ? (
          <ProfileScreen
            key={`user-${stack.length}-${top.userId}`}
            userId={top.userId}
            onBack={pop}
            onOpenPost={openPost}
            onOpenFeed={openFeed}
            onOpenFollows={openFollows}
          />
        ) : top.view === "follows" ? (
          <FollowListScreen
            key={`follows-${stack.length}-${top.userId}`}
            userId={top.userId}
            initialTab={top.tab}
            onBack={pop}
            onOpenUser={openUser}
          />
        ) : (
          <FeedDetailScreen key={`feed-${stack.length}-${top.feedId}`} feedId={top.feedId} onBack={pop} onOpenUser={openUser} />
        )}
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

  if (announcementsOpen) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <CommunityScreen
          initialBoard="event"
          onBack={() => setAnnouncementsOpen(false)}
          onOpenPost={openPost}
          onOpenSearch={() => {
            setAnnouncementsOpen(false);
            setSettingsOpen(false);
            setTab("search");
          }}
          onWrite={(board) => setWriteTarget({ mode: "create", board })}
        />
      </div>
    );
  }

  if (settingsOpen) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <SettingsScreen onBack={() => setSettingsOpen(false)} onOpenAnnouncements={() => setAnnouncementsOpen(true)} />
      </div>
    );
  }

  if (notificationsOpen) {
    return (
      <div className="a-screen flex h-dvh flex-col overflow-hidden">
        <NotificationScreen onBack={() => setNotificationsOpen(false)} onOpenPost={openPost} onOpenFeed={openFeed} onOpenUser={openUser} />
      </div>
    );
  }

  return (
    <div className="a-screen flex h-dvh flex-col overflow-hidden">
      {content}
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
