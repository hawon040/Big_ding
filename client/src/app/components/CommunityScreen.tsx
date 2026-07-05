import { useState, useEffect } from "react";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import {
  Heart, MessageCircle, Bookmark, Image, Plus, X, ThumbsDown,
  Search, Star, Send, UserPlus, ChevronDown, ChevronUp,
  Users, Trophy, Megaphone, BookOpen, Coffee, MoreVertical, Edit2, Trash2, AlertTriangle
} from "lucide-react";

export type BoardType = "free" | "qna" | "contest" | "event" | "lecture" | "meeting";

interface PollOption {
  id: number;
  text: string;
  votes: number;
}

interface Poll {
  question: string;
  options: PollOption[];
}

export interface Post {
  id: number;
  author: string;
  avatar: string;
  time: string;
  title: string;
  content: string;
  likes: number;
  dislikes: number;
  comments: number;
  image?: string;
  tags?: string[];
  rating?: number;
  maxParticipants?: number;
  currentParticipants?: number;
  price?: number;
  poll?: Poll;
  board?: BoardType;
}

interface Friend {
  id: number;
  name: string;
  avatar: string;
  lastMsg: string;
}

interface Message {
  id: number;
  from: string;
  content: string;
  image?: string;
  time: string;
  mine: boolean;
}

const PROFANITY_LIST = ["욕설", "비속어", "씨발", "개새끼", "병신", "지랄", "꺼져", "죽어"];

const filterProfanity = (text: string) => {
  let filtered = text;
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(word, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });
  return filtered;
};

const FRIENDS: Friend[] = [
  { id: 1, name: "데이터킹", avatar: "👑", lastMsg: "오늘 수업 어때?" },
  { id: 2, name: "AI빅데이터27", avatar: "🐱", lastMsg: "공모전 같이 나가자!" },
  { id: 3, name: "분석마스터", avatar: "📊", lastMsg: "족보 공유해줘서 고마워" },
  { id: 4, name: "파이썬고수", avatar: "🐍", lastMsg: "스터디 언제 할래?" },
];

const CHAT_MESSAGES: Record<number, Message[]> = {
  1: [
    { id: 1, from: "데이터킹", content: "오늘 수업 어때?", time: "10:30", mine: false },
    { id: 2, from: "나", content: "괜찮아! 발표 잘 됐어", time: "10:31", mine: true },
    { id: 3, from: "데이터킹", content: "다행이다 ㅎㅎ 점심 같이?", time: "10:32", mine: false },
  ],
  2: [
    { id: 1, from: "AI빅데이터27", content: "공모전 같이 나가자!", time: "09:15", mine: false },
    { id: 2, from: "나", content: "어떤 공모전?", time: "09:20", mine: true },
  ],
};

