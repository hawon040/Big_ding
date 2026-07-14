import { useEffect, useState, useMemo, useRef } from "react";
import {
  Camera, ChevronRight, Heart, FileText, Edit3, MessageCircle, Bookmark,
  Lock, Users, Globe, X, ThumbsDown, Star, MoreVertical, Trash2,
} from "lucide-react";
import api, { resolveAssetUrl } from "@/api";
import defaultAvatar from "@/assets/default-avatar.svg";
import bigRoadingIcon from "@/assets/big-roading-icon.png";
import {
  BOARDS, loadStoredInteractions, filterProfanity,
  STORAGE_KEY, INTERACTIONS_UPDATED_EVENT,
  AVATAR_UPDATED_EVENT, scopedKey,
  getCurrentUser, getDisplayTime, updateStoredUser,
  type Post, type StoredInteractions,
} from "./CommunityScreen";

const VISIBILITY_STORAGE_KEY = "bigding_post_visibility_v1";

type Visibility = "all" | "friends" | "private";

const VISIBILITY_META: Record<Visibility, { label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  all: { label: "전체 공개", Icon: Globe },
  friends: { label: "친구만 공개", Icon: Users },
  private: { label: "나만 보기", Icon: Lock },
};

const loadPostVisibility = (): Record<string, Visibility> => {
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

interface ProfileScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
}

