import { useState, useEffect, useRef } from "react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import api from "@/api";
import {
  Heart, MessageCircle, Bookmark, Image, Plus, X, ThumbsDown,
  Search, Star, Send, UserPlus, ChevronDown, ChevronUp, FileText,
  Users, Trophy, Megaphone, BookOpen, Coffee, MoreVertical, Edit2, Trash2, AlertTriangle
} from "lucide-react";

export type BoardType = "free" | "qna" | "contest" | "event" | "lecture" | "meeting";

// "행사공지" 게시판은 관리자 학번만 글을 작성할 수 있다.
const ADMIN_STUDENT_IDS = ["20232023"];

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
}

// 로그인 시 서버에서 받아 localStorage에 저장해 둔 사용자 정보를 그대로 "현재 로그인한 나"로 사용한다.
export const getCurrentUser = (): CurrentUser | null => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user?._id) return null;
    return { _id: user._id, nickname: user.nickname, avatar: user.avatar, studentId: user.studentId };
  } catch {
    return null;
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
export const getDisplayTime = (post: Post, now: number = Date.now()): string => {
  const created = new Date(post.createdAt).getTime();
  const diffMinutes = Math.max(0, Math.floor((now - created) / 60000));
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return formatPostDate(post.createdAt);
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
}

export interface FriendRequestItem {
  _id: string;
  from: Friend;
}

interface Message {
  _id: string;
  content: string;
  image?: string;
  createdAt: string;
  mine: boolean;
  read: boolean;
}

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
// 즉시 반영되도록 CommunityScreen과 공유한다.
export const AVATAR_STORAGE_KEY = "bigding_profile_avatar_v1";
export const AVATAR_UPDATED_EVENT = "bigding-avatar-updated";

export const loadAvatar = (): string | null => {
  try {
    return localStorage.getItem(scopedKey(AVATAR_STORAGE_KEY));
  } catch {
    return null;
  }
};

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
  id: number;
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

export const removeBlockedUser = (id: number) => {
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
  { id: "free" as BoardType, label: "전체 게시판", emoji: "💬", icon: MessageCircle },
  { id: "qna" as BoardType, label: "선배들 작품 전시 공간", emoji: "🏆", icon: Users },
  { id: "contest" as BoardType, label: "학업", emoji: "📖", icon: Trophy },
  { id: "event" as BoardType, label: "행사공지", emoji: "📢", icon: Megaphone },
  { id: "lecture" as BoardType, label: "전공 강의평가", emoji: "⭐", icon: BookOpen },
  { id: "meeting" as BoardType, label: "공강모임", emoji: "☕", icon: Coffee },
];
interface CommunityScreenProps {
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
  isActive: boolean;
  onViewOwnProfile: () => void;
}

export function CommunityScreen({
  showChat,
  setShowChat,
  isActive,
  onViewOwnProfile,
}: CommunityScreenProps) {

  // 좋아요/싫어요/댓글/스크랩/새 글 등은 로컬 저장소에서 초기값을 불러와
  // 새로고침해도 그대로 유지되도록 한다.
  const [storedInit] = useState(loadStoredInteractions);
  const [currentUser] = useState(getCurrentUser);
  const isAdmin = ADMIN_STUDENT_IDS.includes(getCurrentStudentId());
  const [activeBoard, setActiveBoard] = useState<BoardType>("free");

  // 게시물 목록은 실제 DB(GET /api/posts)에서 불러온다.
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    setPostsLoading(true);
    api.get("/posts")
      .then((res) => {
        if (!cancelled) setPosts(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  // 스크랩(저장)만 계정별 로컬 저장소에 유지한다(좋아요/싫어요/댓글/삭제는 이제 DB가 기준).
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>(storedInit.savedPosts);

  const [commentInput, setCommentInput] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [reportingCommentAuthor, setReportingCommentAuthor] = useState<string | null>(null);

  // 상대 시간("N분 전") 표시를 실시간으로 갱신하기 위한 tick
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleReportCommentAuthor = (author: string) => {
    const counts = loadCommentReportCounts();
    if ((counts[author] || 0) >= MAX_COMMENT_REPORTS_PER_AUTHOR) {
      showAlert("이미 신고 가능 횟수를 모두 사용했습니다.");
      return;
    }
    setReportingCommentAuthor(author);
  };
  // 게시물 상세/작성자 화면은 id만 들고 있다가 posts에서 찾아 쓴다.
  // 그래야 좋아요/댓글 등으로 posts가 갱신될 때 상세 화면에도 즉시 반영된다.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const selectedPost = selectedPostId ? posts.find((p) => p._id === selectedPostId) ?? null : null;
  const [viewedAuthor, setViewedAuthor] = useState<PostAuthor | null>(null);
  const [authorActiveTab, setAuthorActiveTab] = useState<"posts" | "scrapped">("posts");

  // 다른 사용자의 프로필을 새로 열 때마다 "내 글" 탭부터 다시 보이게 한다.
  useEffect(() => {
    if (viewedAuthor) setAuthorActiveTab("posts");
  }, [viewedAuthor]);

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
  const [myAvatar, setMyAvatar] = useState<string | null>(loadAvatar);
  useEffect(() => {
    const handleAvatarUpdated = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setMyAvatar(detail ?? loadAvatar());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === scopedKey(AVATAR_STORAGE_KEY)) setMyAvatar(loadAvatar());
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
  const [showReport, setShowReport] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newBoard, setNewBoard] = useState<BoardType>("free");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [newPollEnabled, setNewPollEnabled] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState<string[]>(["", ""]);

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

  const [chatHeight, setChatHeight] = useState(44);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<Friend[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [isFriendSelectMode, setIsFriendSelectMode] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
const [showChatMenu, setShowChatMenu] = useState(false);
const [selectMode, setSelectMode] = useState(false);
const [selectedMsgs, setSelectedMsgs] = useState<string[]>([]);
const hiddenMessageIdsRef = useRef<Set<string>>(new Set());
const [showReportConfirm, setShowReportConfirm] = useState(false);
const [viewingImage, setViewingImage] = useState<string | null>(null);

  // 친구 목록 / 받은 친구 신청은 실제 DB(GET /api/friends, /api/friends/requests)에서 불러온다.
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    api.get("/friends").then((res) => { if (!cancelled) setFriends(res.data); }).catch(() => {});
    api.get("/friends/requests").then((res) => { if (!cancelled) setFriendRequests(res.data); }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  // 친구 검색: 입력 후 잠시 멈추면(디바운스) 학번/닉네임으로 사용자를 검색한다.
  useEffect(() => {
    if (!showAddFriend || !friendSearch.trim()) {
      setFriendSearchResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      api.get("/users/search", { params: { q: friendSearch.trim() } })
        .then((res) => { if (!cancelled) setFriendSearchResults(res.data); })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [friendSearch, showAddFriend]);

  const handleSendFriendRequest = async (targetId: string) => {
    try {
      const res = await api.post(`/friends/requests/${targetId}`);
      setFriendSearchResults((prev) => prev.filter((u) => u._id !== targetId));
      showAlert(res.data.message);
      if (res.data.message?.includes("친구가 되었습니다")) {
        const friendsRes = await api.get("/friends");
        setFriends(friendsRes.data);
      }
    } catch (err: any) {
      showAlert(err.response?.data?.message || "친구 신청에 실패했습니다.");
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      setFriendRequests((prev) => prev.filter((r) => r._id !== requestId));
      const res = await api.get("/friends");
      setFriends(res.data);
    } catch {
      showAlert("친구 요청 수락에 실패했습니다.");
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      await api.delete(`/friends/requests/${requestId}`);
      setFriendRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch {
      showAlert("처리에 실패했습니다.");
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
      }))
      .filter((m) => !hiddenMessageIdsRef.current.has(m._id));

  // 채팅 탭이 열려 있는 동안, 친구 목록 미리보기를 위해 친구별 대화 내역을 불러온다.
  useEffect(() => {
    if (!isActive || !showChat || friends.length === 0) return;
    let cancelled = false;
    friends.forEach((friend) => {
      api.get(`/chat/${friend._id}`)
        .then((res) => {
          if (cancelled) return;
          setChatMessages((prev) => ({ ...prev, [friend._id]: mapMessages(res.data) }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [friends, isActive, showChat]);

  // 1:1 대화창이 열려 있는 동안에는 실시간 소켓 대신, 몇 초마다 새 메시지가 있는지 서버에 확인한다(폴링).
  useEffect(() => {
    if (!activeFriend) return;
    let cancelled = false;
    const fetchMessages = () => {
      api.get(`/chat/${activeFriend._id}`)
        .then((res) => {
          if (cancelled) return;
          setChatMessages((prev) => ({ ...prev, [activeFriend._id]: mapMessages(res.data) }));
        })
        .catch(() => {});
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeFriend]);

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
  const sortedFriends = [...friends].sort(
    (a, b) => getLastMessageSortKey(b) - getLastMessageSortKey(a)
  );

  // 친구와의 채팅방에 들어가면 대화 내역을 불러오는데(useEffect 폴링), 그 요청 자체가
  // 서버에서 상대가 보낸 메시지를 읽음 처리해준다.
  const openFriendChat = (friend: Friend) => {
    setActiveFriend(friend);
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

 // 게시물의 댓글 수는 이제 실제 DB에 저장된 comments 배열의 길이다.
 const getCommentCount = (post: Post) => post.comments.length;
 // 내가 쓴 글은 프로필에서 업로드한 실제 프로필 사진을, 그 외에는 작성자의 avatar(아직 비어있으면 null)를 보여준다.
 const getAuthorAvatarUrl = (author: PostAuthor): string | null => {
   if (currentUser && author._id === currentUser._id) return myAvatar ?? author.avatar ?? null;
   return author.avatar ?? null;
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

 const toggleSave = (postId: string) => setSavedPosts((s) => ({ ...s, [postId]: !s[postId] }));

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
 const visiblePosts = showSearch && searchQuery
    ? allPosts.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allPosts.filter((p) => p.board === activeBoard);

  const toggleFriendSelectMode = () => {
  setIsFriendSelectMode((prev) => !prev);
  setSelectedFriendIds([]);
};

const toggleFriendSelect = (id: string) => {
  setSelectedFriendIds((prev) =>
    prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
  );
};

const handleDeleteFriends = () => {
  if (selectedFriendIds.length === 0) return;
  showConfirm(`선택한 ${selectedFriendIds.length}명의 친구를 삭제하시겠습니까?`, async () => {
    const idsToDelete = selectedFriendIds;
    setSelectedFriendIds([]);
    setIsFriendSelectMode(false);
    const results = await Promise.allSettled(idsToDelete.map((id) => api.delete(`/friends/${id}`)));
    const succeededIds = idsToDelete.filter((_, i) => results[i].status === "fulfilled");
    setFriends((prev) => prev.filter((f) => !succeededIds.includes(f._id)));
    if (succeededIds.length < idsToDelete.length) {
      showAlert("일부 친구 삭제에 실패했습니다.");
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

  const handleAddComment = async () => {
  if (!selectedPost || !commentInput.trim()) return;
  const content = filterProfanity(commentInput.trim());
  const postId = selectedPost._id;
  setCommentInput("");
  try {
    const res = await api.post(`/posts/${postId}/comments`, { content });
    setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, comments: res.data } : p)));
  } catch {
    showAlert("댓글 등록에 실패했습니다.");
  }
};
const startDrag = (y: number) => {
  setDragStartY(y);
};

const onDrag = (y: number) => {
  if (dragStartY === null) return;

  const diff = dragStartY - y;

  let nextHeight = 44 + diff;

  if (nextHeight < 44) nextHeight = 44;
  if (nextHeight > 640) nextHeight = 640;

  setChatHeight(nextHeight);
};

const endDrag = () => {
  // 거의 움직이지 않았다면(클릭으로 간주) 현재 열림 상태를 반전
  const dragDistance = Math.abs(chatHeight - (showChat ? 640 : 44));
  if (dragDistance < 10) {
    if (showChat) {
      setChatHeight(44);
      setShowChat(false);
    } else {
      setChatHeight(640);
      setShowChat(true);
    }
  } else if (chatHeight > 350) {
    setChatHeight(640);
    setShowChat(true);
  } else {
    setChatHeight(44);
    setShowChat(false);
  }

  setDragStartY(null);
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
  if (activeFriend) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden relative">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          {selectMode ? (
            <button onClick={() => { setSelectMode(false); setSelectedMsgs([]); }} className="text-sm font-semibold" style={{ color: "var(--primary)" }}>취소</button>
          ) : (
            <button onClick={() => setActiveFriend(null)} className="text-lg">←</button>
          )}
          <span className="text-2xl">{activeFriend.avatar ?? activeFriend.nickname.charAt(0)}</span>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{activeFriend.nickname}</p>
          </div>
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
              onClick={() => {
              setShowChatMenu(false);

              showConfirm(
                `${activeFriend?.nickname}님을 차단하면
                더 이상 채팅을 주고받을 수 없습니다.

                차단하시겠습니까?`,
                () => {
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
                    onClick={() => {
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
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {(chatMessages[activeFriend._id] || []).map((msg) => (
            <div key={msg._id} className={`flex items-end gap-2 ${msg.mine ? "justify-end" : "justify-start"}`}>
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
              <div className={`max-w-[70%] flex flex-col gap-1 ${msg.mine ? "items-end" : "items-start"}`}>
                {msg.content && (
                  <div
                    className="px-3 py-2 rounded-2xl text-sm"
                    style={{
                      background: msg.mine ? "var(--primary)" : "var(--card)",
                      color: msg.mine ? "white" : "var(--foreground)",
                      outline: selectedMsgs.includes(msg._id) ? "2px solid var(--primary)" : "none",
                    }}
                  >
                    <p>{msg.content}</p>
                  </div>
                )}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="사진"
                    onClick={() => setViewingImage(msg.image!)}
                    className="rounded-xl max-w-full cursor-pointer"
                    style={{
                      maxHeight: "200px",
                      outline: selectedMsgs.includes(msg._id) ? "2px solid var(--primary)" : "none",
                    }}
                  />
                )}
                <p className="text-[10px] mt-1 opacity-70" style={{ color: "var(--muted-foreground)" }}>{formatMessageTime(msg.createdAt, nowTick)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 입력창 */}
        <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <label
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            style={{ background: "var(--muted)" }}
          >
            🖼️
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
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none"
            style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
          />
          <button
            onClick={sendMessage}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <Send size={16} color="white" />
          </button>
        </div>

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
      </div>
    );
  }

  // ── 작성자 프로필 화면 (내 프로필과 동일한 화면/기능 구성) ──────────────────
  if (viewedAuthor) {
    const authorPosts = allPosts.filter((p) => p.author._id === viewedAuthor._id);
    const getBoardLabel = (board?: BoardType) => BOARDS.find((b) => b.id === board)?.label ?? "";

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 헤더 */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={() => setViewedAuthor(null)}
            className="text-lg"
            style={{ color: "var(--foreground)" }}
          >
            ←
          </button>
          <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>
            프로필
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* 프로필 상단 카드: 내 프로필(ProfileScreen)과 동일한 위치 구성 */}
          <div
            className="relative px-4 pt-8 pb-6"
            style={{ background: "linear-gradient(160deg, #111a30 0%, #0a0f1f 100%)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md overflow-hidden"
                style={{ background: "var(--accent)", border: "3px solid var(--primary)" }}
              >
                {getAuthorAvatarUrl(viewedAuthor) ? (
                  <img src={getAuthorAvatarUrl(viewedAuthor)!} alt="프로필 사진" className="w-full h-full object-cover" />
                ) : (
                  viewedAuthor.nickname.charAt(0)
                )}
              </div>
              <div className="flex-1 pt-1">
                <h2 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
                  {viewedAuthor.nickname}
                </h2>
              </div>
            </div>
          </div>

          {/* 탭: 다른 사용자의 프로필에서는 댓글 내역을 노출하지 않는다 */}
          <div className="grid grid-cols-2 px-4 gap-2 mb-3 mt-3">
            {[
              { key: "posts" as const, label: "내 글", Icon: FileText },
              { key: "scrapped" as const, label: "스크랩", Icon: Bookmark },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setAuthorActiveTab(key)}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: authorActiveTab === key ? "var(--primary)" : "var(--muted)",
                  color: authorActiveTab === key ? "white" : "var(--muted-foreground)",
                }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="px-4 pb-6 flex flex-col gap-3">
            {authorActiveTab === "posts" && (
              authorPosts.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
                  작성한 게시물이 없어요
                </p>
              ) : (
                authorPosts.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => {
                      setViewedAuthor(null);
                      setSelectedPostId(p._id);
                    }}
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
                        <MessageCircle size={12} /> {getCommentCount(p)}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
  {getDisplayTime(p, nowTick)}
</span>
                    </div>
                  </div>
                ))
              )
            )}

            {authorActiveTab === "scrapped" && (
              <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
                스크랩한 게시물이 없어요.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 게시물 상세 화면 ──────────────────────────────────────────────────────
  if (selectedPost) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setSelectedPostId(null)} className="text-lg">
            ←
          </button>
          <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {/* 게시물 카드 */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  setSelectedPostId(null);
                  openAuthor(selectedPost.author);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
                style={{ background: "var(--muted)" }}
              >
                {getAuthorAvatarUrl(selectedPost.author) ? (
                  <img src={getAuthorAvatarUrl(selectedPost.author)!} alt="프로필 사진" className="w-full h-full object-cover" />
                ) : (
                  selectedPost.author.nickname.charAt(0)
                )}
              </button>
              <div className="flex-1">
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

            {selectedPost.images[0] && (
              <img
                src={selectedPost.images[0]}
                alt="첨부 이미지"
                className="mt-2 w-full max-h-72 object-cover rounded-xl"
              />
            )}

            {selectedPost.rating && (
              <div className="flex items-center gap-1 mb-1.5 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14}
                    fill={i < Math.floor(selectedPost!.rating!) ? "#ffc107" : "none"}
                    color={i < Math.floor(selectedPost!.rating!) ? "#ffc107" : "var(--muted-foreground)"} />
                ))}
                <span className="text-xs ml-1 font-semibold" style={{ color: "var(--foreground)" }}>
                  {selectedPost.rating.toFixed(1)}
                </span>
              </div>
            )}

            <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--muted-foreground)" }}>
              {selectedPost.content}
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
             <button className="flex items-center gap-1.5" onClick={() => handleLike(selectedPost)}>
                <Heart size={16} fill={isLiked(selectedPost) ? "#3b82f6" : "none"}
                  color={isLiked(selectedPost) ? "#3b82f6" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: isLiked(selectedPost) ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {selectedPost.likes.length}
                </span>
              </button>
              <button className="flex items-center gap-1.5" onClick={() => handleDislike(selectedPost)}>
                <ThumbsDown size={16} fill={isDisliked(selectedPost) ? "#d4183d" : "none"}
                  color={isDisliked(selectedPost) ? "#d4183d" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: isDisliked(selectedPost) ? "#d4183d" : "var(--muted-foreground)" }}>
                  {selectedPost.dislikes.length}
                </span>
              </button>
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
            </div>
          </div>

          {/* 댓글 목록 */}
          <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
              댓글 {getCommentCount(selectedPost)}개
            </p>
            {selectedPost.comments.map((c) => (
              <div key={c._id} className="flex gap-2 items-start relative">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm cursor-pointer overflow-hidden"
                  style={{ background: "var(--muted)" }}
                  onClick={() => openAuthor(c.author)}>
                  {getAuthorAvatarUrl(c.author) ? (
                    <img src={getAuthorAvatarUrl(c.author)!} alt="프로필 사진" className="w-full h-full object-cover" />
                  ) : (
                    c.author.nickname.charAt(0)
                  )}
                </div>
                <div className="flex-1 px-3 py-2 rounded-xl text-xs flex items-start justify-between gap-2"
                  style={{ color: "var(--foreground)" }}>
                  <span>
                    <span
                      className="font-semibold cursor-pointer"
                      onClick={() => openAuthor(c.author)}
                    >
                      {c.author.nickname}{" "}
                    </span>
                    {c.content}
                  </span>
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
                        {currentUser && c.author._id === currentUser._id ? (
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
                              handleReportCommentAuthor(c.author.nickname);
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
            ))}
          </div>
        </div>

       {/* 댓글 입력 */}
<div className="flex gap-2 px-4 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
  <input
    ref={commentInputRef}
    value={commentInput}
    onChange={(e) => setCommentInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") handleAddComment();
    }}
    placeholder="댓글 입력..."
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

      {/* 댓글 작성자 신고 사유 선택 팝업 */}
      {reportingCommentAuthor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="rounded-2xl p-5 w-full" style={{ background: "var(--card)" }}>
            <p className="font-semibold text-sm text-center mb-1" style={{ color: "var(--foreground)" }}>사용자 신고</p>
            <p className="text-xs text-center mb-3" style={{ color: "var(--muted-foreground)" }}>
              {reportingCommentAuthor}님을 신고하는 이유를 선택해주세요
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {["욕설/비방", "스팸/광고", "음란물", "개인정보 침해", "기타"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    incrementCommentReportCount(reportingCommentAuthor);
                    const now = new Date();
                    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                    addReportToHistory({
                      id: Date.now(),
                      type: reason,
                      target: `"${selectedPost!.title}" 게시물 - ${reportingCommentAuthor}님의 댓글`,
                      status: "처리 중",
                      date,
                      postId: selectedPost!._id,
                      sanction: null,
                    });
                    setReportingCommentAuthor(null);
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
              onClick={() => setReportingCommentAuthor(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 커스텀 알림 팝업 (확인 1개) - 게시물 상세 화면에서도 뜨도록 여기에도 렌더링 */}
      {alertMessage && (
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

      {/* 커스텀 확인 팝업 (댓글 삭제 등) - 게시물 상세 화면에서도 뜨도록 여기에도 렌더링 */}
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
              알림
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
              <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}></p>
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
  onClick={() => {
    setNewBoard(activeBoard === "event" && !isAdmin ? "free" : activeBoard);
    setShowWrite(true);
  }}
  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
  style={{ background: "var(--primary)" }}
>
  <Plus size={20} color="white" />
</button>
          </div>
        </div>

        {showSearch && (
          <input
            type="text"
            placeholder="게시물 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none mb-2"
            style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
          />
        )}
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

      {/* 더보기 메뉴 외부 클릭 닫기 */}
      {showMoreMenu !== null && (
        <div className="absolute inset-0 z-10" onClick={() => setShowMoreMenu(null)} />
      )}

      {/* Posts */}
<div className="flex-1 overflow-y-auto px-4 pb-20 flex flex-col gap-3 no-scrollbar">
        {postsLoading && visiblePosts.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
            게시물을 불러오는 중...
          </p>
        )}
        {!postsLoading && visiblePosts.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
            아직 게시물이 없어요.
          </p>
        )}
        {visiblePosts.map((post) => (
          <div
            key={post._id}
            className="rounded-2xl p-4 shadow-sm relative"
            style={{ background: "var(--card)" }}
          >
            {/* Author */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openAuthor(post.author);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
                style={{ background: "var(--muted)" }}
              >
                {getAuthorAvatarUrl(post.author) ? (
                  <img src={getAuthorAvatarUrl(post.author)!} alt="프로필 사진" className="w-full h-full object-cover" />
                ) : (
                  post.author.nickname.charAt(0)
                )}
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
            </div>

            {/* 더보기 버튼 */}
            <div className="absolute top-3 right-3 z-10">
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
                  {currentUser && post.author._id === currentUser._id ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingPost(post);
                          setEditTitle(post.title);
                          setEditContent(post.content);
                          setShowMoreMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
                        style={{ color: "var(--foreground)" }}
                      >
                        <Edit2 size={14} /> 수정
                      </button>
                      <button
                        onClick={() => {
                          showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
                            setShowMoreMenu(null);
                            try {
                              await api.delete(`/posts/${post._id}`);
                              setPosts((prev) => prev.filter((p) => p._id !== post._id));
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
                  ) : (
                    <button
                      onClick={() => {
                        setShowReport(post._id);
                        setShowMoreMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:opacity-70"
                      style={{ color: "#d4183d" }}
                    >
                      <AlertTriangle size={14} /> 신고
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 클릭하면 상세화면으로 이동 */}
            <div onClick={() => setSelectedPostId(post._id)} className="cursor-pointer">
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{post.title}</h3>

              {post.images[0] && (
                <img
                  src={post.images[0]}
                  alt="첨부 이미지"
                  className="mt-2 w-full max-h-48 object-cover rounded-xl"
                />
              )}

              {post.rating && (
                <div className="flex items-center gap-1 mb-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14}
                      fill={i < Math.floor(post.rating!) ? "#ffc107" : "none"}
                      color={i < Math.floor(post.rating!) ? "#ffc107" : "var(--muted-foreground)"} />
                  ))}
                  <span className="text-xs ml-1 font-semibold" style={{ color: "var(--foreground)" }}>
                    {post.rating.toFixed(1)}
                  </span>
                </div>
              )}

              <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{post.content}</p>

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
            </div>

            {renderPoll(post)}

           {/* Actions */}
<div className="flex items-center gap-3 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
  <button className="flex items-center gap-1.5" onClick={() => handleLike(post)}>
    <Heart size={16} fill={isLiked(post) ? "#3b82f6" : "none"}
      color={isLiked(post) ? "#3b82f6" : "var(--muted-foreground)"} />
    <span className="text-xs" style={{ color: isLiked(post) ? "var(--primary)" : "var(--muted-foreground)" }}>
      {post.likes.length}
    </span>
  </button>
  <button className="flex items-center gap-1.5" onClick={() => handleDislike(post)}>
                <ThumbsDown size={16} fill={isDisliked(post) ? "#d4183d" : "none"}
                  color={isDisliked(post) ? "#d4183d" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: isDisliked(post) ? "#d4183d" : "var(--muted-foreground)" }}>
                  {post.dislikes.length}
                </span>
              </button>
              <button className="flex items-center gap-1.5" onClick={() => setSelectedPostId(post._id)}>
                <MessageCircle size={16} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(post)}</span>
              </button>
              <button className="flex items-center gap-1.5"
                onClick={() => toggleSave(post._id)}>
                <Bookmark size={16} fill={savedPosts[post._id] ? "var(--primary)" : "none"}
                  color={savedPosts[post._id] ? "var(--primary)" : "var(--muted-foreground)"} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 친구/채팅 패널 */}
        <div
          className="absolute bottom-0 left-0 right-0 z-30 transition-all duration-300"
          style={{
            transform: showChat
              ? "translateY(0)"
              : "translateY(calc(100% - 44px))",
          }}
        >
        <button
          onMouseDown={(e) => startDrag(e.clientY)}
          onMouseMove={(e) => dragStartY !== null && onDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={() => dragStartY !== null && endDrag()}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => onDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          className="w-full flex items-center justify-between px-5 py-3 rounded-t-2xl shadow-lg"
          style={{ background: "var(--primary)", touchAction: "none", cursor: "grab" }}
        >
          <div className="flex items-center gap-2">
            <MessageCircle size={16} color="white" />
            <span className="text-sm font-semibold text-white">
              친구 채팅
            </span>
          </div>
          {showChat ? <ChevronDown size={18} color="white" /> : <ChevronUp size={18} color="white" />}
         </button>

        <div className="px-4 py-3 h-160 overflow-y-auto flex flex-col gap-2 no-scrollbar"
          style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-1">
  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>친구 목록</span>
  <div className="flex items-center gap-2">
    {!isFriendSelectMode ? (
      <>
        <button
          onClick={() => setShowAddFriend(!showAddFriend)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
          style={{ background: "var(--secondary)", color: "var(--primary)" }}
        >
          <UserPlus size={12} /> 친구추가
        </button>
        <button
          onClick={toggleFriendSelectMode}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
          style={{ background: "var(--secondary)", color: "#d4183d" }}
        >
          <Trash2 size={12} /> 친구삭제
        </button>
      </>
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
</div>

          {friendRequests.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2 p-2 rounded-xl" style={{ background: "var(--secondary)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>받은 친구 요청</span>
              {friendRequests.map((r) => (
                <div key={r._id} className="flex items-center gap-2">
                  <span className="text-lg">{r.from.avatar ?? r.from.nickname.charAt(0)}</span>
                  <p className="flex-1 min-w-0 text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {r.from.nickname}
                  </p>
                  <button
                    onClick={() => handleAcceptFriendRequest(r._id)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    수락
                  </button>
                  <button
                    onClick={() => handleRejectFriendRequest(r._id)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                  >
                    거절
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddFriend && (
            <div className="flex flex-col gap-2 mb-2">
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="학번 또는 닉네임 검색"
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              {friendSearch.trim() && friendSearchResults.length === 0 && (
                <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>검색 결과가 없습니다.</p>
              )}
              {friendSearchResults.map((u) => (
                <div key={u._id} className="flex items-center gap-2 px-1">
                  <span className="text-lg">{u.avatar ?? u.nickname.charAt(0)}</span>
                  <p className="flex-1 min-w-0 text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {u.nickname}
                  </p>
                  <button
                    onClick={() => handleSendFriendRequest(u._id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    신청
                  </button>
                </div>
              ))}
            </div>
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

    <div className="relative">
      <span className="text-2xl">{friend.avatar ?? friend.nickname.charAt(0)}</span>
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

{isFriendSelectMode && selectedFriendIds.length > 0 && (
  <button
    onClick={handleDeleteFriends}
    className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
    style={{ background: "#d4183d", color: "white" }}
  >
    {selectedFriendIds.length}명 삭제
  </button>
)}
        </div>
      </div>

      {/* 글쓰기 모달 */}
      {showWrite && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
          <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setShowWrite(false)}>
              <X size={20} style={{ color: "var(--foreground)" }} />
            </button>
            <h2 className="flex-1 font-semibold" style={{ color: "var(--foreground)" }}>글쓰기</h2>
            <button
              disabled={isSubmittingPost}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--primary)", color: "white", opacity: isSubmittingPost ? 0.6 : 1 }}
             onClick={async () => {
                if (newBoard === "event" && !isAdmin) {
                  showAlert("행사공지 게시판은 관리자만 작성할 수 있습니다.");
                  return;
                }
                if (!newTitle.trim() || !newContent.trim()) {
                  showAlert("제목과 내용을 입력해주세요.");
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
                  if (newImageFile) formData.append("image", newImageFile);
                  if (newPollEnabled) {
                    formData.append("poll", JSON.stringify({ question: newPollQuestion.trim(), options: pollOptions }));
                  }
                  const res = await api.post("/posts", formData);
                  setPosts((prev) => [res.data, ...prev]);
                  setNewTitle("");
                  setNewContent("");
                  setNewImageFile(null);
                  setNewImagePreview(null);
                  setNewPollEnabled(false);
                  setNewPollQuestion("");
                  setNewPollOptions(["", ""]);
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
          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
                게시판 선택
              </label>
               <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                {BOARDS.filter(({ id }) => id !== "event" || isAdmin).map(({ id, label, emoji }) => (
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
            <input
              placeholder="제목을 입력하세요"
              value={newTitle}
              onChange={(e) => setNewTitle(filterProfanity(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            <textarea
              placeholder="내용을 입력하세요"
              value={newContent}
              onChange={(e) => setNewContent(filterProfanity(e.target.value))}
              rows={8}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setNewImageFile(file);
                const reader = new FileReader();
                reader.onload = () => setNewImagePreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {newImagePreview ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={newImagePreview} alt="첨부 이미지" className="w-full max-h-48 object-cover rounded-2xl" />
                <button
                  onClick={() => {
                    setNewImageFile(null);
                    setNewImagePreview(null);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.5)" }}
                >
                  <X size={14} color="white" />
                </button>
              </div>
            ) : (
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
                  onChange={(e) => setNewPollQuestion(filterProfanity(e.target.value))}
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
                        next[idx] = filterProfanity(e.target.value);
                        setNewPollOptions(next);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                    />
                    {newPollOptions.length > 2 && (
                      <button onClick={() => setNewPollOptions(newPollOptions.filter((_, i) => i !== idx))}>
                        <X size={16} style={{ color: "var(--muted-foreground)" }} />
                      </button>
                    )}
                  </div>
                ))}
                {newPollOptions.length < 5 && (
                  <button
                    onClick={() => setNewPollOptions([...newPollOptions, ""])}
                    className="self-start text-xs font-medium px-3 py-1.5 rounded-xl"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  >
                    + 옵션 추가
                  </button>
                )}
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
              onClick={() => {
                if (!editTitle.trim() || !editContent.trim()) {
                  showAlert("제목과 내용을 입력해주세요.");
                  return;
                }
                showAlert("게시물이 수정되었습니다.", () => setEditingPost(null));
              }}
            >
              완료
            </button>
          </div>
          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
            <input
              placeholder="제목을 입력하세요"
              value={editTitle}
              onChange={(e) => setEditTitle(filterProfanity(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            <textarea
              placeholder="내용을 입력하세요"
              value={editContent}
              onChange={(e) => setEditContent(filterProfanity(e.target.value))}
              rows={8}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none no-scrollbar"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
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
                onClick={() => {
                  const targetPost = allPosts.find((p) => p._id === showReport);
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
                showConfirm("이 사용자를 차단하시겠습니까?", () => {
                  const now = new Date();
                  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  addBlockedUser({
                    id: Date.now(),
                    name: targetPost ? targetPost.author.nickname : "사용자",
                    reason: "게시물 신고",
                    date,
                  });
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

      {/* 커스텀 알림 팝업 (확인 1개) */}
      {alertMessage && (
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
    </div>
  );
}