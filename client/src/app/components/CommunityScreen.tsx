import { useState, useEffect, useLayoutEffect, useRef } from "react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import defaultAvatar from "@/assets/default-avatar.svg";
import api, { resolveAssetUrl } from "@/api";
import { useSocket } from "@/hooks/useSocket";
import {
  Heart, MessageCircle, Bookmark, Image, Plus, X, ThumbsDown,
  Search, Star, Send, UserPlus, ChevronDown, ChevronUp, FileText,
  Users, Trophy, Megaphone, BookOpen, Coffee, MoreVertical, MoreHorizontal, Repeat2, Edit2, Trash2, AlertTriangle, Bell, Lock,
  Settings, Camera, LogOut, ChevronRight, Images, Ban, MessageSquareOff
} from "lucide-react";

export type BoardType = "free" | "qna" | "contest" | "event" | "lecture" | "meeting" | "alumni";
// "행사공지" 게시판은 관리자(User.isAdmin) 또는 행사공지 작성 권한(User.canPostEvents)을
// 부여받은 계정만 글을 작성할 수 있다. 서버(POST /api/posts)에서도 검증한다.

// 글쓰기 모달에서 한 게시물에 첨부할 수 있는 사진 최대 개수.
const MAX_POST_IMAGES = 5;

// 좋아요/신고/차단/건의 등 계정별 데이터가 다른 계정으로 로그인해도 섞이지 않도록,
// localStorage 키에 현재 로그인한 학번을 붙여 계정별로 분리해서 저장한다.
export const getCurrentStudentId = (): string => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "guest";
    const user = JSON.parse(raw);
    return user?.studentId || "guest";
  } catch {
    return "guest";
  }
};

export const scopedKey = (base: string): string => `${base}::${getCurrentStudentId()}`;

export interface CurrentUser {
  _id: string;
  nickname: string;
  avatar?: string;
  studentId: string;
  professor?: string;
  isPrivate?: boolean;
  followers?: string[];
  following?: string[];
  isAdmin?: boolean;
  canPostEvents?: boolean;
}

// 로그인 시 서버에서 받아 localStorage에 저장해 둔 사용자 정보를 그대로 "현재 로그인한 나"로 사용한다.
export const getCurrentUser = (): CurrentUser | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user?._id) return null;
    return {
  _id: user._id,
  nickname: user.nickname,
  avatar: user.avatar,
  studentId: user.studentId,
  professor: user.professor,
  isPrivate: user.isPrivate,
  followers: user.followers,
  following: user.following,
  isAdmin: user.isAdmin,
  canPostEvents: user.canPostEvents,
};
  } catch {
    return null;
  }
};

// 닉네임/아바타를 서버에 저장한 뒤, 다음에 getCurrentUser()를 호출할 때도
// (새로고침 없이) 최신 값을 돌려주도록 localStorage에 캐시된 "user"도 함께 갱신한다.
export const updateStoredUser = (updates: Partial<CurrentUser>) => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const user = JSON.parse(raw);
    localStorage.setItem("user", JSON.stringify({ ...user, ...updates }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

// "N분 전" / "N시간 전" / "N일 전" / "방금 전" 문자열을,
// 게시물이 실제로 만들어진 시각(createdAt)과 현재 시각(now)의 차이로부터 계산한다.
// 24시간이 지난 게시물의 날짜를 "M월 D일" 형식으로 표시한다.
const formatPostDate = (createdAt: string): string => {
  const date = new Date(createdAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
};

// "N분 전" / "N시간 전" / "방금 전"까지는 상대 시간으로, 24시간(하루)이 지나면
// "N일 전" 대신 실제 날짜(예: "7월 5일")로 표시한다.
export const getDisplayTime = (item: { createdAt: string }, now: number = Date.now()): string => {
  const created = new Date(item.createdAt).getTime();
  const diffMinutes = Math.max(0, Math.floor((now - created) / 60000));
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return formatPostDate(item.createdAt);
};

// 24시간 이내면 전송 시각을 "HH:MM"으로, 24시간이 지나면 실제 날짜("7월 5일")로 표시한다.
const formatMessageTime = (createdAt: string, now: number = Date.now()): string => {
  const created = new Date(createdAt).getTime();
  const diffHours = (now - created) / (1000 * 60 * 60);
  if (diffHours < 24) {
    return new Date(createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return formatPostDate(createdAt);
};

// 채팅창 가운데 시간 구분선(인스타처럼 "오늘 오후 2:14" / "어제 오후 2:14" / "7월 5일 오후 2:14")
const formatDividerTime = (createdAt: string): string => {
  const created = new Date(createdAt);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = created.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(created, now)) return `오늘 ${time}`;
  if (isSameDay(created, yesterday)) return `어제 ${time}`;
  return `${formatPostDate(createdAt)} ${time}`;
};

export interface PostAuthor {
  _id: string;
  nickname: string;
  avatar?: string;
  studentId?: string;
}

export interface PostComment {
  _id: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
  parentComment?: string | null;
}

export interface PollOption {
  text: string;
  votes: string[]; // 투표한 사용자 id 목록
}

export interface Poll {
  question: string;
  options: PollOption[];
}

export interface Post {
  _id: string;
  author: PostAuthor;
  title: string;
  content: string;
  likes: string[];
  dislikes: string[];
  comments: PostComment[];
  images: string[];
  tags?: string[];
  rating?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  participants?: string[];
  scraps?: string[];
  price?: number;
  board: BoardType;
  poll?: Poll;
  createdAt: string;
}

export interface Friend {
  _id: string;
  nickname: string;
  avatar?: string;
  studentId?: string;
  isFollowedByMe?: boolean;
}

export interface FriendRequestItem {
  _id: string;
  from: Friend;
}

export interface GroupMessage {
  _id: string;
  groupChat: string;
  sender: Friend;
  content: string;
  image?: string;
  liked?: boolean;
  type?: "text" | "system";
  createdAt: string;
}

export interface GroupChatSummary {
  _id: string;
  post?: { _id: string; title: string; board: string } | null;
  name?: string;
  avatar?: string;
  host: Friend;
  members: Friend[];
  lastMessage?: GroupMessage | null;
}

export interface ChatPhoto {
  image: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  sender: Friend;
  type: "follow" | "join" | "leave" | "comment" | "like" | "dislike" | "scrap"
      | "adminWarning" | "adminBan" | "adminCommentRestriction";
  post?: { _id: string; title: string; board: string } | null;
  commentContent?: string;
  message?: string;
  until?: string;
  read: boolean;
  createdAt: string;
}

interface Message {
  _id: string;
  content: string;
  image?: string;
  createdAt: string;
  mine: boolean;
  read: boolean;
  liked: boolean;
}

// 텍스트 안의 http(s)://... 또는 www.로 시작하는 부분을 새 탭에서 열리는 하이퍼링크로 바꿔준다.
// 댓글/게시물 내용 등 게시판 종류와 상관없이 텍스트가 표시되는 모든 곳에서 공용으로 쓰인다.
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const URL_TRAILING_PUNCTUATION = /[)\]},.!?"']+$/;
export const renderLinkifiedText = (content: string) =>
  content.split(URL_REGEX).map((part, i) => {
    if (!/^(https?:\/\/|www\.)/i.test(part)) {
      return <span key={i}>{part}</span>;
    }
    const trailingMatch = part.match(URL_TRAILING_PUNCTUATION);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const url = trailing ? part.slice(0, -trailing.length) : part;
    const href = url.startsWith("http") ? url : `https://${url}`;
    return (
      <span key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline break-all"
          style={{ color: "var(--primary)" }}
        >
          {url}
        </a>
        {trailing}
      </span>
    );
  });

const PROFANITY_LIST = ["욕설", "비속어", "씨발", "개새끼", "병신", "지랄", "꺼져", "죽어"];

export const filterProfanity = (text: string) => {
  let filtered = text;
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });
  return filtered;
};

// 좋아요/싫어요/댓글 등 사용자 상호작용을 새로고침해도 유지하기 위한 로컬 저장소 헬퍼
export const STORAGE_KEY = "bigding_community_interactions_v1";
// CommunityScreen은 항상 마운트된 채로 유지되기 때문에(App.tsx에서 display:none으로만 숨김),
// ProfileScreen에서 좋아요/싫어요/스크랩/댓글/삭제를 바꿔도 같은 탭 안에서는 storage 이벤트가
// 발생하지 않아 반영되지 않는다. 커스텀 이벤트로 두 화면이 서로의 변경을 즉시 반영하게 한다.
export const INTERACTIONS_UPDATED_EVENT = "bigding-interactions-updated";
export const REPORTS_STORAGE_KEY = "bigding_report_history_v1";
export const REPORTS_UPDATED_EVENT = "bigding-report-added";

// 프로필 사진: ProfileScreen에서 업로드하면 "나"가 작성한 게시물의 아바타에도
// 즉시 반영되도록(새로고침 없이) CommunityScreen과 공유한다.
// 실제 값은 서버(User.avatar)가 기준이며, 이 이벤트는 같은 세션 안에서
// 이미 렌더된 화면들에 최신 URL을 즉시 알려주는 용도일 뿐이다.
export const AVATAR_UPDATED_EVENT = "bigding-avatar-updated";

export interface ReportHistoryItem {
  id: number;
  type: string;
  target: string;
  status: string;
  date: string;
  postId: string;
  sanction?: string | null;
}

