import { useEffect, useState, useMemo, useRef } from "react";
import {
  Camera, ChevronRight, Heart, FileText, Edit3, MessageCircle, Bookmark,
  Lock, Users, Globe, X, ThumbsDown, Star, MoreVertical, Trash2, ArrowLeft,
} from "lucide-react";
import api, { resolveAssetUrl } from "@/api";
import defaultAvatar from "@/assets/default-avatar.svg";
import {
  BOARDS, loadStoredInteractions, filterProfanity,
  STORAGE_KEY, INTERACTIONS_UPDATED_EVENT,
  AVATAR_UPDATED_EVENT, scopedKey,
  getCurrentUser, getDisplayTime, updateStoredUser,
  OtherUserProfile,
  type Post, type StoredInteractions, type Friend, type PostAuthor,
} from "./CommunityScreen";
import "@/styles/tokens.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, type BoardTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";

const VISIBILITY_STORAGE_KEY = "bigding_post_visibility_v1";

type Visibility = "all" | "followers" | "private";

const VISIBILITY_META: Record<Visibility, { label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  all: { label: "전체 공개", Icon: Globe },
  followers: { label: "팔로워 공개", Icon: Users },
  private: { label: "나만 보기", Icon: Lock },
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
  // 커뮤니티(게시물/댓글 작성자 아바타)에서 "내 프로필"을 눌러 들어온 경우에만 전달된다.
  // 존재하면 헤더에 뒤로가기 버튼을 보여주고, 눌렀을 때 커뮤니티로 돌아간다.
  onBack?: () => void;
}

// 게시판 라벨 배지 (BOARD_ACCENTS와 동일한 톤을 Badge 컴포넌트로)
function BoardBadge({ board }: { board?: string }) {
  return <Badge tone={board as BoardTone}>{BOARDS.find((b) => b.id === board)?.label ?? board ?? ""}</Badge>;
}