export const POSTS: Record<BoardType, Post[]> = {
  free: [
    {
      id: 1, author: "AI빅데이터21", avatar: "📊", time: "10분 전",
      title: "오늘 AI빅데이터 프로젝트 발표 끝!",
      content: "한 학기 동안 진행한 AI빅데이터 분석 프로젝트 발표가 무사히 끝났습니다! 팀원분들 모두 고생하셨어요 👏",
      likes: 24, dislikes: 0, comments: 8
    },
    {
      id: 2, author: "데이터분석가", avatar: "💻", time: "1시간 전",
      title: "자취방 구하는 팁 공유합니다",
      content: "학교 근처에서 자취방 구하면서 배운 꿀팁들 공유해요. 부동산 어플 잘 활용하면 좋은 방 구할 수 있어요!",
      likes: 45, dislikes: 2, comments: 15
    },
    {
      id: 3, author: "통계전공생", avatar: "📈", time: "3시간 전",
      title: "학교 카페테리아 신메뉴 후기",
      content: "오늘 새로 나온 돈까스 먹어봤는데 가성비 좋네요! 4,500원에 이 정도면 괜찮은 것 같아요.",
      likes: 67, dislikes: 5, comments: 22
    },
  ],
  qna: [
    {
      id: 4, author: "신입생22", avatar: "🎓", time: "30분 전",
      title: "학교 도서관 이용 시간 문의",
      content: "시험 기간에 도서관 24시간 운영하나요? 처음이라 잘 몰라서 여쭤봅니다!",
      likes: 8, dislikes: 0, comments: 12
    },
    {
      id: 5, author: "선배님", avatar: "👨‍🎓", time: "2시간 전",
      title: "편의점 알바 추천드려요",
      content: "학교 앞 GS25에서 야간 알바생 구한다고 하네요. 시급 괜찮고 일도 널널해요!",
      likes: 23, dislikes: 1, comments: 9
    },
    {
      id: 14, author: "3학년선배", avatar: "🎒", time: "4시간 전",
      title: "복수전공 신청 방법 알려드려요",
      content: "복수전공 신청은 3월 초에 학사포털에서 하면 됩니다. 경쟁률이 있으니 서두르세요!",
      likes: 34, dislikes: 0, comments: 11
    },
  ],
  contest: [
    {
      id: 6, author: "공모전헌터", avatar: "🏆", time: "1시간 전",
      title: "[공모전] AI빅데이터 분석 공모전 팀원 모집",
      content: "데이터 분석 공모전 프론트엔드 개발자 1명 구합니다! Python, R 가능하신 분 환영해요.",
      likes: 34, dislikes: 0, comments: 18
    },
    {
      id: 7, author: "자격증왕", avatar: "📜", time: "4시간 전",
      title: "ADsP 자격증 체감 난이도 후기",
      content: "지난주 ADsP 시험 봤는데 생각보다 어렵지 않았어요. 기출 문제 위주로 공부하시면 충분합니다!",
      likes: 89, dislikes: 3, comments: 25
    },
    {
      id: 15, author: "백엔드개발자", avatar: "⚙️", time: "2시간 전",
      title: "[팀모집] 창업 공모전 백엔드 구합니다",
      content: "Spring Boot 또는 Node.js 가능하신 분 구합니다. 상금 500만원 공모전이에요!",
      likes: 56, dislikes: 1, comments: 20
    },
  ],
  event: [
    {
      id: 8, author: "학생회", avatar: "🎉", time: "1일 전",
      title: "[행사] AI빅데이터 전공 축제 안내",
      content: "다음주 수요일 전공 축제가 열립니다! 다양한 이벤트와 경품 행사가 준비되어 있으니 많은 참여 부탁드립니다.",
      likes: 156, dislikes: 2, comments: 42
    },
    {
      id: 16, author: "교수님대리", avatar: "📢", time: "3시간 전",
      title: "[공지] AI빅데이터 세미나 개최 안내",
      content: "이번 주 금요일 오후 3시, 산학협력관 101호에서 AI빅데이터 산업 동향 세미나가 열립니다.",
      likes: 88, dislikes: 0, comments: 15
    },
  ],
  lecture: [
    {
      id: 9, author: "4학년선배", avatar: "📚", time: "2시간 전",
      title: "데이터마이닝",
      content: "김교수님 데이터마이닝 강의 정말 좋아요! 실습 위주라 이해하기 쉽고 과제도 적당해요.",
      likes: 45, dislikes: 3, comments: 16
    },
    {
      id: 10, author: "수강생", avatar: "✏️", time: "5시간 전",
      title: "머신러닝",
      content: "작년 기말고사 문제 유형 공유합니다. 이론 60% 실습 40% 비율이에요!",
      likes: 78, dislikes: 1, comments: 23
    },
    {
      id: 17, author: "통계학도", avatar: "📐", time: "1일 전",
      title: "통계학 개론",
      content: "출석 30%, 중간 30%, 기말 40% 비율입니다. 교수님 수업은 판서 위주라 필기 열심히 하세요!",
      likes: 62, dislikes: 0, comments: 18
    },
  ],
  meeting: [
    {
      id: 11, author: "공강러", avatar: "☕", time: "30분 전",
      title: "오늘 3시 카페 공부 같이하실 분!",
      content: "학교 앞 스타벅스에서 3시부터 6시까지 공부하려고 해요. 같이 하실 분 댓글 주세요!",
      likes: 12, dislikes: 0, comments: 5, maxParticipants: 4, currentParticipants: 2
    },
    {
      id: 12, author: "밥친구", avatar: "🍚", time: "1시간 전",
      title: "점심 같이 드실 분 구해요",
      content: "12시 30분에 학식 먹으러 가려고 하는데 혼자 먹기 심심해서요. 같이 가실 분~",
      likes: 8, dislikes: 0, comments: 7, maxParticipants: 3, currentParticipants: 1
    },
    {
      id: 13, author: "운동러", avatar: "🏃", time: "2시간 전",
      title: "저녁 학교 운동장 러닝 같이해요",
      content: "매주 화목 저녁 7시에 운동장 러닝합니다. 부담 없이 참여하세요!",
      likes: 19, dislikes: 0, comments: 10, maxParticipants: 8, currentParticipants: 5
    },
  ],
};