export const loadReportHistory = (): ReportHistoryItem[] => {
  try {
    const raw = localStorage.getItem(scopedKey(REPORTS_STORAGE_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const addReportToHistory = (report: ReportHistoryItem) => {
  try {
    const updated = [report, ...loadReportHistory()];
    localStorage.setItem(scopedKey(REPORTS_STORAGE_KEY), JSON.stringify(updated));
    // 같은 탭 안에서도 설정 화면이 즉시 반영할 수 있도록 커스텀 이벤트 전파
    window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT, { detail: updated }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

export const removeReportFromHistory = (id: number) => {
  try {
    const updated = loadReportHistory().filter((r) => r.id !== id);
    localStorage.setItem(scopedKey(REPORTS_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT, { detail: updated }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

// 댓글 작성자 신고: 하루/게시물 단위가 아니라 "같은 작성자"에 대해 누적 최대 3번까지만 허용한다.
const COMMENT_REPORT_COUNTS_KEY = "bigding_comment_report_counts_v1";
const MAX_COMMENT_REPORTS_PER_AUTHOR = 3;

const loadCommentReportCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(scopedKey(COMMENT_REPORT_COUNTS_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const incrementCommentReportCount = (author: string) => {
  try {
    const counts = loadCommentReportCounts();
    counts[author] = (counts[author] || 0) + 1;
    localStorage.setItem(scopedKey(COMMENT_REPORT_COUNTS_KEY), JSON.stringify(counts));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

export const BLOCKED_STORAGE_KEY = "bigding_blocked_users_v1";
export const BLOCKED_UPDATED_EVENT = "bigding-blocked-updated";

export interface BlockedUserItem {
  id: string; // 차단된 사용자의 실제 _id (서버 차단 해제 호출에 사용)
  name: string;
  reason: string;
  date: string;
}

export const loadBlockedUsers = (): BlockedUserItem[] => {
  try {
    const raw = localStorage.getItem(scopedKey(BLOCKED_STORAGE_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const addBlockedUser = (user: BlockedUserItem) => {
  try {
    const updated = [user, ...loadBlockedUsers()];
    localStorage.setItem(scopedKey(BLOCKED_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(BLOCKED_UPDATED_EVENT, { detail: updated }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

export const removeBlockedUser = (id: string) => {
  try {
    const updated = loadBlockedUsers().filter((u) => u.id !== id);
    localStorage.setItem(scopedKey(BLOCKED_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(BLOCKED_UPDATED_EVENT, { detail: updated }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};
export interface StoredInteractions {
  savedPosts: Record<string, boolean>;
}

export const loadStoredInteractions = (): StoredInteractions => {
  const fallback: StoredInteractions = {
    savedPosts: {},
  };
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
};

export const BOARDS = [
  { id: "free" as BoardType, label: "게시판", emoji: "💬", icon: MessageCircle },
  { id: "event" as BoardType, label: "행사공지", emoji: "📢", icon: Megaphone },
  { id: "qna" as BoardType, label: "선배들 작품 전시 공간", emoji: "🏆", icon: Users },
  { id: "contest" as BoardType, label: "꿀팁 게시판", emoji: "💡", icon: Trophy },
  { id: "lecture" as BoardType, label: "전공 강의평가", emoji: "⭐", icon: BookOpen },
  { id: "meeting" as BoardType, label: "공강모임", emoji: "☕", icon: Coffee },
  { id: "alumni" as BoardType, label: "졸업생 게시판", emoji: "🎓", icon: Users },
];

// 게시판별 포인트 컬러: 피드에서 스크롤만으로 어느 게시판 글인지 구분되도록
// 카드 좌측 컬러바 + 배지에 사용한다. 기존 --primary(블루) 톤과 부딪히지 않는
// 범위에서 게시판별로만 다르게 선택.
export const BOARD_ACCENTS: Record<BoardType, string> = {
  free: "#7dd3fc",     // 하늘색 — 자유게시판
  event: "#f472b6",    // 핑크 — 행사공지
  qna: "#c084fc",      // 보라 — 작품 전시
  contest: "#4ade80",  // 그린 — 꿀팁
  lecture: "#fbbf24",  // 앰버 — 강의평가(별점과 톤 통일)
  meeting: "#fb923c",  // 오렌지 — 공강모임
  alumni: "#94a3b8",   // 슬레이트 — 졸업생
};
const RECENT_SEARCH_KEY = "bigding_recent_search_v1";
const MAX_RECENT_SEARCHES = 10;

const loadRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(scopedKey(RECENT_SEARCH_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecentSearches = (list: string[]) => {
  try {
    localStorage.setItem(scopedKey(RECENT_SEARCH_KEY), JSON.stringify(list));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};

interface CommunityScreenProps {
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
  isActive: boolean;
  onViewOwnProfile: () => void;
  openWriteSignal?: number;
  navSignal?: number;
  // 게시물 상세/작성자 프로필처럼 화면 하단에 고정 입력창(댓글 입력 등)이 있는 화면이
  // 열려 있는지를 부모(App)에 알려준다. 부모는 이 값이 true인 동안 점심메뉴 플로팅
  // 버튼을 숨겨서, 그 버튼이 댓글 입력창 위에 겹쳐 보이는 문제를 막는다.
  onDetailViewChange?: (open: boolean) => void;
}

// 다른 사용자의 프로필 화면. 내 프로필(ProfileScreen)과 동일한 인스타 스타일 레이아웃을 쓰되,
// 상대방이 쓴 댓글 탭은 만들지 않고(내 글/스크랩 2개 탭만), "프로필 편집" 대신 팔로우 버튼을 보여준다.
// 비공개 계정 + 친구가 아니면 글/북마크/팔로워·팔로잉 목록을 자물쇠로 가린다(인스타와 동일).
// CommunityScreen(게시물/댓글 작성자 클릭)과 ProfileScreen(팔로워·팔로잉 목록 클릭) 양쪽에서 공용으로 쓴다.
// 팔로워/팔로잉 목록에서 다른 사람을 또 누르면 이 컴포넌트가 스스로를 재귀 렌더링해 계속 파고들 수 있다.
export function OtherUserProfile({
  author,
  posts,
  currentUserId,
  onBack,
  onOpenPost,
  onMessage,
}: {
  author: PostAuthor;
  posts: Post[];
  currentUserId?: string;
  onBack: () => void;
  onOpenPost: (postId: string) => void;
  onMessage?: (author: PostAuthor) => void;
}) {
  const [tab, setTab] = useState<"posts" | "scrapped">("posts");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [userListModal, setUserListModal] = useState<"followers" | "following" | null>(null);
  const [userList, setUserList] = useState<Friend[]>([]);
  const [userListQuery, setUserListQuery] = useState("");
  const [viewingNestedUser, setViewingNestedUser] = useState<PostAuthor | null>(null);

  // 목록 안에서 바로 팔로우/언팔로우 (인스타처럼)
  const toggleListFollow = async (target: Friend) => {
    const wasFollowing = !!target.isFollowedByMe;
    setUserList((prev) => prev.map((u) => (u._id === target._id ? { ...u, isFollowedByMe: !wasFollowing } : u)));
    try {
      if (wasFollowing) await api.delete(`/users/follow/${target._id}`);
      else await api.post(`/users/follow/${target._id}`);
    } catch {
      setUserList((prev) => prev.map((u) => (u._id === target._id ? { ...u, isFollowedByMe: wasFollowing } : u)));
    }
  };
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchProfileInfo = () => {
      api.get(`/users/${author._id}`)
        .then((res) => {
          if (cancelled) return;
          setFollowerCount(res.data.followerCount);
          setFollowingCount(res.data.followingCount);
          setIsFollowing(res.data.isFollowedByMe);
          setIsPrivate(res.data.isPrivate);
          setIsFriend(res.data.isFriend);
        })
        .catch(() => {});
    };
    fetchProfileInfo();
    const interval = setInterval(fetchProfileInfo, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [author._id]);

  const toggleFollow = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await api.post(`/users/follow/${author._id}`);
      else await api.delete(`/users/follow/${author._id}`);
    } catch {
      setIsFollowing(!next);
      setFollowerCount((c) => c + (next ? -1 : 1));
    }
  };

  const isSelf = currentUserId === author._id;
  const canViewFull = isSelf || !isPrivate || isFriend;

  const openUserList = async (kind: "followers" | "following") => {
    if (!canViewFull) return;
    setUserListModal(kind);
    setUserListQuery("");
    try {
      const res = await api.get(`/users/${author._id}/${kind}`);
      setUserList(res.data);
    } catch {
      setUserList([]);
    }
  };

  const authorPosts = posts.filter((p) => p.author._id === author._id);
  const getBoardLabel = (board?: BoardType) => BOARDS.find((b) => b.id === board)?.label ?? "";

  // 팔로워/팔로잉 목록에서 다른 사람의 프로필로 또 들어간 상태라면, 이 화면을 그대로 재사용해서
  // "프로필 안의 프로필"로 계속 들어갈 수 있게 한다.
  if (viewingNestedUser) {
    return (
      <OtherUserProfile
        author={viewingNestedUser}
        posts={posts}
        currentUserId={currentUserId}
        onBack={() => setViewingNestedUser(null)}
        onOpenPost={onOpenPost}
        onMessage={onMessage}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={onBack} className="text-lg" style={{ color: "var(--foreground)" }}>←</button>
        <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>프로필</h2>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* 프로필 상단 카드: 내 프로필(ProfileScreen)과 동일한 인스타 스타일 구성 */}
        <div className="relative px-4 pt-6 pb-4" style={{ background: "linear-gradient(160deg, #111a30 0%, #0a0f1f 100%)" }}>
          <div className="flex items-start gap-6">
            <button
              onClick={() => setShowAvatarZoom(true)}
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md overflow-hidden shrink-0"
              style={{ background: "var(--accent)", border: "3px solid var(--primary)" }}
            >
              <img src={resolveAssetUrl(author.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
            </button>
            <div className="flex-1 flex flex-col gap-1.5 pt-1">
              <div className="flex items-baseline gap-2">
                <h2 className="font-bold text-base" style={{ color: "var(--foreground)" }}>{author.nickname}</h2>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  #{author.studentId ? author.studentId.slice(2, 4) : "23"}학번
                </span>
                {isPrivate && (
                  <Lock size={12} style={{ color: "var(--muted-foreground)" }} />
                )}
              </div>
              <div className="flex items-center gap-10">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{authorPosts.length}</span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>게시글</span>
                </div>
                <button
                  onClick={() => openUserList("followers")}
                  className="flex flex-col items-center gap-0.5"
                  style={{ cursor: canViewFull ? "pointer" : "default" }}
                >
                  <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{followerCount}</span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>팔로워</span>
                </button>
                <button
                  onClick={() => openUserList("following")}
                  className="flex flex-col items-center gap-0.5"
                  style={{ cursor: canViewFull ? "pointer" : "default" }}
                >
                  <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{followingCount}</span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>팔로잉</span>
                </button>
              </div>
            </div>
          </div>

          {!isSelf && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={toggleFollow}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{
                  background: isFollowing ? "var(--muted)" : "var(--primary)",
                  color: isFollowing ? "var(--foreground)" : "white",
                }}
              >
                {isFollowing ? "팔로잉" : "팔로우"}
              </button>
              <button
                onClick={() => onMessage?.(author)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "var(--muted)", color: "var(--foreground)" }}
              >
                메시지
              </button>
            </div>
          )}
        </div>

        {/* 탭: 다른 사용자의 프로필에서는 댓글 내역을 노출하지 않는다 */}
        <div className="grid grid-cols-2 shrink-0 border-t border-b" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setTab("posts")}
            className="flex items-center justify-center py-3"
            style={{
              borderBottom: tab === "posts" ? "2px solid var(--foreground)" : "2px solid transparent",
              color: tab === "posts" ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => setTab("scrapped")}
            className="flex items-center justify-center py-3"
            style={{
              borderBottom: tab === "scrapped" ? "2px solid var(--foreground)" : "2px solid transparent",
              color: tab === "scrapped" ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <Bookmark size={18} />
          </button>
        </div>

        {!canViewFull ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Lock size={32} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>비공개 계정입니다</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              친구가 되면 게시글과 북마크를 볼 수 있어요.
            </p>
          </div>
        ) : (
          <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
            {tab === "posts" ? (
              authorPosts.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
                  작성한 게시물이 없어요
                </p>
              ) : (
                authorPosts.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => onOpenPost(p._id)}
                    className="p-4 rounded-2xl cursor-pointer"
                    style={{ background: "var(--card)" }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                      {getBoardLabel(p.board)}
                    </p>
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                      {p.title}
                    </h3>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--muted-foreground)" }}>
                      {p.content}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                        <Heart size={12} /> {p.likes.length}
                      </span>
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                        <MessageCircle size={12} /> {p.comments.length}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
                        {getDisplayTime(p)}
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : (
              <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
                스크랩한 게시물이 없어요.
              </p>
            )}
          </div>
        )}
      </div>

{/* 팔로워/팔로잉 목록 */}
{userListModal && (
  <div
    className="absolute inset-0 z-50 flex flex-col pointer-events-auto"
    style={{ background: "var(--background)" }}
  >
    {/* 상단 헤더 */}
    <div
      className="flex items-center gap-3 px-4 py-4 border-b shrink-0 pointer-events-auto"
      style={{ borderColor: "var(--border)" }}
    >
      <button onClick={() => setUserListModal(null)}>
        <X size={20} style={{ color: "var(--foreground)" }} />
      </button>
      <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>
        {userListModal === "followers" ? "팔로워" : "팔로잉"}
      </h2>
    </div>

    {/* 검색창 */}
    {userList.length > 0 && (
      <div className="px-4 pt-3 shrink-0 pointer-events-auto">
        <input
          value={userListQuery}
          onChange={(e) => setUserListQuery(e.target.value)}
          placeholder="검색"
          className="w-full px-3 py-2 rounded-xl text-sm outline-none"
          style={{
            background: "var(--input-background)",
            color: "var(--foreground)",
            border: "1.5px solid var(--border)",
          }}
        />
      </div>
    )}

    {/* 목록 */}
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 no-scrollbar pointer-events-auto">
      {userList.length === 0 ? (
        <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
          {userListModal === "followers"
            ? "아직 팔로워가 없습니다."
            : "아직 팔로잉하는 사람이 없습니다."}
        </p>
      ) : (
        userList
          .filter((u) =>
            !userListQuery.trim() ||
            u.nickname.toLowerCase().includes(userListQuery.trim().toLowerCase()) ||
            u.studentId?.toLowerCase().includes(userListQuery.trim().toLowerCase())
          )
          .map((u) => (
            <div
              key={u._id}
              className="flex items-center gap-3 p-2.5 rounded-xl text-left"
              style={{ background: "var(--card)" }}
            >
              {/* 프로필 클릭 */}
              <button
                onClick={() => {
                  setUserListModal(null);
                  setViewingNestedUser(u);
                  setShowAvatarZoom(true);
                }}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <img
                    src={resolveAssetUrl(u.avatar) || defaultAvatar}
                    alt="프로필 사진"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {u.nickname}
                  </p>
                  {u.studentId && (
                    <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {u.studentId}
                    </p>
                  )}
                </div>
              </button>

              {/* 팔로우 버튼 */}
              {u._id !== currentUserId && (
                <button
                  onClick={() => toggleListFollow(u)}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold shrink-0"
                  style={{
                    background: u.isFollowedByMe ? "var(--muted)" : "var(--primary)",
                    color: u.isFollowedByMe ? "var(--muted-foreground)" : "white",
                  }}
                >
                  {u.isFollowedByMe ? "팔로잉" : "팔로우"}
                </button>
              )}
            </div>
          ))
      )}
    </div>
  </div>
)}


      {/* 프로필 사진 크게 보기 */}
{showAvatarZoom && author && (

        <div
  className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-auto"
 style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setShowAvatarZoom(false)}
        >
          <button
            onClick={() => setShowAvatarZoom(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <X size={20} color="white" />
          </button>
          <div className="w-72 h-72 rounded-full overflow-hidden shadow-2xl" style={{ border: "4px solid var(--primary)" }}>
            <img
              src={resolveAssetUrl(author.avatar) || defaultAvatar}
              alt="프로필 사진 크게 보기"
              className="w-full h-full object-cover"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CommunityScreen({
  showChat,
  setShowChat,
  isActive,
  onViewOwnProfile,
  openWriteSignal,
  navSignal,
  onDetailViewChange,
}: CommunityScreenProps) {
  // 좋아요/싫어요/댓글/스크랩/새 글 등은 로컬 저장소에서 초기값을 불러와
  // 새로고침해도 그대로 유지되도록 한다.
  const [storedInit] = useState(loadStoredInteractions);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const isAdmin = !!currentUser?.isAdmin;
  // 행사공지 작성 권한: 전체 권한을 가진 관리자(isAdmin)이거나, "관리자 관리" 화면에서
  // 행사공지 작성 권한만 별도로 부여받은 계정(canPostEvents). 후자는 다른 관리자 기능은 없다.
  const canPostEvents = isAdmin || !!currentUser?.canPostEvents;

  // 채팅 실시간 수신용 소켓 연결 (로그인 토큰이 있는 동안만 연결된다)
  const [authToken] = useState(() => localStorage.getItem("token"));
  const socket = useSocket(authToken);
  const [activeBoard, setActiveBoard] = useState<BoardType>("free");

  // 꿀팁 게시판(contest) 전용 카테고리 필터
  const CONTEST_FILTERS = ["자격증", "공모전", "학업"] as const;
  const [activeContestFilter, setActiveContestFilter] = useState<string | null>(null);
  const [showContestFilterMenu, setShowContestFilterMenu] = useState(false);
// 모든 게시판 공통: 최신순/인기순 정렬
  const [sortOrder, setSortOrder] = useState<"latest" | "popular">("latest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  // 게시판을 옮길 때마다 필터를 초기화해서, 다른 게시판으로 갔다가 다시 꿀팁 게시판으로
  // 돌아와도 이전에 선택했던 필터가 남아있지 않게 한다.
  useEffect(() => {
    setActiveContestFilter(null);
    setShowContestFilterMenu(false);
  }, [activeBoard]);

  // 게시물 목록은 실제 DB(GET /api/posts)에서 불러온다. ...
  // 바꾼 내용도 새로고침 없이 보이도록, 탭이 활성화된 동안 몇 초마다 다시 불러온다(폴링).
  const [posts, setPostsRaw] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  // 좋아요/댓글/수정 등으로 posts를 직접 바꾼 시각을 기록해둔다. 그 시각 이전에 이미
  // 날아가 있던 폴링 응답이 뒤늦게 도착해서 방금 반영한 변경을 덮어쓰는 걸 막기 위함
  // (그렇지 않으면 게시물 수정 직후 잠깐 옛 내용으로 되돌아가 보일 수 있다).
  const lastLocalMutationRef = useRef(0);
  const setPosts = (updater: React.SetStateAction<Post[]>) => {
    lastLocalMutationRef.current = Date.now();
    setPostsRaw(updater);
  };
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const fetchPosts = (isInitial: boolean) => {
      if (isInitial) setPostsLoading(true);
      const requestedAt = Date.now();
      api.get("/posts")
        .then((res) => {
          if (!cancelled && requestedAt >= lastLocalMutationRef.current) setPostsRaw(res.data);
        })
        .catch(() => {})
        .finally(() => {
          if (isInitial && !cancelled) setPostsLoading(false);
        });
    };
    fetchPosts(true);
    const interval = setInterval(() => fetchPosts(false), 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive]);

  // 스크랩(저장)만 계정별 로컬 저장소에 유지한다(좋아요/싫어요/댓글/삭제는 이제 DB가 기준).
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>(storedInit.savedPosts);

  const [commentInput, setCommentInput] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<PostComment | null>(null);
  // 답글을 남기는 대상 댓글(최상위 댓글만 가능). null이면 새 최상위 댓글을 작성한다.
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);
  // 인스타처럼 답글은 기본적으로 접혀 있고, "답글 보기"를 누른 댓글만 펼쳐서 보여준다.
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // 상대 시간("N분 전") 표시를 실시간으로 갱신하기 위한 tick
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 공강모임 채팅방 멤버 신고
  const [reportingGroupMember, setReportingGroupMember] = useState<Friend | null>(null);
  // 채팅 내용을 증거로 첨부해 신고하기: 신고 대상 멤버를 지정하면 그 사람이 보낸 메시지에
  // 체크박스가 나타나고, 최대 5개까지 골라 신고 사유와 함께 접수한다.
  const [groupReportTarget, setGroupReportTarget] = useState<Friend | null>(null);
  const [selectedGroupMsgIds, setSelectedGroupMsgIds] = useState<string[]>([]);
  const MAX_REPORT_EVIDENCE = 5;
  const [reportingGroupMemberEvidence, setReportingGroupMemberEvidence] = useState<{ content: string }[]>([]);

  const handleReportCommentAuthor = (comment: PostComment) => {
   const counts = loadCommentReportCounts();
    if ((counts[comment.author.nickname] || 0) >= MAX_COMMENT_REPORTS_PER_AUTHOR) {
      showAlert("이미 신고 가능 횟수를 모두 사용했습니다.");
      return;
    }
    setReportingComment(comment);
  };
  const reportCommentModal = reportingComment && (
  <div className="absolute inset-0 z-[60] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
    <div className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>댓글 신고</h3>
        <button onClick={() => setReportingComment(null)}>
          <X size={20} style={{ color: "var(--foreground)" }} />
        </button>
      </div>
      <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
        {reportingComment.author.nickname}님의 댓글을 신고하는 이유를 선택해주세요
      </p>
      {["스팸/도배", "욕설/비방", "음란물", "허위 정보", "기타"].map((reason) => (
        <button
          key={reason}
          onClick={async () => {
            try {
              await api.post("/reports", {
                targetType: "comment",
                targetId: reportingComment._id,
                reason,
              });
            } catch {
              showAlert("신고 접수에 실패했습니다.");
              return;
            }
            incrementCommentReportCount(reportingComment.author.nickname);
            const now = new Date();
            const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
            addReportToHistory({
              id: Date.now(),
              type: reason,
              target: `${reportingComment.author.nickname}의 댓글`,
              status: "처리 중",
              date,
              postId: selectedPostId ?? "",
              sanction: null,
            });
            setReportingComment(null);
            showAlert(`신고가 접수되었습니다: ${reason}`);
          }}
          className="w-full px-4 py-3 rounded-xl text-left text-sm"
          style={{ background: "var(--card)", color: "var(--foreground)" }}
        >
          {reason}
        </button>
      ))}
    </div>
  </div>
);

// 공강모임 채팅방 멤버 신고 모달. groupReportTarget이 함께 있으면 evidenceMessages에
// 담긴 메시지 내용도 신고 사유와 함께 접수한다.
const reportGroupMemberModal = reportingGroupMember && (
  <div className="absolute inset-0 z-[60] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
    <div className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>사용자 신고</h3>
        <button onClick={() => { setReportingGroupMember(null); setReportingGroupMemberEvidence([]); }}>
          <X size={20} style={{ color: "var(--foreground)" }} />
        </button>
      </div>
      <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
        {reportingGroupMember.nickname}님을 신고하는 이유를 선택해주세요
      </p>
      {reportingGroupMemberEvidence.length > 0 && (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl" style={{ background: "var(--muted)" }}>
          <p className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
            첨부된 메시지 ({reportingGroupMemberEvidence.length}개)
          </p>
          {reportingGroupMemberEvidence.map((m, i) => (
            <p key={i} className="text-xs" style={{ color: "var(--foreground)" }}>
              "{m.content}"
            </p>
          ))}
        </div>
      )}
      {["스팸/도배", "욕설/비방", "음란물", "허위 정보", "기타"].map((reason) => (
        <button
          key={reason}
          onClick={async () => {
            try {
              await api.post("/reports", {
                targetType: "user",
                targetId: reportingGroupMember._id,
                reason,
                evidence: reportingGroupMemberEvidence.map((m) => m.content),
              });
            } catch {
              showAlert("신고 접수에 실패했습니다.");
              return;
            }
            const now = new Date();
            const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
            const evidenceNote = reportingGroupMemberEvidence.length > 0
              ? ` (메시지 ${reportingGroupMemberEvidence.length}개 첨부: ${reportingGroupMemberEvidence.map((m) => `"${m.content}"`).join(", ")})`
              : "";
            addReportToHistory({
              id: Date.now(),
              type: reason,
              target: `${reportingGroupMember.nickname}님${evidenceNote}`,
              status: "처리 중",
              date,
              postId: "",
              sanction: null,
            });
            setReportingGroupMember(null);
            setReportingGroupMemberEvidence([]);
            setGroupReportTarget(null);
            setSelectedGroupMsgIds([]);
            showAlert(`신고가 접수되었습니다: ${reason}`);
          }}
          className="w-full px-4 py-3 rounded-xl text-left text-sm"
          style={{ background: "var(--card)", color: "var(--foreground)" }}
        >
          {reason}
        </button>
      ))}
    </div>
  </div>
);
  // 게시물 상세/작성자 화면은 id만 들고 있다가 posts에서 찾아 쓴다.
  // 그래야 좋아요/댓글 등으로 posts가 갱신될 때 상세 화면에도 즉시 반영된다.
const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
const selectedPost = selectedPostId ? posts.find((p) => p._id === selectedPostId) ?? null : null;

// 메인 피드 목록의 스크롤 위치. 게시물 상세화면을 열면(selectedPostId가 생기면) 목록
// 컴포넌트 자체가 언마운트되므로(상세화면이 완전히 다른 return문으로 그려짐), 상세화면을
// 닫고 목록으로 돌아왔을 때 이 값으로 스크롤 위치를 복원해 맨 위로 튀지 않게 한다.
const feedScrollRef = useRef<HTMLDivElement>(null);
const feedScrollPositionRef = useRef(0);
useLayoutEffect(() => {
  if (!selectedPostId && feedScrollRef.current) {
    feedScrollRef.current.scrollTop = feedScrollPositionRef.current;
  }
}, [selectedPostId]);
const [viewedAuthor, setViewedAuthor] = useState<PostAuthor | null>(null);

// 게시물 상세 화면(하단에 댓글 입력창이 고정으로 붙어있음)이 열려 있는 동안에는
// 점심메뉴 추천 플로팅 버튼(App.tsx)이 그 위에 겹쳐 보이지 않도록 부모에게 알려준다.
// 주의: selectedPost는 posts.find(...)로 매번 새로 계산되는 객체라서, 2초마다 도는
// 게시물 폴링이나 댓글 등록으로 posts가 갱신될 때마다 참조가 바뀐다. 예전에는 이 객체
// 자체를 deps로 써서 그럴 때마다 "닫힘(false) → 열림(true)"을 반복 호출했는데, 그 사이에
// 부모 state가 false에 멈춰버리면 상세화면이 열려 있는데도 점심메뉴 버튼이 다시 겹쳐
// 보이는 버그로 이어졌다. 그래서 값이 안 바뀌는 id를 기준으로 열림 여부만 알리고,
// "닫힘" 알림은 실제로 상세화면을 벗어나거나 언마운트될 때만 보내도록 분리한다.
const viewedAuthorId = viewedAuthor?._id ?? null;
useEffect(() => {
  onDetailViewChange?.(!!selectedPostId || !!viewedAuthorId);
}, [selectedPostId, viewedAuthorId, onDetailViewChange]);

useEffect(() => {
  return () => {
    onDetailViewChange?.(false);
  };
}, [onDetailViewChange]);
  // 게시물 상세/작성자 화면이 열려있으면 친구 채팅 패널(메인 피드에만 있음)이 가려지므로,
  // 하단 네비게이션에서 채팅 탭을 누르면(showChat이 true가 되면) 상세 화면을 닫아
  // 채팅 패널로 실제로 이동할 수 있게 한다.
  useEffect(() => {
    if (showChat) {
      setSelectedPostId(null);
      setViewedAuthor(null);
    } else {
      // 커뮤니티/프로필/설정 탭으로 나가면(showChat이 꺼지면) 열려있던 1:1 대화창도 닫아서,
      // 채팅 탭으로 돌아왔을 때 이전 대화가 아닌 채팅 목록부터 다시 보이게 한다.
      setActiveFriend(null);
    }
  }, [showChat]);


  // ProfileScreen에서 업로드한 프로필 사진을 "나"가 쓴 글의 아바타에도 반영한다.
  // 서버(User.avatar)가 기준값이고, 이 상태는 같은 세션에서 즉시 반영하기 위한 캐시일 뿐이다.
  const [myAvatar, setMyAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setMyAvatar(detail ?? getCurrentUser()?.avatar ?? null);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "user") setMyAvatar(getCurrentUser()?.avatar ?? null);
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // 커뮤니티 탭은 화면 전환 시에도 마운트가 유지되므로(App.tsx에서 display:none으로만 숨김),
  // 다른 탭으로 나갔다가 돌아오면 예전에 열어뒀던 게시물 상세/작성자 화면이 아니라
  // 항상 목록 화면부터 다시 보이도록 탭을 벗어나는 즉시 초기화한다.
  useEffect(() => {
    if (!isActive) {
      setSelectedPostId(null);
      setViewedAuthor(null);
    }
  }, [isActive]);

  const [showWrite, setShowWrite] = useState(false);

  // 글쓰기 모달을 등록 없이 닫을 때(X 버튼, 하단 네비게이션 이동 등) 입력해뒀던 내용을
  // 전부 초기화한다. 그래야 다시 글쓰기를 열었을 때 이전에 쓰다 만 내용이 남아있지 않는다.
  const resetWriteForm = () => {
    setNewTitle("");
    setNewContent("");
    setNewImageFiles([]);
    setNewImagePreviews([]);
    setNewPollEnabled(false);
    setNewPollQuestion("");
    setNewPollOptions(["", ""]);
    setNewPollDeleteMode(false);
    setNewLectureGrade("");
    setNewLectureName("");
    setNewLectureProfessor("");
    setNewLectureRating(0);
    setNewLectureContent("");
    setNewMeetingTitle("");
    setNewMeetingContent("");
    setNewMeetingTime("");
    setNewMeetingPlace("");
    setNewMeetingCount(null);
    setNewContestCategory("전체");
  };

  const closeWriteModal = () => {
    resetWriteForm();
    setShowWrite(false);
  };

  // 하단 네비게이션의 펜 버튼(BottomNav)을 눌렀을 때도 헤더 + 버튼과 동일하게 글쓰기 모달을 연다.
  useEffect(() => {
    if (openWriteSignal === undefined || openWriteSignal === 0) return;
    setNewBoard(activeBoard === "event" && !canPostEvents ? "free" : activeBoard);
    setShowWrite(true);
  }, [openWriteSignal]);

  // 글쓰기 모달이 열린 상태에서 하단 네비게이션(커뮤니티/채팅)을 누르면
  // 모달이 화면을 덮은 채로 남아 이동한 것처럼 보이지 않는 문제를 막는다.
  useEffect(() => {
    if (navSignal === undefined || navSignal === 0) return;
    closeWriteModal();
  }, [navSignal]);
  const [showReport, setShowReport] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  // 관리자 제재(경고/차단/댓글제한) 액션 모달
  const [showAdminAction, setShowAdminAction] = useState<{
    type: "warn" | "ban" | "restrictComments";
    postId: string;
    authorId: string;
    authorName: string;
  } | null>(null);
  const [adminReasonInput, setAdminReasonInput] = useState("");
  const [adminBanType, setAdminBanType] = useState<"temporary" | "permanent">("temporary");
  const [adminDurationDays, setAdminDurationDays] = useState(7);
  const [adminActionSubmitting, setAdminActionSubmitting] = useState(false);

  const submitAdminAction = async () => {
    if (!showAdminAction || !adminReasonInput.trim()) return;
    setAdminActionSubmitting(true);
    try {
      const { type, authorId, postId } = showAdminAction;
      if (type === "warn") {
        await api.post(`/admin/users/${authorId}/warn`, { reason: adminReasonInput.trim(), postId });
      } else if (type === "ban") {
        await api.post(`/admin/users/${authorId}/ban`, {
          reason: adminReasonInput.trim(),
          banType: adminBanType,
          days: adminBanType === "temporary" ? adminDurationDays : undefined,
          postId,
        });
      } else {
        await api.post(`/admin/users/${authorId}/restrict-comments`, {
          reason: adminReasonInput.trim(),
          days: adminDurationDays,
          postId,
        });
      }
      setShowAdminAction(null);
      setAdminReasonInput("");
      setAdminBanType("temporary");
      setAdminDurationDays(7);
      showAlert("처리되었습니다.");
    } catch (err: any) {
      showAlert(err?.response?.data?.message || "처리에 실패했습니다.");
    } finally {
      setAdminActionSubmitting(false);
    }
  };

  // 게시물 "..." 더보기 메뉴 (본인글 수정/삭제, 관리자 제재, 타인글 신고) 공용 렌더 헬퍼.
  // 카드 목록과 상세화면 두 곳에서 동일한 분기 로직을 공유하기 위해 뽑아냈다.
  const renderPostMoreMenu = (targetPost: Post, onEditStart: () => void, onDeleted: () => void) => (
    currentUser && targetPost.author._id === currentUser._id ? (
      <>
        <button
          onClick={onEditStart}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "var(--foreground)" }}
        >
          <Edit2 size={14} /> 수정
        </button>
        <button
          onClick={() => {
            showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
              try {
                await api.delete(`/posts/${targetPost._id}`);
                onDeleted();
              } catch {
                showAlert("게시물 삭제에 실패했습니다.");
              }
            });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "#d4183d" }}
        >
          <Trash2 size={14} /> 삭제
        </button>
      </>
    ) : isAdmin ? (
      <>
        <button
          onClick={() => {
            showConfirm("관리자 권한으로 이 게시물을 삭제하시겠습니까?", async () => {
              try {
                await api.delete(`/posts/${targetPost._id}`);
                onDeleted();
              } catch {
                showAlert("게시물 삭제에 실패했습니다.");
              }
            });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "#d4183d" }}
        >
          <Trash2 size={14} /> 삭제 (관리자)
        </button>
        <button
          onClick={() => {
            setShowMoreMenu(null);
            setShowAdminAction({ type: "warn", postId: targetPost._id, authorId: targetPost.author._id, authorName: targetPost.author.nickname });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "var(--foreground)" }}
        >
          <AlertTriangle size={14} /> 유저 경고
        </button>
        <button
          onClick={() => {
            setShowMoreMenu(null);
            setShowAdminAction({ type: "ban", postId: targetPost._id, authorId: targetPost.author._id, authorName: targetPost.author.nickname });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "var(--foreground)" }}
        >
          <Ban size={14} /> 앱 차단
        </button>
        <button
          onClick={() => {
            setShowMoreMenu(null);
            setShowAdminAction({ type: "restrictComments", postId: targetPost._id, authorId: targetPost.author._id, authorName: targetPost.author.nickname });
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
          style={{ color: "var(--foreground)" }}
        >
          <MessageSquareOff size={14} /> 댓글 제한
        </button>
      </>
    ) : (
      <button
        onClick={() => {
          setShowReport(targetPost._id);
          setShowMoreMenu(null);
        }}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
        style={{ color: "#d4183d" }}
      >
        <AlertTriangle size={14} /> 신고
      </button>
    )
  );

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  // 투표가 있는 게시물을 수정할 때, 질문/옵션 텍스트도 함께 수정할 수 있게 한다.
  const [editPollQuestion, setEditPollQuestion] = useState("");
  const [editPollOptions, setEditPollOptions] = useState<string[]>([]);
  const [editPollDeleteMode, setEditPollDeleteMode] = useState(false);
  // 투표 자체를 통째로 삭제하는 기능. X 버튼 → 확인 팝업 → "네"를 누르면 투표 섹션이 사라지고
  // 저장 시 서버에 poll: null로 전달해 게시물에서 투표를 완전히 제거한다.
  const [editPollDeleted, setEditPollDeleted] = useState(false);
  const [showPollDeleteConfirm, setShowPollDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  // 최근 검색어(에타 스타일): 검색창에 아직 아무것도 입력하지 않았을 때 보여준다.
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);
  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  };
  const removeRecentSearch = (query: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((q) => q !== query);
      saveRecentSearches(next);
      return next;
    });
  };
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newBoard, setNewBoard] = useState<BoardType>("free");
  // 꿀팁 게시판 글쓰기 카테고리 (기본값 "전체")
  const [newContestCategory, setNewContestCategory] = useState<string>("전체");
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [newPollEnabled, setNewPollEnabled] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState<string[]>(["", ""]);
  // 평소에는 "옵션 추가"만 가능하고, "수정" 버튼을 눌러야 각 옵션 옆에 삭제(X) 버튼이 나타난다.
  const [newPollDeleteMode, setNewPollDeleteMode] = useState(false);

  // 전공 강의평가(lecture) 전용 글쓰기 폼 상태
  const LECTURE_GRADES = ["1학년", "2학년", "3학년", "4학년"];
  const [newLectureGrade, setNewLectureGrade] = useState("");
  const [newLectureName, setNewLectureName] = useState("");
  const [newLectureProfessor, setNewLectureProfessor] = useState("");
  const [newLectureRating, setNewLectureRating] = useState(0); // 0.5 단위
  const [newLectureContent, setNewLectureContent] = useState("");
  const [professorList, setProfessorList] = useState<string[]>([]);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showProfessorDropdown, setShowProfessorDropdown] = useState(false);

  // 글쓰기 모달에서 게시판을 "전공 강의평가"로 선택하면 서버에서 교수님 목록을 불러온다.
  // 교수님 목록: User 모델(server/models/User.js)의 professor enum과 동일하게 고정 목록 사용
  const PROFESSOR_LIST = ["유진호", "차대현", "홍진근"];
// 공강모임(meeting) 전용 글쓰기 폼 상태
  const MEETING_TIMES = Array.from({ length: 15 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`); // 09:00~23:00, 1시간 단위
  const MEETING_COUNTS = Array.from({ length: 9 }, (_, i) => i + 2); // 2명~10명(본인 포함)
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingContent, setNewMeetingContent] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newMeetingPlace, setNewMeetingPlace] = useState("");
  const [newMeetingCount, setNewMeetingCount] = useState<number | null>(null);
  const [showMeetingTimeDropdown, setShowMeetingTimeDropdown] = useState(false);
  const [showMeetingCountDropdown, setShowMeetingCountDropdown] = useState(false);
  // 게시판을 바꾸면 열려있던 드롭다운은 닫는다.
  useEffect(() => {
    setShowGradeDropdown(false);
    setShowProfessorDropdown(false);
    setShowMeetingTimeDropdown(false);
    setShowMeetingCountDropdown(false);
  }, [newBoard]);

  // 별점 입력 UI: 별 5개, 절반 단위(0.5)로 클릭 가능. 각 별을 왼쪽/오른쪽 절반으로
  // 나눠 각각 버튼으로 두고, 실제 채워진 별은 위에 겹쳐 clip해서 반개를 표현한다.
  const renderLectureRatingInput = () => (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const filledRatio = Math.max(0, Math.min(1, newLectureRating - i));
        return (
          <div key={i} className="relative w-6 h-6 shrink-0">
            <Star size={24} color="var(--muted-foreground)" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${filledRatio * 100}%` }}>
              <Star size={24} fill="#ffc107" color="#ffc107" />
            </div>
            <button
              type="button"
              onClick={() => setNewLectureRating(i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
              aria-label={`${i + 0.5}점`}
            />
            <button
              type="button"
              onClick={() => setNewLectureRating(i + 1)}
              className="absolute inset-y-0 right-0 w-1/2"
              aria-label={`${i + 1}점`}
            />
          </div>
        );
      })}
      <span className="ml-2 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {newLectureRating.toFixed(1)}
      </span>
    </div>
  );

  // 스크랩(savedPosts)이 바뀔 때마다 저장해서 새로고침해도 유지되게 한다.
  // 이미 저장된 내용과 동일하면 다시 쓰지 않아, ProfileScreen이 보낸 갱신을 받아
  // 그대로 반영할 때 다시 이벤트를 쏘는 무한 루프가 생기지 않는다.
  useEffect(() => {
    const toStore: StoredInteractions = { savedPosts };
    try {
      const json = JSON.stringify(toStore);
      if (localStorage.getItem(scopedKey(STORAGE_KEY)) !== json) {
        localStorage.setItem(scopedKey(STORAGE_KEY), json);
        window.dispatchEvent(new CustomEvent(INTERACTIONS_UPDATED_EVENT, { detail: toStore }));
      }
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [savedPosts]);

  // 다른 화면(ProfileScreen)에서 스크랩을 바꾸면
  // 같은 탭에서는 커스텀 이벤트로, 다른 탭에서는 storage 이벤트로 반영한다.
  useEffect(() => {
    const applyExternalUpdate = (next: StoredInteractions) => {
      setSavedPosts(next.savedPosts);
    };
    const handleInteractionsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<StoredInteractions>).detail;
      applyExternalUpdate(detail ?? loadStoredInteractions());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === scopedKey(STORAGE_KEY)) applyExternalUpdate(loadStoredInteractions());
    };
    window.addEventListener(INTERACTIONS_UPDATED_EVENT, handleInteractionsUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(INTERACTIONS_UPDATED_EVENT, handleInteractionsUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [returnToChatFriend, setReturnToChatFriend] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  // 인스타처럼 상대가 지금 접속 중이면 아바타에 초록 점과 "활동 중"을 표시한다.
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  useEffect(() => {
    if (!socket) return;
    const handleOnlineUsers = (ids: string[]) => setOnlineUserIds(ids);
    socket.on("online_users", handleOnlineUsers);
    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, [socket]);
  // 채팅창에서 메시지를 탭하면 그 메시지의 정확한 시각이 잠깐 나타난다(인스타처럼).
  const [revealedTimeId, setRevealedTimeId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  // 공강모임 그룹채팅
  const [activeGroupChat, setActiveGroupChat] = useState<GroupChatSummary | null>(null);
  const [groupMessages, setGroupMessages] = useState<Record<string, GroupMessage[]>>({});
  const [groupChatInput, setGroupChatInput] = useState("");
  const [showGroupChatMembers, setShowGroupChatMembers] = useState(false);
  // 방장이 이 단체채팅방을 삭제했는지(그래서 더 이상 메시지를 보낼 수 없는지)
  const [activeGroupChatDeleted, setActiveGroupChatDeleted] = useState(false);
  const [viewingGroupMember, setViewingGroupMember] = useState<PostAuthor | null>(null);

  // 채팅 설정 플로팅 패널 (단체 채팅방 전용: 이름 변경/나가기/대표 사진 변경 등)
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [chatSettingsView, setChatSettingsView] = useState<"menu" | "rename">("menu");
  const [renameInput, setRenameInput] = useState("");
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);

  // 채팅방 사진 모아보기 (단체/1:1 채팅 공용)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [chatPhotos, setChatPhotos] = useState<ChatPhoto[]>([]);
  const [chatPhotosLoading, setChatPhotosLoading] = useState(false);
  const [galleryViewingImage, setGalleryViewingImage] = useState<string | null>(null);

  const openPhotoGallery = async () => {
    setShowPhotoGallery(true);
    setChatPhotosLoading(true);
    try {
      const res = activeGroupChat
        ? await api.get(`/group-chats/${activeGroupChat._id}/photos`)
        : activeFriend
        ? await api.get(`/chat/${activeFriend._id}/photos`)
        : null;
      setChatPhotos(res?.data || []);
    } catch {
      setChatPhotos([]);
    } finally {
      setChatPhotosLoading(false);
    }
  };

  const handleOpenChatSettings = () => {
    if (activeGroupChat) setRenameInput(activeGroupChat.name || "");
    setChatSettingsView("menu");
    setShowChatSettings(true);
  };

  const handleRenameGroupChat = async () => {
    if (!activeGroupChat || !renameInput.trim()) return;
    const groupChatId = activeGroupChat._id;
    try {
      const res = await api.patch(`/group-chats/${groupChatId}/name`, { name: renameInput.trim() });
      setActiveGroupChat(res.data);
      setGroupChatList((prev) => prev.map((c) => (c._id === groupChatId ? res.data : c)));
      setChatSettingsView("menu");
    } catch (err: any) {
      showAlert(err.response?.data?.message || "이름 변경에 실패했습니다.");
    }
  };

  const handleChangeGroupAvatar = async (file: File) => {
    if (!activeGroupChat) return;
    const groupChatId = activeGroupChat._id;
    setIsUploadingGroupAvatar(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.patch(`/group-chats/${groupChatId}/avatar`, formData);
      setActiveGroupChat(res.data);
      setGroupChatList((prev) => prev.map((c) => (c._id === groupChatId ? res.data : c)));
    } catch (err: any) {
      showAlert(err.response?.data?.message || "대표 사진 변경에 실패했습니다.");
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  const handleLeaveGroupChat = () => {
    if (!activeGroupChat) return;
    const groupChatId = activeGroupChat._id;
    showConfirm("채팅방을 나가시겠습니까?\n대화 내용은 더 이상 볼 수 없습니다.", async () => {
      try {
        await api.post(`/group-chats/${groupChatId}/leave`);
      } catch {
        showAlert("채팅방 나가기에 실패했습니다.");
        return;
      }
      setGroupChatList((prev) => prev.filter((c) => c._id !== groupChatId));
      setGroupMessages((prev) => {
        const next = { ...prev };
        delete next[groupChatId];
        return next;
      });
      setShowChatSettings(false);
      setActiveGroupChat(null);
    });
  };
  
  // 내가 속한 모든 단체 채팅방 목록(공강모임 채팅방 + 친구끼리 만든 채팅방)
  const [groupChatList, setGroupChatList] = useState<GroupChatSummary[]>([]);
  // 친구끼리 단체 채팅방 만들기
  const [showCreateGroupChat, setShowCreateGroupChat] = useState(false);
  const [newGroupChatMemberIds, setNewGroupChatMemberIds] = useState<string[]>([]);
  const [newGroupChatName, setNewGroupChatName] = useState("");

  const fetchGroupChatList = () => {
    api.get("/group-chats")
      .then((res) => setGroupChatList(res.data))
      .catch(() => {});
  };

  // 채팅 탭이 열려 있는 동안 단체 채팅방 목록을 주기적으로 다시 불러와,
  // 새로 초대된 채팅방이 자동으로 나타나게 한다.
  useEffect(() => {
    if (!isActive || !showChat) return;
    fetchGroupChatList();
    const interval = setInterval(fetchGroupChatList, 3000);
    return () => clearInterval(interval);
  }, [isActive, showChat]);

  // 친구가 나를 단체 채팅방에 초대하면 실시간으로 목록에 바로 반영한다.
  useEffect(() => {
    if (!socket) return;
    const handleGroupChatCreated = (chat: GroupChatSummary) => {
      setGroupChatList((prev) => (prev.some((c) => c._id === chat._id) ? prev : [chat, ...prev]));
    };
    socket.on("group_chat_created", handleGroupChatCreated);

    // 다른 멤버가 이름/대표 사진을 바꾸거나, 방장이 넘어가는 등 채팅방 정보가 바뀌면 실시간 반영한다.
    const handleGroupChatUpdated = (chat: GroupChatSummary) => {
      setGroupChatList((prev) => prev.map((c) => (c._id === chat._id ? { ...c, ...chat } : c)));
      setActiveGroupChat((prev) => (prev && prev._id === chat._id ? { ...prev, ...chat } : prev));
    };
    socket.on("group_chat_updated", handleGroupChatUpdated);

    // 방장이 채팅방을 완전히 삭제하면 모든 멤버의 목록/열려있는 화면에서도 사라진다.
    const handleGroupChatDeleted = ({ _id }: { _id: string }) => {
      setGroupChatList((prev) => prev.filter((c) => c._id !== _id));
      setActiveGroupChat((prev) => {
        if (prev && prev._id === _id) setActiveGroupChatDeleted(true);
        return prev;
      });
    };
    socket.on("group_chat_deleted", handleGroupChatDeleted);

    return () => {
      socket.off("group_chat_created", handleGroupChatCreated);
      socket.off("group_chat_updated", handleGroupChatUpdated);
      socket.off("group_chat_deleted", handleGroupChatDeleted);
    };
  }, [socket]);
  const openGroupChat = async (chat: GroupChatSummary) => {
    try {
      setActiveGroupChat(chat);
      setActiveGroupChatDeleted(false);
      const msgsRes = await api.get(`/group-chats/${chat._id}/messages`);
      setGroupMessages((prev) => ({ ...prev, [chat._id]: msgsRes.data }));
    } catch (err: any) {
      showAlert(err.response?.data?.message || "채팅방을 열 수 없습니다.");
    }
  };

  const openGroupChatForPost = async (postId: string) => {
    try {
      const res = await api.get(`/group-chats/by-post/${postId}`);
      await openGroupChat(res.data);
    } catch (err: any) {
      showAlert(err.response?.data?.message || "채팅방을 열 수 없습니다.");
    }
  };

  const handleCreateGroupChat = async () => {
    if (newGroupChatMemberIds.length === 0) {
      showAlert("함께할 친구를 선택해주세요.");
      return;
    }
    try {
      const res = await api.post("/group-chats", {
        memberIds: newGroupChatMemberIds,
        name: newGroupChatName.trim() || undefined,
      });
      setGroupChatList((prev) => [res.data, ...prev]);
      setShowCreateGroupChat(false);
      setNewGroupChatMemberIds([]);
      setNewGroupChatName("");
      await openGroupChat(res.data);
    } catch (err: any) {
      showAlert(err.response?.data?.message || "채팅방 생성에 실패했습니다.");
    }
  };

  const handleSendGroupMessage = async () => {
    if (!activeGroupChat || !groupChatInput.trim()) return;
    const content = filterProfanity(groupChatInput.trim());
    const groupChatId = activeGroupChat._id;
    setGroupChatInput("");
    try {
      const res = await api.post(`/group-chats/${groupChatId}/messages`, { content });
      setGroupMessages((prev) => ({ ...prev, [groupChatId]: [...(prev[groupChatId] || []), res.data] }));
    } catch {
      showAlert("메시지 전송에 실패했습니다.");
    }
  };

  // 입력창이 비어있을 때 하트 버튼을 누르면 1:1 채팅처럼 하트 메시지를 바로 보낸다.
  const sendGroupHeartMessage = async () => {
    if (!activeGroupChat) return;
    const groupChatId = activeGroupChat._id;
    try {
      const res = await api.post(`/group-chats/${groupChatId}/messages`, { content: "❤️" });
      setGroupMessages((prev) => ({ ...prev, [groupChatId]: [...(prev[groupChatId] || []), res.data] }));
    } catch {
      showAlert("메시지 전송에 실패했습니다.");
    }
  };

  // 메시지 더블탭 하트 반응 토글 (1:1 채팅과 동일)
  const handleToggleGroupMessageLike = async (messageId: string) => {
    if (!activeGroupChat) return;
    const groupChatId = activeGroupChat._id;
    setGroupMessages((prev) => ({
      ...prev,
      [groupChatId]: (prev[groupChatId] || []).map((m) => (m._id === messageId ? { ...m, liked: !m.liked } : m)),
    }));
    try {
      await api.patch(`/group-chats/messages/${messageId}/like`);
    } catch {
      setGroupMessages((prev) => ({
        ...prev,
        [groupChatId]: (prev[groupChatId] || []).map((m) => (m._id === messageId ? { ...m, liked: !m.liked } : m)),
      }));
    }
  };

  // 그룹채팅 메시지가 소켓으로 도착하면, 현재 열려있는 채팅방이면 바로 목록에 추가한다.
  useEffect(() => {
    if (!socket) return;
    const handleReceiveGroupMessage = (msg: GroupMessage) => {
      setGroupMessages((prev) => ({ ...prev, [msg.groupChat]: [...(prev[msg.groupChat] || []), msg] }));
    };
    socket.on("receive_group_message", handleReceiveGroupMessage);

    // 다른 멤버가 메시지에 하트를 붙이면 실시간으로 반영한다.
    const handleGroupMessageLiked = (msg: { _id: string; groupChat: string; liked?: boolean }) => {
      setGroupMessages((prev) => ({
        ...prev,
        [msg.groupChat]: (prev[msg.groupChat] || []).map((m) => (m._id === msg._id ? { ...m, liked: !!msg.liked } : m)),
      }));
    };
    socket.on("group_message_liked", handleGroupMessageLiked);

    return () => {
      socket.off("receive_group_message", handleReceiveGroupMessage);
      socket.off("group_message_liked", handleGroupMessageLiked);
    };
  }, [socket]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isFriendSelectMode, setIsFriendSelectMode] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  // 단체채팅 중 내가 방장인 것만 선택 삭제 가능
  const [selectedGroupChatIds, setSelectedGroupChatIds] = useState<string[]>([]);
  // 1:1 채팅에서 "채팅 삭제"를 누르면 친구 관계는 유지한 채 내 채팅 목록에서만 숨긴다.
  const [hiddenChatFriendIds, setHiddenChatFriendIds] = useState<string[]>([]);
  // 지금 열려있는 1:1 채팅에서 상대방이 채팅을 나갔는지(그래서 더 이상 보낼 수 없는지)
  const [activeFriendTheyLeft, setActiveFriendTheyLeft] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // 좋아요/싫어요 누른 사람 목록 보기
  const [reactionListModal, setReactionListModal] = useState<{ type: "likes" | "dislikes"; postId: string } | null>(null);
  const [reactionListUsers, setReactionListUsers] = useState<Friend[]>([]);
  const openReactionList = async (postId: string, type: "likes" | "dislikes") => {
    setReactionListModal({ type, postId });
    try {
      const res = await api.get(`/posts/${postId}/${type}`);
      setReactionListUsers(res.data);
    } catch {
      setReactionListUsers([]);
    }
  };
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>(currentUser?.following ?? []);
  // 알림 패널에서 맞팔로우/팔로우 취소 요청이 진행 중인 대상 id (중복 클릭 방지용)
  const [followBackPendingId, setFollowBackPendingId] = useState<string | null>(null);
const [showChatMenu, setShowChatMenu] = useState(false);
const [selectMode, setSelectMode] = useState(false);
const [selectedMsgs, setSelectedMsgs] = useState<string[]>([]);
const hiddenMessageIdsRef = useRef<Set<string>>(new Set());
const [showReportConfirm, setShowReportConfirm] = useState(false);
const [viewingImage, setViewingImage] = useState<string | null>(null);
const [fullscreenPostImage, setFullscreenPostImage] = useState<string | null>(null);
// 행사공지(event) 게시물 상세를 인스타그램 스타일로 보여주기 위한 상태
const [eventImageIndex, setEventImageIndex] = useState(0);
// 피드 카드(상세화면 밖)에서 게시물별로 몇 번째 이미지를 보고 있는지 저장.
// 게시물마다 따로 넘길 수 있어야 하므로 postId를 key로 하는 맵으로 관리한다.
const [feedImageIndices, setFeedImageIndices] = useState<Record<string, number>>({});
const getFeedImageIndex = (postId: string) => feedImageIndices[postId] ?? 0;
const stepFeedImage = (postId: string, delta: number, maxIndex: number) => {
  setFeedImageIndices((prev) => {
    const current = prev[postId] ?? 0;
    const next = Math.max(0, Math.min(maxIndex, current + delta));
    return { ...prev, [postId]: next };
  });
};
const [eventFollowingIds, setEventFollowingIds] = useState<string[]>([]);
const toggleEventFollow = async (authorId: string) => {
  const isFollowing = eventFollowingIds.includes(authorId);
  setEventFollowingIds((prev) => isFollowing ? prev.filter((id) => id !== authorId) : [...prev, authorId]);
  try {
    if (isFollowing) await api.delete(`/users/follow/${authorId}`);
    else await api.post(`/users/follow/${authorId}`);
  } catch {
    setEventFollowingIds((prev) => isFollowing ? [...prev, authorId] : prev.filter((id) => id !== authorId));
  }
};
// 게시물이 바뀔 때마다 인스타그램 스타일 이미지 캐러셀 인덱스를 처음으로 되돌린다.
useEffect(() => {
  setEventImageIndex(0);
  setReplyTarget(null);
}, [selectedPostId]);

  // 친구 기능은 폐기되고 팔로우/팔로잉으로 대체되었다. 채팅 탭 하단 패널은 팔로우 여부와
  // 무관하게, 실제로 메시지를 주고받은 적 있는 상대(대화상대) 목록을 보여준다.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const fetchFriendsData = () => {
      api.get("/chat/conversations").then((res) => { if (!cancelled) setFriends(res.data); }).catch(() => {});
      api.get("/chat/hidden-friends").then((res) => { if (!cancelled) setHiddenChatFriendIds(res.data); }).catch(() => {});
    };
    fetchFriendsData();
    const interval = setInterval(fetchFriendsData, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive]);

  // 관리자가 다른 세션에서 내 계정의 관리자 권한(isAdmin) / 행사공지 작성 권한(canPostEvents)을
  // 바꿨을 수 있다. currentUser는 로그인 시점에 localStorage에 캐시해둔 값을 최초 1회만 읽어오므로,
  // 그 이후 권한이 바뀌어도 로그아웃 후 재로그인 전까지는 반영되지 않는 문제가 있었다. 그래서
  // 주기적으로 서버의 최신 값을 확인해 캐시와 화면 상태를 함께 갱신한다.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const syncPermissions = () => {
      api.get("/auth/me").then((res) => {
        if (cancelled || !res.data) return;
        const fresh = res.data;
        setCurrentUser((prev) => {
          if (!prev || (prev.isAdmin === fresh.isAdmin && prev.canPostEvents === fresh.canPostEvents)) return prev;
          updateStoredUser({ isAdmin: fresh.isAdmin, canPostEvents: fresh.canPostEvents });
          return { ...prev, isAdmin: fresh.isAdmin, canPostEvents: fresh.canPostEvents };
        });
      }).catch(() => {});
    };
    syncPermissions();
    const interval = setInterval(syncPermissions, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive]);

  // 팔로우 알림의 안 읽은 개수(GET /api/notifications/unread-count)를 몇 초마다 다시 불러와
  // 벨 아이콘 뱃지가 새로고침 없이 갱신되게 한다.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const fetchUnreadNotifCount = () => {
      api.get("/notifications/unread-count")
        .then((res) => { if (!cancelled) setUnreadNotifCount(res.data.count); })
        .catch(() => {});
    };
    fetchUnreadNotifCount();
    const interval = setInterval(fetchUnreadNotifCount, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isActive]);

  // 알림 패널을 열 때 알림 목록과 최신 팔로잉 목록(맞팔로우 여부 판단용)을 불러오고,
  // 전부 읽음 처리한다.
  const openNotifications = async () => {
    setShowNotifications(true);
    try {
      const [notifRes, profileRes] = await Promise.all([
        api.get("/notifications"),
        api.get("/users/profile"),
      ]);
      setNotifications(notifRes.data);
      setFollowingIds((profileRes.data.following || []).map((id: string) => String(id)));
      await api.patch("/notifications/read-all");
      setUnreadNotifCount(0);
    } catch {
      // 조용히 무시
    }
  };

  // 알림 패널에서 바로 맞팔로우 / 팔로우 취소를 토글한다.
  // 패널을 닫거나 프로필로 이동하지 않고 그 자리에서 처리한다.
  const handleToggleFollowBack = async (targetId: string, isFollowing: boolean) => {
    if (followBackPendingId) return;
    setFollowBackPendingId(targetId);
    try {
      if (isFollowing) {
        await api.delete(`/users/follow/${targetId}`);
        setFollowingIds((prev) => prev.filter((id) => String(id) !== targetId));
      } else {
        await api.post(`/users/follow/${targetId}`);
        setFollowingIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
      }
    } catch (err: any) {
      showAlert(
        err.response?.data?.message ||
          (isFollowing ? "팔로우 취소에 실패했습니다." : "팔로우에 실패했습니다."),
      );
    } finally {
      setFollowBackPendingId(null);
    }
  };

  // 서버가 내려주는 메시지(from/to가 User로 populate됨)를 채팅 화면에서 쓰는 형태로 변환한다.
  // 로컬에서 "삭제"한 메시지는 다음 폴링에서 서버 응답에 그대로 남아있어도 다시 보이지 않게 걸러낸다.
  const mapMessages = (raw: any[]): Message[] =>
    raw
      .map((m) => ({
        _id: m._id,
        content: m.content || "",
        image: m.image,
        createdAt: m.createdAt,
        mine: !!currentUser && m.from?._id === currentUser._id,
        read: !!m.read,
        liked: !!m.liked,
      }))
      .filter((m) => !hiddenMessageIdsRef.current.has(m._id));

  // 같은 친구에 대해 여러 경로(주기적 미리보기, 대화창 열기, 소켓 수신)로 동시에 대화 내역을
  // 불러올 수 있는데, 먼저 보낸 요청이 나중에 도착하면 방금 받은 새 메시지가(아직 안 읽음
  // 상태인 채로) 사라져버릴 수 있다("1이 자동으로 없어짐" 버그의 원인). 친구별로 가장 최근에
  // "보낸" 요청 시각을 기록해두고, 그보다 먼저 보낸 요청의 응답은 무시해서 이를 막는다.
  const chatFetchTimestampsRef = useRef<Record<string, number>>({});
  const applyChatMessages = (friendId: string, requestedAt: number, raw: any[]) => {
    if ((chatFetchTimestampsRef.current[friendId] ?? 0) > requestedAt) return;
    chatFetchTimestampsRef.current[friendId] = requestedAt;
    setChatMessages((prev) => ({ ...prev, [friendId]: mapMessages(raw) }));
  };

  // 채팅 탭이 열려 있는 동안, 친구 목록 미리보기를 위해 친구별 대화 내역을 불러온다.
  useEffect(() => {
    if (!isActive || !showChat || friends.length === 0) return;
    let cancelled = false;
    friends.forEach((friend) => {
      const requestedAt = Date.now();
      api.get(`/chat/${friend._id}?preview=true`)
        .then((res) => {
          if (cancelled) return;
          applyChatMessages(friend._id, requestedAt, res.data);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [friends, isActive, showChat]);

  // 1:1 대화창을 열 때 대화 내역을 불러온다(이후 새 메시지는 소켓으로 실시간 수신).
  useEffect(() => {
    if (!activeFriend) {
      setActiveFriendTheyLeft(false);
      return;
    }
    let cancelled = false;
    const requestedAt = Date.now();
    api.get(`/chat/${activeFriend._id}`)
      .then((res) => {
        if (cancelled) return;
        applyChatMessages(activeFriend._id, requestedAt, res.data);
      })
      .catch(() => {});
    api.get(`/chat/${activeFriend._id}/state`)
      .then((res) => { if (!cancelled) setActiveFriendTheyLeft(!!res.data.theyLeft); })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeFriend]);

  // 소켓으로 새 메시지가 도착하면(내가 보낸 메시지는 REST 응답으로 이미 반영되므로 해당 없음)
  // 해당 친구의 대화 내역을 다시 불러와 실시간으로 반영한다. 활성 대화창이라면 읽음 처리도 함께 된다.
  useEffect(() => {
    if (!socket) return;
    const handleReceiveMessage = (msg: { from?: { _id?: string } }) => {
      const friendId = msg?.from?._id;
      if (!friendId) return;
      const isViewing = activeFriend?._id ===friendId;
      const requestedAt = Date.now();
      api.get(`/chat/${friendId}${isViewing ? "" : "?preview=true"}`)
        .then((res) => {
          applyChatMessages(friendId, requestedAt, res.data);
        })
        .catch(() => {});
      // 삭제(숨김)했던 채팅이었다면, 상대가 새 메시지를 보냈으니 목록에 다시 나타나게 한다.
      setHiddenChatFriendIds((prev) => prev.filter((id) => id !== friendId));
    };
    socket.on("receive_message", handleReceiveMessage);

    // 상대방이 내가 보낸(또는 상대가 보낸) 메시지를 더블탭해서 하트를 붙이면 실시간으로 반영한다.
    const handleMessageLiked = (msg: { _id: string; from?: { _id?: string }; to?: { _id?: string }; liked?: boolean }) => {
      const friendId = msg.from?._id === currentUser?._id ? msg.to?._id : msg.from?._id;
      if (!friendId) return;
      setChatMessages((prev) => ({
        ...prev,
        [friendId]: (prev[friendId] || []).map((m) => (m._id === msg._id ? { ...m, liked: !!msg.liked } : m)),
      }));
    };
    socket.on("message_liked", handleMessageLiked);

    // 상대방이 이 1:1 채팅을 나갔으면(채팅삭제) 지금 보고 있는 화면에 바로 안내문구를 띄운다.
    const handleChatLeft = ({ friendId }: { friendId: string }) => {
      if (activeFriend?._id === friendId) setActiveFriendTheyLeft(true);
    };
    socket.on("chat_left", handleChatLeft);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_liked", handleMessageLiked);
      socket.off("chat_left", handleChatLeft);
    };
  }, [socket, activeFriend]);

  // 메시지 더블탭 하트 반응 토글 (인스타 DM처럼)
  const handleToggleMessageLike = async (messageId: string) => {
    if (!activeFriend) return;
    const friendId = activeFriend._id;
    setChatMessages((prev) => ({
      ...prev,
      [friendId]: (prev[friendId] || []).map((m) => (m._id === messageId ? { ...m, liked: !m.liked } : m)),
    }));
    try {
      await api.patch(`/chat/messages/${messageId}/like`);
    } catch {
      setChatMessages((prev) => ({
        ...prev,
        [friendId]: (prev[friendId] || []).map((m) => (m._id === messageId ? { ...m, liked: !m.liked } : m)),
      }));
    }
  };

  // 친구 목록 카드에 보여줄 마지막 메시지 미리보기/시간/안 읽은 개수
  const getFriendPreview = (friend: Friend) => {
    const msgs = chatMessages[friend._id] || [];
    if (msgs.length === 0) {
      return { text: "", time: "", unreadCount: 0 };
    }
    const last = msgs[msgs.length - 1];
    const text = last.image && !last.content ? "사진을 보냈습니다" : last.content;
    const unreadCount = msgs.filter((m) => !m.mine && !m.read).length;
    return { text, time: formatMessageTime(last.createdAt, nowTick), unreadCount };
  };

  // 대화 내역은 서버가 시간순으로 정렬해 내려주므로, 마지막 메시지 시각이 최신일수록
  // 최근에 주고받은 대화다. 메시지가 없는 친구는 가장 아래로 내려간다.
  const getLastMessageSortKey = (friend: Friend) => {
    const msgs = chatMessages[friend._id] || [];
    return msgs.length === 0 ? 0 : new Date(msgs[msgs.length - 1].createdAt).getTime();
  };
  const sortedFriends = [...friends]
    .filter((f) => !hiddenChatFriendIds.includes(f._id))
    .sort((a, b) => getLastMessageSortKey(b) - getLastMessageSortKey(a));

  // 친구와의 채팅방에 들어가면 대화 내역을 불러오는데(useEffect 폴링), 그 요청 자체가
  // 서버에서 상대가 보낸 메시지를 읽음 처리해준다.
  const openFriendChat = (friend: Friend) => {
    setActiveFriend(friend);
  };

  const openFriendProfileFromChat = () => {
    const friend = activeFriend;
    if (!friend) return;
    setActiveFriend(null);
    setViewedAuthor(friend);
    setReturnToChatFriend(friend);
  };

  // 커스텀 알림/확인 팝업 상태
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertCallback, setAlertCallback] = useState<(() => void) | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showAlert = (message: string, callback?: () => void) => {
    setAlertMessage(message);
    setAlertCallback(() => callback || null);
  };
  const closeAlert = () => {
    setAlertMessage(null);
    if (alertCallback) alertCallback();
    setAlertCallback(null);
  };
const showConfirm = (message: string, onConfirm: () => void) => {
  setConfirmState({ message, onConfirm });
};
const closeConfirm = () => setConfirmState(null);

// 커스텀 알림/확인 팝업: showAlert/showConfirm은 게시물 상세, 채팅창, 검색 화면 등
// 어디서든 호출될 수 있는데, 예전에는 이 팝업 JSX가 맨 아래 "커뮤니티 메인" 화면의
// return문에만 있었다. 그래서 예를 들어 게시물 상세화면에서 댓글 삭제를 확인하면
// confirmState는 바뀌지만 그 화면에는 팝업이 안 보이고, 나중에 메인 화면으로 돌아가야
// (그 return이 렌더링되어야) 팝업이 뒤늦게 나타나는 버그가 있었다. 여러 화면에서 공용으로
// 쓸 수 있도록 JSX를 변수로 뽑아, 팝업을 띄울 수 있는 모든 화면에서 각자 렌더링한다.
const alertAndConfirmModals = (
  <>
    {/* 커스텀 알림 팝업 (확인 1개) */}
{alertMessage && (
  <div
    className="absolute inset-0 z-[70] flex items-center justify-center px-6 pointer-events-auto"
    style={{ background: "rgba(0,0,0,0.6)" }}
  >
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
      style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 text-base font-semibold"
        style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
      >
        Code
        <button onClick={closeAlert} style={{ color: "var(--muted-foreground)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
        {alertMessage}
      </div>

      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <button
          className="w-full py-3 text-sm font-medium"
          style={{ color: "var(--foreground)" }}
          onClick={closeAlert}
        >
          확인
        </button>
      </div>
    </div>
  </div>
)}


    {/* 커스텀 확인 팝업 (확인/취소 2개) */}
    {confirmState && (
      <div
        className="absolute inset-0 z-[70] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <div
          className="w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 text-base font-semibold"
            style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
          >
            Code
            <button onClick={closeConfirm} style={{ color: "var(--muted-foreground)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            {confirmState.message}
          </div>
          <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <button
              className="flex-1 py-3 text-sm font-medium"
              style={{ color: "var(--foreground)", borderRight: "1px solid rgba(255,255,255,0.1)" }}
              onClick={() => {
                const action = confirmState.onConfirm;
                setConfirmState(null);
                action();
              }}
            >
              확인
            </button>
            <button
              className="flex-1 py-3 text-sm font-medium"
              style={{ color: "var(--foreground)" }}
              onClick={closeConfirm}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

// 이미지 전체화면 뷰어(카톡처럼 클릭 시 확대)도 alertAndConfirmModals와 같은 이유로
// 공용 변수로 뽑아둔다. 예전에는 이 JSX가 "커뮤니티 메인" 화면의 return문에만 있어서,
// 게시물 상세화면에서 이미지를 클릭하면 fullscreenPostImage 상태는 바뀌지만 그 화면에는
// 뷰어가 안 보이고, 뒤로 가기로 메인 화면에 돌아가야 뷰어가 뒤늦게(게시물 상세화면
// 밖에서) 나타나는 버그가 있었다.
const fullscreenImageViewer = fullscreenPostImage && (
  <div
    className="absolute inset-0 z-[80] flex items-center justify-center"
    style={{ background: "rgba(0,0,0,0.92)" }}
    onClick={() => setFullscreenPostImage(null)}
  >
    <button
      onClick={() => setFullscreenPostImage(null)}
      className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.15)" }}
    >
      <X size={20} color="white" />
    </button>
    <img
      src={fullscreenPostImage}
      alt="확대 이미지"
      className="max-w-full max-h-full object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// 채팅방 사진 모아보기 모달. 단체 채팅과 1:1 채팅 화면 둘 다에서 열 수 있으므로,
// alertAndConfirmModals와 같은 이유로 공용 변수로 뽑아 각 채팅 화면에서 렌더링한다.
const photoGalleryModal = showPhotoGallery && (
  <div className="absolute inset-0 z-[75] flex flex-col" style={{ background: "var(--background)" }}>
    <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => {
          setShowPhotoGallery(false);
          setGalleryViewingImage(null);
          // 단체 채팅방 설정에서 열었던 경우(즉 지금 단체 채팅방에 들어와 있는 경우)엔
          // 채팅창이 아니라 설정 패널이 열려있던 상태로 되돌아간다.
          if (activeGroupChat) setShowChatSettings(true);
        }}
        className="text-lg"
        style={{ color: "var(--foreground)" }}
      >←</button>
      <p className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>사진 모아보기</p>
    </div>
    <div className="flex-1 overflow-y-auto p-1">
      {chatPhotosLoading ? (
        <p className="text-center text-xs py-10" style={{ color: "var(--muted-foreground)" }}>불러오는 중...</p>
      ) : chatPhotos.length === 0 ? (
        <p className="text-center text-xs py-10" style={{ color: "var(--muted-foreground)" }}>아직 채팅방에 올라온 사진이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {chatPhotos.map((photo, i) => (
            <button
              key={`${photo.image}-${i}`}
              onClick={() => setGalleryViewingImage(photo.image)}
              className="aspect-square overflow-hidden"
            >
              <img src={resolveAssetUrl(photo.image)} alt="채팅 사진" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
    {galleryViewingImage && (
      <div
        className="absolute inset-0 z-[80] flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.9)" }}
        onClick={() => setGalleryViewingImage(null)}
      >
        <button
          onClick={() => setGalleryViewingImage(null)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <X size={20} color="white" />
        </button>
        <img
          src={resolveAssetUrl(galleryViewingImage)}
          alt="사진 크게 보기"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full rounded-xl object-contain"
        />
      </div>
    )}
  </div>
);

// 게시물의 댓글 수는 이제 실제 DB에 저장된 comments 배열의 길이다.
const getCommentCount = (post: Post) => post.comments.length;
// 별점을 화면에 보여줄 때 쓰는 함수. 반개(0.5) 단위까지 정확히 표현하기 위해
// 빈 별 위에 채워진 별을 rating 비율만큼만 겹쳐서(overflow: hidden으로 잘라서) 그린다.
const renderRatingStars = (rating: number, size: number = 14) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => {
      const filledRatio = Math.max(0, Math.min(1, rating - i));
      return (
        <div key={i} className="relative shrink-0" style={{ width: size, height: size }}>
          <Star size={size} color="var(--muted-foreground)" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${filledRatio * 100}%` }}>
            <Star size={size} fill="#ffc107" color="#ffc107" />
          </div>
        </div>
      );
    })}
  </>
);
 // 내가 쓴 글은 프로필에서 업로드한 실제 프로필 사진을, 그 외에는 작성자의 avatar(아직 비어있으면 null)를 보여준다.
 const getAuthorAvatarUrl = (author: PostAuthor): string | null => {
   if (currentUser && author._id === currentUser._id) return resolveAssetUrl(myAvatar ?? author.avatar) ?? null;
   return resolveAssetUrl(author.avatar) ?? null;
 };
 // 내가 쓴 글의 아바타를 누르면 작성자 보기 화면 대신 실제 내 프로필 탭으로 이동한다.
 const openAuthor = (author: PostAuthor) => {
   if (currentUser && author._id === currentUser._id) {
     onViewOwnProfile();
   } else {
     setViewedAuthor(author);
   }
 };
 const isLiked = (post: Post) => !!currentUser && post.likes.includes(currentUser._id);
 const isDisliked = (post: Post) => !!currentUser && post.dislikes.includes(currentUser._id);

 const handleLike = async (post: Post) => {
   if (!currentUser) return;
   const uid = currentUser._id;
   const wasLiked = post.likes.includes(uid);
   const wasDisliked = post.dislikes.includes(uid);
   setPosts((prev) => prev.map((p) => p._id !== post._id ? p : {
     ...p,
     likes: wasLiked ? p.likes.filter((id) => id !== uid) : [...p.likes, uid],
     dislikes: wasDisliked ? p.dislikes.filter((id) => id !== uid) : p.dislikes,
   }));
   try {
     await api.post(`/posts/${post._id}/like`);
   } catch {
     setPosts((prev) => prev.map((p) => (p._id === post._id ? post : p)));
   }
 };

 const handleDislike = async (post: Post) => {
   if (!currentUser) return;
   const uid = currentUser._id;
   const wasDisliked = post.dislikes.includes(uid);
   const wasLiked = post.likes.includes(uid);
   setPosts((prev) => prev.map((p) => p._id !== post._id ? p : {
     ...p,
     dislikes: wasDisliked ? p.dislikes.filter((id) => id !== uid) : [...p.dislikes, uid],
     likes: wasLiked ? p.likes.filter((id) => id !== uid) : p.likes,
   }));
   try {
     await api.post(`/posts/${post._id}/dislike`);
   } catch {
     setPosts((prev) => prev.map((p) => (p._id === post._id ? post : p)));
   }
 };

 const toggleSave = (postId: string) => {
   const wasSaved = !!savedPosts[postId];
   setSavedPosts((s) => ({ ...s, [postId]: !s[postId] }));

   // 인기순 정렬에 쓰이는 게시물별 스크랩 수를 서버와 동기화한다.
   if (!currentUser) return;
   const uid = currentUser._id;
   setPosts((prev) => prev.map((p) => {
     if (p._id !== postId) return p;
     const scraps = wasSaved
       ? (p.scraps || []).filter((id) => id !== uid)
       : [...(p.scraps || []), uid];
     return { ...p, scraps };
   }));
   api.post(`/posts/${postId}/scrap`).catch(() => {});
 };

 // 투표하기: 이미 다른 옵션에 투표했었다면 서버에서 자동으로 옮겨준다.
 const handleVote = async (post: Post, optionIndex: number) => {
   if (!currentUser) return;
   try {
     const res = await api.post(`/posts/${post._id}/poll/vote`, { optionIndex });
     setPosts((prev) => prev.map((p) => (p._id === post._id ? res.data : p)));
   } catch {
     showAlert("투표에 실패했습니다.");
   }
 };
// 공강모임 참여하기
 const handleJoinMeeting = async (post: Post) => {
   if (!currentUser) return;
   try {
     const res = await api.post(`/posts/${post._id}/join`);
     setPosts((prev) => prev.map((p) => (p._id === post._id ? res.data : p)));
   } catch (err: any) {
     showAlert(err.response?.data?.message || "참여에 실패했습니다.");
   }
 };

 // 공강모임 참여 취소하기
 const handleLeaveMeeting = async (post: Post) => {
   if (!currentUser) return;
   try {
     const res = await api.post(`/posts/${post._id}/leave`);
     setPosts((prev) => prev.map((p) => (p._id === post._id ? res.data : p)));
   } catch (err: any) {
     showAlert(err.response?.data?.message || "참여 취소에 실패했습니다.");
   }
 };

 const hasJoinedMeeting = (post: Post) => !!currentUser && !!post.participants?.includes(currentUser._id);
 const isMeetingFull = (post: Post) => !!post.maxParticipants && (post.participants?.length ?? post.currentParticipants ?? 0) >= post.maxParticipants;

 // 참여 버튼 클릭: 이미 참여 중이면 취소 여부를 물어보고, 아니면 바로 참여시킨다.
 const handleMeetingButtonClick = (post: Post) => {
   if (hasJoinedMeeting(post)) {
     showConfirm("참여를 취소하시겠습니까?", () => handleLeaveMeeting(post));
   } else {
     handleJoinMeeting(post);
   }
 };
 const renderPoll = (post: Post) => {
   if (!post.poll) return null;
   const { poll } = post;
   const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
   const myVoteIndex = currentUser ? poll.options.findIndex((o) => o.votes.includes(currentUser._id)) : -1;
   return (
     <div
       className="mt-2 p-3 rounded-2xl flex flex-col gap-2"
       style={{ background: "var(--muted)" }}
       onClick={(e) => e.stopPropagation()}
     >
       <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>🗳️ {poll.question}</p>
       {poll.options.map((opt, idx) => {
         const percent = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
         const isMine = idx === myVoteIndex;
         return (
           <button
             key={idx}
             onClick={() => handleVote(post, idx)}
             className="relative w-full text-left px-3 py-2 rounded-xl text-xs overflow-hidden"
             style={{ background: "var(--card)", border: isMine ? "1.5px solid var(--primary)" : "1.5px solid var(--border)" }}
           >
             <div
               className="absolute inset-y-0 left-0"
               style={{ width: `${percent}%`, background: "var(--secondary)" }}
             />
             <div className="relative flex items-center justify-between" style={{ color: "var(--foreground)" }}>
               <span>{opt.text}{isMine ? " ✓" : ""}</span>
               <span>{percent}%</span>
             </div>
           </button>
         );
       })}
       <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{totalVotes}명 참여</p>
     </div>
   );
 };

 const allPosts = posts;
 // 검색어를 단어 단위로 끊어서, 모든 단어가 실제로 제목/내용/태그 어딘가에 들어있는
 // 게시물만 노출한다(단어 순서나 위치는 상관없이 전부 포함돼야 함).
 const searchWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const visiblePosts = showSearch && searchWords.length > 0
    ? allPosts.filter((p) => {
        const title = p.title.toLowerCase();
        const content = p.content.toLowerCase();
        const tags = p.tags?.map((t) => t.toLowerCase()) ?? [];
        return searchWords.every((word) =>
          title.includes(word) || content.includes(word) || tags.some((t) => t.includes(word))
        );
      })
    : allPosts
        .filter((p) =>
          // "게시판" 탭은 모든 게시판의 글이 모이는 통합 피드로 보여준다.
          activeBoard === "free" ? true : p.board === activeBoard
        )
        .filter((p) =>
          // 꿀팁 게시판에서 카테고리 필터를 선택했다면 해당 태그가 붙은 게시물만 남긴다.
          activeBoard === "contest" && activeContestFilter
            ? p.tags?.includes(activeContestFilter)
            : true
        );

 // 인기순 = 좋아요 수 + 스크랩 수 합산이 높은 순
 const getPopularityScore = (post: Post) => post.likes.length + (post.scraps?.length ?? 0);
 const sortedVisiblePosts = sortOrder === "popular"
   ? [...visiblePosts].sort((a, b) => getPopularityScore(b) - getPopularityScore(a))
   : visiblePosts;

  const toggleFriendSelectMode = () => {
  setIsFriendSelectMode((prev) => !prev);
  setSelectedFriendIds([]);
  setSelectedGroupChatIds([]);
};

const toggleFriendSelect = (id: string) => {
  setSelectedFriendIds((prev) =>
    prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
  );
};

const toggleGroupChatSelect = (id: string) => {
  setSelectedGroupChatIds((prev) =>
    prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
  );
};

// 채팅삭제: 1:1 채팅은 친구 관계를 유지한 채 내 목록에서만 나가고(상대방에게는 "상대방이
// 나갔습니다"가 표시됨), 단체채팅은 내가 방장인 것만 선택할 수 있으며 삭제하면 모든
// 멤버에게서 채팅방이 완전히 사라진다.
const handleDeleteSelectedChats = () => {
  const totalCount = selectedFriendIds.length + selectedGroupChatIds.length;
  if (totalCount === 0) return;
  showConfirm(`선택한 ${totalCount}개의 채팅을 삭제하시겠습니까?`, async () => {
    const friendIdsToLeave = selectedFriendIds;
    const groupChatIdsToDelete = selectedGroupChatIds;
    setSelectedFriendIds([]);
    setSelectedGroupChatIds([]);
    setIsFriendSelectMode(false);

    const [friendResults, groupResults] = await Promise.all([
      Promise.allSettled(friendIdsToLeave.map((id) => api.post(`/chat/${id}/leave`))),
      Promise.allSettled(groupChatIdsToDelete.map((id) => api.delete(`/group-chats/${id}`))),
    ]);

    const succeededFriendIds = friendIdsToLeave.filter((_, i) => friendResults[i].status === "fulfilled");
    const succeededGroupChatIds = groupChatIdsToDelete.filter((_, i) => groupResults[i].status === "fulfilled");

    setHiddenChatFriendIds((prev) => [...prev, ...succeededFriendIds]);
    setGroupChatList((prev) => prev.filter((c) => !succeededGroupChatIds.includes(c._id)));

    const failedCount = (friendIdsToLeave.length - succeededFriendIds.length) + (groupChatIdsToDelete.length - succeededGroupChatIds.length);
    if (failedCount > 0) {
      showAlert("일부 채팅 삭제에 실패했습니다.");
    }
  });
};

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeFriend) return;
    const content = filterProfanity(chatInput.trim());
    const friendId = activeFriend._id;
    setChatInput("");
    try {
      const res = await api.post(`/chat/${friendId}`, { content });
      const [newMsg] = mapMessages([res.data]);
      setChatMessages((prev) => ({
        ...prev,
        [friendId]: [...(prev[friendId] || []), newMsg],
      }));
    } catch {
      showAlert("메시지 전송에 실패했습니다.");
    }
  };

  // 입력창이 비어있을 때 하트 버튼을 누르면 인스타처럼 하트 메시지를 바로 보낸다.
  const sendHeartMessage = async () => {
    if (!activeFriend) return;
    const friendId = activeFriend._id;
    try {
      const res = await api.post(`/chat/${friendId}`, { content: "❤️" });
      const [newMsg] = mapMessages([res.data]);
      setChatMessages((prev) => ({
        ...prev,
        [friendId]: [...(prev[friendId] || []), newMsg],
      }));
    } catch {
      showAlert("메시지 전송에 실패했습니다.");
    }
  };

  const handleAddComment = async () => {
  if (!selectedPost || !commentInput.trim()) return;
  const content = filterProfanity(commentInput.trim());
  const postId = selectedPost._id;
  // 답글이 또 다른 답글에 달리는 경우는 없으므로, 항상 최상위 댓글을 부모로 남긴다.
  const parentComment = replyTarget ? (replyTarget.parentComment || replyTarget._id) : null;
  setCommentInput("");
  setReplyTarget(null);
  if (parentComment) setExpandedReplies((prev) => ({ ...prev, [parentComment]: true }));
  try {
    const res = await api.post(`/posts/${postId}/comments`, { content, parentComment });
    setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, comments: res.data } : p)));
  } catch {
    showAlert("댓글 등록에 실패했습니다.");
  }
};
// 내가 작성한 댓글 삭제 (실제 DB에서 삭제)
  const handleDeleteComment = (postId: string, commentId: string) => {
    setOpenCommentMenu(null);
    showConfirm("댓글을 삭제하시겠습니까?", async () => {
      try {
        const res = await api.delete(`/posts/${postId}/comments/${commentId}`);
        setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, comments: res.data } : p)));
      } catch {
        showAlert("댓글 삭제에 실패했습니다.");
      }
    });
  };
  // ── 채팅 창 ──────────────────────────────────────────────────────────────
  if (activeGroupChat) {
    const messages = groupMessages[activeGroupChat._id] || [];

    // 멤버 목록 화면: 채팅 UI 자체를 렌더링하지 않고 이 화면만 단독으로 보여준다.
    if (showGroupChatMembers) {
      return (
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => { setShowGroupChatMembers(false); setShowChatSettings(true); }} className="text-lg" style={{ color: "var(--foreground)" }}>←</button>
            <p className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>
              멤버 {activeGroupChat.members.length}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
            {activeGroupChat.members.map((m) => (
              <div key={m._id} className="flex items-center justify-between gap-2 py-2">
                <button
                  onClick={() => {
                    if (currentUser && m._id === currentUser._id) {
                      onViewOwnProfile();
                    } else {
                      setViewingGroupMember(m);
                    }
                  }}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                    <img src={resolveAssetUrl(m.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {m.nickname}{m._id === activeGroupChat.host._id ? " (방장)" : ""}
                  </p>
                </button>
                {currentUser && m._id !== currentUser._id && (
                  <button
                    onClick={() => {
                      setGroupReportTarget(m);
                      setSelectedGroupMsgIds([]);
                      setShowGroupChatMembers(false);
                    }}
                    className="shrink-0"
                    style={{ color: "var(--muted-foreground)" }}
                    aria-label="사용자 신고"
                  >
                    <AlertTriangle size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {viewingGroupMember && (
            <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
              <OtherUserProfile
                author={viewingGroupMember}
                posts={allPosts}
                currentUserId={currentUser?._id}
                onBack={() => setViewingGroupMember(null)}
                onOpenPost={(postId) => {
                  setViewingGroupMember(null);
                  setShowGroupChatMembers(false);
                  setActiveGroupChat(null);
                  setSelectedPostId(postId);
                }}
                onMessage={(target) => {
                  setViewingGroupMember(null);
                  setShowGroupChatMembers(false);
                  setActiveGroupChat(null);
                  setShowChat(true);
                  setActiveFriend({ _id: target._id, nickname: target.nickname, avatar: target.avatar, studentId: target.studentId });
                }}
              />
            </div>
          )}
          {reportGroupMemberModal}
          {alertAndConfirmModals}
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => { setActiveGroupChat(null); setShowGroupChatMembers(false); setActiveGroupChatDeleted(false); }} className="text-lg">←</button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
              {activeGroupChat.name || activeGroupChat.post?.title ||
                activeGroupChat.members.filter((m) => m._id !== currentUser?._id).map((m) => m.nickname).join(", ")}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {activeGroupChat.post ? "공강모임 채팅방" : "단체 채팅방"}
            </p>
          </div>
          <button
            onClick={handleOpenChatSettings}
            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{ background: "var(--secondary)", color: "var(--primary)" }}
            aria-label="채팅 설정"
          >
            <Settings size={15} />
          </button>
        </div>

        {/* 메시지 선택으로 신고하기 안내 바 */}
        {groupReportTarget && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--foreground)" }}>
              <span className="font-semibold">{groupReportTarget.nickname}</span>님의 메시지를 선택하세요 ({selectedGroupMsgIds.length}/{MAX_REPORT_EVIDENCE})
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setGroupReportTarget(null); setSelectedGroupMsgIds([]); }}
                className="text-xs font-semibold px-2 py-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  const evidence = messages
                    .filter((m) => selectedGroupMsgIds.includes(m._id))
                    .map((m) => ({ content: m.content && m.content.trim() ? m.content : "(사진)" }));
                  setReportingGroupMemberEvidence(evidence);
                  setReportingGroupMember(groupReportTarget);
                }}
                disabled={selectedGroupMsgIds.length === 0}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{
                  background: selectedGroupMsgIds.length === 0 ? "var(--card)" : "#d4183d",
                  color: selectedGroupMsgIds.length === 0 ? "var(--muted-foreground)" : "white",
                }}
              >
                신고하기
              </button>
            </div>
          </div>
        )}

        {/* 멤버 목록 */}


        {/* 메시지 목록 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {messages.map((msg) => {
            if (msg.type === "system") {
              return (
                <p key={msg._id} className="text-center text-[11px] my-1" style={{ color: "var(--muted-foreground)" }}>
                  {msg.content}
                </p>
              );
            }
            const mine = currentUser?._id === msg.sender._id;
            const isReportable = !!groupReportTarget && msg.sender._id === groupReportTarget._id;
            const isSelected = selectedGroupMsgIds.includes(msg._id);
            const toggleSelectForReport = () => {
              if (!isReportable) return;
              setSelectedGroupMsgIds((prev) => {
                if (prev.includes(msg._id)) return prev.filter((id) => id !== msg._id);
                if (prev.length >= MAX_REPORT_EVIDENCE) {
                  showAlert(`메시지는 최대 ${MAX_REPORT_EVIDENCE}개까지 선택할 수 있습니다.`);
                  return prev;
                }
                return [...prev, msg._id];
              });
            };
            return (
              <div key={msg._id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {isReportable && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={toggleSelectForReport}
                    className="w-4 h-4 accent-orange-400 shrink-0"
                  />
                )}
                {!mine && (
  <button
    onClick={() => setViewingGroupMember(msg.sender)}
    className="w-7 h-7 rounded-full overflow-hidden shrink-0 self-start mt-5"
  >
    <img src={resolveAssetUrl(msg.sender.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
  </button>
)}
<div className={`max-w-[70%] flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
  {!mine && (
    <button
      onClick={() => setViewingGroupMember(msg.sender)}
      className="text-[11px] font-semibold"
      style={{ color: "var(--muted-foreground)" }}
    >
      {msg.sender.nickname}
    </button>
  )}
                  {msg.content && (
                    <div className="relative">
                      <div
                        onClick={isReportable ? toggleSelectForReport : undefined}
                        onDoubleClick={() => !isReportable && handleToggleGroupMessageLike(msg._id)}
                        className="px-3 py-2 rounded-2xl text-sm select-none"
                        style={{
                          background: mine ? "var(--primary)" : "var(--card)",
                          color: mine ? "white" : "var(--foreground)",
                          cursor: isReportable ? "pointer" : "default",
                          outline: isSelected ? "2px solid #d4183d" : "none",
                        }}
                      >
                        <p>{msg.content}</p>
                      </div>
                      {msg.liked && (
                        <span
                          className="absolute -bottom-2 flex items-center justify-center w-5 h-5 rounded-full"
                          style={mine ? { background: "var(--background)", left: -4 } : { background: "var(--background)", right: -4 }}
                        >
                          <Heart size={12} fill="#d4183d" color="#d4183d" />
                        </span>
                      )}
                    </div>
                  )}
                  {msg.image && (
                    <div className="relative">
                      <img
                        src={resolveAssetUrl(msg.image)}
                        alt="사진"
                        onClick={() => (isReportable ? toggleSelectForReport() : setViewingImage(msg.image!))}
                        onDoubleClick={() => !isReportable && handleToggleGroupMessageLike(msg._id)}
                        className="rounded-xl max-w-full cursor-pointer"
                        style={{ maxHeight: "200px", outline: isSelected ? "2px solid #d4183d" : "none" }}
                      />
                      {msg.liked && (
                        <span
                          className="absolute -bottom-2 flex items-center justify-center w-5 h-5 rounded-full"
                          style={mine ? { background: "var(--background)", left: -4 } : { background: "var(--background)", right: -4 }}
                        >
                          <Heart size={12} fill="#d4183d" color="#d4183d" />
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] opacity-70" style={{ color: "var(--muted-foreground)" }}>{formatMessageTime(msg.createdAt, nowTick)}</p>
                </div>
              </div>
            );
          })}
        </div>

       {/* 입력창 */}
        {activeGroupChatDeleted ? (
          <div className="flex items-center justify-center px-3 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>호스트가 채팅방을 삭제했습니다</p>
          </div>
        ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <label
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: "var(--muted)" }}
          >
            <Image size={17} style={{ color: "var(--foreground)" }} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !activeGroupChat) return;
                const groupChatId = activeGroupChat._id;
                try {
                  const formData = new FormData();
                  formData.append("image", file);
                  const res = await api.post(`/group-chats/${groupChatId}/messages`, formData);
                  setGroupMessages((prev) => ({ ...prev, [groupChatId]: [...(prev[groupChatId] || []), res.data] }));
                } catch {
                  showAlert("이미지 전송에 실패했습니다.");
                }
              }}
            />
          </label>
          <input
            value={groupChatInput}
            onChange={(e) => setGroupChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendGroupMessage(); }}
            placeholder="메시지 입력..."
            className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
            style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
          />
          {groupChatInput.trim() ? (
            <button
              onClick={handleSendGroupMessage}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--primary)" }}
            >
              <Send size={15} color="white" />
            </button>
          ) : (
            <button
              onClick={sendGroupHeartMessage}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--muted)" }}
              aria-label="하트 보내기"
            >
              <Heart size={17} color="#d4183d" />
            </button>
          )}
        </div>
        )}
        {viewingGroupMember && (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
            <OtherUserProfile
              author={viewingGroupMember}
              posts={allPosts}
              currentUserId={currentUser?._id}
              onBack={() => setViewingGroupMember(null)}
              onOpenPost={(postId) => {
                setViewingGroupMember(null);
                setActiveGroupChat(null);
                setSelectedPostId(postId);
              }}
              onMessage={(target) => {
                setViewingGroupMember(null);
                setActiveGroupChat(null);
                setShowChat(true);
                setActiveFriend({ _id: target._id, nickname: target.nickname, avatar: target.avatar, studentId: target.studentId });
              }}
            />
          </div>
        )}
        {/* 채팅 설정 플로팅 패널 */}
        {showChatSettings && (
          <div
            className="absolute inset-0 z-50 flex items-start justify-end"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setShowChatSettings(false)}
          >
            <div
              className="mt-16 mr-3 w-[260px] rounded-2xl shadow-lg overflow-hidden"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {chatSettingsView === "menu" ? (
                <>
                  {/* 대표 사진 + 이름 */}
                  <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
                    <label className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer shrink-0">
                      <img
                        src={resolveAssetUrl(activeGroupChat.avatar) || defaultAvatar}
                        alt="채팅방 대표 사진"
                        className="w-full h-full object-cover"
                        style={{ opacity: isUploadingGroupAvatar ? 0.5 : 1 }}
                      />
                      <span
                        className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "var(--primary)" }}
                      >
                        <Camera size={11} color="white" />
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingGroupAvatar}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) handleChangeGroupAvatar(file);
                        }}
                      />
                    </label>
                    <p className="text-sm font-semibold text-center truncate max-w-full" style={{ color: "var(--foreground)" }}>
                      {activeGroupChat.name || activeGroupChat.post?.title ||
                        activeGroupChat.members.filter((m) => m._id !== currentUser?._id).map((m) => m.nickname).join(", ")}
                    </p>
                  </div>

                  <button
                    onClick={() => { setRenameInput(activeGroupChat.name || ""); setChatSettingsView("rename"); }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="flex items-center gap-2"><Edit2 size={14} /> 채팅방 이름 변경</span>
                    <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                  <button
                    onClick={() => { setShowChatSettings(false); setShowGroupChatMembers(true); }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="flex items-center gap-2"><Users size={14} /> 멤버 목록</span>
                    <span className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      {activeGroupChat.members.length} <ChevronRight size={14} />
                    </span>
                  </button>
                  <button
                    onClick={() => { setShowChatSettings(false); openPhotoGallery(); }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left"
                    style={{ color: "var(--foreground)" }}
                  >
                    <span className="flex items-center gap-2"><Images size={14} /> 사진 모아보기</span>
                    <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                  <button
                    onClick={handleLeaveGroupChat}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left border-t"
                    style={{ color: "#d4183d", borderColor: "var(--border)" }}
                  >
                    <LogOut size={14} /> 채팅방 나가기
                  </button>
                </>
              ) : (
                <div className="px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setChatSettingsView("menu")} className="text-sm" style={{ color: "var(--muted-foreground)" }}>←</button>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>채팅방 이름 변경</p>
                  </div>
                  <input
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameGroupChat()}
                    maxLength={30}
                    placeholder="채팅방 이름"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                    autoFocus
                  />
                  <button
                    onClick={handleRenameGroupChat}
                    disabled={!renameInput.trim()}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{
                      background: renameInput.trim() ? "var(--primary)" : "var(--muted)",
                      color: renameInput.trim() ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    저장
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* 사진 확대 보기 팝업 */}
        {viewingImage && (
          <div
            className="absolute inset-0 z-[80] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.9)" }}
            onClick={() => setViewingImage(null)}
          >
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <X size={20} color="white" />
            </button>
            <img
              src={resolveAssetUrl(viewingImage)}
              alt="사진 크게 보기"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full rounded-xl object-contain"
            />
          </div>
        )}
        {photoGalleryModal}
        {reportGroupMemberModal}
        {alertAndConfirmModals}
      </div>
    );
  }

  if (activeFriend) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          {selectMode ? (
            <button onClick={() => { setSelectMode(false); setSelectedMsgs([]); }} className="text-sm font-semibold" style={{ color: "var(--primary)" }}>취소</button>
          ) : (
            <button onClick={() => setActiveFriend(null)} className="text-lg">←</button>
          )}
          <button
            onClick={openFriendProfileFromChat}
            className="relative w-9 h-9 rounded-full overflow-hidden shrink-0"
          >
            <img src={resolveAssetUrl(activeFriend.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
            {onlineUserIds.includes(activeFriend._id) && (
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                style={{ background: "#42d354", border: "2px solid var(--background)" }}
              />
            )}
          </button>
          <button
            onClick={openFriendProfileFromChat}
            className="flex-1 text-left"
          >
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{activeFriend.nickname}</p>
            <p className="text-xs" style={{ color: onlineUserIds.includes(activeFriend._id) ? "#42d354" : "var(--muted-foreground)" }}>
              {onlineUserIds.includes(activeFriend._id) ? "활동 중" : ""}
            </p>
          </button>
          {selectMode ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  selectedMsgs.forEach((id) => hiddenMessageIdsRef.current.add(id));
                  setChatMessages((prev) => ({
                    ...prev,
                    [activeFriend._id]: (prev[activeFriend._id] || []).filter((m) => !selectedMsgs.includes(m._id)),
                  }));
                  setSelectedMsgs([]);
                  setSelectMode(false);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "#d4183d", color: "white" }}
              >
                🗑️ 삭제 ({selectedMsgs.length})
              </button>
              <button
                onClick={() => setShowReportConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "var(--muted)", color: "#d4183d" }}
              >
                🚨 신고
              </button>
            </div>
          ) : (
            <button onClick={() => setShowChatMenu((v) => !v)} className="p-1 text-xl">⋮</button>
          )}
        </div>

        {/* ⋮ 드롭다운 */}
        {showChatMenu && (
          <div
            className="absolute right-4 top-16 z-50 rounded-xl shadow-lg overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)", minWidth: "160px" }}
          >
            <button
              onClick={() => { setShowChatMenu(false); setSelectMode(true); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
              style={{ color: "var(--foreground)" }}
            >
              ☑️ 메시지 선택
            </button>
            <button
              onClick={() => { setShowChatMenu(false); openPhotoGallery(); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
              style={{ color: "var(--foreground)" }}
            >
              <Images size={14} /> 사진 모아보기
            </button>
            <button
              onClick={() => {
              setShowChatMenu(false);

              showConfirm(
                `${activeFriend?.nickname}님을 차단하면
                더 이상 채팅을 주고받을 수 없습니다.

                차단하시겠습니까?`,
                async () => {
                  if (!activeFriend) return;
                  try {
                    await api.post(`/users/block/${activeFriend._id}`);
                  } catch {
                    showAlert("차단에 실패했습니다.");
                    return;
                  }
                  const now = new Date();
                  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  addBlockedUser({
                    id: activeFriend._id,
                    name: activeFriend.nickname,
                    reason: "채팅에서 차단",
                    date,
                  });

                  setFriends((prev) =>
                    prev.filter((f) => f._id !== activeFriend?._id)
                  );

                  setActiveFriend(null);

                  showAlert("차단되었습니다.");
                }
              );
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
            style={{
              color: "#d4183d"
            }}
          >
            🚫 차단
          </button>
          </div>
        )}

        {/* 신고 팝업 */}
        {showReportConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="rounded-2xl p-5 mx-6 w-full" style={{ background: "var(--card)" }}>
              <p className="font-semibold text-sm text-center mb-1" style={{ color: "var(--foreground)" }}>신고</p>
              <p className="text-xs text-center mb-3" style={{ color: "var(--muted-foreground)" }}>신고 이유를 선택해주세요</p>
              <div className="flex flex-col gap-2 mb-4">
                {["욕설/비방", "스팸/광고", "음란물", "개인정보 침해", "기타"].map((reason) => (
                  <button
                    key={reason}
                    onClick={async () => {
                      if (!activeFriend) return;
                      try {
                        await api.post("/reports", { targetType: "user", targetId: activeFriend._id, reason });
                      } catch {
                        showAlert("신고 접수에 실패했습니다.");
                        return;
                      }
                      setShowReportConfirm(false);
                      setSelectMode(false);
                      setSelectedMsgs([]);
                      showAlert(`"${reason}" 사유로 신고가 접수되었습니다.`);
                    }}
                    className="w-full py-2.5 rounded-xl text-sm text-left px-4"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowReportConfirm(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 메시지 목록 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-0.5 no-scrollbar">
          {(chatMessages[activeFriend._id] || []).map((msg, idx, arr) => {
            const prev = arr[idx - 1];
            const next = arr[idx + 1];
            // 인스타처럼 이전 메시지와 30분 이상 차이나거나 첫 메시지면 가운데 시간 구분선을 보여준다.
            const showDivider = !prev || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60 * 1000;
            // 같은 사람이 연달아 보낸 메시지는 클러스터로 묶어서 마지막 메시지에만 여백/아바타를 준다.
            const isFirstInCluster =
              !prev || prev.mine !== msg.mine || showDivider ||
              new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
            const isLastInCluster =
              !next || next.mine !== msg.mine ||
              new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000;
            const isVeryLast = idx === arr.length - 1;
            // 인스타처럼 같은 사람이 연달아 보낸 버블은 이어지는 쪽 모서리를 좁혀서 "쌓인" 느낌을 준다.
            const tightCorner = "6px";
            const roundCorner = "20px";
            const bubbleRadius = msg.mine
              ? {
                  borderTopRightRadius: isFirstInCluster ? roundCorner : tightCorner,
                  borderBottomRightRadius: isLastInCluster ? roundCorner : tightCorner,
                  borderTopLeftRadius: roundCorner,
                  borderBottomLeftRadius: roundCorner,
                }
              : {
                  borderTopLeftRadius: isFirstInCluster ? roundCorner : tightCorner,
                  borderBottomLeftRadius: isLastInCluster ? roundCorner : tightCorner,
                  borderTopRightRadius: roundCorner,
                  borderBottomRightRadius: roundCorner,
                };
            return (
            <div key={msg._id}>
              {showDivider && (
                <p className="text-center text-[11px] my-3" style={{ color: "var(--muted-foreground)" }}>
                  {formatDividerTime(msg.createdAt)}
                </p>
              )}
              <div className={`flex items-end gap-2 ${msg.mine ? "justify-end" : "justify-start"} ${isLastInCluster ? "mb-2.5" : "mb-0.5"}`}>
                {selectMode && msg.mine && (
                  <input
                    type="checkbox"
                    checked={selectedMsgs.includes(msg._id)}
                    onChange={() => {
                      setSelectedMsgs((prev) =>
                        prev.includes(msg._id) ? prev.filter((id) => id !== msg._id) : [...prev, msg._id]
                      );
                    }}
                    className="w-4 h-4 accent-orange-400"
                  />
                )}
                {!msg.mine && (
  isLastInCluster ? (
    <button
      onClick={openFriendProfileFromChat}
      className="w-6 h-6 rounded-full overflow-hidden shrink-0"
    >
      <img src={resolveAssetUrl(activeFriend.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
    </button>
  ) : (
    <div className="w-6 shrink-0" />
  )
)}
                <div className={`max-w-[70%] flex flex-col gap-1 ${msg.mine ? "items-end" : "items-start"}`}>
                  {msg.content && (
                    <div
                      className="relative"
                      onClick={() => setRevealedTimeId((id) => (id === msg._id ? null : msg._id))}
                      onDoubleClick={() => handleToggleMessageLike(msg._id)}
                    >
                      <div
                        className="px-3.5 py-2 text-[14px] leading-snug select-none cursor-pointer"
                        style={{
                          background: msg.mine ? "var(--primary)" : "var(--card)",
                          color: msg.mine ? "white" : "var(--foreground)",
                          outline: selectedMsgs.includes(msg._id) ? "2px solid var(--primary)" : "none",
                          ...bubbleRadius,
                        }}
                      >
                        <p>{msg.content}</p>
                      </div>
                      {msg.liked && (
                        <span
                          className="absolute -bottom-2 flex items-center justify-center w-5 h-5 rounded-full"
                          style={msg.mine ? { background: "var(--background)", left: -4 } : { background: "var(--background)", right: -4 }}
                        >
                          <Heart size={12} fill="#d4183d" color="#d4183d" />
                        </span>
                      )}
                    </div>
                  )}
                  {msg.image && (
                    <div className="relative">
                      <img
                        src={resolveAssetUrl(msg.image)}
                        alt="사진"
                        onClick={() => setViewingImage(msg.image!)}
                        onDoubleClick={() => handleToggleMessageLike(msg._id)}
                        className="rounded-2xl max-w-full cursor-pointer"
                        style={{
                          maxHeight: "200px",
                          outline: selectedMsgs.includes(msg._id) ? "2px solid var(--primary)" : "none",
                        }}
                      />
                      {msg.liked && (
                        <span
                          className="absolute -bottom-2 flex items-center justify-center w-5 h-5 rounded-full"
                          style={msg.mine ? { background: "var(--background)", left: -4 } : { background: "var(--background)", right: -4 }}
                        >
                          <Heart size={12} fill="#d4183d" color="#d4183d" />
                        </span>
                      )}
                    </div>
                  )}
                  {(revealedTimeId === msg._id || (isLastInCluster && isVeryLast && msg.mine && msg.read)) && (
                    <p className="text-[10px] opacity-70" style={{ color: "var(--muted-foreground)" }}>
                      {revealedTimeId === msg._id ? formatMessageTime(msg.createdAt, nowTick) : ""}
                      {isVeryLast && msg.mine && msg.read ? (revealedTimeId === msg._id ? " · 읽음" : "읽음") : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* 입력창 */}
        {activeFriendTheyLeft ? (
          <div className="flex items-center justify-center px-3 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>상대방이 나갔습니다</p>
          </div>
        ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <label
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: "var(--muted)" }}
          >
            <Image size={17} style={{ color: "var(--foreground)" }} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !activeFriend) return;
                const friendId = activeFriend._id;
                try {
                  const formData = new FormData();
                  formData.append("image", file);
                  const res = await api.post(`/chat/${friendId}`, formData);
                  const [newMsg] = mapMessages([res.data]);
                  setChatMessages((prev) => ({
                    ...prev,
                    [friendId]: [...(prev[friendId] || []), newMsg],
                  }));
                } catch {
                  showAlert("이미지 전송에 실패했습니다.");
                }
              }}
            />
          </label>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="메시지 입력..."
            className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
            style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
          />
          {chatInput.trim() ? (
            <button
              onClick={sendMessage}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--primary)" }}
            >
              <Send size={15} color="white" />
            </button>
          ) : (
            <button
              onClick={sendHeartMessage}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--muted)" }}
              aria-label="하트 보내기"
            >
              <Heart size={17} color="#d4183d" />
            </button>
          )}
        </div>
        )}

        {/* 이미지 뷰어 팝업 */}
        {viewingImage && (
          <div
            className="absolute inset-0 z-[80] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.9)" }}
            onClick={() => setViewingImage(null)}
          >
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <X size={20} color="white" />
            </button>
            <img
              src={viewingImage}
              alt="사진 크게 보기"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full rounded-xl object-contain"
            />
          </div>
        )}

        {photoGalleryModal}
        {alertAndConfirmModals}
      </div>
    );
  }

  // ── 작성자 프로필 화면 (내 프로필과 동일한 인스타 스타일 구성) ──────────────────
  if (viewedAuthor) {
    return (
      <OtherUserProfile
        author={viewedAuthor}
        posts={allPosts}
        currentUserId={currentUser?._id}
        onBack={() => {
          setViewedAuthor(null);
          if (returnToChatFriend) {
            setActiveFriend(returnToChatFriend);
            setReturnToChatFriend(null);
          }
        }}
        onOpenPost={(postId) => {
          setViewedAuthor(null);
          setSelectedPostId(postId);
          setReturnToChatFriend(null);
        }}
        onMessage={(target) => {
          setViewedAuthor(null);
          setReturnToChatFriend(null);
          setShowChat(true);
          setActiveFriend({ _id: target._id, nickname: target.nickname, avatar: target.avatar, studentId: target.studentId });
        }}
      />
    );
  }

   // ── 게시물 상세 화면 ──────────────────────────────────────────────────────
 if (selectedPost) {
  const renderCommentItem = (c: PostComment, isReply: boolean) => (
    <div key={c._id} className="flex gap-2 items-start relative" style={isReply ? { marginLeft: 28 } : undefined}>
      <div className={`${isReply ? "w-6 h-6" : "w-7 h-7"} rounded-full flex items-center justify-center text-sm cursor-pointer overflow-hidden shrink-0`}
        style={{ background: "var(--muted)" }}
        onClick={() => openAuthor(c.author)}>
        <img src={getAuthorAvatarUrl(c.author) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 px-3 py-2 rounded-xl text-xs flex items-start justify-between gap-2"
        style={{ color: "var(--foreground)" }}>
        <div>
          <span
            className="block font-semibold cursor-pointer"
            onClick={() => openAuthor(c.author)}
          >
            {c.author.nickname}
          </span>
          <span style={{ color: "var(--muted-foreground)" }}>{renderLinkifiedText(c.content)}</span>
          <div className="flex items-center gap-3 mt-1" style={{ color: "var(--muted-foreground)" }}>
            <span className="text-[11px]">{getDisplayTime(c, nowTick)}</span>
            {!isReply && (
              <button
                onClick={() => {
                  setReplyTarget(c);
                  commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  commentInputRef.current?.focus();
                }}
                className="text-[11px] font-semibold"
                style={{ color: "var(--muted-foreground)" }}
              >
                답글 달기
              </button>
            )}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setOpenCommentMenu(openCommentMenu === c._id ? null : c._id)}
            style={{ color: "var(--muted-foreground)" }}
            aria-label="댓글 더보기"
          >
            <MoreVertical size={14} />
          </button>
          {openCommentMenu === c._id && (
            <div
              className="absolute right-0 top-6 z-20 rounded-xl shadow-lg py-1 min-w-[90px]"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {currentUser && (c.author._id === currentUser._id || isAdmin) ? (
                <button
                  onClick={() => handleDeleteComment(selectedPost._id, c._id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:opacity-70"
                  style={{ color: "#d4183d" }}
                >
                  <Trash2 size={13} /> 삭제
                </button>
              ) : (
                <button
                  onClick={() => {
                    setOpenCommentMenu(null);
                    handleReportCommentAuthor(c);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:opacity-70"
                  style={{ color: "#d4183d" }}
                >
                  <AlertTriangle size={13} /> 신고
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const commentsList = (
    <>
      <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
        댓글 {getCommentCount(selectedPost)}개
      </p>
      {selectedPost.comments.filter((c) => !c.parentComment).map((c) => {
        const replies = selectedPost.comments.filter((r) => r.parentComment === c._id);
        const isExpanded = !!expandedReplies[c._id];
        return (
          <div key={c._id} className="flex flex-col gap-2">
            {renderCommentItem(c, false)}
            {replies.length > 0 && (
              <button
                onClick={() => setExpandedReplies((prev) => ({ ...prev, [c._id]: !prev[c._id] }))}
                className="flex items-center gap-2 text-[11px] font-semibold"
                style={{ color: "var(--muted-foreground)", marginLeft: 40 }}
              >
                <span style={{ width: 20, height: 1, background: "var(--border)" }} />
                {isExpanded ? "답글 숨기기" : `답글 ${replies.length}개 보기`}
              </button>
            )}
            {isExpanded && replies.map((r) => renderCommentItem(r, true))}
          </div>
        );
      })}
    </>
  );
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => setSelectedPostId(null)} className="text-lg">
          ←
        </button>
        {selectedPost.board === "event" || selectedPost.board === "qna" ? (
  <>
    <button
      onClick={() => openAuthor(selectedPost.author)}
      className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ background: "var(--muted)" }}
    >
      <img src={getAuthorAvatarUrl(selectedPost.author) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
    </button>
            <button
              onClick={() => openAuthor(selectedPost.author)}
              className="font-semibold text-sm flex-1 text-left truncate"
              style={{ color: "var(--foreground)" }}
            >
              {selectedPost.author.nickname}
            </button>
            {currentUser && selectedPost.author._id !== currentUser._id && (
              <button
                onClick={() => toggleEventFollow(selectedPost.author._id)}
                className="text-xs font-semibold px-1 shrink-0"
                style={{ color: eventFollowingIds.includes(selectedPost.author._id) ? "var(--muted-foreground)" : "var(--primary)" }}
              >
                {eventFollowingIds.includes(selectedPost.author._id) ? "팔로잉" : "팔로우"}
              </button>
            )}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowMoreMenu(showMoreMenu === selectedPost._id ? null : selectedPost._id)}
                style={{ color: "var(--foreground)" }}
                aria-label="더보기"
              >
                <MoreHorizontal size={20} />
              </button>
              {showMoreMenu === selectedPost._id && (
                <div
                  className="absolute right-0 top-7 z-50 rounded-xl shadow-lg overflow-hidden min-w-[130px]"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  {renderPostMoreMenu(
                    selectedPost,
                    () => {
                      setShowMoreMenu(null);
                      setEditTitle(selectedPost.title);
                      setEditContent(selectedPost.content);
                      setEditPollQuestion(selectedPost.poll?.question ?? "");
                      setEditPollOptions(selectedPost.poll ? selectedPost.poll.options.map((o) => o.text) : []);
                      setEditPollDeleteMode(false);
                      setEditPollDeleted(false);
                      setShowPollDeleteConfirm(false);
                      setEditingPost(selectedPost);
                    },
                    () => {
                      setShowMoreMenu(null);
                      setPosts((prev) => prev.filter((p) => p._id !== selectedPost._id));
                      setSelectedPostId(null);
                    }
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
          <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(showMoreMenu === selectedPost._id ? null : selectedPost._id)}
              style={{ color: "var(--foreground)" }}
            >
              <MoreVertical size={20} />
            </button>
            {showMoreMenu === selectedPost._id && (
              <div
                className="absolute right-0 top-7 z-50 rounded-xl shadow-lg overflow-hidden"
                style={{ background: "var(--card)", border: "1px solid var(--border)", minWidth: "130px" }}
              >
                {renderPostMoreMenu(
                  selectedPost,
                  () => {
                    setShowMoreMenu(null);
                    setEditTitle(selectedPost.title);
                    setEditContent(selectedPost.content);
                    setEditPollQuestion(selectedPost.poll?.question ?? "");
                    setEditPollOptions(selectedPost.poll ? selectedPost.poll.options.map((o) => o.text) : []);
                    setEditPollDeleteMode(false);
                    setEditPollDeleted(false);
                    setShowPollDeleteConfirm(false);
                    setEditingPost(selectedPost);
                  },
                  () => {
                    setShowMoreMenu(null);
                    setPosts((prev) => prev.filter((p) => p._id !== selectedPost._id));
                    setSelectedPostId(null);
                  }
                )}
              </div>
            )}
          </div>
          </>
        )}
        
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {selectedPost.board === "event" || selectedPost.board === "qna" ? (
  /* 행사공지 게시물은 정사각형 이미지가 커서 게시물 카드만으로 화면 높이를 다 채울 수
     있다. 그래서 게시물 카드를 화면에 고정하지 않고, 카드와 댓글 목록을 하나의 스크롤
     영역으로 묶어 댓글을 작성하면 항상 목록에서 확인할 수 있게 한다. */
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 no-scrollbar">
            <div className="pb-3">
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "var(--card)" }}>
                {/* 인스타그램 스타일 이미지 영역 */}
                {selectedPost.images.length > 0 && (
                  <div className="relative w-full aspect-square" style={{ background: "var(--muted)" }}>
                    <img
                      src={resolveAssetUrl(selectedPost.images[eventImageIndex] || selectedPost.images[0])}
                      alt="첨부 이미지"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setFullscreenPostImage(resolveAssetUrl(selectedPost.images[eventImageIndex] || selectedPost.images[0]) || null)}
                    />
                    {selectedPost.images.length > 1 && (
                      <>
                        <span
                          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
                        >
                          {eventImageIndex + 1}/{selectedPost.images.length}
                        </span>
                        <button
                          className="absolute inset-y-0 left-0 w-1/3"
                          onClick={() => setEventImageIndex((i) => Math.max(0, i - 1))}
                          aria-label="이전 이미지"
                        />
                        <button
                          className="absolute inset-y-0 right-0 w-1/3"
                          onClick={() => setEventImageIndex((i) => Math.min(selectedPost.images.length - 1, i + 1))}
                          aria-label="다음 이미지"
                        />
                        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                          {selectedPost.images.map((_, i) => (
                            <span
                              key={i}
                              className="rounded-full"
                              style={{
                                width: 5, height: 5,
                                background: i === eventImageIndex ? "white" : "rgba(255,255,255,0.5)",
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="p-4">
                  {/* 좋아요 / 댓글 / 공유 / 저장 아이콘 행 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleLike(selectedPost)}>
                        <Heart size={22} fill={isLiked(selectedPost) ? "#3b82f6" : "none"}
                          color={isLiked(selectedPost) ? "#3b82f6" : "var(--foreground)"} />
                      </button>
                      <button
                        onClick={() => {
                          commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          commentInputRef.current?.focus();
                        }}
                      >
                        <MessageCircle size={22} style={{ color: "var(--foreground)" }} />
                      </button>
                    </div>
                    <button onClick={() => toggleSave(selectedPost._id)}>
                      <Bookmark size={22} fill={savedPosts[selectedPost._id] ? "var(--primary)" : "none"}
                        color={savedPosts[selectedPost._id] ? "var(--primary)" : "var(--foreground)"} />
                    </button>
                  </div>

                  <p
                    className="text-sm font-semibold mb-1 cursor-pointer w-fit"
                    style={{ color: "var(--foreground)" }}
                    onClick={() => openReactionList(selectedPost._id, "likes")}
                  >
                    좋아요 {selectedPost.likes.length}개
                  </p>

                  <p
  className="text-sm leading-relaxed"
  style={{
    color: "var(--foreground)",
    wordBreak: "break-all",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  }}
>
  <span
    className="font-semibold mr-1.5 cursor-pointer"
    onClick={(e) => { e.stopPropagation(); openAuthor(selectedPost.author); }}
  >
    {selectedPost.author.nickname}
  </span>
  <span className="font-semibold">{selectedPost.title}</span>
  {selectedPost.content && <>{" "}{renderLinkifiedText(selectedPost.content)}</>}
</p>

                  {selectedPost.tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedPost.tags.map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {commentsList}
            </div>
          </div>
       ) : (
  <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 no-scrollbar">
    {/* 게시물 카드: 내용이 아무리 길어도 위 스크롤 영역 안에서 자연스럽게 스크롤된다 */}
    <div className="pb-3">
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              openAuthor(selectedPost.author);
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
            style={{ background: "var(--muted)" }}
          >
            <img src={getAuthorAvatarUrl(selectedPost.author) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
          </button>
          <div className="flex-1 cursor-pointer" onClick={() => openAuthor(selectedPost.author)}>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {selectedPost.author.nickname}
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {getDisplayTime(selectedPost, nowTick)}
            </p>
          </div>
          {selectedPost.price && (
            <span className="px-2 py-1 rounded-xl text-xs font-bold"
              style={{ background: "var(--accent)", color: "var(--foreground)" }}>
              {selectedPost.price}원
            </span>
          )}
        </div>

        <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{selectedPost.title}</h3>

        {selectedPost.board === "meeting" && selectedPost.tags && selectedPost.tags.length >= 2 && (
          <p className="text-xs mb-1.5 mt-2" style={{ color: "var(--muted-foreground)" }}>
            ⏰ {selectedPost.tags[0]} · 📍 {selectedPost.tags[1]}
          </p>
        )}
        {selectedPost.board === "lecture" && selectedPost.tags && selectedPost.tags.length >= 2 && (
          <p className="text-xs mb-1.5 mt-2" style={{ color: "var(--muted-foreground)" }}>
            {selectedPost.tags[0]} · {selectedPost.tags[1]} 교수님
          </p>
        )}
        {selectedPost.rating && (
          <div className="flex items-center gap-1 mb-1.5">
            {renderRatingStars(selectedPost.rating, 14)}
            <span className="text-xs ml-1 font-semibold" style={{ color: "var(--foreground)" }}>
              {selectedPost.rating.toFixed(1)}
            </span>
          </div>
        )}

        <p
          className="text-sm leading-relaxed mt-1"
          style={{
            color: "var(--muted-foreground)",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
          }}
        >
          {renderLinkifiedText(selectedPost.content)}
        </p>

        {selectedPost.images.length > 0 && (
          <div className="relative w-full mt-2 rounded-xl overflow-hidden" style={{ background: "var(--muted)" }}>
            <img
              src={resolveAssetUrl(selectedPost.images[eventImageIndex] || selectedPost.images[0])}
              alt="첨부 이미지"
              className="w-full max-h-72 object-cover cursor-pointer"
              onClick={() => setFullscreenPostImage(resolveAssetUrl(selectedPost.images[eventImageIndex] || selectedPost.images[0]) || null)}
            />
            {selectedPost.images.length > 1 && (
              <>
                <span
                  className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
                >
                  {eventImageIndex + 1}/{selectedPost.images.length}
                </span>
                <button
                  className="absolute inset-y-0 left-0 w-1/3"
                  onClick={() => setEventImageIndex((i) => Math.max(0, i - 1))}
                  aria-label="이전 이미지"
                />
                <button
                  className="absolute inset-y-0 right-0 w-1/3"
                  onClick={() => setEventImageIndex((i) => Math.min(selectedPost.images.length - 1, i + 1))}
                  aria-label="다음 이미지"
                />
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                  {selectedPost.images.map((_, i) => (
                    <span
                      key={i}
                      className="rounded-full"
                      style={{
                        width: 5, height: 5,
                        background: i === eventImageIndex ? "white" : "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {selectedPost.tags && selectedPost.board !== "lecture" && selectedPost.board !== "meeting" && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedPost.tags.map((tag, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
        {selectedPost.maxParticipants && (
          <div className="mt-2">
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: selectedPost.currentParticipants === selectedPost.maxParticipants ? "#5cb85c22" : "var(--secondary)",
                color: selectedPost.currentParticipants === selectedPost.maxParticipants ? "#5cb85c" : "var(--primary)",
              }}
            >
              {selectedPost.currentParticipants}/{selectedPost.maxParticipants}명
              {selectedPost.currentParticipants === selectedPost.maxParticipants ? " 모집완료" : " 모집중"}
            </span>
          </div>
        )}

        {renderPoll(selectedPost)}

        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleLike(selectedPost)}>
              <Heart size={16} fill={isLiked(selectedPost) ? "#3b82f6" : "none"}
                color={isLiked(selectedPost) ? "#3b82f6" : "var(--muted-foreground)"} />
            </button>
            <span
              className="text-xs cursor-pointer"
              style={{ color: isLiked(selectedPost) ? "var(--primary)" : "var(--muted-foreground)" }}
              onClick={() => openReactionList(selectedPost._id, "likes")}
            >
              {selectedPost.likes.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleDislike(selectedPost)}>
              <ThumbsDown size={16} fill={isDisliked(selectedPost) ? "#d4183d" : "none"}
                color={isDisliked(selectedPost) ? "#d4183d" : "var(--muted-foreground)"} />
            </button>
            <span
              className="text-xs cursor-pointer"
              style={{ color: isDisliked(selectedPost) ? "#d4183d" : "var(--muted-foreground)" }}
              onClick={() => openReactionList(selectedPost._id, "dislikes")}
            >
              {selectedPost.dislikes.length}
            </span>
          </div>
          <button className="flex items-center gap-1.5"
            onClick={() => {
              commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              commentInputRef.current?.focus();
            }}>
            <MessageCircle size={16} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(selectedPost)}</span>
          </button>
          <button className="flex items-center gap-1.5"
            onClick={() => toggleSave(selectedPost._id)}>
            <Bookmark size={16} fill={savedPosts[selectedPost._id] ? "var(--primary)" : "none"}
              color={savedPosts[selectedPost._id] ? "var(--primary)" : "var(--muted-foreground)"} />
          </button>

          {selectedPost.board === "meeting" && currentUser && hasJoinedMeeting(selectedPost) && (
            <button
              onClick={() => openGroupChatForPost(selectedPost._id)}
              className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
              style={{ background: "var(--secondary)", color: "var(--primary)" }}
            >
              <MessageCircle size={13} /> 채팅방
            </button>
          )}
          {selectedPost.board === "meeting" && currentUser && selectedPost.author._id !== currentUser._id && (
            <button
              onClick={() => handleMeetingButtonClick(selectedPost)}
              disabled={!hasJoinedMeeting(selectedPost) && isMeetingFull(selectedPost)}
              className={`${hasJoinedMeeting(selectedPost) ? "" : "ml-auto"} px-3 py-1.5 rounded-xl text-xs font-semibold`}
              style={{
                background: hasJoinedMeeting(selectedPost) || isMeetingFull(selectedPost) ? "var(--muted)" : "var(--primary)",
                color: hasJoinedMeeting(selectedPost) || isMeetingFull(selectedPost) ? "var(--muted-foreground)" : "white",
                cursor: !hasJoinedMeeting(selectedPost) && isMeetingFull(selectedPost) ? "not-allowed" : "pointer",
              }}
            >
              {hasJoinedMeeting(selectedPost) ? "참여중" : isMeetingFull(selectedPost) ? "모집완료" : "참여"}
            </button>
          )}
        </div>
      </div>
    </div>
    {/* 댓글 목록: 이제 위 게시물 카드와 같은 스크롤 영역 안에 있어서, 게시물 내용이 아무리
        길어도 화면 밖으로 잘리지 않고 함께 스크롤된다 */}
    <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      {commentsList}
    </div>
  </div>
)}
      </div>

      {/* 댓글 입력 */}
      {replyTarget && (
        <div className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
          <span><span className="font-semibold">{replyTarget.author.nickname}</span>님에게 답글 남기는 중</span>
          <button onClick={() => setReplyTarget(null)} aria-label="답글 취소">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <input
          ref={commentInputRef}
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddComment();
          }}
          placeholder={replyTarget ? `${replyTarget.author.nickname}님에게 답글 남기기...` : "댓글 입력..."}
          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: "var(--input-background)", color: "white", border: "1.5px solid var(--border)" }}
        />
        <button
          onClick={handleAddComment}
          disabled={!commentInput.trim()}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: commentInput.trim() ? "var(--primary)" : "var(--muted)",
            color: commentInput.trim() ? "white" : "var(--muted-foreground)",
            cursor: commentInput.trim() ? "pointer" : "not-allowed",
          }}
        >
          등록
        </button>
      </div>

      {/* 좋아요/싫어요 누른 사람 목록 */}
      {reactionListModal && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setReactionListModal(null)}>
              <X size={20} style={{ color: "var(--foreground)" }} />
            </button>
            <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>
              {reactionListModal.type === "likes" ? "좋아요" : "싫어요"}
            </h2>
          </div>
<div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 no-scrollbar pointer-events-auto">
            {reactionListUsers.length === 0 ? (
              <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
                {reactionListModal.type === "likes" ? "아직 좋아요를 누른 사람이 없습니다." : "아직 싫어요를 누른 사람이 없습니다."}
              </p>
            ) : (
              reactionListUsers.map((u) => (
                <button
                  key={u._id}
                  onClick={() => { setReactionListModal(null); openAuthor(u); }}
                  className="flex items-center gap-3 p-2.5 rounded-xl text-left"
                  style={{ background: "var(--card)" }}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    <img src={resolveAssetUrl(u.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{u.nickname}</p>
                    {u.studentId && (
                      <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{u.studentId}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
{editingPost && (
        <div className="absolute inset-0 z-[60] flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setEditingPost(null)} className="text-lg">←</button>
            <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물 수정</h2>
            <button
              onClick={async () => {
                try {
                  const res = await api.patch(`/posts/${editingPost._id}`, {
                    title: editTitle,
                    content: editContent,
                  });
                  setPosts((prev) => prev.map((p) => p._id === editingPost._id ? res.data : p));
                  setEditingPost(null);
                  showAlert("게시물이 수정되었습니다.");
                } catch {
                  showAlert("수정에 실패했습니다.");
                }
              }}
              style={{ color: "var(--primary)" }}
              className="text-sm font-semibold"
            >
              완료
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted-foreground)" }}>제목</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--muted-foreground)" }}>내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
            </div>
          </div>
        </div>
      )}
      {reportCommentModal} 
      {alertAndConfirmModals}
      {fullscreenImageViewer}
    </div>
  );
}

  // ── 검색 화면 ─────────────────────────────────────────────────────────────
  if (showSearch) {
    const getBoardLabel = (board?: BoardType) => BOARDS.find((b) => b.id === board)?.label ?? "";

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 헤더 */}
        <div
          className="flex items-center gap-2 px-4 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); }}
            className="text-lg shrink-0"
            style={{ color: "var(--foreground)" }}
          >
            ←
          </button>
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              type="text"
              autoFocus
              placeholder="게시물 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRecentSearch(searchQuery); }}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 no-scrollbar">
          {!searchQuery.trim() && (
            recentSearches.length === 0 ? (
              <p className="text-center text-sm py-10" style={{ color: "var(--muted-foreground)" }}>
                검색어를 입력해주세요.
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>최근 검색어</span>
                  <button
                    onClick={() => { setRecentSearches([]); saveRecentSearches([]); }}
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    전체삭제
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((q) => (
                    <span
                      key={q}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                      style={{ background: "var(--muted)", color: "var(--foreground)" }}
                    >
                      <button onClick={() => setSearchQuery(q)}>{q}</button>
                      <button onClick={() => removeRecentSearch(q)}>
                        <X size={12} style={{ color: "var(--muted-foreground)" }} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
          {searchQuery.trim() && visiblePosts.length === 0 && (
            <p className="text-center text-sm py-10" style={{ color: "var(--muted-foreground)" }}>
              검색 결과가 없어요.
            </p>
          )}
          {searchQuery.trim() && visiblePosts.map((post) => (
            <div
              key={post._id}
              onClick={() => {
                addRecentSearch(searchQuery);
                setSelectedPostId(post._id);
              }}
              className="p-4 rounded-2xl cursor-pointer"
              style={{ background: "var(--card)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                {getBoardLabel(post.board)}
              </p>
              <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                {post.title}
              </h3>
              <p
  className="text-xs leading-relaxed mb-2"
  style={{
    color: "var(--muted-foreground)",
    wordBreak: "break-all",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }}
>
  {renderLinkifiedText(post.content)}
</p>
              <div className="flex items-center gap-3">
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                  <Heart size={12} /> {post.likes.length}
                </span>
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                  <MessageCircle size={12} /> {getCommentCount(post)}
                </span>
                <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
                  {getDisplayTime(post, nowTick)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {alertAndConfirmModals}
      </div>
    );
  }

  // ── 커뮤니티 메인 ─────────────────────────────────────────────────────────


  return (
  <div className="flex flex-col flex-1 overflow-hidden relative">

    {/* Header */}
    <div className="px-4 pt-5 pb-3 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img src={bigRoadingIcon} alt="Big Roading" className="w-14 h-14 object-cover" />
          <div>
            <h1
              className="text-2xl"
              style={{
                color: "var(--foreground)",
                fontFamily: "'Brush Script MT', cursive",
              }}
            >
              Big Ding
            </h1>
          </div>
        </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: showSearch ? "var(--primary)" : "var(--muted)" }}
            >
              <Search size={18} color={showSearch ? "white" : "var(--foreground)"} />
            </button>
            <button
              onClick={openNotifications}
              className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "var(--muted)" }}
            >
              <Bell size={18} color="var(--foreground)" />
              {unreadNotifCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: "#d4183d", lineHeight: 1 }}
                >
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
      </div>

      {/* Board tabs */}
      {!showSearch && (
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar shrink-0">
          {BOARDS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => setActiveBoard(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: activeBoard === id ? "var(--primary)" : "var(--muted)",
                color: activeBoard === id ? "white" : "var(--muted-foreground)",
              }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      )}

      {/* 정렬(모든 게시판) + 꿀팁 게시판 카테고리 필터 */}
      {!showSearch && (
        <div className="relative flex justify-end items-center gap-2 px-4 pb-3 shrink-0">
          {activeBoard === "contest" && (
            <div className="relative">
              <button
                onClick={() => setShowContestFilterMenu((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap"
                style={{
                  background: activeContestFilter ? "var(--primary)" : "var(--muted)",
                  color: activeContestFilter ? "white" : "var(--muted-foreground)",
                }}
              >
                {activeContestFilter ?? "필터"}
                {showContestFilterMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showContestFilterMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 min-w-[110px]"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <button
                    onClick={() => {
                      setActiveContestFilter(null);
                      setShowContestFilterMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-left"
                    style={{ color: activeContestFilter === null ? "var(--primary)" : "var(--foreground)" }}
                  >
                    전체
                  </button>
                  {CONTEST_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setActiveContestFilter(filter);
                        setShowContestFilterMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs text-left"
                      style={{ color: activeContestFilter === filter ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 최신순/인기순 정렬: 모든 게시판에서 노출 */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {sortOrder === "latest" ? "최신순" : "인기순"}
              {showSortDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showSortDropdown && (
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 min-w-[90px]"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => { setSortOrder("latest"); setShowSortDropdown(false); }}
                  className="w-full px-3 py-2 text-xs text-left"
                  style={{ color: sortOrder === "latest" ? "var(--primary)" : "var(--foreground)" }}
                >
                  최신순
                </button>
                <button
                  onClick={() => { setSortOrder("popular"); setShowSortDropdown(false); }}
                  className="w-full px-3 py-2 text-xs text-left"
                  style={{ color: sortOrder === "popular" ? "var(--primary)" : "var(--foreground)" }}
                >
                  인기순
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 더보기 메뉴 / 꿀팁 필터 메뉴 / 정렬 메뉴 외부 클릭 닫기 */}
      {(showMoreMenu !== null || showContestFilterMenu || showSortDropdown) && (
        <div
          className="absolute inset-0 z-10"
          onClick={() => {
            setShowMoreMenu(null);
            setShowContestFilterMenu(false);
            setShowSortDropdown(false);
          }}
        />
      )}
      {/* Posts */}
<div
  ref={feedScrollRef}
  onScroll={(e) => { feedScrollPositionRef.current = e.currentTarget.scrollTop; }}
  className="flex-1 overflow-y-auto px-4 pb-20 flex flex-col gap-3 no-scrollbar"
>
        {postsLoading && sortedVisiblePosts.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
            게시물을 불러오는 중...
          </p>
        )}
        {!postsLoading && sortedVisiblePosts.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
            아직 게시물이 없어요.
          </p>
        )}
        {sortedVisiblePosts.map((post) => (
         <div
  key={post._id}
  onClick={() => setSelectedPostId(post._id)}
  className="rounded-2xl p-4 shadow-sm relative flex flex-col shrink-0 cursor-pointer"
  style={
  post.board === "event" || post.board === "qna"
    ? { background: "var(--card)", borderLeft: `3px solid ${BOARD_ACCENTS[post.board]}` }
    : { background: "var(--card)", minHeight: "184px", borderLeft: `3px solid ${BOARD_ACCENTS[post.board]}` }
}
>
            {/* Author */}
{post.board === "event" || post.board === "qna" ? (
  <div className="flex items-center gap-2 mb-2 pr-8">
    <button
      onClick={(e) => {
        e.stopPropagation();
        openAuthor(post.author);
      }}
      className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ background: "var(--muted)" }}
    >
      <img src={getAuthorAvatarUrl(post.author) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
    </button>
    <button
  onClick={(e) => { e.stopPropagation(); openAuthor(post.author); }}
  className="flex-1 min-w-0 text-left"
>
  <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
    {post.author.nickname}
  </p>
  <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
    {getDisplayTime(post, nowTick)}
  </p>
</button>
  </div>
) : (
  <div className="flex items-center gap-2 mb-2">
    <button
      onClick={(e) => {
        e.stopPropagation();
        openAuthor(post.author);
      }}
      className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
      style={{ background: "var(--muted)" }}
    >
      <img src={getAuthorAvatarUrl(post.author) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
    </button>
    <div className="flex-1">
      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{post.author.nickname}</p>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getDisplayTime(post, nowTick)}</p>
    </div>
    {post.price && (
      <span className="px-2 py-1 rounded-xl text-xs font-bold"
        style={{ background: "var(--accent)", color: "var(--foreground)" }}>
        {post.price}원
      </span>
    )}
    {post.board === "lecture" && post.rating && (
      <span
        className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold shrink-0"
        style={{ background: "#fbbf2422", color: "#fbbf24" }}
      >
        <Star size={12} fill="#fbbf24" color="#fbbf24" />
        {post.rating.toFixed(1)}
      </span>
    )}
  </div>
)}

            {/* 더보기 버튼 */}
            <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(showMoreMenu === post._id ? null : post._id);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: "var(--muted-foreground)" }}
              >
                <MoreVertical size={18} />
              </button>
              {showMoreMenu === post._id && (
                <div
                  className="absolute right-0 top-9 z-20 rounded-xl shadow-lg py-1 min-w-[110px]"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  {renderPostMoreMenu(
                    post,
                    () => {
                      setEditingPost(post);
                      setEditTitle(post.title);
                      setEditContent(post.content);
                      setEditPollQuestion(post.poll?.question ?? "");
                      setEditPollOptions(post.poll ? post.poll.options.map((o) => o.text) : []);
                      setEditPollDeleteMode(false);
                      setEditPollDeleted(false);
                      setShowPollDeleteConfirm(false);
                      setShowMoreMenu(null);
                    },
                    () => {
                      setShowMoreMenu(null);
                      setPosts((prev) => prev.filter((p) => p._id !== post._id));
                    }
                  )}
                </div>
              )}
            </div>

  {post.board === "event" || post.board === "qna" ? (
  <>
    {/* 인스타그램 피드 스타일: 이미지, 좋아요/댓글/공유/저장, 캡션 */}
    {post.images[0] && (
      <div
        className="relative w-full aspect-square rounded-xl overflow-hidden mb-2"
        style={{ background: "var(--muted)" }}
      >
        <img
          src={resolveAssetUrl(post.images[getFeedImageIndex(post._id)] || post.images[0])}
          alt="첨부 이미지"
          className="w-full h-full object-cover"
        />
        {post.images.length > 1 && (
          <>
            <span
              className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(0,0,0,0.55)", color: "white" }}
            >
              {getFeedImageIndex(post._id) + 1}/{post.images.length}
            </span>
            <button
              className="absolute inset-y-0 left-0 w-1/3"
              onClick={(e) => {
                e.stopPropagation();
                stepFeedImage(post._id, -1, post.images.length - 1);
              }}
              aria-label="이전 이미지"
            />
            <button
              className="absolute inset-y-0 right-0 w-1/3"
              onClick={(e) => {
                e.stopPropagation();
                stepFeedImage(post._id, 1, post.images.length - 1);
              }}
              aria-label="다음 이미지"
            />
            <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
              {post.images.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: i === getFeedImageIndex(post._id) ? "white" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )}

    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-3">
        <button onClick={(e) => { e.stopPropagation(); handleLike(post); }}>
          <Heart size={20} fill={isLiked(post) ? "#3b82f6" : "none"}
            color={isLiked(post) ? "#3b82f6" : "var(--foreground)"} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setSelectedPostId(post._id); }}>
  <MessageCircle size={20} style={{ color: "var(--foreground)" }} />
</button>
      </div>
      <button onClick={(e) => { e.stopPropagation(); toggleSave(post._id); }}>
        <Bookmark size={20} fill={savedPosts[post._id] ? "var(--primary)" : "none"}
          color={savedPosts[post._id] ? "var(--primary)" : "var(--foreground)"} />
      </button>
    </div>

    <p className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
      좋아요 {post.likes.length}개
    </p>

    <div className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
  <span
    className="font-semibold mr-1.5 cursor-pointer"
    onClick={(e) => { e.stopPropagation(); openAuthor(post.author); }}
  >
    {post.author.nickname}
  </span>
  <span className="font-semibold">{post.title}</span>
  {post.content && <>{" "}{renderLinkifiedText(post.content)}</>}
</div>
  </>
) : (
  <>
    {/* 클릭하면 상세화면으로 이동. 사진이 있으면 오른쪽에 정사각형 썸네일로 붙인다. */}
    <div onClick={() => setSelectedPostId(post._id)} className="cursor-pointer flex gap-3 items-start">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold mb-1 truncate" style={{ color: "var(--foreground)" }}>{post.title}</h3>

        {post.board === "meeting" && post.tags && post.tags.length >= 2 && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "#fb923c22", color: "#fb923c" }}
            >
              ⏰ {post.tags[0]}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "#fb923c22", color: "#fb923c" }}
            >
              📍 {post.tags[1]}
            </span>
          </div>
        )}
        {post.board === "lecture" && post.tags && post.tags.length >= 2 && (
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "#fbbf2422", color: "#fbbf24" }}
            >
              {post.tags[0]}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "#fbbf2422", color: "#fbbf24" }}
            >
              {post.tags[1]} 교수님
            </span>
          </div>
        )}
        {post.rating && (
          <div className="flex items-center gap-1 mb-1.5">
            {renderRatingStars(post.rating, 14)}
            <span className="text-xs ml-1 font-semibold" style={{ color: "var(--foreground)" }}>
              {post.rating.toFixed(1)}
            </span>
          </div>
        )}
        {post.maxParticipants && (
          <div className="mt-2">
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: post.currentParticipants === post.maxParticipants ? "#5cb85c22" : "var(--secondary)",
                color: post.currentParticipants === post.maxParticipants ? "#5cb85c" : "var(--primary)",
              }}
            >
              {post.currentParticipants}/{post.maxParticipants}명
              {post.currentParticipants === post.maxParticipants ? " 모집완료" : " 모집중"}
            </span>
          </div>
        )}

        <div
          style={{
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            color: "var(--muted-foreground)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          className="text-sm leading-relaxed mt-1"
        >
          {renderLinkifiedText(post.content)}
        </div>
      </div>

      {post.images[0] && (
        <div className="relative w-16 h-16 shrink-0">
          <img
            src={resolveAssetUrl(post.images[0])}
            alt="첨부 이미지"
            className="w-16 h-16 object-cover rounded-xl"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenPostImage(resolveAssetUrl(post.images[0]) || null);
            }}
          />
          {post.images.length > 1 && (
            <span
              className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] leading-none font-semibold"
              style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
            >
              1/{post.images.length}
            </span>
          )}
        </div>
      )}
    </div>

    {renderPoll(post)}

    {/* Actions: 카드 높이가 짧아도 항상 카드 맨 아래에 붙도록 mt-auto로 고정 */}
    <div className="flex items-center gap-3 mt-auto pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
      {/* 카드 전체가 상세화면 이동 핸들러를 갖고 있으므로, 액션 버튼은 전파를 막아야 한다 */}
      <button className="flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); handleLike(post); }}>
        <Heart size={16} fill={isLiked(post) ? "#3b82f6" : "none"}
          color={isLiked(post) ? "#3b82f6" : "var(--muted-foreground)"} />
        <span className="text-xs" style={{ color: isLiked(post) ? "var(--primary)" : "var(--muted-foreground)" }}>
          {post.likes.length}
        </span>
      </button>
      {post.board === "lecture" && (
        <button className="flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); handleDislike(post); }}>
          <ThumbsDown size={16} fill={isDisliked(post) ? "#d4183d" : "none"}
            color={isDisliked(post) ? "#d4183d" : "var(--muted-foreground)"} />
          <span className="text-xs" style={{ color: isDisliked(post) ? "#d4183d" : "var(--muted-foreground)" }}>
            {post.dislikes.length}
          </span>
        </button>
      )}
      <button className="flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); setSelectedPostId(post._id); }}>
        <MessageCircle size={16} style={{ color: "var(--muted-foreground)" }} />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(post)}</span>
      </button>
      <button className="flex items-center gap-1.5"
        onClick={(e) => { e.stopPropagation(); toggleSave(post._id); }}>
        <Bookmark size={16} fill={savedPosts[post._id] ? "var(--primary)" : "none"}
          color={savedPosts[post._id] ? "var(--primary)" : "var(--muted-foreground)"} />
      </button>

      {post.board === "meeting" && currentUser && hasJoinedMeeting(post) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openGroupChatForPost(post._id);
          }}
          className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          <MessageCircle size={13} /> 채팅방
        </button>
      )}
      {post.board === "meeting" && currentUser && post.author._id !== currentUser._id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMeetingButtonClick(post);
          }}
          disabled={!hasJoinedMeeting(post) && isMeetingFull(post)}
          className={`${hasJoinedMeeting(post) ? "" : "ml-auto"} px-3 py-1.5 rounded-xl text-xs font-semibold`}
          style={{
            background: hasJoinedMeeting(post) ? "var(--muted)" : isMeetingFull(post) ? "var(--muted)" : "var(--primary)",
            color: hasJoinedMeeting(post) ? "var(--muted-foreground)" : isMeetingFull(post) ? "var(--muted-foreground)" : "white",
            cursor: !hasJoinedMeeting(post) && isMeetingFull(post) ? "not-allowed" : "pointer",
          }}
        >
          {hasJoinedMeeting(post) ? "참여중" : isMeetingFull(post) ? "모집완료" : "참여"}
        </button>
      )}
    </div>
  </>
)}
          </div>
        ))}
      </div>

        {/* 친구 채팅 패널 */}
{showChat && (
<div
  className="absolute bottom-0 left-0 right-0 z-30"
>

       
        <div className="px-4 py-3 h-170 overflow-y-auto flex flex-col gap-2 no-scrollbar"
          style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-1">
  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>채팅 목록</span>
  {!isFriendSelectMode ? (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowCreateGroupChat(true)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
        style={{ background: "var(--secondary)", color: "var(--primary)" }}
      >
        <Users size={12} /> 단체채팅
      </button>
      <button
        onClick={() => {
          api.post("/chat/read-all").catch(() => showAlert("처리에 실패했습니다."));
        }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
        style={{ background: "var(--secondary)", color: "var(--primary)" }}
      >
        모두 읽음
      </button>
      <button
        onClick={toggleFriendSelectMode}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
        style={{ background: "var(--secondary)", color: "#d4183d" }}
      >
        <Trash2 size={12} /> 채팅삭제
      </button>
    </div>
  ) : (
    <button
      onClick={toggleFriendSelectMode}
      className="text-xs px-2 py-1 rounded-lg font-medium"
      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
    >
      취소
    </button>
  )}
</div>

{groupChatList.length > 0 && (
  <div className="flex flex-col gap-1.5 mb-2">
    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>단체채팅</span>
    {groupChatList.map((chat) => {
      const title = chat.name || chat.post?.title ||
        chat.members.filter((m) => m._id !== currentUser?._id).map((m) => m.nickname).join(", ");
      const preview = chat.lastMessage
        ? (chat.lastMessage.image && !chat.lastMessage.content ? "사진을 보냈습니다" : chat.lastMessage.content)
        : "아직 대화가 없습니다";
      const isHost = !!currentUser && chat.host._id === currentUser._id;
      const isSelectable = isFriendSelectMode && isHost;
      const isSelected = selectedGroupChatIds.includes(chat._id);
      return (
        <button
          key={chat._id}
          onClick={() => {
            if (isFriendSelectMode) {
              if (isHost) toggleGroupChatSelect(chat._id);
            } else {
              openGroupChat(chat);
            }
          }}
          className="flex items-center gap-3 p-2.5 rounded-xl text-left"
          style={{
            background: "var(--card)",
            opacity: isFriendSelectMode && !isHost ? 0.5 : 1,
            outline: isSelected ? "2px solid var(--primary)" : "none",
          }}
        >
          {isSelectable && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isSelected ? "var(--primary)" : "var(--muted)",
                border: "1.5px solid var(--border)",
              }}
            >
              {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
          )}
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--secondary)" }}>
            <Users size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{title}</p>
            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
              {isFriendSelectMode && !isHost ? "방장만 삭제할 수 있어요" : preview}
            </p>
          </div>
        </button>
      );
    })}
  </div>
)}

{friends.length === 0 && (
  <p className="text-sm text-center mt-4" style={{ color: "var(--muted-foreground)" }}>
    아직 대화한 상대가 없습니다. 팔로우한 사람의 프로필에서 메시지를 보내보세요.
  </p>
)}

{friends.length > 0 && (
  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>개인채팅</span>
)}

{isFriendSelectMode && (selectedFriendIds.length > 0 || selectedGroupChatIds.length > 0) && (
  <button
    onClick={handleDeleteSelectedChats}
    className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold"
    style={{ background: "#d4183d", color: "white" }}
  >
    {selectedFriendIds.length + selectedGroupChatIds.length}개 채팅 삭제
  </button>
)}

         {sortedFriends.map((friend) => {
  const { text, time, unreadCount } = getFriendPreview(friend);
  return (
  <button
    key={friend._id}
    onClick={() => {
      if (isFriendSelectMode) {
        toggleFriendSelect(friend._id);
      } else {
        openFriendChat(friend);
      }
    }}
    className="flex items-center gap-3 p-2.5 rounded-xl text-left"
    style={{
      background: "var(--card)",
      outline: isFriendSelectMode && selectedFriendIds.includes(friend._id)
        ? "2px solid var(--primary)"
        : "none",
    }}
  >
    {isFriendSelectMode && (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: selectedFriendIds.includes(friend._id) ? "var(--primary)" : "var(--muted)",
          border: "1.5px solid var(--border)",
        }}
      >
        {selectedFriendIds.includes(friend._id) && (
          <span className="text-white text-[10px] font-bold">✓</span>
        )}
      </div>
    )}
    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
      <img src={resolveAssetUrl(friend.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
      {onlineUserIds.includes(friend._id) && (
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full"
          style={{ background: "#42d354", border: "2px solid var(--background)" }}
        />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{friend.nickname}</p>
        {unreadCount > 0 && (
          <span
            className="text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 shrink-0"
            style={{ background: "#d4183d", minWidth: "16px", textAlign: "center", lineHeight: 1.2 }}
          >
            {unreadCount}
          </span>
        )}
      </div>
      {text && (
        <p
          className="text-xs truncate mt-1"
          style={{
            color: unreadCount > 0 ? "var(--foreground)" : "var(--muted-foreground)",
            fontWeight: unreadCount > 0 ? 700 : 400,
          }}
        >
          {text}
        </p>
      )}
    </div>
    {time && (
      <span className="text-[10px] shrink-0 self-start pt-1" style={{ color: "var(--muted-foreground)" }}>
        {time}
      </span>
    )}
  </button>
  );
})}
        </div>
      </div>
)}

      {/* 글쓰기 모달 */}
      {showWrite && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <button onClick={closeWriteModal}>
              <X size={20} style={{ color: "var(--foreground)" }} />
            </button>
            <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>글쓰기</h2>
            <button
              disabled={isSubmittingPost}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--primary)", color: "white", opacity: isSubmittingPost ? 0.6 : 1 }}
             onClick={async () => {
                if (newBoard === "event" && !canPostEvents) {
                  showAlert("행사공지 게시판은 관리자만 작성할 수 있습니다.");
                  return;
                }

                if (newBoard === "meeting") {
                  if (!newMeetingTitle.trim()) { showAlert("제목을 입력해주세요."); return; }
                  if (!newMeetingTime) { showAlert("시간을 선택해주세요."); return; }
                  if (!newMeetingPlace.trim()) { showAlert("장소를 입력해주세요."); return; }
                  if (!newMeetingCount) { showAlert("인원을 선택해주세요."); return; }
                  if (!newMeetingContent.trim()) { showAlert("내용을 입력해주세요."); return; }
                  setIsSubmittingPost(true);
                  try {
                    const formData = new FormData();
                    formData.append("board", "meeting");
                    formData.append("title", newMeetingTitle.trim());
                    formData.append("content", newMeetingContent.trim());
                    formData.append("maxParticipants", String(newMeetingCount));
                    formData.append("currentParticipants", "1");
                    formData.append("tags", JSON.stringify([newMeetingTime, newMeetingPlace.trim()]));
                    const res = await api.post("/posts", formData);
                    setPosts((prev) => [res.data, ...prev]);
                    resetWriteForm();
                    setShowWrite(false);
                  } catch (err: any) {
                    showAlert(err.response?.data?.message || "게시물 등록에 실패했습니다.");
                  } finally {
                    setIsSubmittingPost(false);
                  }
                  return;
                }

                if (newBoard === "lecture") {
                  if (!newLectureGrade) { showAlert("학년을 선택해주세요."); return; }
                  if (!newLectureName.trim()) { showAlert("강의명을 입력해주세요."); return; }
                  if (!newLectureProfessor) { showAlert("교수님을 선택해주세요."); return; }
                  if (newLectureRating === 0) { showAlert("별점을 선택해주세요."); return; }
                  if (newLectureContent.trim().length < 20) {
                    showAlert("평가 글을 20자 이상 작성해주세요.");
                    return;
                  }
                  setIsSubmittingPost(true);
                  try {
                    const formData = new FormData();
                    formData.append("board", "lecture");
                    formData.append("title", newLectureName.trim());
                    formData.append("content", newLectureContent.trim());
                    formData.append("rating", String(newLectureRating));
                    formData.append("tags", JSON.stringify([newLectureGrade, newLectureProfessor]));
                    const res = await api.post("/posts", formData);
                    setPosts((prev) => [res.data, ...prev]);
                    setNewLectureGrade("");
                    setNewLectureName("");
                    setNewLectureProfessor("");
                    setNewLectureRating(0);
                    setNewLectureContent("");
                    setShowWrite(false);
                  } catch (err: any) {
                    showAlert(err.response?.data?.message || "게시물 등록에 실패했습니다.");
                  } finally {
                    setIsSubmittingPost(false);
                  }
                  return;
                }

                if (!newTitle.trim() || (!newPollEnabled && !newContent.trim())) {
                  showAlert(newPollEnabled ? "제목을 입력해주세요." : "제목과 내용을 입력해주세요.");
                  return;
                }
                const pollOptions = newPollOptions.map((o) => o.trim()).filter(Boolean);
                if (newPollEnabled && (!newPollQuestion.trim() || pollOptions.length < 2)) {
                  showAlert("투표 질문과 옵션을 2개 이상 입력해주세요.");
                  return;
                }
                setIsSubmittingPost(true);
                try {
                  const formData = new FormData();
                  formData.append("board", newBoard);
                  formData.append("title", newTitle);
                  formData.append("content", newContent);
                 newImageFiles.forEach((file) => formData.append("images", file));
                  if (newBoard === "contest" && newContestCategory !== "전체") {
                    formData.append("tags", JSON.stringify([newContestCategory]));
                  }
                  if (newPollEnabled) {
                    formData.append("poll", JSON.stringify({ question: newPollQuestion.trim(), options: pollOptions }));
                  }
                  const res = await api.post("/posts", formData);
                  setPosts((prev) => [res.data, ...prev]);
                  setNewTitle("");
                  setNewContent("");
                  setNewImageFiles([]);
                  setNewImagePreviews([]);
                  setNewPollEnabled(false);
                  setNewPollQuestion("");
                  setNewPollOptions(["", ""]);
                  setNewContestCategory("전체");
                  setShowWrite(false);
                } catch (err: any) {
                  showAlert(err.response?.data?.message || "게시물 등록에 실패했습니다.");
                } finally {
                  setIsSubmittingPost(false);
                }
              }}
            >
              등록
            </button>
          </div>
         <div
            className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto no-scrollbar"
            onClick={() => {
              setShowGradeDropdown(false);
              setShowProfessorDropdown(false);
              setShowMeetingTimeDropdown(false);
              setShowMeetingCountDropdown(false);
            }}
          >
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
                게시판 선택
              </label>
               <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                {BOARDS.filter(({ id }) => id !== "event" || canPostEvents).map(({ id, label, emoji }) => (
                  <button
                    key={id}
                    onClick={() => setNewBoard(id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0"
                    style={{
                      background: newBoard === id ? "var(--primary)" : "var(--muted)",
                      color: newBoard === id ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </div>

            {newBoard === "meeting" ? (
              <div className="flex flex-col gap-4">
                <input
                  placeholder="제목을 입력하세요"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />

                <div className="flex gap-2">
                  {/* 시간: 1시간 단위 드롭다운 */}
                  <div className="flex-1">
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>시간</label>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowMeetingTimeDropdown((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
                        style={{
                          background: "var(--input-background)",
                          color: newMeetingTime ? "var(--foreground)" : "var(--muted-foreground)",
                          border: "1.5px solid var(--border)",
                        }}
                      >
                        {newMeetingTime || "시간 선택"}
                        {showMeetingTimeDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {showMeetingTimeDropdown && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto no-scrollbar"
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                        >
                          {MEETING_TIMES.map((t) => (
                            <button
                              key={t}
                              onClick={() => { setNewMeetingTime(t); setShowMeetingTimeDropdown(false); }}
                              className="w-full px-4 py-2.5 text-sm text-left"
                              style={{ color: newMeetingTime === t ? "var(--primary)" : "var(--foreground)" }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 장소: 직접 입력 */}
                  <div className="flex-1">
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>장소</label>
                    <input
                      placeholder="장소를 입력하세요"
                      value={newMeetingPlace}
                      onChange={(e) => setNewMeetingPlace(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                      style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                    />
                  </div>
                </div>

                {/* 인원: 2명~10명(본인 포함) 드롭다운 */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>인원 (본인 포함)</label>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowMeetingCountDropdown((v) => !v)}
                      className="w-40 flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
                      style={{
                        background: "var(--input-background)",
                        color: newMeetingCount ? "var(--foreground)" : "var(--muted-foreground)",
                        border: "1.5px solid var(--border)",
                      }}
                    >
                      {newMeetingCount ? `${newMeetingCount}명` : "인원 선택"}
                      {showMeetingCountDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showMeetingCountDropdown && (
                      <div
                        className="absolute left-0 top-full mt-1 z-20 w-40 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto no-scrollbar"
                        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                      >
                        {MEETING_COUNTS.map((c) => (
                          <button
                            key={c}
                            onClick={() => { setNewMeetingCount(c); setShowMeetingCountDropdown(false); }}
                            className="w-full px-4 py-2.5 text-sm text-left"
                            style={{ color: newMeetingCount === c ? "var(--primary)" : "var(--foreground)" }}
                          >
                            {c}명
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  placeholder="내용을 입력하세요"
                  value={newMeetingContent}
                  onChange={(e) => setNewMeetingContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
              </div>
            ) : newBoard === "lecture" ? (
              <div className="flex flex-col gap-4">
                {/* 학년 드롭다운 */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>학년</label>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowGradeDropdown((v) => !v)}
                      className="w-40 flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
                      style={{
                        background: "var(--input-background)",
                        color: newLectureGrade ? "var(--foreground)" : "var(--muted-foreground)",
                        border: "1.5px solid var(--border)",
                      }}
                    >
                      {newLectureGrade || "학년 선택"}
                      {showGradeDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showGradeDropdown && (
                      <div
                        className="absolute left-0 top-full mt-1 z-20 w-40 rounded-xl shadow-lg py-1"
                        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                      >
                        {LECTURE_GRADES.map((g) => (
                          <button
                            key={g}
                            onClick={() => {
                              setNewLectureGrade(g);
                              setNewLectureName("");
                              setNewLectureProfessor("");
                              setShowGradeDropdown(false);
                            }}
                            className="w-full px-4 py-2.5 text-sm text-left"
                            style={{ color: newLectureGrade === g ? "var(--primary)" : "var(--foreground)" }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 강의명 + 교수님 선택 */}
                <div className="flex-1">
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>강의명</label>
                    <input
                      placeholder={newLectureGrade ? "강의명을 입력하세요" : "학년을 먼저 선택해주세요"}
                      value={newLectureName}
                      onChange={(e) => setNewLectureName(e.target.value)}
                      disabled={!newLectureGrade}
                      className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                      style={{
                        background: "var(--input-background)",
                        color: "var(--foreground)",
                        border: "1.5px solid var(--border)",
                        opacity: newLectureGrade ? 1 : 0.5,
                        cursor: newLectureGrade ? "text" : "not-allowed",
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>교수님 선택</label>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (!newLectureName.trim()) return;
                          setShowProfessorDropdown((v) => !v);
                        }}
                        disabled={!newLectureName.trim()}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
                        style={{
                          background: "var(--input-background)",
                          color: newLectureProfessor ? "var(--foreground)" : "var(--muted-foreground)",
                          border: "1.5px solid var(--border)",
                          opacity: newLectureName.trim() ? 1 : 0.5,
                          cursor: newLectureName.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        {newLectureProfessor || (newLectureName.trim() ? "교수님 선택" : "강의명을 먼저 입력해주세요")}
                        {showProfessorDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {showProfessorDropdown && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto no-scrollbar"
                          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                        >
                          {PROFESSOR_LIST.map((p) => (
                            <button
                              key={p}
                              onClick={() => { setNewLectureProfessor(p); setShowProfessorDropdown(false); }}
                              className="w-full px-4 py-2.5 text-sm text-left"
                              style={{ color: newLectureProfessor === p ? "var(--primary)" : "var(--foreground)" }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                {/* 별점 */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>별점</label>
                  {renderLectureRatingInput()}
                </div>

                {/* 평가 글 */}
                <div>
                  <textarea
                    placeholder="평가 글을 작성해주세요"
                    value={newLectureContent}
                    onChange={(e) => setNewLectureContent(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                  />
                  <p
                    className="text-xs mt-1"
                    style={{ color: newLectureContent.trim().length < 20 ? "#d4183d" : "var(--muted-foreground)" }}
                  >
                    ※ 20자 이상 작성해주세요. ({newLectureContent.trim().length}/20)
                  </p>
                </div>
              </div>
            ) : (
              <>
                {newBoard === "contest" && (
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>카테고리</label>
                    <div className="flex gap-2">
                      {["전체", ...CONTEST_FILTERS].map((category) => (
                        <button
                          key={category}
                          onClick={() => setNewContestCategory(category)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium"
                          style={{
                            background: newContestCategory === category ? "var(--primary)" : "var(--muted)",
                            color: newContestCategory === category ? "white" : "var(--muted-foreground)",
                          }}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input
  placeholder="제목을 입력하세요"
  value={newTitle}
  onChange={(e) => setNewTitle(e.target.value)}
  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
/>
            <textarea
  placeholder="내용을 입력하세요"
  value={newContent}
  onChange={(e) => setNewContent(e.target.value)}
  rows={8}
  className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
/>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                // 같은 파일을 다시 선택해도 onChange가 또 발생하도록 값을 비워준다.
                e.target.value = "";
                if (files.length === 0) return;
                const room = MAX_POST_IMAGES - newImageFiles.length;
                if (room <= 0) {
                  showAlert(`사진은 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
                  return;
                }
                const filesToAdd = files.slice(0, room);
                if (files.length > room) {
                  showAlert(`사진은 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
                }
                setNewImageFiles((prev) => [...prev, ...filesToAdd]);
                filesToAdd.forEach((file) => {
                  const reader = new FileReader();
                  reader.onload = () => setNewImagePreviews((prev) => [...prev, reader.result as string]);
                  reader.readAsDataURL(file);
                });
              }}
            />
            {(newImagePreviews.length > 0 || newImageFiles.length > 0) && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {newImagePreviews.map((preview, index) => (
                  <div key={index} className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden">
                    <img src={preview} alt="첨부 이미지" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setNewImageFiles((prev) => prev.filter((_, i) => i !== index));
                        setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                    >
                      <X size={12} color="white" />
                    </button>
                  </div>
                ))}
                {newImageFiles.length < MAX_POST_IMAGES && (
                  <button
                    onClick={() => document.getElementById("image-upload")?.click()}
                    className="w-24 h-24 shrink-0 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1"
                    style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                  >
                    <Image size={18} />
                    <span className="text-xs">{newImageFiles.length}/{MAX_POST_IMAGES}</span>
                  </button>
                )}
              </div>
            )}
            {newImageFiles.length === 0 && (
              <button
                onClick={() => document.getElementById("image-upload")?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed"
                style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              >
                <Image size={18} />
                <span className="text-sm">사진 첨부</span>
              </button>
            )}

            {/* 투표 추가 */}
            {newPollEnabled ? (
              <div className="p-3 rounded-2xl flex flex-col gap-2.5" style={{ background: "var(--muted)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>🗳️ 투표 만들기</span>
                  <button
                    onClick={() => {
                      setNewPollEnabled(false);
                      setNewPollQuestion("");
                      setNewPollOptions(["", ""]);
                    }}
                  >
                    <X size={16} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                </div>
                <input
  placeholder="투표 질문을 입력하세요"
  value={newPollQuestion}
  onChange={(e) => setNewPollQuestion(e.target.value)}
  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
/>
                {newPollOptions.map((opt, idx) => (
  <div key={idx} className="flex items-center gap-2">
    <input
      placeholder={`옵션 ${idx + 1}`}
      value={opt}
      onChange={(e) => {
        const next = [...newPollOptions];
        next[idx] = e.target.value;
        setNewPollOptions(next);
      }}
      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
      style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
    />
    {newPollDeleteMode && newPollOptions.length > 2 && (
      <button onClick={() => setNewPollOptions(newPollOptions.filter((_, i) => i !== idx))}>
        <X size={16} style={{ color: "#d4183d" }} />
      </button>
    )}
  </div>
))}
                <div className="flex items-center gap-2">
                  {newPollOptions.length < 5 && (
                    <button
                      onClick={() => setNewPollOptions([...newPollOptions, ""])}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl"
                      style={{ background: "var(--secondary)", color: "var(--primary)" }}
                    >
                      + 옵션 추가
                    </button>
                  )}
                  <button
                    onClick={() => setNewPollDeleteMode((v) => !v)}
                    className="text-xs font-medium px-3 py-1.5 rounded-xl"
                    style={{
                      background: newPollDeleteMode ? "#d4183d" : "var(--secondary)",
                      color: newPollDeleteMode ? "white" : "var(--primary)",
                    }}
                  >
                    {newPollDeleteMode ? "수정 완료" : "수정"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNewPollEnabled(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed"
                style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              >
                <Plus size={18} />
                <span className="text-sm">투표 추가</span>
              </button>
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 수정 모달 */}
{editingPost && (
  <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
    <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setEditingPost(null)}>
        <X size={20} style={{ color: "var(--foreground)" }} />
      </button>
      <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>게시물 수정</h2>
      <button
        className="px-4 py-1.5 rounded-xl text-sm font-semibold"
        style={{ background: "var(--primary)", color: "white" }}
        onClick={async () => {
          if (!editTitle.trim() || !editContent.trim()) {
            showAlert("제목과 내용을 입력해주세요.");
            return;
          }
          if (!editingPost) return;
          let pollPayload: { question: string; options: string[] } | null | undefined;
          if (editPollDeleted) {
            pollPayload = null; // 투표를 완전히 삭제한다는 신호
          } else if (editingPost.poll) {
            const options = editPollOptions.map((o) => o.trim()).filter(Boolean);
            if (!editPollQuestion.trim() || options.length < 2) {
              showAlert("투표 질문과 옵션을 2개 이상 입력해주세요.");
              return;
            }
            pollPayload = { question: editPollQuestion.trim(), options };
          }
          try {
            const res = await api.patch(`/posts/${editingPost._id}`, {
              title: editTitle.trim(),
              content: editContent.trim(),
              poll: pollPayload,
            });
            setPosts((prev) => prev.map((p) => (p._id === editingPost._id ? res.data : p)));
            showAlert("게시물이 수정되었습니다.", () => setEditingPost(null));
          } catch (err: any) {
            showAlert(err?.response?.data?.message || "게시물 수정에 실패했습니다.");
          }
        }}
      >
        완료
      </button>
    </div>
    <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
      <input
  placeholder="제목을 입력하세요"
  value={editTitle}
  onChange={(e) => setEditTitle(e.target.value)}
  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
/>
<textarea
  placeholder="내용을 입력하세요"
  value={editContent}
  onChange={(e) => setEditContent(e.target.value)}
  rows={8}
  className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
/>

{editingPost.poll && !editPollDeleted && (
  <div className="p-3 rounded-2xl flex flex-col gap-2.5" style={{ background: "var(--muted)" }}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>🗳️ 투표 수정</span>
      <button onClick={() => setShowPollDeleteConfirm(true)} aria-label="투표 삭제">
        <X size={16} style={{ color: "var(--muted-foreground)" }} />
      </button>
    </div>
    <input
      placeholder="투표 질문을 입력하세요"
      value={editPollQuestion}
      onChange={(e) => setEditPollQuestion(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
      style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
    />
    {editPollOptions.map((opt, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <input
          placeholder={`옵션 ${idx + 1}`}
          value={opt}
          onChange={(e) => {
            const next = [...editPollOptions];
            next[idx] = e.target.value;
            setEditPollOptions(next);
          }}
          className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
        />
        {editPollDeleteMode && editPollOptions.length > 2 && (
          <button onClick={() => setEditPollOptions(editPollOptions.filter((_, i) => i !== idx))}>
            <X size={16} style={{ color: "#d4183d" }} />
          </button>
        )}
      </div>
    ))}
    <div className="flex items-center gap-2">
      {editPollOptions.length < 5 && (
        <button
          onClick={() => setEditPollOptions([...editPollOptions, ""])}
          className="text-xs font-medium px-3 py-1.5 rounded-xl"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          + 옵션 추가
        </button>
      )}
      <button
        onClick={() => setEditPollDeleteMode((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-xl"
        style={{
          background: editPollDeleteMode ? "#d4183d" : "var(--secondary)",
          color: editPollDeleteMode ? "white" : "var(--primary)",
        }}
      >
        {editPollDeleteMode ? "수정 완료" : "수정"}
      </button>
    </div>
    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
      옵션 텍스트를 바꾸면 해당 옵션의 기존 투표 수는 유지되고, 새로 추가한 옵션은 0표로 시작합니다.
    </p>
  </div>
)}

{showPollDeleteConfirm && (
  <div
    className="absolute inset-0 z-[75] flex items-center justify-center px-6"
    style={{ background: "rgba(0,0,0,0.6)" }}
  >
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="px-5 py-6 text-sm leading-relaxed text-center" style={{ color: "var(--foreground)" }}>
        정말 투표를 삭제하시겠습니까?
      </div>
      <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <button
          onClick={() => {
            setEditPollDeleted(true);
            setShowPollDeleteConfirm(false);
          }}
          className="flex-1 py-3 text-sm font-medium"
          style={{ color: "#d4183d", borderRight: "1px solid rgba(255,255,255,0.1)" }}
        >
          네
        </button>
        <button
          onClick={() => setShowPollDeleteConfirm(false)}
          className="flex-1 py-3 text-sm font-medium"
          style={{ color: "var(--foreground)" }}
        >
          아니요
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  </div>
)}

      {/* 신고 모달 */}
      {showReport && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>신고하기</h3>
              <button onClick={() => setShowReport(null)}>
                <X size={20} style={{ color: "var(--foreground)" }} />
              </button>
            </div>
            {["스팸/도배", "욕설/비방", "음란물", "허위 정보", "기타"].map((reason) => (
              <button
                key={reason}
                onClick={async () => {
                  const targetPost = allPosts.find((p) => p._id === showReport);
                  try {
                    await api.post("/reports", { targetType: "post", targetId: showReport, reason });
                  } catch {
                    showAlert("신고 접수에 실패했습니다.");
                    return;
                  }
                  const now = new Date();
                  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  addReportToHistory({
                    id: Date.now(),
                    type: reason,
                    target: targetPost ? targetPost.title : "게시물",
                    status: "처리 중",
                    date,
                    postId: showReport as string,
                    sanction: null,
                  });
                  setShowReport(null);
                  showAlert(`신고가 접수되었습니다: ${reason}`);
                }}
                className="w-full px-4 py-3 rounded-xl text-left text-sm"
                style={{ background: "var(--card)", color: "var(--foreground)" }}
              >
                {reason}
              </button>

            ))}
          <button
              onClick={() => {
                const targetPost = allPosts.find((p) => p._id === showReport);
                showConfirm("이 사용자를 차단하시겠습니까?", async () => {
                  if (!targetPost) {
                    setShowReport(null);
                    return;
                  }
                  try {
                    await api.post(`/users/block/${targetPost.author._id}`);
                  } catch {
                    showAlert("차단에 실패했습니다.");
                    return;
                  }
                  const now = new Date();
                  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  addBlockedUser({
                    id: targetPost.author._id,
                    name: targetPost.author.nickname,
                    reason: "게시물 신고",
                    date,
                  });
                  // 차단한 사용자의 글은 목록에서 즉시 사라지게 한다.
                  setPosts((prev) => prev.filter((p) => p.author._id !== targetPost.author._id));
                  setShowReport(null);
                  showAlert("사용자가 차단되었습니다.");
                });
              }}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#d4183d22", color: "#d4183d" }}
            >
              사용자 차단
              </button>
          </div>
        </div>
      )}

      {/* 관리자 제재(경고/차단/댓글제한) 모달 */}
      {showAdminAction && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                {showAdminAction.type === "warn" ? "유저 경고" : showAdminAction.type === "ban" ? "앱 차단" : "댓글 제한"}
              </h3>
              <button onClick={() => setShowAdminAction(null)}>
                <X size={20} style={{ color: "var(--foreground)" }} />
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>대상: {showAdminAction.authorName}</p>

            {showAdminAction.type === "ban" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAdminBanType("temporary")}
                  className="py-2.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: adminBanType === "temporary" ? "var(--primary)" : "var(--muted)",
                    color: adminBanType === "temporary" ? "white" : "var(--muted-foreground)",
                  }}
                >
                  기간 지정
                </button>
                <button
                  onClick={() => setAdminBanType("permanent")}
                  className="py-2.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: adminBanType === "permanent" ? "var(--primary)" : "var(--muted)",
                    color: adminBanType === "permanent" ? "white" : "var(--muted-foreground)",
                  }}
                >
                  영구 정지
                </button>
              </div>
            )}

            {(showAdminAction.type === "restrictComments" || (showAdminAction.type === "ban" && adminBanType === "temporary")) && (
              <div className="flex gap-2 items-center">
                {[3, 7, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setAdminDurationDays(d)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{
                      background: adminDurationDays === d ? "var(--primary)" : "var(--muted)",
                      color: adminDurationDays === d ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    {d}일
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={adminDurationDays}
                  onChange={(e) => setAdminDurationDays(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 px-2 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>일</span>
              </div>
            )}

            <textarea
              value={adminReasonInput}
              onChange={(e) => setAdminReasonInput(e.target.value)}
              placeholder="사유를 입력하세요"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />

            <button
              onClick={submitAdminAction}
              disabled={!adminReasonInput.trim() || adminActionSubmitting}
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "#d4183d", color: "white" }}
            >
              {adminActionSubmitting ? "처리 중..." : "확인"}
            </button>
          </div>
        </div>
      )}

    {/* 커스텀 알림 팝업 (확인 1개) */}
{alertMessage && (
  <div
    className="absolute inset-0 z-[70] flex items-center justify-center px-6 pointer-events-auto"
    style={{ background: "rgba(0,0,0,0.6)" }}
  >
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
      style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 text-base font-semibold"
        style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
      >
        Code
        <button onClick={closeAlert} style={{ color: "var(--muted-foreground)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
        {alertMessage}
      </div>

      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <button
          className="w-full py-3 text-sm font-medium"
          style={{ color: "var(--foreground)" }}
          onClick={closeAlert}
        >
          확인
        </button>
      </div>
    </div>
  </div>
)}

  {/* 커스텀 확인 팝업 (확인/취소 2개) */}
{confirmState && (
  <div
    className="absolute inset-0 z-[70] flex items-center justify-center px-6 pointer-events-auto"
    style={{ background: "rgba(0,0,0,0.6)" }}
  >
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
      style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 text-base font-semibold"
        style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}
      >
        Code
        <button onClick={closeConfirm} style={{ color: "var(--muted-foreground)" }}>
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
        {confirmState.message}
      </div>

      <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <button
          className="flex-1 py-3 text-sm font-medium"
          style={{ color: "var(--foreground)", borderRight: "1px solid rgba(255,255,255,0.1)" }}
          onClick={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            action();
          }}
        >
          확인
        </button>

        <button
          className="flex-1 py-3 text-sm font-medium"
          style={{ color: "var(--foreground)" }}
          onClick={closeConfirm}
        >
          취소
        </button>
      </div>
    </div>
  </div>
)}

{alertAndConfirmModals}
{/* 알림 패널 (팔로우 알림) */}
{showNotifications && (
  <div
    className="absolute inset-0 z-50 flex flex-col pointer-events-auto"
    style={{ background: "var(--background)" }}
  >
    <div
      className="flex items-center gap-3 px-4 py-4 border-b shrink-0 pointer-events-auto"
      style={{ borderColor: "var(--border)" }}
    >
      <button onClick={() => setShowNotifications(false)}>
        <X size={20} style={{ color: "var(--foreground)" }} />
      </button>
      <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>
        알림
      </h2>
    </div>

    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1 no-scrollbar pointer-events-auto">
      {notifications.length === 0 ? (
        <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
          아직 알림이 없습니다.
        </p>
      ) : (
        notifications.map((n) => {
          const senderId = String(n.sender._id);
          const isFollowingBack = followingIds.some((id) => String(id) === senderId);
          const isFollowBackPending = followBackPendingId === senderId;
          const isAdminNotif = n.type === "adminWarning" || n.type === "adminBan" || n.type === "adminCommentRestriction";
          const commentPreview = n.commentContent
            ? (n.commentContent.length > 20 ? `${n.commentContent.slice(0, 20)}…` : n.commentContent)
            : null;
          // 버튼(행동)마다 알림 문구 형식을 고정해서, 실제 보낸 사람의 행위와 다른 문구가
          // 뜨는 일이 없게 한다. "follow"도 다른 타입처럼 명시적으로 매칭하고, 정말 알 수
          // 없는 타입일 때만 중립적인 문구를 보여준다(마지막 else를 follow로 두지 않음).
          const notifMessage =
            n.type === "follow" ? "님이 회원님을 팔로우하기 시작했습니다."
            : n.type === "join" ? "님이 회원님의 모임에 참여했습니다."
            : n.type === "leave" ? "님이 회원님의 모임 참여를 취소했습니다."
            : n.type === "comment" ? (commentPreview ? `님이 "${commentPreview}"라는 댓글을 작성했습니다.` : "님이 회원님의 게시물에 댓글을 남겼습니다.")
            : n.type === "like" ? "님이 좋아요 버튼을 눌렀습니다."
            : n.type === "dislike" ? "님이 싫어요 버튼을 눌렀습니다."
            : n.type === "scrap" ? "님이 게시물을 스크랩했습니다."
            : n.type === "adminWarning" ? `에게 경고를 받았습니다.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`
            : n.type === "adminBan" ? `에게 계정이 ${n.until ? `${new Date(n.until).toLocaleDateString("ko-KR")}까지` : "영구"} 정지되었습니다.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`
            : n.type === "adminCommentRestriction" ? `에게 ${n.until ? new Date(n.until).toLocaleDateString("ko-KR") : ""}까지 댓글 작성이 제한되었습니다.${n.post ? ` (게시물: "${n.post.title}")` : ""} 사유: ${n.message ?? "-"}`
            : "님과 관련된 새 알림이 있습니다.";

          return (
            <div
              key={n._id}
              role="button"
              tabIndex={0}
              onClick={() => {
                // 알림창 즉시 닫기
                setShowNotifications(false);

                // 이동 로직 즉시 실행
                if (n.type === "follow") {
                  openAuthor(n.sender);
                } else if (n.post) {
                  setSelectedPostId(n.post._id);
                }
              }}
              className="flex items-center gap-3 p-2.5 rounded-xl text-left w-full cursor-pointer"
              style={{ background: "var(--card)" }}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                <img
                  src={isAdminNotif ? defaultAvatar : (resolveAssetUrl(n.sender.avatar) || defaultAvatar)}
                  alt="프로필 사진"
                  className="w-full h-full object-cover"
                />
              </div>

              <p className="flex-1 min-w-0 text-sm" style={{ color: "var(--foreground)" }}>
                <span className="font-semibold">{isAdminNotif ? "관리자" : n.sender.nickname}</span>
                {notifMessage}
                <span className="block text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {getDisplayTime(n, nowTick)}
                </span>
              </p>

              {n.type === "follow" && (
                <button
                  type="button"
                  disabled={isFollowBackPending}
                  // 알림 카드 클릭(패널 닫기 + 프로필 이동)으로 이벤트가 번지지 않게 막고,
                  // 알림 패널 안에서 그대로 맞팔로우 / 팔로우 취소를 토글한다.
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFollowBack(senderId, isFollowingBack);
                  }}
                  className="text-xs px-3 py-1.5 rounded-xl shrink-0 disabled:opacity-60"
                  style={
                    isFollowingBack
                      ? { background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 500 }
                      : { background: "var(--primary)", color: "white", fontWeight: 600 }
                  }
                >
                  {isFollowBackPending ? "처리 중..." : isFollowingBack ? "팔로잉" : "맞팔로우"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  </div>
)}


      {/* 친구끼리 단체 채팅방 만들기 */}
      {showCreateGroupChat && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => { setShowCreateGroupChat(false); setNewGroupChatMemberIds([]); setNewGroupChatName(""); }}>
              <X size={20} style={{ color: "var(--foreground)" }} />
            </button>
            <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>단체채팅 만들기</h2>
            <button
              onClick={handleCreateGroupChat}
              disabled={newGroupChatMemberIds.length === 0}
              className="text-sm font-semibold px-2"
              style={{ color: newGroupChatMemberIds.length === 0 ? "var(--muted-foreground)" : "var(--primary)" }}
            >
              만들기
            </button>
          </div>
          <div className="px-4 py-3 shrink-0">
            <input
              value={newGroupChatName}
              onChange={(e) => setNewGroupChatName(e.target.value)}
              placeholder="채팅방 이름 (선택)"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 no-scrollbar">
            {friends.length === 0 ? (
              <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
                초대할 친구가 없습니다.
              </p>
            ) : (
              friends.map((friend) => {
                const checked = newGroupChatMemberIds.includes(friend._id);
                return (
                  <button
                    key={friend._id}
                    onClick={() =>
                      setNewGroupChatMemberIds((prev) =>
                        prev.includes(friend._id) ? prev.filter((id) => id !== friend._id) : [...prev, friend._id]
                      )
                    }
                    className="flex items-center gap-3 p-2.5 rounded-xl text-left"
                    style={{ background: "var(--card)", outline: checked ? "2px solid var(--primary)" : "none" }}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <img src={resolveAssetUrl(friend.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{friend.nickname}</p>
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: checked ? "var(--primary)" : "var(--muted)", border: "1.5px solid var(--border)" }}
                    >
                      {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {fullscreenImageViewer}
    </div>
  );
}