export function ProfileScreen({ nickname, setNickname, onBack }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "comments" | "scrapped">("posts");
  const [currentUser] = useState(getCurrentUser);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
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

// + 팔로워/팔로잉 목록 모달 + 목록에서 클릭한 사용자 프로필 보기
const [userListModal, setUserListModal] = useState<"followers" | "following" | null>(null);
const [userList, setUserList] = useState<Friend[]>([]);
const [userListQuery, setUserListQuery] = useState("");
const [viewingUser, setViewingUser] = useState<PostAuthor | null>(null);

const openUserList = async (kind: "followers" | "following") => {
  setUserListModal(kind);
  setUserListQuery("");
  if (!currentUser) return;
  try {
    const res = await api.get(`/users/${currentUser._id}/${kind}`);
    setUserList(res.data);
  } catch {
    setUserList([]);
  }
};

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

// 팔로워 목록에서 특정 사람을 내 팔로워에서 삭제 (인스타의 "팔로워 삭제")
const removeFollower = (target: Friend) => {
  showConfirm(`${target.nickname}님을 팔로워에서 삭제하시겠습니까?`, async () => {
    setUserList((prev) => prev.filter((u) => u._id !== target._id));
    setFollowerCount((c) => Math.max(0, c - 1));
    try {
      await api.delete(`/users/followers/${target._id}`);
    } catch {
      showAlert("삭제에 실패했습니다.");
    }
  });
};

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

// 공개범위는 이제 서버(Post.visibility)가 기준이다. posts 배열에서 각 게시물의
// 실제 visibility 값을 바로 읽어와 보여주고, 변경 시 서버에 저장한다.

  // 게시물 목록은 실제 DB(GET /api/posts)에서 불러온다. 좋아요/댓글/투표처럼 다른 사람이
  // 바꾼 내용도 새로고침 없이 보이도록, 이 화면에 머무르는 동안 몇 초마다 다시 불러온다(폴링).
  const [posts, setPostsRaw] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  // 좋아요/댓글/삭제 등으로 posts를 직접 바꾼 시각을 기록해, 그 이전에 이미 날아가 있던
  // 폴링 응답이 뒤늦게 도착해 방금 반영한 변경을 덮어쓰지 않게 한다.
  const lastLocalMutationRef = useRef(0);
  const setPosts = (updater: React.SetStateAction<Post[]>) => {
    lastLocalMutationRef.current = Date.now();
    setPostsRaw(updater);
  };
  useEffect(() => {
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

  const AlertModal = (
    <Modal open={!!alertMessage} title="알림" onClose={closeAlert}>
      {alertMessage}
    </Modal>
  );

  const ConfirmModal = (
    <Modal
      open={!!confirmState}
      title="확인"
      onClose={closeConfirm}
      cancelText="취소"
      onCancel={closeConfirm}
      onConfirm={() => {
        if (!confirmState) return;
        const action = confirmState.onConfirm;
        setConfirmState(null);
        action();
      }}
    >
      {confirmState?.message}
    </Modal>
  );

  const TABS: { id: "posts" | "comments" | "scrapped"; icon: typeof FileText }[] = [
    { id: "posts", icon: FileText },
    { id: "comments", icon: MessageCircle },
    { id: "scrapped", icon: Bookmark },
  ];

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Profile header (Instagram 스타일) */}
      <div className="relative shrink-0 px-4 pb-3 pt-3">
        <div className="mb-4 flex items-center gap-1.5">
          {onBack && (
            <IconButton aria-label="뒤로 가기" onClick={onBack} className="mr-1">
              <ArrowLeft size={16} />
            </IconButton>
          )}
          <span className="notranslate text-2xl leading-none" translate="no" style={{ color: "var(--text-strong)", fontFamily: "var(--font-logo)" }}>
            Big Ding
          </span>
        </div>

        {/* 아바타 + (닉네임/학번 위, 게시글/팔로워/팔로잉 아래) */}
        <div className="flex items-start gap-6">
          <div className="relative shrink-0">
            <Avatar src={resolveAssetUrl(avatar)} fallbackSrc={defaultAvatar} size="xl" />
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {editMode && (
              <button
                onClick={() => document.getElementById("avatar-upload")?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full shadow"
                style={{ background: "var(--blue-deep)" }}
                aria-label="프로필 사진 변경"
              >
                <Camera size={13} color="white" />
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1.5 pt-1">
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
                  className="w-[160px] border-b-2 bg-transparent text-base font-bold outline-none"
                  style={{ color: "var(--text-strong)", borderColor: "var(--blue-primary)" }}
                />
                <Button size={44} className="ml-2.5 h-8 px-3" onClick={checkNicknameDuplicate}>
                  중복확인
                </Button>
              </div>
            ) : (
              <div className="flex flex-col">
                <h2 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>{nickname}</h2>
                {/* 로그인 시 입력한 학번의 3~4번째 자리(입학연도)를 닉네임 아래에 표시 */}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  #{studentId ? studentId.slice(2, 4) : "23"}학번
                </span>
              </div>
            )}

            {/* 게시글/팔로워/팔로잉 (닉네임 아래, 닉네임과 왼쪽 맞춤) */}
            <div className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base font-bold" style={{ color: "var(--text-strong)" }}>{myPosts.length}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>게시글</span>
              </div>
              <button onClick={() => openUserList("followers")} className="flex flex-col items-center gap-0.5">
                <span className="text-base font-bold" style={{ color: "var(--text-strong)" }}>{followerCount}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>팔로워</span>
              </button>
              <button onClick={() => openUserList("following")} className="flex flex-col items-center gap-0.5">
                <span className="text-base font-bold" style={{ color: "var(--text-strong)" }}>{followingCount}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>팔로잉</span>
              </button>
            </div>
          </div>
        </div>

        {/* 프로필 편집 버튼 (인스타의 "프로필 편집" 버튼처럼 가로 전체) */}
        <Button
          variant="secondary"
          fullWidth
          className="mt-3"
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
        >
          {editMode ? (
            "완료"
          ) : (
            <>
              <Edit3 size={14} />
              프로필 편집
            </>
          )}
        </Button>
      </div>

      {/* Tabs (인스타 그리드 탭처럼 아이콘 + 밑줄) */}
      <div className="grid shrink-0 grid-cols-3 border-b border-t" style={{ borderColor: "var(--border-subtle)" }}>
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center justify-center py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue-primary)]"
            style={{
              borderBottom: activeTab === id ? "2px solid var(--blue-deep)" : "2px solid transparent",
              color: activeTab === id ? "var(--blue-deep)" : "var(--text-muted)",
            }}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 pt-3">
        {activeTab === "posts" && (
          postsLoading && myPosts.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              불러오는 중...
            </p>
          ) : myPosts.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              아직 작성한 글이 없어요.
            </p>
          ) : myPosts.map((post) => {
            const visibility = ((post as any).visibility as Visibility) ?? "all";
            const VisibilityIcon = VISIBILITY_META[visibility].Icon;
            return (
              <Card key={post._id} className="cursor-pointer" onClick={() => setSelectedPostId(post._id)}>
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <BoardBadge board={post.board} />
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{post.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {getDisplayTime(post)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setShowVisibilityModal(post._id); }} aria-label="공개 범위 설정">
                      <VisibilityIcon size={16} style={{ color: "var(--text-muted)" }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePost(post._id);
                      }}
                      aria-label="게시물 삭제"
                    >
                      <Trash2 size={16} style={{ color: "var(--danger)" }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t pt-2" style={{ borderColor: "var(--border-subtle)" }}>
                  <button
                    className="flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(post);
                    }}
                  >
                    <Heart
                      size={13}
                      fill={isLiked(post) ? "var(--blue-deep)" : "none"}
                      color={isLiked(post) ? "var(--blue-deep)" : "var(--text-muted)"}
                    />
                    <span className="text-xs" style={{ color: isLiked(post) ? "var(--blue-deep)" : "var(--text-muted)" }}>
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
                      fill={isDisliked(post) ? "var(--danger)" : "none"}
                      color={isDisliked(post) ? "var(--danger)" : "var(--text-muted)"}
                    />
                    <span className="text-xs" style={{ color: isDisliked(post) ? "var(--danger)" : "var(--text-muted)" }}>
                      {post.dislikes.length}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <MessageCircle size={13} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{getCommentCount(post)}</span>
                  </div>
                </div>
              </Card>
            );
          })
        )}

        {activeTab === "comments" && (
          myWrittenComments.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              작성한 댓글이 없어요.
            </p>
          ) : myWrittenComments.map((comment) => (
            <Card
              key={comment.commentId}
              className="cursor-pointer"
              onClick={() => setSelectedPostId(comment.postId)}
            >
              <div className="mb-1 flex items-start justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--blue-deep)" }}>
                  {comment.postTitle}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComment(comment.postId, comment.commentId);
                  }}
                  aria-label="댓글 삭제"
                >
                  <X size={14} style={{ color: "var(--danger)" }} />
                </button>
              </div>
              <p className="text-sm" style={{ color: "var(--text-body)" }}>{comment.text}</p>
            </Card>
          ))
        )}

        {activeTab === "scrapped" && (
          scrappedPosts.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              스크랩한 게시물이 없어요.
            </p>
          ) : scrappedPosts.map((post) => (
            <Card key={post._id} className="cursor-pointer" onClick={() => setSelectedPostId(post._id)}>
              <BoardBadge board={post.board} />
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{post.title}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {getDisplayTime(post)}
              </p>
            </Card>
          ))
        )}

        {/* 상세 화면 */}
        {selectedPost && (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <div className="flex shrink-0 items-center gap-3 px-4 py-4">
              <IconButton aria-label="뒤로 가기" onClick={() => setSelectedPostId(null)}>
                <ArrowLeft size={16} />
              </IconButton>
              <h2 className="flex-1 text-base font-semibold" style={{ color: "var(--text-strong)" }}>게시물</h2>
              {currentUser && selectedPost.author._id === currentUser._id && (
            <div className="relative">
              <button
                onClick={() => setShowPostMenu(showPostMenu ? null : selectedPost._id)}
                style={{ color: "var(--text-body)" }}
                aria-label="게시물 메뉴"
              >
                <MoreVertical size={20} />
              </button>
              {showPostMenu === selectedPost._id && (
                <div
                  className="absolute right-0 top-7 z-50 overflow-hidden rounded-[var(--r-md)]"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", minWidth: "120px", boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                >
                  <button
                    onClick={() => {
                      setShowPostMenu(null);
                      setEditTitle(selectedPost.title);
                      setEditContent(selectedPost.content);
                      setEditingPost(selectedPost);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm"
                    style={{ color: "var(--text-body)" }}
                  >
                    <Edit3 size={14} /> 수정
                  </button>
                  <button
                    onClick={() => {
                      setShowPostMenu(null);
                      handleDeletePost(selectedPost._id);
                    }}
                    className="flex w-full items-center gap-2 border-t px-4 py-3 text-left text-sm"
                    style={{ color: "var(--danger)", borderColor: "var(--border-subtle)" }}
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              )}
            </div>
          )}
            </div>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <Card>
                <div className="mb-3 flex items-center gap-2">
                  <Avatar src={resolveAssetUrl(selectedPost.author.avatar)} fallbackSrc={defaultAvatar} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                      {selectedPost.author.nickname}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {getDisplayTime(selectedPost)}
                    </p>
                  </div>
                  {selectedPost.price && (
                    <Badge tone="info">{selectedPost.price}원</Badge>
                  )}
                </div>

                <h3 className="mb-1 font-semibold" style={{ color: "var(--text-strong)" }}>{selectedPost.title}</h3>

                {selectedPost.rating && (
                  <div className="mb-1.5 mt-2 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14}
                        fill={i < Math.floor(selectedPost!.rating!) ? "var(--tag-lecture-fg)" : "none"}
                        color={i < Math.floor(selectedPost!.rating!) ? "var(--tag-lecture-fg)" : "var(--text-muted)"} />
                    ))}
                    <span className="ml-1 text-xs font-semibold" style={{ color: "var(--text-strong)" }}>
                      {selectedPost.rating.toFixed(1)}
                    </span>
                  </div>
                )}

                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {selectedPost.content}
                </p>

                {selectedPost.images[0] && (
                  <img
                    src={resolveAssetUrl(selectedPost.images[0])}
                    alt="첨부 이미지"
                    className="mt-2 max-h-72 w-full cursor-pointer rounded-[var(--r-md)] object-cover"
                    onClick={() => setFullscreenImage(resolveAssetUrl(selectedPost.images[0]) || null)}
                  />
                )}

                {selectedPost.tags && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedPost.tags.map((tag, i) => (
                      <Badge key={i} tone="info">#{tag}</Badge>
                    ))}
                  </div>
                )}

                {selectedPost.maxParticipants && (
                  <div className="mt-2">
                    <Badge tone={selectedPost.currentParticipants === selectedPost.maxParticipants ? "success" : "info"}>
                      {selectedPost.currentParticipants}/{selectedPost.maxParticipants}명
                      {selectedPost.currentParticipants === selectedPost.maxParticipants ? " 모집완료" : " 모집중"}
                    </Badge>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3 border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                  <button className="flex items-center gap-1.5" onClick={() => handleLike(selectedPost)}>
                    <Heart size={16} fill={isLiked(selectedPost) ? "var(--blue-primary)" : "none"}
                      color={isLiked(selectedPost) ? "var(--blue-primary)" : "var(--text-muted)"} />
                    <span className="text-xs" style={{ color: isLiked(selectedPost) ? "var(--blue-deep)" : "var(--text-muted)" }}>
                      {selectedPost.likes.length}
                    </span>
                  </button>

                  <button className="flex items-center gap-1.5" onClick={() => handleDislike(selectedPost)}>
                    <ThumbsDown size={16} fill={isDisliked(selectedPost) ? "var(--danger)" : "none"}
                      color={isDisliked(selectedPost) ? "var(--danger)" : "var(--text-muted)"} />
                    <span className="text-xs" style={{ color: isDisliked(selectedPost) ? "var(--danger)" : "var(--text-muted)" }}>
                      {selectedPost.dislikes.length}
                    </span>
                  </button>

                  <button className="flex items-center gap-1.5"
                    onClick={() => {
                      commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      commentInputRef.current?.focus();
                    }}>
                    <MessageCircle size={16} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{getCommentCount(selectedPost)}</span>
                  </button>

                  <button className="flex items-center gap-1.5"
                    onClick={() => setSavedPosts((s) => ({ ...s, [selectedPost._id]: !s[selectedPost._id] }))}>
                    <Bookmark size={16} fill={savedPosts[selectedPost._id] ? "var(--blue-primary)" : "none"}
                      color={savedPosts[selectedPost._id] ? "var(--blue-primary)" : "var(--text-muted)"} />
                  </button>
                </div>
              </Card>

              <Card className="flex flex-col gap-3">
  <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
    댓글 {getCommentCount(selectedPost)}개
  </p>

                {selectedPost.comments.map((c) => (
                  <div key={c._id} className="relative flex items-start gap-2">
                    <Avatar src={resolveAssetUrl(c.author.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div className="flex flex-1 items-start justify-between gap-2 rounded-[var(--r-md)] px-3 py-2 text-xs"
                      style={{ color: "var(--text-body)" }}>
                      <span><span className="font-semibold">{c.author.nickname} </span>{c.content}</span>
                      {currentUser && c.author._id === currentUser._id && (
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setOpenCommentMenu(openCommentMenu === c._id ? null : c._id)}
                            style={{ color: "var(--text-muted)" }}
                            aria-label="댓글 더보기"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openCommentMenu === c._id && (
                            <div
                              className="absolute right-0 top-6 z-20 min-w-[90px] rounded-[var(--r-md)] py-1"
                              style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                            >
                              <button
                                onClick={() => handleDeleteComment(selectedPost._id, c._id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:opacity-70"
                                style={{ color: "var(--danger)" }}
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
              </Card>
            </div>
          </div>
        )}
      </div>
      {/* 팔로워/팔로잉 목록 */}
      {userListModal && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
          <div className="flex shrink-0 items-center gap-3 px-4 py-4">
            <IconButton aria-label="닫기" onClick={() => setUserListModal(null)}>
              <X size={16} />
            </IconButton>
            <h2 className="flex-1 font-semibold" style={{ color: "var(--text-strong)" }}>
              {userListModal === "followers" ? "팔로워" : "팔로잉"}
            </h2>
          </div>
          {userList.length > 0 && (
            <div className="shrink-0 px-4 pt-3">
              <Input label="검색" hideLabel value={userListQuery} onChange={(e) => setUserListQuery(e.target.value)} placeholder="검색" />
            </div>
          )}
          <div className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
            {userList.length === 0 ? (
              <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                {userListModal === "followers" ? "아직 팔로워가 없습니다." : "아직 팔로잉하는 사람이 없습니다."}
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
                  className="flex items-center gap-3 rounded-[var(--r-lg)] p-2.5 text-left"
                  style={{ background: "var(--bg-card)" }}
                >
                  <button
                    onClick={() => {
                      setUserListModal(null);
                      setViewingUser(u);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar src={resolveAssetUrl(u.avatar)} fallbackSrc={defaultAvatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-strong)" }}>{u.nickname}</p>
                      {u.studentId && (
                        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{u.studentId}</p>
                      )}
                    </div>
                  </button>
                  <Button
                    variant={u.isFollowedByMe ? "secondary" : "primary"}
                    size={44}
                    className="h-8 shrink-0 px-3"
                    onClick={() => toggleListFollow(u)}
                  >
                    {u.isFollowedByMe ? "팔로잉" : "팔로우"}
                  </Button>
                  {userListModal === "followers" && (
                    <button
                      onClick={() => removeFollower(u)}
                      className="shrink-0"
                      style={{ color: "var(--text-muted)" }}
                      aria-label="팔로워 삭제"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 목록에서 클릭한 사용자의 프로필 */}
      {viewingUser && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--bg-base)" }}>
          <OtherUserProfile
            author={viewingUser}
            posts={posts}
            currentUserId={currentUser?._id}
            onBack={() => setViewingUser(null)}
            onOpenPost={(postId) => {
              setViewingUser(null);
              setSelectedPostId(postId);
            }}
          />
        </div>
      )}
      {editingPost && (
        <div className="absolute inset-0 z-[60] flex flex-col" style={{ background: "var(--bg-base)" }}>
          <div className="flex shrink-0 items-center gap-3 px-4 py-4">
            <IconButton aria-label="뒤로 가기" onClick={() => setEditingPost(null)}>
              <ArrowLeft size={16} />
            </IconButton>
            <h2 className="flex-1 text-base font-semibold" style={{ color: "var(--text-strong)" }}>게시물 수정</h2>
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
              style={{ color: "var(--blue-deep)" }}
              className="text-sm font-semibold"
            >
              완료
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <Input label="제목" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium" style={{ color: "var(--text-body)" }}>내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-body)] outline-none focus:border-[var(--blue-primary)] focus:bg-[var(--blue-soft)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
              />
            </div>
          </div>
        </div>
      )}
      {/* Visibility modal */}
      {showVisibilityModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(15,23,42,0.45)" }}>
          <div
            className="flex w-full flex-col gap-3 rounded-[var(--r-lg)] px-4 py-6"
            style={{ background: "var(--bg-card)", boxShadow: "0 12px 32px rgba(15,23,42,0.16)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: "var(--text-strong)" }}>공개 범위 설정</h3>
              <IconButton aria-label="닫기" onClick={() => setShowVisibilityModal(null)} className="h-9 w-9">
                <X size={16} />
              </IconButton>
            </div>
            {(Object.keys(VISIBILITY_META) as Visibility[]).map((id) => {
              const { label, Icon } = VISIBILITY_META[id];
              return (
                <button
                  key={id}
                  onClick={async () => {
                    const postId = showVisibilityModal;
                    setShowVisibilityModal(null);
                    if (postId == null) return;
                    try {
                      const res = await api.patch(`/posts/${postId}`, { visibility: id });
                      setPosts((prev) => prev.map((p) => (p._id === postId ? res.data : p)));
                      showAlert(`공개 범위가 '${label}'로 변경되었습니다.`);
                    } catch {
                      showAlert("공개 범위 변경에 실패했습니다.");
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-[var(--r-md)] px-4 py-3 text-left text-sm"
                  style={{ background: "var(--bg-base)", color: "var(--text-body)" }}
                >
                  <span style={{ color: "var(--blue-primary)" }}><Icon size={18} /></span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {AlertModal}
      {ConfirmModal}

      {/* 이미지 전체화면 뷰어 (카톡처럼 클릭 시 확대) */}
      {fullscreenImage && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="닫기"
          >
            <X size={20} color="white" />
          </button>
          <img
            src={fullscreenImage}
            alt="확대 이미지"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