export function ProfileScreen({ nickname, setNickname }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "comments" | "scrapped">("posts");
  const [currentUser] = useState(getCurrentUser);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [studentId] = useState(loadStudentId);
  const [showVisibilityModal, setShowVisibilityModal] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  // + 닉네임 변경 검증용 상태
const [nicknameInput, setNicknameInput] = useState(nickname);
const [nicknameChecked, setNicknameChecked] = useState(false);

// + 팔로우/팔로워 상태
const [followerCount, setFollowerCount] = useState(currentUser?.followers?.length ?? 0);
const [followingCount, setFollowingCount] = useState(currentUser?.following?.length ?? 0);

// + 팔로워/팔로잉 수를 몇 초마다 다시 불러와 실시간처럼 반영한다.
// (다른 사람이 나를 팔로우해도, currentUser는 로그인 시점 캐시라서 저절로 갱신되지 않음)
useEffect(() => {
  let cancelled = false;
  const fetchFollowCounts = () => {
    api.get("/users/profile")
      .then((res) => {
        if (cancelled) return;
        setFollowerCount((res.data.followers || []).length);
        setFollowingCount((res.data.following || []).length);
      })
      .catch(() => {});
  };
  fetchFollowCounts();
  const interval = setInterval(fetchFollowCounts, 2000);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, []);

const [postVisibility, setPostVisibility] = useState<Record<string, Visibility>>(loadPostVisibility);

  // 게시물 목록은 실제 DB(GET /api/posts)에서 불러온다. 좋아요/댓글/투표처럼 다른 사람이
  // 바꾼 내용도 새로고침 없이 보이도록, 이 화면에 머무르는 동안 몇 초마다 다시 불러온다(폴링).
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fetchPosts = (isInitial: boolean) => {
      if (isInitial) setPostsLoading(true);
      api.get("/posts")
        .then((res) => {
          if (!cancelled) setPosts(res.data);
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
  }, []);
  const selectedPost = selectedPostId ? posts.find((p) => p._id === selectedPostId) ?? null : null;

  // 스크랩(저장)만 CommunityScreen과 동일한 로컬 저장소(STORAGE_KEY)를 공유해서
  // 두 화면에서 항상 일치하도록 한다. 좋아요/싫어요/댓글/삭제는 이제 DB가 기준이다.
  const [storedInit] = useState(loadStoredInteractions);
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>(storedInit.savedPosts);
  const [commentInput, setCommentInput] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [openCommentMenu, setOpenCommentMenu] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // 상대 시간("N분 전") 표시를 실시간으로 갱신하기 위한 tick.
  // 값 자체는 쓰지 않고, 1분마다 리렌더를 강제로 일으켜 formatRelativeTime이 다시 계산되게 한다.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 스크랩(savedPosts)이 바뀌면 저장하고, CommunityScreen에도
  // 즉시 알려서(같은 탭: 커스텀 이벤트, 다른 탭: storage 이벤트) 서로 어긋나지 않게 한다.
  // 이미 저장된 내용과 같으면 다시 쓰지 않아, CommunityScreen이 보낸 갱신을 반영할 때
  // 다시 이벤트를 쏘는 무한 루프가 생기지 않는다.
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

  useEffect(() => {
    try {
      localStorage.setItem(scopedKey(VISIBILITY_STORAGE_KEY), JSON.stringify(postVisibility));
    } catch {
      // 저장 공간이 꽉 찼거나 접근 불가한 경우 조용히 무시
    }
  }, [postVisibility]);

  const myPosts: Post[] = useMemo(
    () => (currentUser ? posts.filter((p) => p.author._id === currentUser._id) : []),
    [posts, currentUser]
  );

  // CommunityScreen에서 스크랩(북마크)한 게시물을 실제로 불러온다.
  const scrappedPosts: Post[] = useMemo(
    () => posts.filter((p) => savedPosts[p._id]),
    [posts, savedPosts]
  );

  // 내가 실제로 작성한 댓글을 각 게시물의 실제 comments 배열에서 뽑아온다.
  const myWrittenComments = useMemo(() => {
    if (!currentUser) return [];
    const list: { postId: string; commentId: string; text: string; postTitle: string }[] = [];
    posts.forEach((post) => {
      post.comments.forEach((c) => {
        if (c.author._id !== currentUser._id) return;
        list.push({ postId: post._id, commentId: c._id, text: c.content, postTitle: post.title });
      });
    });
    return list;
  }, [posts, currentUser]);

  const getBoardLabel = (board?: string) => BOARDS.find((b) => b.id === board)?.label ?? board ?? "";
  const getCommentCount = (post: Post) => post.comments.length;
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

  const handleDeletePost = (postId: string) => {
    showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
      try {
        await api.delete(`/posts/${postId}`);
        setPosts((prev) => prev.filter((p) => p._id !== postId));
      } catch {
        showAlert("게시물 삭제에 실패했습니다.");
      }
    });
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await api.patch("/users/profile", formData);
      const url = res.data.avatar as string;
      setAvatar(url);
      updateStoredUser({ avatar: url });
      window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail: url }));
    } catch {
      showAlert("프로필 사진 변경에 실패했습니다.");
    }
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

  // + 닉네임 검증 함수
  const validateNickname = (value: string): string | null => {
    if (!value.trim()) {
      return "닉네임을 작성해주세요.";
    }
    const validPattern = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\s]+$/;
    if (!validPattern.test(value) || value.length > 10) {
      return "특수문자를 제외한 띄어쓰기 포함 10자 이내로 적어주세요.";
    }
    return null;
  };

  const checkNicknameDuplicate = async () => {
    const error = validateNickname(nicknameInput);
    if (error) {
      showAlert(error);
      return;
    }
    if (nicknameInput.trim() === nickname.trim()) {
      setNicknameChecked(true);
      showAlert("현재 사용 중인 닉네임입니다.");
      return;
    }
    try {
      const res = await api.post("/auth/check-nickname", { nickname: nicknameInput.trim() });
      setNicknameChecked(true);
      showAlert(res.data.message);
    } catch (err: any) {
      setNicknameChecked(false);
      showAlert(err?.response?.data?.message || "이미 사용 중인 닉네임입니다.");
    }
  };

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      {/* Profile header (Instagram 스타일) */}
      <div
        className="relative px-4 pt-3 pb-3 shrink-0"
        style={{ background: "linear-gradient(160deg, var(--background) 0%, #0a0f1f 100%)" }}
      >
        <div className="flex items-center gap-1.5 mb-4">
          <img src={bigRoadingIcon} alt="Big Roading" className="w-7 h-7 object-cover rounded-md" />
          <span
            className="text-lg"
            style={{ color: "var(--foreground)", fontFamily: "'Brush Script MT', cursive" }}
          >
            Big Ding
          </span>
        </div>

        {/* 아바타 + (닉네임/학번 위, 게시글/팔로워/팔로잉 아래) */}
        <div className="flex items-start gap-6">
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-md overflow-hidden"
              style={{ background: "var(--accent)", border: "3px solid var(--primary)" }}
            >
              <img src={resolveAssetUrl(avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
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

          <div className="flex-1 flex flex-col gap-1.5 pt-1">
            {/* 닉네임 / 학번 (아바타 오른쪽 위) */}
            {editMode ? (
              <div className="flex items-center">
                <input
                  value={nicknameInput}
                  onChange={(e) => {
                    setNicknameInput(e.target.value);
                    setNicknameChecked(false);
                  }}
                  maxLength={10}
                  className="font-bold text-base border-b-2 outline-none bg-transparent"
                  style={{ color: "var(--foreground)", borderColor: "var(--primary)", width: "160px" }}
                />
                <button
                  onClick={checkNicknameDuplicate}
                  className="rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={{ background: "var(--primary)", color: "white", marginLeft: "10px", padding: "4px 8px" }}
                >
                  중복확인
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <h2 className="font-bold text-base" style={{ color: "var(--foreground)" }}>{nickname}</h2>
                {/* 로그인 시 입력한 학번의 3~4번째 자리(입학연도)를 이름 옆에 표시 */}
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  #{studentId ? studentId.slice(2, 4) : "23"}학번
                </span>
              </div>
            )}

            {/* 게시글/팔로워/팔로잉 (닉네임 아래, 닉네임과 왼쪽 맞춤) */}
            <div className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-0.2">
                <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{myPosts.length}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>게시글</span>
              </div>
              <div className="flex flex-col items-center gap-0.2">
                <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{followerCount}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>팔로워</span>
              </div>
              <div className="flex flex-col items-center gap-0.2">
                <span className="font-bold text-base" style={{ color: "var(--foreground)" }}>{followingCount}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>팔로잉</span>
              </div>
            </div>
          </div>
        </div>

        {/* 프로필 편집 버튼 (인스타의 "프로필 편집" 버튼처럼 가로 전체) */}
        <button
          onClick={async () => {
            if (editMode) {
              const error = validateNickname(nicknameInput);
              if (error) {
                showAlert(error);
                return;
              }
              if (nicknameInput.trim() !== nickname.trim() && !nicknameChecked) {
                showAlert("닉네임 중복확인을 먼저 해주세요.");
                return;
              }
              try {
                const res = await api.patch("/users/profile", { nickname: nicknameInput.trim() });
                setNickname(res.data.nickname);
                updateStoredUser({ nickname: res.data.nickname });
                setEditMode(false);
              } catch (err: any) {
                showAlert(err?.response?.data?.message || "닉네임 변경에 실패했습니다.");
              }
              return;
            }
            setNicknameInput(nickname);
            setNicknameChecked(false);
            setEditMode(true);
          }}
          className="w-full mt-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
          style={{ background: "var(--muted)", color: "var(--foreground)" }}
        >
          {editMode ? (
            "완료"
          ) : (
            <>
              <Edit3 size={14} />
              프로필 편집
            </>
          )}
        </button>
      </div>

      {/* Tabs (인스타 그리드 탭처럼 아이콘 + 밑줄) */}
      <div className="grid grid-cols-3 shrink-0 border-t border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setActiveTab("posts")}
          className="flex items-center justify-center py-3"
          style={{
            borderBottom: activeTab === "posts" ? "2px solid var(--foreground)" : "2px solid transparent",
            color: activeTab === "posts" ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          <FileText size={18} />
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          className="flex items-center justify-center py-3"
          style={{
            borderBottom: activeTab === "comments" ? "2px solid var(--foreground)" : "2px solid transparent",
            color: activeTab === "comments" ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          <MessageCircle size={18} />
        </button>
        <button
          onClick={() => setActiveTab("scrapped")}
          className="flex items-center justify-center py-3"
          style={{
            borderBottom: activeTab === "scrapped" ? "2px solid var(--foreground)" : "2px solid transparent",
            color: activeTab === "scrapped" ? "var(--foreground)" : "var(--muted-foreground)",
          }}
        >
          <Bookmark size={18} />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-3 pb-6 flex flex-col gap-3">
        {activeTab === "posts" && (
          postsLoading && myPosts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              불러오는 중...
            </p>
          ) : myPosts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              아직 작성한 글이 없어요.
            </p>
          ) : myPosts.map((post) => {
            const visibility = postVisibility[post._id] ?? "all";
            const VisibilityIcon = VISIBILITY_META[visibility].Icon;
            return (
              <div key={post._id} className="p-3.5 rounded-2xl shadow-sm cursor-pointer" style={{ background: "var(--card)" }} onClick={() => setSelectedPostId(post._id)}>
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
                      {getDisplayTime(post)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setShowVisibilityModal(post._id); }}>
                      <VisibilityIcon size={16} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePost(post._id);
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
                      handleLike(post);
                    }}
                  >
                    <Heart
                      size={13}
                      fill={isLiked(post) ? "var(--primary)" : "none"}
                      color={isLiked(post) ? "var(--primary)" : "var(--muted-foreground)"}
                    />
                    <span className="text-xs" style={{ color: isLiked(post) ? "var(--primary)" : "var(--muted-foreground)" }}>
                      {post.likes.length}
                    </span>
                  </button>
                  <button
                    className="flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDislike(post);
                    }}
                  >
                    <ThumbsDown
                      size={13}
                      fill={isDisliked(post) ? "#d4183d" : "none"}
                      color={isDisliked(post) ? "#d4183d" : "var(--muted-foreground)"}
                    />
                    <span className="text-xs" style={{ color: isDisliked(post) ? "#d4183d" : "var(--muted-foreground)" }}>
                      {post.dislikes.length}
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
              key={comment.commentId}
              className="p-3.5 rounded-2xl shadow-sm cursor-pointer"
              style={{ background: "var(--card)" }}
              onClick={() => setSelectedPostId(comment.postId)}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                  {comment.postTitle}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComment(comment.postId, comment.commentId);
                  }}
                >
                  <X size={14} style={{ color: "#d4183d" }} />
                </button>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground)" }}>{comment.text}</p>
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
              key={post._id}
              className="p-3.5 rounded-2xl shadow-sm cursor-pointer"
              style={{ background: "var(--card)" }}
              onClick={() => setSelectedPostId(post._id)}
            >
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--secondary)", color: "var(--primary)" }}
              >
                {getBoardLabel(post.board)}
              </span>
              <p className="font-semibold text-sm mt-1.5" style={{ color: "var(--foreground)" }}>{post.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {getDisplayTime(post)}
              </p>
            </div>
          ))
        )}

        {/* 상세 화면 */}
        {selectedPost && (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--background)" }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setSelectedPostId(null)} className="text-lg">←</button>
              <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
              <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden"
                    style={{ background: "var(--muted)" }}
                  >
                    <img src={resolveAssetUrl(selectedPost.author.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {selectedPost.author.nickname}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {getDisplayTime(selectedPost)}
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
                    src={resolveAssetUrl(selectedPost.images[0])}
                    alt="첨부 이미지"
                    className="mt-2 w-full max-h-72 object-cover rounded-xl cursor-pointer"
                    onClick={() => setFullscreenImage(resolveAssetUrl(selectedPost.images[0]) || null)}
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
                    onClick={() => setSavedPosts((s) => ({ ...s, [selectedPost._id]: !s[selectedPost._id] }))}>
                    <Bookmark size={16} fill={savedPosts[selectedPost._id] ? "var(--primary)" : "none"}
                      color={savedPosts[selectedPost._id] ? "var(--primary)" : "var(--muted-foreground)"} />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: "var(--card)" }}>
  <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
    댓글 {getCommentCount(selectedPost)}개
  </p>

                {selectedPost.comments.map((c) => (
                  <div key={c._id} className="flex gap-2 items-start relative">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm overflow-hidden"
                      style={{ background: "var(--muted)" }}>
                      <img src={resolveAssetUrl(c.author.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 px-3 py-2 rounded-xl text-xs flex items-start justify-between gap-2"
                      style={{ color: "var(--foreground)" }}>
                      <span><span className="font-semibold">{c.author.nickname} </span>{c.content}</span>
                      {currentUser && c.author._id === currentUser._id && (
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
                              <button
                                onClick={() => handleDeleteComment(selectedPost._id, c._id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:opacity-70"
                                style={{ color: "#d4183d" }}
                              >
                                <Trash2 size={13} /> 삭제
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
            <div className="flex items-center justify-between mb-2 ">
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

      {/* 이미지 전체화면 뷰어 (카톡처럼 클릭 시 확대) */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <X size={20} color="white" />
          </button>
          <img
            src={fullscreenImage}
            alt="확대 이미지"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}