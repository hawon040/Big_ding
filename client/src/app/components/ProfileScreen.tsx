import { useEffect, useState, useMemo } from "react";
import {
  Camera, ChevronRight, Heart, FileText, Edit3, MessageCircle, Bookmark,
  Lock, Users, Globe, X, ThumbsDown, Star, MoreVertical, Trash2,
} from "lucide-react";
import {
  POSTS, BOARDS, loadStoredInteractions, getDummyComments, filterProfanity,
  STORAGE_KEY, type Post, type StoredInteractions,
} from "./CommunityScreen";

const SCRAPPED = [
  { id: 1, title: "AI빅데이터 분석 공모전 팀원 모집", board: "공모전/자격증", emoji: "🏆" },
  { id: 2, title: "데이터마이닝 강의 추천합니다", board: "강의평가", emoji: "⭐" },
  { id: 3, title: "학교 도서관 이용 시간 문의", board: "선후배 Q&A", emoji: "🙋" },
];

const MY_COMMENTS = [
  { id: 1, postTitle: "ADsP 자격증 체감 난이도 후기", content: "저도 다음달에 시험 보는데 도움이 많이 됐어요!", time: "1일 전" },
  { id: 2, postTitle: "학교 카페테리아 신메뉴 AI빅데이터전공 27학번후기", content: "저도 어제 먹어봤는데 맛있더라구요", time: "3일 전" },
];

const AVATAR_STORAGE_KEY = "bigding_profile_avatar_v1";
const VISIBILITY_STORAGE_KEY = "bigding_post_visibility_v1";

type Visibility = "all" | "friends" | "private";

const VISIBILITY_META: Record<Visibility, { label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  all: { label: "전체 공개", Icon: Globe },
  friends: { label: "친구만 공개", Icon: Users },
  private: { label: "나만 보기", Icon: Lock },
};

const loadAvatar = (): string | null => {
  try {
    return localStorage.getItem(AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
};

const loadPostVisibility = (): Record<number, Visibility> => {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
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

  // 삭제/취소가 실제로 반영되도록 상태로 관리
  const [myComments, setMyComments] = useState(MY_COMMENTS);
  const [scrapped, setScrapped] = useState(SCRAPPED);

  // CommunityScreen과 동일한 로컬 저장소(STORAGE_KEY)를 공유해서
  // 좋아요/싫어요/스크랩/댓글/삭제 상태가 두 화면에서 항상 일치하도록 한다.
  const [storedInit] = useState(loadStoredInteractions);
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>(storedInit.likedPosts);
  const [dislikedPosts, setDislikedPosts] = useState<Record<number, boolean>>(storedInit.dislikedPosts);
  const [savedPosts, setSavedPosts] = useState<Record<number, boolean>>(storedInit.savedPosts);
  const [extraComments, setExtraComments] = useState<Record<number, { user: string; text: string; emoji: string }[]>>(storedInit.extraComments);
  const [deletedPostIds, setDeletedPostIds] = useState<number[]>(storedInit.deletedPostIds);
  const [commentInput, setCommentInput] = useState("");
  const [openCommentMenu, setOpenCommentMenu] = useState<number | null>(null);

  useEffect(() => {
    const toStore: StoredInteractions = {
      likedPosts,
      dislikedPosts,
      savedPosts,
      extraComments,
      createdPosts: storedInit.createdPosts,
      deletedPostIds,
      nextPostId: storedInit.nextPostId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [likedPosts, dislikedPosts, savedPosts, extraComments, deletedPostIds, storedInit.createdPosts, storedInit.nextPostId]);

  useEffect(() => {
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(postVisibility));
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [postVisibility]);

  const myPosts: Post[] = useMemo(() => {
    const allPosts = [...storedInit.createdPosts, ...Object.values(POSTS).flat()];
    return allPosts.filter((p) => !deletedPostIds.includes(p.id) && p.author === "나");
  }, [storedInit.createdPosts, deletedPostIds]);

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
        localStorage.setItem(AVATAR_STORAGE_KEY, result);
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
    <div className="relative flex flex-col flex-1 overflow-y-auto">
      {/* Profile header */}
      <div
        className="relative px-4 pt-8 pb-6"
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
      <div className="grid grid-cols-3 px-4 gap-2 mb-3 mt-3">
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
      <div className="px-4 pb-6 flex flex-col gap-3">
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
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{post.time}</p>
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
        <div className="flex items-center gap-1">
  <Heart size={13} fill="var(--primary)" color="var(--primary)" />
  <span className="text-xs" style={{ color: "var(--primary)" }}>{getLikeCount(post)}</span>
</div>
        <div className="flex items-center gap-1">
          <MessageCircle size={13} style={{ color: "var(--muted-foreground)" }} />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getCommentCount(post)}</span>
        </div>
      </div>
    </div>
    );
  })
)}
        {activeTab === "comments" && myComments.map((comment) => (
          <div key={comment.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                {comment.postTitle}
              </p>
              <button
                onClick={() => {
                  showConfirm("댓글을 삭제하시겠습니까?", () => {
                    setMyComments((prev) => prev.filter((c) => c.id !== comment.id));
                  });
                }}
              >
                <X size={14} style={{ color: "#d4183d" }} />
              </button>
            </div>
            <p className="text-sm" style={{ color: "var(--foreground)" }}>{comment.content}</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{comment.time}</p>
          </div>
        ))}

        {activeTab === "scrapped" && scrapped.map((item) => (
          <div key={item.id} className="p-3.5 rounded-2xl shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{item.emoji}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "var(--secondary)", color: "var(--primary)" }}
                  >
                    {item.board}
                  </span>
                </div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{item.title}</p>
              </div>
              <button
                onClick={() => {
                  showConfirm("스크랩을 취소하시겠습니까?", () => {
                    setScrapped((prev) => prev.filter((s) => s.id !== item.id));
                  });
                }}
              >
                <Bookmark size={18} fill="var(--primary)" color="var(--primary)" />
              </button>
            </div>
          </div>
        ))}
      </div>

    {selectedPost && (
  <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
    <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setSelectedPost(null)} className="text-lg">←</button>
      <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-hide">
      {/* 게시물 카드 */}
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
            setLikedPosts((l) => ({ ...l, [selectedPost!.id]: !l[selectedPost!.id] }));
            setDislikedPosts((d) => ({ ...d, [selectedPost!.id]: false }));
          }}>
            <Heart size={16} fill={likedPosts[selectedPost.id] ? "#3b82f6" : "none"}
              color={likedPosts[selectedPost.id] ? "#3b82f6" : "var(--muted-foreground)"} />
            <span className="text-xs" style={{ color: likedPosts[selectedPost.id] ? "var(--primary)" : "var(--muted-foreground)" }}>
              {getLikeCount(selectedPost)}
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
              {getDislikeCount(selectedPost)}
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
  </div>
)}
      {/* Visibility modal */}
      {showVisibilityModal && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div
            className="w-full rounded-t-3xl px-4 py-6 flex flex-col gap-3"
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
