import { useEffect, useState, useMemo, useRef } from "react";
import {
  Camera, ChevronRight, Heart, FileText, Edit3, MessageCircle, Bookmark,
  Lock, Users, Globe, X, ThumbsDown, Star, MoreVertical, Trash2,
} from "lucide-react";
import {
  POSTS, BOARDS, loadStoredInteractions, getDummyComments, filterProfanity,
  STORAGE_KEY, INTERACTIONS_UPDATED_EVENT,
  AVATAR_STORAGE_KEY, AVATAR_UPDATED_EVENT, loadAvatar, scopedKey,
  type Post, type StoredInteractions,
} from "./CommunityScreen";

const VISIBILITY_STORAGE_KEY = "bigding_post_visibility_v1";

type Visibility = "all" | "friends" | "private";

const VISIBILITY_META: Record<Visibility, { label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  all: { label: "전체 공개", Icon: Globe },
  friends: { label: "친구만 공개", Icon: Users },
  private: { label: "나만 보기", Icon: Lock },
};

const loadPostVisibility = (): Record<number, Visibility> => {
  try {
    const raw = localStorage.getItem(scopedKey(VISIBILITY_STORAGE_KEY));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// 로그인 시 서버에서 받아 저장해둔 사용자 정보(localStorage "user")에서 학번을 가져온다.
const loadStudentId = (): string => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    return JSON.parse(raw)?.studentId || "";
  } catch {
    return "";
  }
};

// 24시간이 지난 게시물의 날짜를 "M월 D일" 형식으로 표시한다. (연도는 표시하지 않음)
const formatPostDate = (createdAt: number): string => {
  const date = new Date(createdAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
};

// createdAt(작성 시각, epoch ms)이 있으면 그걸 기준으로 "N분 전" 같은 상대 시간을
// 실시간으로 계산해서 보여준다. 24시간이 지나면 "N일 전" 대신 실제 날짜로 표시한다.
// createdAt이 없는 더미 게시물은 기존 문자열(fallback)을 그대로 쓴다.
const formatRelativeTime = (createdAt?: number, fallback?: string): string => {
  if (!createdAt) return fallback ?? "";

  const diffSec = Math.floor((Date.now() - createdAt) / 1000);
  if (diffSec < 5) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  return formatPostDate(createdAt);
};

interface ProfileScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
}