// 좋아요/싫어요/댓글 등 사용자 상호작용을 새로고침해도 유지하기 위한 로컬 저장소 헬퍼
export const STORAGE_KEY = "bigding_community_interactions_v1";
const REPORTS_STORAGE_KEY = "bigding_report_history_v1";
const REPORTS_UPDATED_EVENT = "bigding-report-added";

interface ReportHistoryItem {
  id: number;
  type: string;
  target: string;
  status: string;
  date: string;
  postId: number;
}

const addReportToHistory = (report: ReportHistoryItem) => {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    const list: ReportHistoryItem[] = raw ? JSON.parse(raw) : [];
    const updated = [report, ...list];
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
    // 같은 탭 안에서도 설정 화면이 즉시 반영할 수 있도록 커스텀 이벤트 전파
    window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT, { detail: updated }));
  } catch {
    // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
  }
};
export interface StoredInteractions {
  likedPosts: Record<number, boolean>;
  dislikedPosts: Record<number, boolean>;
  savedPosts: Record<number, boolean>;
  extraComments: Record<number, { user: string; text: string; emoji: string }[]>;
  createdPosts: Post[];
  deletedPostIds: number[];
  nextPostId: number;
}
 
export const loadStoredInteractions = (): StoredInteractions => {
  const fallback: StoredInteractions = {
    likedPosts: {},
    dislikedPosts: {},
    savedPosts: {},
    extraComments: {},
    createdPosts: [],
    deletedPostIds: [],
    nextPostId: 10000,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
};
 const DUMMY_COMMENT_TEMPLATES: { user: string; text: string; emoji: string }[] = [
  { user: "익명1", text: "좋은 정보 감사해요!", emoji: "😊" },
  { user: "익명2", text: "저도 궁금했는데 도움됐어요!", emoji: "🐱" },
  { user: "익명3", text: "공유 감사합니다 👍", emoji: "📊" },
  { user: "익명4", text: "완전 유용하네요!", emoji: "🔥" },
  { user: "익명5", text: "저장해두고 봐야겠어요", emoji: "📌" },
  { user: "익명6", text: "덕분에 잘 알아갑니다", emoji: "🙏" },
  { user: "익명7", text: "저랑 상황이 똑같아서 공감돼요", emoji: "🐰" },
  { user: "익명8", text: "이거 진짜 궁금했던 내용이에요", emoji: "🤔" },
  { user: "익명9", text: "글 잘 읽었습니다!", emoji: "📚" },
  { user: "익명10", text: "다음 글도 기대할게요", emoji: "✨" },
  { user: "익명11", text: "이런 정보 자주 올려주세요", emoji: "🙌" },
  { user: "익명12", text: "저도 참고할게요~", emoji: "🐶" },
];

export const getDummyComments = (post: Post) => {
  const count = Math.max(0, post.comments);
  return Array.from({ length: count }, (_, i) => {
    const template = DUMMY_COMMENT_TEMPLATES[i % DUMMY_COMMENT_TEMPLATES.length];
    const user = i < DUMMY_COMMENT_TEMPLATES.length ? template.user : `익명${i + 1}`;
    return { user, text: template.text, emoji: template.emoji };
  });
};
export const BOARDS = [
  { id: "free" as BoardType, label: "생활Q&A", emoji: "💬", icon: MessageCircle },
  { id: "qna" as BoardType, label: "선배들 작품 전시 공간", emoji: "🏆", icon: Users },
  { id: "contest" as BoardType, label: "학업", emoji: "📖", icon: Trophy },
  { id: "event" as BoardType, label: "행사공지", emoji: "📢", icon: Megaphone },
  { id: "lecture" as BoardType, label: "전공 강의평가", emoji: "⭐", icon: BookOpen },
  { id: "meeting" as BoardType, label: "공강모임", emoji: "☕", icon: Coffee },
];

<<<<<<< HEAD
export function CommunityScreen({ selectedPostId }: { selectedPostId?: number | null }) {
=======
interface CommunityScreenProps {
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
}

export function CommunityScreen({
  showChat,
  setShowChat,
}: CommunityScreenProps) {
>>>>>>> eba623241899abf46b6795ff46087ec4dd13f018
  // 좋아요/싫어요/댓글/스크랩/새 글 등은 로컬 저장소에서 초기값을 불러와
  // 새로고침해도 그대로 유지되도록 한다.
  const [storedInit] = useState(loadStoredInteractions);
  const [activeBoard, setActiveBoard] = useState<BoardType>("free");
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>(storedInit.likedPosts);
  const [dislikedPosts, setDislikedPosts] = useState<Record<number, boolean>>(storedInit.dislikedPosts);
  const [savedPosts, setSavedPosts] = useState<Record<number, boolean>>(storedInit.savedPosts);
 
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [extraComments, setExtraComments] = useState<Record<number, { user: string; text: string; emoji: string }[]>>(storedInit.extraComments);
  const [commentInput, setCommentInput] = useState("");
  const [openCommentMenu, setOpenCommentMenu] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [viewedAuthor, setViewedAuthor] = useState<{ name: string; avatar: string } | null>(null);
  const [showWrite, setShowWrite] = useState(false);
  const [showReport, setShowReport] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [deletedPostIds, setDeletedPostIds] = useState<number[]>(storedInit.deletedPostIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newBoard, setNewBoard] = useState<BoardType>("free");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newPollEnabled, setNewPollEnabled] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState<string[]>(["", ""]);
  const [createdPosts, setCreatedPosts] = useState<Post[]>(storedInit.createdPosts);
  const [nextPostId, setNextPostId] = useState(storedInit.nextPostId);
  const [pollSelections, setPollSelections] = useState<Record<number, number>>({});

  // likedPosts/dislikedPosts/savedPosts/extraComments/createdPosts/deletedPostIds/nextPostId가
  // 바뀔 때마다 로컬 저장소에 저장해서 새로고침해도 숫자가 유지되게 한다.
  useEffect(() => {
    const toStore: StoredInteractions = {
      likedPosts,
      dislikedPosts,
      savedPosts,
      extraComments,
      createdPosts,
      deletedPostIds,
      nextPostId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [likedPosts, dislikedPosts, savedPosts, extraComments, createdPosts, deletedPostIds, nextPostId]);

  const [chatHeight, setChatHeight] = useState(44);
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<number, Message[]>>(CHAT_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const [isFriendSelectMode, setIsFriendSelectMode] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
const [showChatMenu, setShowChatMenu] = useState(false);
const [selectMode, setSelectMode] = useState(false);
const [selectedMsgs, setSelectedMsgs] = useState<number[]>([]);
const [showReportConfirm, setShowReportConfirm] = useState(false);

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

 // 게시물의 실제 댓글 수 = 원래 댓글 수 + 내가 새로 등록한 댓글 수
 const getCommentCount = (post: Post) => post.comments + (extraComments[post.id]?.length || 0);
 const allPosts = [...createdPosts, ...Object.values(POSTS).flat()].filter((p) => !deletedPostIds.includes(p.id));
  useEffect(() => {
  if (selectedPostId != null) {
    const target = allPosts.find((p) => p.id === selectedPostId);
    if (target) {
      setActiveBoard(target.board || activeBoard);
      setSelectedPost(target);
    }
  }
}, [selectedPostId]);
 const posts = showSearch && searchQuery
    ? allPosts.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [...createdPosts.filter((p) => p.board === activeBoard), ...POSTS[activeBoard]].filter((p) => !deletedPostIds.includes(p.id));

  const toggleFriendSelectMode = () => {
  setIsFriendSelectMode((prev) => !prev);
  setSelectedFriendIds([]);
};

const toggleFriendSelect = (id: number) => {
  setSelectedFriendIds((prev) =>
    prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
  );
};

const handleDeleteFriends = () => {
  if (selectedFriendIds.length === 0) return;
  showConfirm(`선택한 ${selectedFriendIds.length}명의 친구를 삭제하시겠습니까?`, () => {
    setFriends((prev) => prev.filter((f) => !selectedFriendIds.includes(f.id)));
    setSelectedFriendIds([]);
    setIsFriendSelectMode(false);
  });
};

  const sendMessage = () => {
    if (!chatInput.trim() || !activeFriend) return;
    const filtered = filterProfanity(chatInput);
    const newMsg: Message = {
      id: Date.now(),
      from: "나",
      content: filtered,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      mine: true,
    };
    setChatMessages((prev) => ({
      ...prev,
      [activeFriend.id]: [...(prev[activeFriend.id] || []), newMsg],
    }));
    setChatInput("");
  };

  const handleAddComment = () => {
  if (!selectedPost || !commentInput.trim()) return;
  const filtered = filterProfanity(commentInput.trim());
  setExtraComments((prev) => ({
    ...prev,
    [selectedPost.id]: [...(prev[selectedPost.id] || []), { user: "나", text: filtered, emoji: "🙂" }],
  }));
  setCommentInput("");
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

// 내가 작성한 댓글 삭제 (extraComments에서 해당 인덱스만 제거)
  const handleDeleteComment = (postId: number, index: number) => {
    setOpenCommentMenu(null);
    showConfirm("댓글을 삭제하시겠습니까?", () => {
      setExtraComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((_, i) => i !== index),
      }));
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
          <span className="text-2xl">{activeFriend.avatar}</span>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{activeFriend.name}</p>
          </div>
          {selectMode ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setChatMessages((prev) => ({
                    ...prev,
                    [activeFriend.id]: (prev[activeFriend.id] || []).filter((m) => !selectedMsgs.includes(m.id)),
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
                `${activeFriend?.name}님을 차단하면
                더 이상 채팅을 주고받을 수 없습니다.

                차단하시겠습니까?`,
                () => {
                  setFriends((prev) =>
                    prev.filter((f) => f.id !== activeFriend?.id)
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
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {(chatMessages[activeFriend.id] || []).map((msg) => (
            <div key={msg.id} className={`flex items-center gap-2 ${msg.mine ? "justify-end" : "justify-start"}`}>
              {selectMode && msg.mine && (
                <input
                  type="checkbox"
                  checked={selectedMsgs.includes(msg.id)}
                  onChange={() => {
                    setSelectedMsgs((prev) =>
                      prev.includes(msg.id) ? prev.filter((id) => id !== msg.id) : [...prev, msg.id]
                    );
                  }}
                  className="w-4 h-4 accent-orange-400"
                />
              )}
              <div
                className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                style={{
                  background: msg.mine ? "var(--primary)" : "var(--card)",
                  color: msg.mine ? "white" : "var(--foreground)",
                  outline: selectedMsgs.includes(msg.id) ? "2px solid var(--primary)" : "none",
                }}
              >
                <p>{msg.content}</p>
                {msg.image && (
                  <img src={msg.image} alt="사진" className="rounded-xl mt-1 max-w-full" style={{ maxHeight: "200px" }} />
                )}
                <p className="text-[10px] mt-0.5 opacity-70 text-right">{msg.time}</p>
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !activeFriend) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const newMsg: Message = {
                    id: Date.now(),
                    from: "나",
                    content: "",
                    image: reader.result as string,
                    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
                    mine: true,
                  };
                  setChatMessages((prev) => ({
                    ...prev,
                    [activeFriend.id]: [...(prev[activeFriend.id] || []), newMsg],
                  }));
                };
                reader.readAsDataURL(file);
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
      </div>
    );
  }

  // ── 작성자 프로필 화면 ────────────────────────────────────────────────────
  if (viewedAuthor) {
    const authorPosts = allPosts.filter((p) => p.author === viewedAuthor.name);

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

        <div className="flex-1 overflow-y-auto">
          {/* 프로필 상단 카드 */}
          <div className="px-4 py-6 flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ background: "var(--muted)" }}
            >
              {viewedAuthor.avatar}
            </div>
            <p className="font-bold text-lg mt-1" style={{ color: "var(--foreground)" }}>
              {viewedAuthor.name}
            </p>

            {/* 통계 */}
            <div className="flex gap-8 mt-2">
              {[
                { label: "게시글", value: authorPosts.length },
                { label: "댓글", value: authorPosts.reduce((s, p) => s + getCommentCount(p), 0) },
                { label: "좋아요", value: authorPosts.reduce((s, p) => s + p.likes, 0) },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{value}</span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 탭: 내글 / 댓글 / 좋아요 / 스크랩 */}
          <div
            className="flex border-b shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            {[
              { label: "내 글", icon: "📄" },
              { label: "댓글", icon: "💬" },
              { label: "좋아요", icon: "🤍" },
              { label: "스크랩", icon: "🔖" },
            ].map(({ label, icon }, idx) => (
              <button
                key={label}
                className="flex-1 flex flex-col items-center py-3 text-xs font-medium gap-1"
                style={{
                  color: idx === 0 ? "var(--primary)" : "var(--muted-foreground)",
                  borderBottom: idx === 0 ? "2px solid var(--primary)" : "2px solid transparent",
                }}
              >
                <span className="text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* 게시물 목록 */}
          <div className="px-4 py-3 flex flex-col gap-3">
            {authorPosts.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>
                작성한 게시물이 없어요
              </p>
            ) : (
              authorPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setViewedAuthor(null);
                    setSelectedPost(p);
                  }}
                  className="p-4 rounded-2xl cursor-pointer"
                  style={{ background: "var(--card)" }}
                >
                  {/* 게시판 라벨 */}
                  <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                    자유게시판
                  </p>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                    {p.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--muted-foreground)" }}>
                    {p.content}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Heart size={12} /> {p.likes + (likedPosts[p.id] ? 1 : 0)}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <MessageCircle size={12} /> {getCommentCount(p)}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
                      {p.time}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 게시물 상세 화면 ──────────────────────────────────────────────────────
  if (selectedPost) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setSelectedPost(null)} className="text-lg">←</button>
          <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-hide">
          {/* 게시물 카드 */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  setSelectedPost(null);
                  setViewedAuthor({ name: selectedPost.author, avatar: selectedPost.avatar });
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0"
                style={{ background: "var(--muted)" }}
              >
                {selectedPost.avatar}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {selectedPost.author}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {selectedPost.time}
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

            {selectedPost.id % 3 === 1 && (
              <div className="mt-2 h-32 rounded-xl flex items-center justify-center" style={{ background: "var(--muted)" }}>
                <Image size={28} style={{ color: "var(--muted-foreground)" }} />
              </div>
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

            <div className="flex items-center gap-3 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
             <button className="flex items-center gap-1.5"
              onClick={() => {
                setLikedPosts((l) => ({ ...l, [selectedPost!.id]: !l[selectedPost!.id] }));
                setDislikedPosts((d) => ({ ...d, [selectedPost!.id]: false }));
              }}>
                <Heart size={16} fill={likedPosts[selectedPost.id] ? "#3b82f6" : "none"}
                  color={likedPosts[selectedPost.id] ? "#3b82f6" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: likedPosts[selectedPost.id] ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {selectedPost.likes + (likedPosts[selectedPost.id] ? 1 : 0)}
                </span>
              </button>
              <button className="flex items-center gap-1.5"
                onClick={() => {
                  if (!likedPosts[selectedPost!.id]) {
                    setDislikedPosts((d) => ({ ...d, [selectedPost!.id]: !d[selectedPost!.id] }));
                  }
                }}>
                <ThumbsDown size={16} fill={dislikedPosts[selectedPost.id] ? "#d4183d" : "none"}
                  color={dislikedPosts[selectedPost.id] ? "#d4183d" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: dislikedPosts[selectedPost.id] ? "#d4183d" : "var(--muted-foreground)" }}>
                  {selectedPost.dislikes + (dislikedPosts[selectedPost.id] ? 1 : 0)}
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <MessageCircle size={16} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(selectedPost)}</span>
              </div>
              <button className="flex items-center gap-1.5"
                onClick={() => setSavedPosts((s) => ({ ...s, [selectedPost!.id]: !s[selectedPost!.id] }))}>
                <Bookmark size={16} fill={savedPosts[selectedPost.id] ? "var(--primary)" : "none"}
                  color={savedPosts[selectedPost.id] ? "var(--primary)" : "var(--muted-foreground)"} />
              </button>
            </div>
          </div>

          {/* 댓글 목록 */}
          <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
              댓글 {getCommentCount(selectedPost)}개
            </p>
            {getDummyComments(selectedPost).map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{ background: "var(--muted)" }}>{c.emoji}</div>
                <div className="flex-1 px-3 py-2 rounded-xl text-xs"
                  style={{ color: "var(--foreground)" }}>
                  <span className="font-semibold">{c.user} </span>{c.text}
                </div>
              </div>
            ))}

           {(extraComments[selectedPost.id] || []).map((c, i) => (
  <div key={`new-${i}`} className="flex gap-2 items-start relative">
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
      style={{ background: "var(--muted)" }}>{c.emoji}</div>
    <div className="flex-1 px-3 py-2 rounded-xl text-xs flex items-start justify-between gap-2"
      style={{ color: "var(--foreground)" }}>
      <span><span className="font-semibold">{c.user} </span>{c.text}</span>
      <div className="relative shrink-0">
        <button
          onClick={() => setOpenCommentMenu(openCommentMenu === i ? null : i)}
          style={{ color: "var(--muted-foreground)" }}
          aria-label="댓글 더보기"
        >
          <MoreVertical size={14} />
        </button>
        {openCommentMenu === i && (
          <div
            className="absolute right-0 top-6 z-20 rounded-xl shadow-lg py-1 min-w-[90px]"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <button
              onClick={() => handleDeleteComment(selectedPost.id, i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:opacity-70"
              style={{ color: "#d4183d" }}
            >
              <Trash2 size={13} /> 삭제
            </button>
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
    setNewBoard(activeBoard);
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
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide shrink-0">
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
<div className="flex-1 overflow-y-auto px-4 pb-20 flex flex-col gap-3 scrollbar-hide">        {posts.map((post) => (
          <div
            key={post.id}
            className="rounded-2xl p-4 shadow-sm relative"
            style={{ background: "var(--card)" }}
          >
            {/* Author */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewedAuthor({ name: post.author, avatar: post.avatar });
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0"
                style={{ background: "var(--muted)" }}
              >
                {post.avatar}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{post.author}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{post.time}</p>
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
                  setShowMoreMenu(showMoreMenu === post.id ? null : post.id);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ color: "var(--muted-foreground)" }}
              >
                <MoreVertical size={18} />
              </button>
              {showMoreMenu === post.id && (
                <div
                  className="absolute right-0 top-9 z-20 rounded-xl shadow-lg py-1 min-w-[110px]"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  {post.author === "나" ? (
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
                          showConfirm("이 게시물을 삭제하시겠습니까?", () => {
                            setDeletedPostIds((prev) => [...prev, post.id]);
                            setShowMoreMenu(null);
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
                        setShowReport(post.id);
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
            <div onClick={() => setSelectedPost(post)} className="cursor-pointer">
              <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{post.title}</h3>

              {post.id % 3 === 1 && (
                <div className="mt-2 h-32 rounded-xl flex items-center justify-center" style={{ background: "var(--muted)" }}>
                  <Image size={28} style={{ color: "var(--muted-foreground)" }} />
                </div>
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

              {post.poll && (() => {
                const selectedId = pollSelections[post.id];
                const totalVotes = post.poll.options.reduce(
                  (sum, opt) => sum + opt.votes + (selectedId === opt.id ? 1 : 0),
                  0
                );
                return (
                  <div
                    className="mt-3 p-3 rounded-2xl flex flex-col gap-2"
                    style={{ background: "var(--muted)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      🗳️ {post.poll.question}
                    </p>
                    {post.poll.options.map((opt) => {
                      const votes = opt.votes + (selectedId === opt.id ? 1 : 0);
                      const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
                      const isSelected = selectedId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setPollSelections((prev) => ({
                              ...prev,
                              [post.id]: prev[post.id] === opt.id ? undefined : opt.id,
                            } as Record<number, number>))
                          }
                          className="relative w-full text-left rounded-xl overflow-hidden text-xs"
                          style={{ border: "1.5px solid var(--border)" }}
                        >
                          {selectedId !== undefined && (
                            <div
                              className="absolute inset-y-0 left-0 transition-all"
                              style={{
                                width: `${percent}%`,
                                background: isSelected ? "var(--primary)" : "var(--secondary)",
                                opacity: isSelected ? 0.35 : 0.25,
                              }}
                            />
                          )}
                          <div className="relative flex items-center justify-between px-3 py-2">
                            <span style={{ color: "var(--foreground)", fontWeight: isSelected ? 600 : 400 }}>
                              {opt.text}
                            </span>
                            {selectedId !== undefined && (
                              <span style={{ color: "var(--muted-foreground)" }}>{percent}% ({votes})</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {totalVotes}명 참여{selectedId === undefined ? " · 옵션을 눌러 투표하세요" : ""}
                    </p>
                  </div>
                );
              })()}

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

           {/* Actions */}
<div className="flex items-center gap-3 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
  <button className="flex items-center gap-1.5"
    onClick={() => {
      setLikedPosts((l) => ({ ...l, [post.id]: !l[post.id] }));
      setDislikedPosts((d) => ({ ...d, [post.id]: false }));
    }}>
    <Heart size={16} fill={likedPosts[post.id] ? "#3b82f6" : "none"}
      color={likedPosts[post.id] ? "#3b82f6" : "var(--muted-foreground)"} />
    <span className="text-xs" style={{ color: likedPosts[post.id] ? "var(--primary)" : "var(--muted-foreground)" }}>
      {post.likes + (likedPosts[post.id] ? 1 : 0)}
    </span>
  </button>
  <button className="flex items-center gap-1.5"
    onClick={() => {
      setDislikedPosts((d) => ({ ...d, [post.id]: !d[post.id] }));
      setLikedPosts((l) => ({ ...l, [post.id]: false }));
    }}>
                <ThumbsDown size={16} fill={dislikedPosts[post.id] ? "#d4183d" : "none"}
                  color={dislikedPosts[post.id] ? "#d4183d" : "var(--muted-foreground)"} />
                <span className="text-xs" style={{ color: dislikedPosts[post.id] ? "#d4183d" : "var(--muted-foreground)" }}>
                  {post.dislikes + (dislikedPosts[post.id] ? 1 : 0)}
                </span>
              </button>
              <button className="flex items-center gap-1.5" onClick={() => setSelectedPost(post)}>
                <MessageCircle size={16} style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(post)}</span>
              </button>
              <button className="flex items-center gap-1.5"
                onClick={() => setSavedPosts((s) => ({ ...s, [post.id]: !s[post.id] }))}>
                <Bookmark size={16} fill={savedPosts[post.id] ? "var(--primary)" : "none"}
                  color={savedPosts[post.id] ? "var(--primary)" : "var(--muted-foreground)"} />
              </button>
            </div>

            {openComments[post.id] && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex gap-2 items-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                    style={{ background: "var(--muted)" }}>😊</div>
                  <div className="flex-1 px-3 py-2 rounded-xl text-xs"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}>
                    <span className="font-semibold">익명1 </span>좋은 정보 감사해요!
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    placeholder="댓글 입력..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                  />
                  <button className="px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: "var(--primary)", color: "white" }}>
                    등록
                  </button>
                </div>
              </div>
            )}
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

        <div className="px-4 py-3 h-160 overflow-y-auto flex flex-col gap-2"
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

          {showAddFriend && (
            <div className="flex gap-2 mb-2">
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="학번 또는 닉네임 검색"
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                onClick={() => {
                  if (friendSearch.trim()) {
                    const name = friendSearch;
                    setFriendSearch("");
                    setShowAddFriend(false);
                    showAlert(`'${name}'에게 친구 신청을 보냈습니다.`);
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--primary)", color: "white" }}
              >
                신청
              </button>
            </div>
          )}

         {friends.map((friend) => (
  <button
    key={friend.id}
    onClick={() => {
      if (isFriendSelectMode) {
        toggleFriendSelect(friend.id);
      } else {
        setActiveFriend(friend);
      }
    }}
    className="flex items-center gap-3 p-2.5 rounded-xl text-left"
    style={{
      background: "var(--card)",
      outline: isFriendSelectMode && selectedFriendIds.includes(friend.id)
        ? "2px solid var(--primary)"
        : "none",
    }}
  >
    {isFriendSelectMode && (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: selectedFriendIds.includes(friend.id) ? "var(--primary)" : "var(--muted)",
          border: "1.5px solid var(--border)",
        }}
      >
        {selectedFriendIds.includes(friend.id) && (
          <span className="text-white text-[10px] font-bold">✓</span>
        )}
      </div>
    )}

    <div className="relative">
      <span className="text-2xl">{friend.avatar}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{friend.name}</p>
      <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{friend.lastMsg}</p>
    </div>
  </button>
))}

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
              className="px-4 py-1.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--primary)", color: "white" }}
             onClick={() => {
                if (!newTitle.trim() || !newContent.trim()) {
                  showAlert("제목과 내용을 입력해주세요.");
                  return;
                }
                const validOptions = newPollOptions.map((o) => o.trim()).filter(Boolean);
                if (newPollEnabled && (!newPollQuestion.trim() || validOptions.length < 2)) {
                  showAlert("투표 질문과 2개 이상의 옵션을 입력해주세요.");
                  return;
                }
                const newPost: Post = {
                  id: nextPostId,
                  author: "나",
                  avatar: "🙂",
                  time: "방금 전",
                  title: newTitle,
                  content: newContent,
                  likes: 0,
                  dislikes: 0,
                  comments: 0,
                  image: newImage || undefined,
                  board: newBoard,
                  ...(newPollEnabled
                    ? {
                        poll: {
                          question: newPollQuestion.trim(),
                          options: validOptions.map((text, i) => ({ id: i, text, votes: 0 })),
                        },
                      }
                    : {}),
                };
                setCreatedPosts((prev) => [newPost, ...prev]);
                setNextPostId((n) => n + 1);
                setNewTitle("");
                setNewContent("");
                setNewImage(null);
                setNewPollEnabled(false);
                setNewPollQuestion("");
                setNewPollOptions(["", ""]);
                setShowWrite(false);
              }}
            >
              등록
            </button>
          </div>
          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
                게시판 선택
              </label>
               <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
                {BOARDS.map(({ id, label, emoji }) => (
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
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
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
                const reader = new FileReader();
                reader.onload = () => setNewImage(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {newImage ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={newImage} alt="첨부 이미지" className="w-full max-h-48 object-cover rounded-2xl" />
                <button
                  onClick={() => setNewImage(null)}
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
          <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
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
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {showReport && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-t-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
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
                  const targetPost = allPosts.find((p) => p.id === showReport);
                  const now = new Date();
                  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
                  addReportToHistory({
                    id: Date.now(),
                    type: reason,
                    target: targetPost ? targetPost.title : "게시물",
                    status: "처리 중",
                    date,
                    postId: showReport as number,
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
                showConfirm("이 사용자를 차단하시겠습니까?", () => {
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