export function ProfileScreen({ nickname, setNickname }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "comments" | "scrapped">("posts");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [studentId] = useState(loadStudentId);
  const [showVisibilityModal, setShowVisibilityModal] = useState<number | null>(null);
  const [avatar, setAvatar] = useState<string | null>(loadAvatar);
  const [postVisibility, setPostVisibility] = useState<Record<number, Visibility>>(loadPostVisibility);
  // CommunityScreen과 동일한 로컬 저장소(STORAGE_KEY)를 공유해서
  // 좋아요/싫어요/스크랩/댓글/삭제 상태가 두 화면에서 항상 일치하도록 한다.
  const [storedInit] = useState(loadStoredInteractions);
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>(storedInit.likedPosts);
  const [dislikedPosts, setDislikedPosts] = useState<Record<number, boolean>>(storedInit.dislikedPosts);
  const [savedPosts, setSavedPosts] = useState<Record<number, boolean>>(storedInit.savedPosts);
  const [extraComments, setExtraComments] = useState<Record<number, { user: string; text: string; emoji: string }[]>>(storedInit.extraComments);
  const [createdPosts, setCreatedPosts] = useState<Post[]>(storedInit.createdPosts);
  const [deletedPostIds, setDeletedPostIds] = useState<number[]>(storedInit.deletedPostIds);
  const [nextPostId, setNextPostId] = useState(storedInit.nextPostId);
  const [commentInput, setCommentInput] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<number | null>(null);

  // 상대 시간("N분 전") 표시를 실시간으로 갱신하기 위한 tick.
  // 값 자체는 쓰지 않고, 1분마다 리렌더를 강제로 일으켜 formatRelativeTime이 다시 계산되게 한다.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 이 화면에서 좋아요/싫어요/스크랩/댓글/삭제가 바뀌면 저장하고, CommunityScreen에도
  // 즉시 알려서(같은 탭: 커스텀 이벤트, 다른 탭: storage 이벤트) 서로 어긋나지 않게 한다.
  // 이미 저장된 내용과 같으면 다시 쓰지 않아, CommunityScreen이 보낸 갱신을 반영할 때
  // 다시 이벤트를 쏘는 무한 루프가 생기지 않는다.
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
      const json = JSON.stringify(toStore);
      if (localStorage.getItem(scopedKey(STORAGE_KEY)) !== json) {
        localStorage.setItem(scopedKey(STORAGE_KEY), json);
        window.dispatchEvent(new CustomEvent(INTERACTIONS_UPDATED_EVENT, { detail: toStore }));
      }
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [likedPosts, dislikedPosts, savedPosts, extraComments, createdPosts, deletedPostIds, nextPostId]);

  useEffect(() => {
    const applyExternalUpdate = (next: StoredInteractions) => {
      setLikedPosts(next.likedPosts);
      setDislikedPosts(next.dislikedPosts);
      setSavedPosts(next.savedPosts);
      setExtraComments(next.extraComments);
      setCreatedPosts(next.createdPosts);
      setDeletedPostIds(next.deletedPostIds);
      setNextPostId(next.nextPostId);
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

  useEffect(() => {
    try {
      localStorage.setItem(scopedKey(VISIBILITY_STORAGE_KEY), JSON.stringify(postVisibility));
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [postVisibility]);

  const allKnownPosts: Post[] = useMemo(() => {
    const allPosts = [...createdPosts, ...Object.values(POSTS).flat()];
    return allPosts.filter((p) => !deletedPostIds.includes(p.id));
  }, [createdPosts, deletedPostIds]);

  const myPosts: Post[] = useMemo(
    () => allKnownPosts.filter((p) => p.author === "나"),
    [allKnownPosts]
  );

  // CommunityScreen에서 스크랩(북마크)한 게시물을 실제로 불러온다.
  const scrappedPosts: Post[] = useMemo(
    () => allKnownPosts.filter((p) => savedPosts[p.id]),
    [allKnownPosts, savedPosts]
  );

  // 내가 실제로 작성한 댓글을 게시물별 extraComments에서 뽑아온다.
  const myWrittenComments = useMemo(() => {
    const list: { postId: number; index: number; text: string; emoji: string; postTitle: string }[] = [];
    Object.entries(extraComments).forEach(([postIdStr, comments]) => {
      const postId = Number(postIdStr);
      const post = allKnownPosts.find((p) => p.id === postId);
      if (!post) return;
      comments.forEach((c, index) => {
        if (c.user !== "나") return;
        list.push({ postId, index, text: c.text, emoji: c.emoji, postTitle: post.title });
      });
    });
    return list;
  }, [extraComments, allKnownPosts]);

  const getBoardLabel = (board?: string) => BOARDS.find((b) => b.id === board)?.label ?? board ?? "";
  const getCommentCount = (post: Post) => post.comments + (extraComments[post.id]?.length || 0);
  const getLikeCount = (post: Post) => post.likes + (likedPosts[post.id] ? 1 : 0);
  const getDislikeCount = (post: Post) => post.dislikes + (dislikedPosts[post.id] ? 1 : 0);

  const handleAddComment = () => {
    if (!selectedPost || !commentInput.trim()) return;
    const filtered = filterProfanity(commentInput.trim());
    setExtraComments((prev) => ({
      ...prev,
      [selectedPost.id]: [...(prev[selectedPost.id] || []), { user: "나", text: filtered, emoji: "🙂" }],
    }));
    setCommentInput("");
  };

  const handleDeleteComment = (postId: number, index: number) => {
    setOpenCommentMenu(null);
    showConfirm("댓글을 삭제하시겠습니까?", () => {
      setExtraComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((_, i) => i !== index),
      }));
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatar(result);
      try {
        localStorage.setItem(scopedKey(AVATAR_STORAGE_KEY), result);
        window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail: result }));
      } catch {
        // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
      }
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      {/* Profile header */}
      <div
        className="relative px-4 pt-8 pb-6 shrink-0"
        style={{ background: "linear-gradient(160deg, #111a30 0%, #0a0f1f 100%)" }}
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md overflow-hidden"
              style={{ background: "var(--accent)", border: "3px solid var(--primary)" }}
            >
              {avatar ? (
                <img src={avatar} alt="프로필 사진" className="w-full h-full object-cover" />
              ) : (
                "🐕"
              )}
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => document.getElementById("avatar-upload")?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow"
              style={{ background: "var(--primary)" }}
            >
              <Camera size={13} color="white" />
            </button>
          </div>

          <div className="flex-1 pt-1">
            {editMode ? (
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="font-bold text-lg border-b-2 outline-none bg-transparent w-full"
                style={{ color: "var(--foreground)", borderColor: "var(--primary)" }}
              />
            ) : (
             <h2 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>{nickname}</h2>
           )}
           {/* 로그인 시 입력한 학번의 3~4번째 자리(입학연도)를 고정으로 표시 */}
         <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          #{studentId ? studentId.slice(2, 4) : "23"}학번
          </p>
          </div>

          <button
            onClick={() => setEditMode(!editMode)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--card)" }}
          >
            <Edit3 size={22} color="white" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 px-4 gap-2 mb-3 mt-3 shrink-0">
        <button
          onClick={() => setActiveTab("posts")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "posts" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "posts" ? "white" : "var(--muted-foreground)",
          }}
        >
          <FileText size={14} />
          <span>내 글</span>
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "comments" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "comments" ? "white" : "var(--muted-foreground)",
          }}
        >
          <MessageCircle size={14} />
          <span>댓글</span>
        </button>
        <button
          onClick={() => setActiveTab("scrapped")}
          className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: activeTab === "scrapped" ? "var(--primary)" : "var(--muted)",
            color: activeTab === "scrapped" ? "white" : "var(--muted-foreground)",
          }}
        >
          <Bookmark size={14} />
          <span>스크랩</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 flex flex-col gap-3">
        {activeTab === "posts" && (
          myPosts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              아직 작성한 글이 없어요.
            </p>
          ) : myPosts.map((post) => {
            const visibility = postVisibility[post.id] ?? "all";
            const VisibilityIcon = VISIBILITY_META[visibility].Icon;
            return (
              <div key={post.id} className="p-3.5 rounded-2xl shadow-sm cursor-pointer" style={{ background: "var(--card)" }} onClick={() => setSelectedPost(post)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--secondary)", color: "var(--primary)" }}
                    >
                      {getBoardLabel(post.board)}
                    </span>
                    <p className="font-semibold text-sm mt-1.5" style={{ color: "var(--foreground)" }}>{post.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {formatRelativeTime(post.createdAt, post.time)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setShowVisibilityModal(post.id); }}>
                      <VisibilityIcon size={16} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showConfirm("이 게시물을 삭제하시겠습니까?", () => {
                          setDeletedPostIds((prev) => [...prev, post.id]);
                        });
                      }}
                    >
                      <Trash2 size={16} style={{ color: "#d4183d" }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    className="flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLikedPosts((l) => ({ ...l, [post.id]: !l[post.id] }));
                      setDislikedPosts((d) => ({ ...d, [post.id]: false }));
                    }}
                  >
                    <Heart
                      size={13}
                      fill={likedPosts[post.id] ? "var(--primary)" : "none"}
                      color={likedPosts[post.id] ? "var(--primary)" : "var(--muted-foreground)"}
                    />
                    <span className="text-xs" style={{ color: likedPosts[post.id] ? "var(--primary)" : "var(--muted-foreground)" }}>
                      {getLikeCount(post)}
                    </span>
                  </button>
                  <button
                    className="flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDislikedPosts((d) => ({ ...d, [post.id]: !d[post.id] }));
                      setLikedPosts((l) => ({ ...l, [post.id]: false }));
                    }}
                  >
                    <ThumbsDown
                      size={13}
                      fill={dislikedPosts[post.id] ? "#d4183d" : "none"}
                      color={dislikedPosts[post.id] ? "#d4183d" : "var(--muted-foreground)"}
                    />
                    <span className="text-xs" style={{ color: dislikedPosts[post.id] ? "#d4183d" : "var(--muted-foreground)" }}>
                      {getDislikeCount(post)}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <MessageCircle size={13} style={{ color: "var(--muted-foreground)" }} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(post)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {activeTab === "comments" && (
          myWrittenComments.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              작성한 댓글이 없어요.
            </p>
          ) : myWrittenComments.map((comment) => (
            <div
              key={`${comment.postId}-${comment.index}`}
              className="p-3.5 rounded-2xl shadow-sm cursor-pointer"
              style={{ background: "var(--card)" }}
              onClick={() => {
                const post = allKnownPosts.find((p) => p.id === comment.postId);
                if (post) setSelectedPost(post);
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  {comment.postTitle}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComment(comment.postId, comment.index);
                  }}
                >
                  <X size={14} style={{ color: "#d4183d" }} />
                </button>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground)" }}>{comment.emoji} {comment.text}</p>
            </div>
          ))
        )}

        {activeTab === "scrapped" && (
          scrappedPosts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              스크랩한 게시물이 없어요.
            </p>
          ) : scrappedPosts.map((post) => (
            <div
              key={post.id}
              className="p-3.5 rounded-2xl shadow-sm cursor-pointer"
              style={{ background: "var(--card)" }}
              onClick={() => setSelectedPost(post)}
            >
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--secondary)", color: "var(--primary)" }}
              >
                {getBoardLabel(post.board)}
              </span>
              <p className="font-semibold text-sm mt-1.5" style={{ color: "var(--foreground)" }}>{post.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {formatRelativeTime(post.createdAt, post.time)}
              </p>
            </div>
          ))
        )}

        {/* 상세 화면 */}
        {selectedPost && (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setSelectedPost(null)} className="text-lg">←</button>
              <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
              <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0"
                    style={{ background: "var(--muted)" }}
                  >
                    {selectedPost.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {selectedPost.author}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {formatRelativeTime(selectedPost.createdAt, selectedPost.time)}
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

                {selectedPost.image && (
                  <img
                    src={selectedPost.image}
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

                <div className="flex items-center gap-3 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
                  <button className="flex items-center gap-1.5"
                    onClick={() => {
                      setLikedPosts((l) => ({ ...l, [selectedPost.id]: !l[selectedPost.id] }));
                      setDislikedPosts((d) => ({ ...d, [selectedPost.id]: false }));
                    }}>
                    <Heart size={16} fill={likedPosts[selectedPost.id] ? "#3b82f6" : "none"}
                      color={likedPosts[selectedPost.id] ? "#3b82f6" : "var(--muted-foreground)"} />
                    <span className="text-xs" style={{ color: likedPosts[selectedPost.id] ? "var(--primary)" : "var(--muted-foreground)" }}>
                      {getLikeCount(selectedPost)}
                    </span>
                  </button>

                  <button className="flex items-center gap-1.5"
  onClick={() => {
    setDislikedPosts((d) => ({ ...d, [selectedPost.id]: !d[selectedPost.id] }));
    setLikedPosts((l) => ({ ...l, [selectedPost.id]: false }));
  }}>
                    <ThumbsDown size={16} fill={dislikedPosts[selectedPost.id] ? "#d4183d" : "none"}
                      color={dislikedPosts[selectedPost.id] ? "#d4183d" : "var(--muted-foreground)"} />
                    <span className="text-xs" style={{ color: dislikedPosts[selectedPost.id] ? "#d4183d" : "var(--muted-foreground)" }}>
                      {getDislikeCount(selectedPost)}
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
                    onClick={() => setSavedPosts((s) => ({ ...s, [selectedPost.id]: !s[selectedPost.id] }))}>
                    <Bookmark size={16} fill={savedPosts[selectedPost.id] ? "var(--primary)" : "none"}
                      color={savedPosts[selectedPost.id] ? "var(--primary)" : "var(--muted-foreground)"} />
                  </button>
                </div>
              </div>

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
          </div>
        )}
      </div>
      {/* Visibility modal */}
      {showVisibilityModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div
            className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>공개 범위 설정</h3>
              <button onClick={() => setShowVisibilityModal(null)}>
                <X size={20} style={{ color: "var(--foreground)" }} />
              </button>
            </div>
            {(Object.keys(VISIBILITY_META) as Visibility[]).map((id) => {
              const { label, Icon } = VISIBILITY_META[id];
              return (
                <button
                  key={id}
                  onClick={() => {
                    const postId = showVisibilityModal;
                    setShowVisibilityModal(null);
                    if (postId != null) {
                      setPostVisibility((prev) => ({ ...prev, [postId]: id }));
                    }
                    showAlert(`공개 범위가 '${label}'로 변경되었습니다.`);
                  }}
                  className="w-full px-4 py-3 rounded-xl flex items-center gap-3 text-left text-sm"
                  style={{ background: "var(--card)", color: "var(--foreground)" }}
                >
                  <span style={{ color: "var(--primary)" }}><Icon size={18} /></span>
                  {label}
                </button>
              );
            })}
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