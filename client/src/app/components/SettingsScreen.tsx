import { useEffect, useState } from "react";
import {
  Bell, Moon, User, Lock, ArrowLeft, LogOut, AlertTriangle, FileText, MessageSquare,
  BookOpen, UserX, Eye, EyeOff, Heart, ThumbsDown, MessageCircle, Bookmark, Ban,
  ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";
import api, { resolveAssetUrl } from "@/api";
import defaultAvatar from "@/assets/default-avatar.svg";
import {
  REPORTS_STORAGE_KEY, REPORTS_UPDATED_EVENT, loadReportHistory, removeReportFromHistory, type ReportHistoryItem,
  BLOCKED_STORAGE_KEY, BLOCKED_UPDATED_EVENT, loadBlockedUsers, removeBlockedUser, type BlockedUserItem,
  getDisplayTime, type Post, scopedKey, updateStoredUser, getCurrentUser, BOARDS,
  OtherUserProfile, type PostAuthor,
} from "./CommunityScreen";
import "@/styles/tokens.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, type BoardTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Switch } from "@/components/ui/Switch";
import { List, ListItem } from "@/components/ui/List";
import { Modal } from "@/components/ui/Modal";

const PROFESSORS = ["유진호", "차대현", "홍진근"];

interface AdminUserItem {
  _id: string;
  nickname: string;
  studentId?: string;
  avatar?: string;
}

interface AdminReportItem {
  _id: string;
  reporter: { _id: string; nickname: string; studentId?: string };
  targetType: "post" | "comment" | "user";
  targetId: string;
  reason: string;
  status: "pending" | "resolved";
  createdAt: string;
}

interface ReportTargetUser {
  _id: string;
  nickname: string;
  studentId?: string;
  avatar?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

interface AdminInquiryItem {
  _id: string;
  user: { _id: string; nickname: string; studentId?: string } | null;
  title: string;
  content: string;
  status: "pending" | "resolved";
  createdAt: string;
}

interface AdminMemberItem {
  _id: string;
  nickname: string;
  studentId?: string;
  avatar?: string;
  isAdmin?: boolean;
  canPostEvents?: boolean;
  banned?: boolean;
  banType?: "permanent" | "temporary";
  banUntil?: string;
  commentRestrictedUntil?: string;
  isWithdrawn?: boolean;
  createdAt?: string;
  warningCount?: number;
  banCount?: number;
}

interface AdminLogItem {
  _id: string;
  actor: { _id: string; nickname: string; studentId?: string } | null;
  actorIsAdmin: boolean;
  actionType: "deletePost" | "deleteComment";
  board?: string;
  targetAuthor: { _id: string; nickname: string; studentId?: string } | null;
  snapshot: { title?: string; content?: string };
  postId?: string;
  createdAt: string;
}

interface SanctionItem {
  _id: string;
  user: { _id: string; nickname: string; studentId?: string; avatar?: string } | null;
  type: "warning" | "ban" | "commentRestriction" | "forceWithdraw";
  reason: string;
  admin: { _id: string; nickname: string } | null;
  post?: string;
  banType?: "permanent" | "temporary";
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}


interface SettingsScreenProps {
  darkMode: boolean;
  onToggleDark: () => void;
  onLogout: () => void;
  nickname: string;
  setNickname: (name: string) => void;
}

// 건의사항 내역은 기기별 localStorage가 아니라 서버(GET /inquiries/mine)를 그대로 보여준다.
// 그래야 유저가 보는 내 건의사항 내역과 관리자가 보는 건의사항 목록이 항상 같은 데이터를 가리킨다.
interface MyInquiryItem {
  _id: string;
  title: string;
  content: string;
  status: "pending" | "resolved";
  createdAt: string;
}

// 페이지 헤더 공통 패턴: 뒤로가기 아이콘박스 + 제목
function ScreenHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <IconButton aria-label="뒤로 가기" onClick={onBack}>
        <ArrowLeft size={18} />
      </IconButton>
      <h2 className="flex-1 text-base font-semibold" style={{ color: "var(--text-strong)" }}>{title}</h2>
      {action}
    </div>
  );
}

// 게시판 라벨 배지 (BOARD_ACCENTS와 동일한 톤을 Badge 컴포넌트로)
function BoardBadge({ board }: { board: string }) {
  return <Badge tone={board as BoardTone}>{BOARDS.find((b) => b.id === board)?.label ?? board}</Badge>;
}

export function SettingsScreen({ darkMode, onToggleDark, onLogout, nickname, setNickname }: SettingsScreenProps) {
  const [notifications, setNotifications] = useState({
    chat: true,
    community: true,
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // + 전화번호 등록/변경용 상태 (비밀번호 찾기 본인 확인에 사용됨)
  const [phoneCurrentPassword, setPhoneCurrentPassword] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  // + 닉네임 변경용 상태
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(nickname);
  const [nicknameChecked, setNicknameChecked] = useState(false);
  // + 담당 교수 변경용 상태
  const [professor, setProfessor] = useState(() => getCurrentUser()?.professor ?? "");
  const [editingProfessor, setEditingProfessor] = useState(false);
  const [professorInput, setProfessorInput] = useState(professor);
  // + 비공개 계정 여부 (비공개면 친구가 아닌 사람에게 글/북마크/팔로워·팔로잉 목록이 자물쇠로 가려짐)
  const [isPrivate, setIsPrivate] = useState(() => getCurrentUser()?.isPrivate ?? false);
  const isAdmin = !!getCurrentUser()?.isAdmin;
  // + 관리자 화면(신고 관리 / 관리자 관리)
  const [adminReports, setAdminReports] = useState<AdminReportItem[]>([]);
  // + 신고 관리 / 건의사항 내역을 게시물/댓글 모니터링처럼 한 화면에서 탭으로 묶어 보여준다.
  const [adminReportTab, setAdminReportTab] = useState<"reports" | "inquiries">("reports");
  // + 커뮤니티 화면의 최신순/인기순 드롭다운과 같은 방식으로 미처리/처리완료 상태 필터링
  const [adminStatusFilter, setAdminStatusFilter] = useState<"all" | "pending" | "resolved">("all");
  const [showAdminStatusDropdown, setShowAdminStatusDropdown] = useState(false);
  // + 신고/건의 목록 더보기 개수
  const [visibleReportsCount, setVisibleReportsCount] = useState(5);
  const [visibleInquiriesCount, setVisibleInquiriesCount] = useState(5);
  // + 신고 대상(게시물/댓글) 조회 시, viewingPost 안에서 어떤 댓글이 신고 대상인지 강조하기 위한 id
  const [viewingCommentId, setViewingCommentId] = useState<string | null>(null);
  // + 신고 대상이 사용자(user)일 때 보여줄 모달
  const [viewingUser, setViewingUser] = useState<ReportTargetUser | null>(null);
  // + 지금 조회 중인 대상이 어느 신고 건에서 왔는지 (제재를 내렸을 때 그 신고자에게 결과를 알려주기 위함)
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  // + 신고/건의를 "처리완료로 표시"할 때, 신고자/건의자에게 그대로 전달할 결과 메시지를 입력받는 모달
  const [resolveNoteTarget, setResolveNoteTarget] = useState<
    { kind: "report"; report: AdminReportItem } | { kind: "inquiry"; inquiry: AdminInquiryItem } | null
  >(null);
  const [resolveNoteText, setResolveNoteText] = useState("");
  // + 신고된 사용자의 프로필로 바로 들어가기
  const [showingUserProfile, setShowingUserProfile] = useState(false);
  const [userProfilePosts, setUserProfilePosts] = useState<Post[]>([]);
  // + 신고된 사용자에게 이 화면에서 바로 제재(경고/차단/댓글제한)를 부여하기
  const [sanctionAction, setSanctionAction] = useState<{ type: "warn" | "ban" | "restrictComments" | "withdraw" } | null>(null);
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionBanType, setSanctionBanType] = useState<"temporary" | "permanent">("temporary");
  const [sanctionDays, setSanctionDays] = useState(7);
  const [sanctionSubmitting, setSanctionSubmitting] = useState(false);
  // + 회원 관리 화면(전체 회원 검색/목록, 상태 배지, 그 자리에서 제재·강제탈퇴·관리자 임명)
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberList, setMemberList] = useState<AdminMemberItem[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberHasMore, setMemberHasMore] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [viewingMember, setViewingMember] = useState<AdminMemberItem | null>(null);
  const [memberSanctions, setMemberSanctions] = useState<SanctionItem[]>([]);
  const [memberSanctionsLoading, setMemberSanctionsLoading] = useState(false);
  const [memberSanctionFilter, setMemberSanctionFilter] = useState<"warning" | "ban" | null>(null);
  // + 게시물/댓글 통합 모니터링 화면(게시판별 최근 글 + 삭제 로그)
  const [monitorTab, setMonitorTab] = useState<"posts" | "logs">("posts");
  const [monitorBoard, setMonitorBoard] = useState("");
  const [monitorSearchQuery, setMonitorSearchQuery] = useState("");
  const [monitorPosts, setMonitorPosts] = useState<Post[]>([]);
  const [monitorPage, setMonitorPage] = useState(1);
  const [monitorHasMore, setMonitorHasMore] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorLogType, setMonitorLogType] = useState<"all" | "deletePost" | "deleteComment">("all");
  const [monitorLogs, setMonitorLogs] = useState<AdminLogItem[]>([]);
  const [monitorLogPage, setMonitorLogPage] = useState(1);
  const [monitorLogHasMore, setMonitorLogHasMore] = useState(false);
    const [monitorLogLoading, setMonitorLogLoading] = useState(false);
  const [adminInquiries, setAdminInquiries] = useState<AdminInquiryItem[]>([]);
  const [adminList, setAdminList] = useState<AdminUserItem[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<AdminUserItem[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<MyInquiryItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"reports" | "inquiries">("reports");
  // + 건의사항 내용 박스 크기를 통일하기 위해 기본은 미리보기(줄 제한)로 자르고, "더보기"를 누른 항목만 전체를 펼친다.
  const [expandedInquiryIds, setExpandedInquiryIds] = useState<Set<string>>(new Set());
  const INQUIRY_PREVIEW_LENGTH = 60;
  const toggleInquiryExpand = (id: string) => {
    setExpandedInquiryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 내가 접수한 건의사항 목록을 서버에서 그대로 불러온다(로컬 저장 없이 서버가 기준값).
  const fetchMyInquiries = () => {
    api.get("/inquiries/mine").then((res) => setInquiryHistory(res.data)).catch(() => {});
  };

  useEffect(() => {
    setReportHistory(loadReportHistory());
    fetchMyInquiries();
    setBlockedUsers(loadBlockedUsers());

    const handleReportsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<ReportHistoryItem[]>).detail;
      setReportHistory(detail ?? loadReportHistory());
    };
    const handleBlockedUpdated = (e: Event) => {
      const detail = (e as CustomEvent<BlockedUserItem[]>).detail;
      setBlockedUsers(detail ?? loadBlockedUsers());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === scopedKey(REPORTS_STORAGE_KEY)) setReportHistory(loadReportHistory());
      if (e.key === scopedKey(BLOCKED_STORAGE_KEY)) setBlockedUsers(loadBlockedUsers());
    };

    window.addEventListener(REPORTS_UPDATED_EVENT, handleReportsUpdated);
    window.addEventListener(BLOCKED_UPDATED_EVENT, handleBlockedUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(REPORTS_UPDATED_EVENT, handleReportsUpdated);
      window.removeEventListener(BLOCKED_UPDATED_EVENT, handleBlockedUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // 신고/건의 내역 화면에 들어갈 때마다 최신 값을 다시 불러와,
  // 방금 등록하거나 다른 곳(관리자 화면 등)에서 처리된 내용이 항상 반영되도록 한다.
  useEffect(() => {
    if (activeSection === "reports") {
      setReportHistory(loadReportHistory());
      fetchMyInquiries();
    }
  }, [activeSection]);

  // 관리자 화면에 들어갈 때마다 최신 신고/관리자 목록을 서버에서 다시 불러온다.
  // 회원 관리 화면의 회원 목록을 (검색어 + 페이지 기준으로) 서버에서 불러온다.
  // append가 true면 "더 보기"로 이어붙이고, 아니면 새 검색/최초 진입이므로 목록을 새로 교체한다.
  const loadMembers = async (page: number, q: string, append = false) => {
    setMemberLoading(true);
    try {
      const res = await api.get("/admin/users", { params: { q, page, limit: 30 } });
      const { users, hasMore } = res.data as { users: AdminMemberItem[]; total: number; page: number; hasMore: boolean };
      setMemberList((prev) => (append ? [...prev, ...users] : users));
      setMemberPage(page);
      setMemberHasMore(hasMore);
    } catch {
      if (!append) setMemberList([]);
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "adminMembers") {
      setMemberSearchQuery("");
      loadMembers(1, "");
    }
  }, [activeSection]);

  // 회원 상세를 열 때마다 그 회원의 제재 내역(경고/차단/댓글제한/강제탈퇴)을 불러온다.
  useEffect(() => {
    setMemberSanctionFilter(null);
    if (!viewingMember) {
      setMemberSanctions([]);
      return;
    }
    setMemberSanctionsLoading(true);
    api
      .get("/admin/sanctions", { params: { user: viewingMember._id } })
      .then((res) => setMemberSanctions(res.data))
      .catch(() => setMemberSanctions([]))
      .finally(() => setMemberSanctionsLoading(false));
  }, [viewingMember?._id]);

  // 차단 탭이 펼쳐진 상태에서 다시 누르면(=현재 차단 중이면) 해제 여부를 물어보고,
  // 동의 시 제재를 해제하되 내역 자체는 지우지 않고 active만 false로 남긴다.
  const liftMemberBan = () => {
    const activeBan = memberSanctions.find((s) => s.type === "ban" && s.active);
    if (!activeBan) return;
    showConfirm("차단을 해제하시겠습니까?", async () => {
      try {
        await api.patch(`/admin/sanctions/${activeBan._id}/lift`);
        setMemberSanctions((prev) => prev.map((x) => (x._id === activeBan._id ? { ...x, active: false } : x)));
        setViewingMember((prev) => (prev ? { ...prev, banned: false } : prev));
      } catch {
        showAlert("해제에 실패했습니다.");
      }
    });
  };

  // 제재 내역에서 사유가 된 게시물을 눌렀을 때, 그 게시물을 바로 불러와 보여준다.
  const openSanctionPost = async (postId: string) => {
    try {
      const res = await api.get("/admin/posts", { params: { id: postId, limit: 1 } });
      const post = (res.data.posts as Post[])[0];
      if (!post) {
        showAlert("삭제되었거나 존재하지 않는 게시물입니다.");
        return;
      }
      setViewingPost(post);
    } catch {
      showAlert("게시물을 불러오지 못했습니다.");
    }
  };

  // 게시판 통합 모니터링: 게시판/검색어 기준으로 최근 게시물을 불러온다.
  const loadMonitorPosts = async (page: number, board: string, q: string, append = false) => {
    setMonitorLoading(true);
    try {
      const res = await api.get("/admin/posts", { params: { board: board || undefined, q, page, limit: 20 } });
      const { posts, hasMore } = res.data as { posts: Post[]; total: number; page: number; hasMore: boolean };
      setMonitorPosts((prev) => (append ? [...prev, ...posts] : posts));
      setMonitorPage(page);
      setMonitorHasMore(hasMore);
    } catch {
      if (!append) setMonitorPosts([]);
    } finally {
      setMonitorLoading(false);
    }
  };

  // 삭제 로그(게시물/댓글 삭제 이력)를 불러온다.
  const loadMonitorLogs = async (page: number, type: "all" | "deletePost" | "deleteComment", append = false) => {
    setMonitorLogLoading(true);
    try {
      const res = await api.get("/admin/logs", { params: { type: type === "all" ? undefined : type, page, limit: 20 } });
      const { logs, hasMore } = res.data as { logs: AdminLogItem[]; total: number; page: number; hasMore: boolean };
      setMonitorLogs((prev) => (append ? [...prev, ...logs] : logs));
      setMonitorLogPage(page);
      setMonitorLogHasMore(hasMore);
    } catch {
      if (!append) setMonitorLogs([]);
    } finally {
      setMonitorLogLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "adminMonitoring") {
      setMonitorTab("posts");
      setMonitorBoard("");
      setMonitorSearchQuery("");
      loadMonitorPosts(1, "", "");
    }
  }, [activeSection]);

  // 관리자가 모니터링 화면에서 게시물을 바로 삭제한다 (기존 DELETE /posts/:id 재사용).
  const deleteMonitorPost = (post: Post) => {
    showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
      try {
        await api.delete(`/posts/${post._id}`);
        setMonitorPosts((prev) => prev.filter((p) => p._id !== post._id));
        if (viewingPost?._id === post._id) setViewingPost(null);
        showAlert("게시물이 삭제되었습니다.");
      } catch {
        showAlert("게시물 삭제에 실패했습니다.");
      }
    });
  };

    // 관리자가 모니터링 화면(게시물 상세)에서 댓글 하나를 바로 삭제한다.
  const deleteMonitorComment = (post: Post, commentId: string) => {
    showConfirm("이 댓글을 삭제하시겠습니까?", async () => {
      try {
        await api.delete(`/posts/${post._id}/comments/${commentId}`);
        setViewingPost((prev) => (prev && prev._id === post._id ? { ...prev, comments: prev.comments.filter((c) => c._id !== commentId) } : prev));
        setMonitorPosts((prev) => prev.map((p) => (p._id === post._id ? { ...p, comments: p.comments.filter((c) => c._id !== commentId) } : p)));
      } catch {
        showAlert("댓글 삭제에 실패했습니다.");
      }
    });
  };

  useEffect(() => {
    if (activeSection === "adminReports") {
      setAdminReportTab("reports");
      setAdminStatusFilter("all");
      api.get("/reports").then((res) => setAdminReports(res.data)).catch(() => {});
      api.get("/inquiries").then((res) => setAdminInquiries(res.data)).catch(() => {});
    } else if (activeSection === "adminUsers") {
      api.get("/admin/event-admins").then((res) => setAdminList(res.data)).catch(() => {});
      setAdminSearchQuery("");
      setAdminSearchResults([]);
    }
  }, [activeSection]);

  // + 탭이나 상태 필터가 바뀌면 더보기 개수를 10개로 초기화
  useEffect(() => {
    setVisibleReportsCount(5);
    setVisibleInquiriesCount(5);
  }, [adminReportTab, adminStatusFilter]);

  const toggleReportStatus = async (report: AdminReportItem) => {
    // 미처리로 되돌릴 때는 알림이 나가지 않으니 바로 처리하고,
    // 처리완료로 표시할 때만 신고자에게 보낼 결과 메시지를 먼저 물어본다.
    if (report.status === "resolved") {
      try {
        await api.patch(`/reports/${report._id}`, { status: "pending" });
        setAdminReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, status: "pending" } : r)));
      } catch {
        showAlert("신고 처리에 실패했습니다.");
      }
      return;
    }
    setResolveNoteText("");
    setResolveNoteTarget({ kind: "report", report });
  };

  const deleteReportedPost = (report: AdminReportItem) => {
    showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
      try {
        await api.delete(`/posts/${report.targetId}`);
        await api.patch(`/reports/${report._id}`, { status: "resolved", note: "신고하신 게시물이 삭제 처리되었습니다." });
        setAdminReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, status: "resolved" } : r)));
        showAlert("게시물이 삭제되었습니다.");
      } catch {
        showAlert("게시물 삭제에 실패했습니다.");
      }
    });
  };

  // 신고 건의 대상(게시물/댓글/유저)을 ID 수기 조회 없이 바로 확인한다.
  const viewReportTarget = async (report: AdminReportItem) => {
    try {
      const res = await api.get(`/reports/${report._id}/target`);
      const data = res.data as { targetType: string; post?: Post; targetCommentId?: string; user?: ReportTargetUser };
      setViewingReportId(report._id);
      if (data.targetType === "user") {
        setViewingUser(data.user ?? null);
      } else {
        setViewingPost(data.post ?? null);
        setViewingCommentId(data.targetCommentId ?? null);
      }
    } catch (err: any) {
      console.error("신고 대상 조회 실패:", err?.response?.status, err?.response?.data, err);
      showAlert(err?.response?.data?.message || "대상을 불러오지 못했습니다.");
    }
  };

  const toggleInquiryStatus = async (inquiry: AdminInquiryItem) => {
    if (inquiry.status === "resolved") {
      try {
        await api.patch(`/inquiries/${inquiry._id}`, { status: "pending" });
        setAdminInquiries((prev) => prev.map((i) => (i._id === inquiry._id ? { ...i, status: "pending" } : i)));
      } catch {
        showAlert("건의사항 처리에 실패했습니다.");
      }
      return;
    }
    setResolveNoteText("");
    setResolveNoteTarget({ kind: "inquiry", inquiry });
  };

  // "처리완료로 표시"를 누르면 뜨는 결과 메시지 입력을 신고자/건의자에게 알림으로 그대로 전달한다.
  const submitResolveNote = async () => {
    if (!resolveNoteTarget) return;
    try {
      if (resolveNoteTarget.kind === "report") {
        const { report } = resolveNoteTarget;
        await api.patch(`/reports/${report._id}`, { status: "resolved", note: resolveNoteText.trim() || undefined });
        setAdminReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, status: "resolved" } : r)));
      } else {
        const { inquiry } = resolveNoteTarget;
        await api.patch(`/inquiries/${inquiry._id}`, { status: "resolved", response: resolveNoteText.trim() || undefined });
        setAdminInquiries((prev) => prev.map((i) => (i._id === inquiry._id ? { ...i, status: "resolved" } : i)));
      }
      setResolveNoteTarget(null);
      setResolveNoteText("");
    } catch {
      showAlert("처리에 실패했습니다.");
    }
  };

  // 신고된 사용자의 프로필로 바로 들어간다. OtherUserProfile은 전체 게시물 목록에서
  // 해당 작성자 글만 걸러 쓰므로, 지금 볼 수 있는 게시물 전체를 한 번 받아둔다.
  const openUserProfile = async () => {
    if (!viewingUser) return;
    try {
      const res = await api.get("/posts");
      setUserProfilePosts(res.data);
    } catch {
      setUserProfilePosts([]);
    }
    setShowingUserProfile(true);
  };

  const submitSanctionAction = async () => {
    if (!viewingUser || !sanctionAction || !sanctionReason.trim()) return;
    setSanctionSubmitting(true);
    try {
      if (sanctionAction.type === "warn") {
        await api.post(`/admin/users/${viewingUser._id}/warn`, { reason: sanctionReason.trim(), reportId: viewingReportId || undefined });
      } else if (sanctionAction.type === "ban") {
        await api.post(`/admin/users/${viewingUser._id}/ban`, {
          reason: sanctionReason.trim(),
          banType: sanctionBanType,
          days: sanctionBanType === "temporary" ? sanctionDays : undefined,
          reportId: viewingReportId || undefined,
        });
      } else if (sanctionAction.type === "restrictComments") {
        await api.post(`/admin/users/${viewingUser._id}/restrict-comments`, {
          reason: sanctionReason.trim(),
          days: sanctionDays,
          reportId: viewingReportId || undefined,
        });
      } else {
        await api.post(`/admin/users/${viewingUser._id}/withdraw`, { reason: sanctionReason.trim(), reportId: viewingReportId || undefined });
      }
      const wasWithdraw = sanctionAction.type === "withdraw";
      // 신고 처리 화면에서는 이 신고가 이미 처리 완료로 자동 전환됐으니 목록에도 반영한다.
      if (viewingReportId) {
        setAdminReports((prev) => prev.map((r) => (r._id === viewingReportId ? { ...r, status: "resolved" } : r)));
      }
      setSanctionAction(null);
      setSanctionReason("");
      setSanctionBanType("temporary");
      setSanctionDays(7);
      // 회원 관리 화면에서 실행한 경우, 배지가 최신 상태를 반영하도록 목록을 새로고침한다.
      if (viewingMember) {
        if (wasWithdraw) setViewingMember(null);
        loadMembers(1, memberSearchQuery);
      }
      showAlert(wasWithdraw ? "강제 탈퇴 처리되었습니다." : "제재가 적용되었습니다.");
    } catch (err: any) {
      showAlert(err?.response?.data?.message || "처리에 실패했습니다.");
    } finally {
      setSanctionSubmitting(false);
    }
  };

  // 회원 관리 화면에서 관리자 권한(isAdmin, 전체 운영 권한)을 그 자리에서 부여/해제한다.
  // "행사공지 관리자"(canPostEvents)와는 별개의, 진짜 관리자 권한이다.
  const toggleFullAdmin = async (member: AdminMemberItem) => {
    showConfirm(
      member.isAdmin ? `${member.nickname}님의 관리자 권한을 해제할까요?` : `${member.nickname}님에게 관리자 권한을 부여할까요?`,
      async () => {
        try {
          await api.patch(`/users/${member._id}/admin`, { isAdmin: !member.isAdmin });
          setMemberList((prev) => prev.map((u) => (u._id === member._id ? { ...u, isAdmin: !member.isAdmin } : u)));
          setViewingMember((prev) => (prev && prev._id === member._id ? { ...prev, isAdmin: !member.isAdmin } : prev));
        } catch (err: any) {
          showAlert(err?.response?.data?.message || "관리자 권한 변경에 실패했습니다.");
        }
      }
    );
  };

  const searchAdminCandidates = async (q: string) => {
    setAdminSearchQuery(q);
    if (!q.trim()) {
      setAdminSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}`);
      setAdminSearchResults(res.data);
    } catch {
      setAdminSearchResults([]);
    }
  };

  // 행사공지 작성 권한만 부여/해제한다 (isAdmin과 별개 — 신고 처리·유저 제재·관리자 관리
  // 등 다른 권한은 전혀 주지 않는다).
  const setUserAdmin = async (user: AdminUserItem, nextCanPostEvents: boolean) => {
    try {
      await api.patch(`/admin/users/${user._id}/event-admin`, { canPostEvents: nextCanPostEvents });
      if (nextCanPostEvents) {
        setAdminList((prev) => (prev.some((u) => u._id === user._id) ? prev : [...prev, user]));
      } else {
        setAdminList((prev) => prev.filter((u) => u._id !== user._id));
      }
    } catch {
      showAlert("행사공지 작성 권한 변경에 실패했습니다.");
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
    try {
      const res = await api.post("/auth/check-nickname", { nickname: nicknameInput });
      if (res.data.available) {
        setNicknameChecked(true);
      }
      showAlert(res.data.message);
    } catch {
      showAlert("서버 연결 실패");
    }
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

  // 경고/차단/댓글제한/강제탈퇴 사유 입력 모달 — 회원 관리 화면과 신고 관리 화면이 동일한 상태를 공유한다.
  const SanctionModal = sanctionAction && viewingUser && (
    <Modal
      open
      title={sanctionAction.type === "warn" ? "유저 경고" : sanctionAction.type === "ban" ? "앱 차단" : sanctionAction.type === "restrictComments" ? "댓글 제한" : "강제 탈퇴"}
      onClose={() => setSanctionAction(null)}
      confirmText={sanctionSubmitting ? "처리 중..." : "확인"}
      confirmDisabled={!sanctionReason.trim() || sanctionSubmitting}
      onConfirm={submitSanctionAction}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>대상: {viewingUser.nickname}</p>

        {sanctionAction.type === "ban" && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant={sanctionBanType === "temporary" ? "primary" : "secondary"} onClick={() => setSanctionBanType("temporary")}>
              기간 지정
            </Button>
            <Button variant={sanctionBanType === "permanent" ? "primary" : "secondary"} onClick={() => setSanctionBanType("permanent")}>
              영구 정지
            </Button>
          </div>
        )}

        {(sanctionAction.type === "restrictComments" || (sanctionAction.type === "ban" && sanctionBanType === "temporary")) && (
          <div className="flex gap-2 items-center">
            {[3, 7, 30].map((d) => (
              <Chip key={d} selected={sanctionDays === d} onClick={() => setSanctionDays(d)}>
                {d}일
              </Chip>
            ))}
            <input
              type="number"
              min={1}
              value={sanctionDays}
              onChange={(e) => setSanctionDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded-[var(--r-sm)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 py-2 text-sm text-[var(--text-body)] outline-none"
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>일</span>
          </div>
        )}

        <textarea
          value={sanctionReason}
          onChange={(e) => setSanctionReason(e.target.value)}
          placeholder="사유를 입력하세요"
          rows={3}
          className="w-full resize-none rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-body)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>
    </Modal>
  );

  // "처리완료로 표시"를 누르면, 신고자/건의자에게 그대로 전달할 결과 메시지를 입력받는다.
  const ResolveNoteModal = resolveNoteTarget && (
    <Modal
      open
      title={resolveNoteTarget.kind === "report" ? "신고 처리 결과" : "건의사항 답변"}
      onClose={() => setResolveNoteTarget(null)}
      confirmText="처리완료로 표시"
      onConfirm={submitResolveNote}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {resolveNoteTarget.kind === "report"
            ? "여기에 적은 내용이 신고자에게 알림으로 전달됩니다. 비워두면 \"별도의 제재 조치는 없었습니다\"로 전달됩니다."
            : "여기에 적은 내용이 건의자에게 답변 알림으로 전달됩니다. 비워두면 기본 안내 문구로 전달됩니다."}
        </p>
        <textarea
          value={resolveNoteText}
          onChange={(e) => setResolveNoteText(e.target.value)}
          placeholder={resolveNoteTarget.kind === "report" ? "예: 검토 결과 규정 위반이 아니었습니다." : "예: 요청하신 기능은 다음 업데이트에 반영 예정입니다."}
          rows={4}
          className="w-full resize-none rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-body)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>
    </Modal>
  );

  if (activeSection === "blocked") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="차단 내역" onBack={() => setActiveSection(null)} />
        <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {blockedUsers.length === 0 && (
            <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              차단한 사용자가 없습니다.
            </p>
          )}
          {blockedUsers.map((user) => (
            <Card key={user.id} className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <UserX size={14} style={{ color: "var(--danger)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{user.name}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>사유: {user.reason}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{user.date}</p>
              </div>
              <Chip
                selected
                onClick={() => {
                  showConfirm(`${user.name}님의 차단을 해제하시겠습니까?`, async () => {
                    try {
                      await api.delete(`/users/block/${user.id}`);
                    } catch {
                      showAlert("차단 해제에 실패했습니다.");
                      return;
                    }
                    removeBlockedUser(user.id);
                    showAlert("차단이 해제되었습니다.");
                  });
                }}
              >
                차단 해제
              </Chip>
            </Card>
          ))}
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "password") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="비밀번호 변경" onBack={() => setActiveSection(null)} />
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="relative">
            <Input
              label="현재 비밀번호"
              type={showPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 bottom-1.5 flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div>
            <Input
              label="새 비밀번호"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              비밀번호 (8~15자의 영문, 숫자 또는 특수문자 조합)
            </p>
          </div>
          <div>
            <Input
              label="새 비밀번호 확인"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              안전한 사용을 위해 8자 이상 입력해주세요!
            </p>
          </div>
          <Button
            size={52}
            fullWidth
            onClick={async () => {
              if (!currentPassword.trim()) {
                showAlert("현재 비밀번호를 입력해주세요.");
                return;
              }
              const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
              if (!passwordRegex.test(newPassword)) {
                showAlert("새 비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다.");
                return;
              }
              if (newPassword !== confirmPassword) {
                showAlert("새 비밀번호가 일치하지 않습니다.");
                return;
              }
              try {
                await api.patch("/auth/password", { currentPassword, newPassword });
                showAlert("비밀번호가 변경되었습니다.", () => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setActiveSection(null);
                });
              } catch (err: any) {
                showAlert(err?.response?.data?.message || "비밀번호 변경에 실패했습니다.");
              }
            }}
          >
            변경하기
          </Button>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "phone") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="전화번호 등록/변경" onBack={() => setActiveSection(null)} />
        <div className="flex flex-col gap-4 px-4 py-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            비밀번호를 잊었을 때 본인 확인에 사용되는 전화번호입니다. 등록되어 있지 않으면
            비밀번호 찾기를 이용할 수 없습니다.
          </p>
          <Input
            label="현재 비밀번호"
            type="password"
            value={phoneCurrentPassword}
            onChange={(e) => setPhoneCurrentPassword(e.target.value)}
          />
          <Input
            label="전화번호"
            type="tel"
            placeholder="예) 01012345678"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            maxLength={13}
          />
          <Button
            size={52}
            fullWidth
            onClick={async () => {
              if (!phoneCurrentPassword.trim()) {
                showAlert("현재 비밀번호를 입력해주세요.");
                return;
              }
              if (!/^01[016789]\d{7,8}$/.test(phoneInput.replace(/\D/g, ""))) {
                showAlert("올바른 휴대전화 번호를 입력해주세요.");
                return;
              }
              try {
                await api.patch("/auth/phone", { currentPassword: phoneCurrentPassword, phone: phoneInput });
                showAlert("전화번호가 등록되었습니다.", () => {
                  setPhoneCurrentPassword("");
                  setPhoneInput("");
                  setActiveSection(null);
                });
              } catch (err: any) {
                showAlert(err?.response?.data?.message || "전화번호 등록에 실패했습니다.");
              }
            }}
          >
            저장하기
          </Button>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "inquiry") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="건의사항" onBack={() => setActiveSection(null)} />

        <div className="flex flex-col gap-4 px-4 py-4">
          <Input
            label="제목"
            type="text"
            placeholder="건의사항 제목을 입력하세요"
            value={inquiryTitle}
            onChange={(e) => setInquiryTitle(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium" style={{ color: "var(--text-body)" }}>내용</label>
            <textarea
              placeholder="건의사항 내용을 입력하세요"
              value={inquiryContent}
              onChange={(e) => setInquiryContent(e.target.value)}
              rows={8}
              className="no-scrollbar w-full resize-none rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-body)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--blue-primary)] focus:bg-[var(--blue-soft)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
            />
          </div>

          <Button
            size={52}
            fullWidth
            onClick={async () => {
              if (!inquiryTitle.trim() || !inquiryContent.trim()) {
                showAlert("제목과 내용을 입력해주세요.");
                return;
              }
              try {
                // 서버에 접수하고, 성공하면 서버 기준 목록을 다시 불러와 내 내역에 바로 반영한다.
                await api.post("/inquiries", { title: inquiryTitle, content: inquiryContent });
              } catch {
                showAlert("건의사항 접수에 실패했습니다. 잠시 후 다시 시도해주세요.");
                return;
              }
              fetchMyInquiries();
              showAlert("건의사항이 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.", () => {
                setInquiryTitle("");
                setInquiryContent("");
                setActiveSection(null);
              });
            }}
          >
            제출하기
          </Button>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "guidelines") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="커뮤니티 이용 규칙" onBack={() => setActiveSection(null)} />
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <Card className="mb-3">
            <h3 className="mb-2 font-semibold" style={{ color: "var(--text-strong)" }}>가이드 및 규칙</h3>
            <ul className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <li>• 타인을 존중하고 예의 바르게 소통하세요.</li>
              <li>• 욕설, 비방, 차별적 발언은 금지됩니다.</li>
              <li>• 허위 정보나 스팸성 게시물을 작성하지 마세요.</li>
              <li>• 타인의 저작권을 침해하지 마세요.</li>
            </ul>
          </Card>
          <Card>
            <h3 className="mb-2 font-semibold" style={{ color: "var(--text-strong)" }}>신고 및 제재</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              규칙을 위반한 게시물이나 사용자를 발견하면 신고 기능을 이용해주세요.
              신고가 접수되면 관리자가 확인 후 적절한 조치를 취합니다.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (activeSection === "reports") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="신고/건의 내역" onBack={() => setActiveSection(null)} />

        {/* 신고 내역 / 건의사항 내역 탭 */}
        <div className="mb-1 mt-4 grid grid-cols-2 gap-2 px-4">
          <Button variant={historyTab === "reports" ? "primary" : "secondary"} onClick={() => setHistoryTab("reports")}>
            <AlertTriangle size={14} /> 신고 내역 ({reportHistory.length})
          </Button>
          <Button variant={historyTab === "inquiries" ? "primary" : "secondary"} onClick={() => setHistoryTab("inquiries")}>
            <MessageSquare size={14} /> 건의사항 내역 ({inquiryHistory.length})
          </Button>
        </div>

        <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {historyTab === "reports" ? (
            reportHistory.length === 0 ? (
              <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                신고 내역이 없습니다.
              </p>
            ) : (
              reportHistory.map((r) => (
                <Card
                  key={`report-${r.id}`}
                  className="cursor-pointer"
                  onClick={async () => {
                    try {
                      const res = await api.get("/posts");
                      const post = (res.data as Post[]).find((p) => p._id === r.postId);
                      if (post) {
                        setViewingPost(post);
                      } else {
                        showAlert("게시물을 찾을 수 없습니다. 삭제되었을 수 있습니다.");
                      }
                    } catch {
                      showAlert("게시물을 불러오지 못했습니다.");
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <AlertTriangle size={14} style={{ color: "var(--blue-primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{r.type}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-strong)" }}>
                        "{r.target}"
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{r.date}</p>
                    </div>
                    {r.status === "처리 완료" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showAlert(r.sanction || "현재 검토 중이며, 아직 확정된 제재 내용이 없습니다.");
                        }}
                      >
                        <Badge tone="success">처리 완료</Badge>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm("신고를 취소하시겠습니까?", () => {
                            removeReportFromHistory(r.id);
                          });
                        }}
                      >
                        <Badge tone="info">{r.status}</Badge>
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )
          ) : (
            inquiryHistory.length === 0 ? (
              <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                건의사항 내역이 없습니다.
              </p>
            ) : (
              inquiryHistory.map((item) => (
                <Card key={`inquiry-${item._id}`}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex min-w-0 items-center gap-2">
                        <MessageSquare size={14} className="shrink-0" style={{ color: "var(--blue-primary)" }} />
                        <span className="truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                          {item.title}
                        </span>
                      </div>
                      <p
                        className={`min-h-[2.25rem] break-words text-xs ${!expandedInquiryIds.has(item._id) && item.content.length > INQUIRY_PREVIEW_LENGTH ? "line-clamp-2" : ""}`}
                        style={{ color: "var(--text-muted)" }}
                      >
                        {item.content}
                      </p>
                      {item.content.length > INQUIRY_PREVIEW_LENGTH && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleInquiryExpand(item._id); }}
                          className="mt-0.5 text-xs font-semibold"
                          style={{ color: "var(--blue-deep)" }}
                        >
                          {expandedInquiryIds.has(item._id) ? "접기" : "더보기"}
                        </button>
                      )}
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(item.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    {item.status === "resolved" ? (
                      <Badge tone="success" className="shrink-0">처리 완료</Badge>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm("건의사항을 취소하시겠습니까?", async () => {
                            try {
                              await api.delete(`/inquiries/${item._id}`);
                              setInquiryHistory((prev) => prev.filter((i) => i._id !== item._id));
                            } catch (err: any) {
                              showAlert(err?.response?.data?.message || "건의사항 취소에 실패했습니다.");
                            }
                          });
                        }}
                        className="shrink-0"
                      >
                        <Badge tone="info">처리 중</Badge>
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )
          )}
        </div>

        {/* 신고/건의 내역에서 게시물 클릭 시, 커뮤니티 탭으로 이동하지 않고 이 화면 위에 바로 상세를 띄운다 */}
        {viewingPost && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <ScreenHeader title="게시물" onBack={() => setViewingPost(null)} />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Avatar src={resolveAssetUrl(viewingPost.author.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.author.nickname}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{getDisplayTime(viewingPost)}</p>
                  </div>
                </div>
                <h3 className="mb-1 font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {viewingPost.content}
                </p>
                {viewingPost.images[0] && (
                  <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 max-h-72 w-full rounded-[var(--r-md)] object-cover" />
                )}
              </Card>

              <Card className="flex flex-col gap-3">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  댓글 {viewingPost.comments.length}개
                </p>
                {viewingPost.comments.map((c) => (
                  <div key={c._id} className="flex items-start gap-2">
                    <Avatar src={resolveAssetUrl(c.author.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div className="flex-1 rounded-[var(--r-md)] px-3 py-2 text-xs" style={{ color: "var(--text-body)" }}>
                      <span className="font-semibold">{c.author.nickname} </span>{c.content}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminMonitoring") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="게시물/댓글 모니터링" onBack={() => setActiveSection(null)} />

        <div className="mb-1 mt-4 grid grid-cols-2 gap-2 px-4">
          <Button
            variant={monitorTab === "posts" ? "primary" : "secondary"}
            onClick={() => { setMonitorTab("posts"); loadMonitorPosts(1, monitorBoard, monitorSearchQuery); }}
          >
            최근 게시물
          </Button>
          <Button
            variant={monitorTab === "logs" ? "primary" : "secondary"}
            onClick={() => { setMonitorTab("logs"); loadMonitorLogs(1, monitorLogType); }}
          >
            삭제 로그
          </Button>
        </div>

        {monitorTab === "posts" ? (
          <>
            <div className="flex flex-col gap-2 px-4 pt-2">
              <Input
                label="제목/내용 검색"
                hideLabel
                value={monitorSearchQuery}
                onChange={(e) => { setMonitorSearchQuery(e.target.value); loadMonitorPosts(1, monitorBoard, e.target.value); }}
                placeholder="제목/내용 검색"
              />
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                <Chip selected={monitorBoard === ""} onClick={() => { setMonitorBoard(""); loadMonitorPosts(1, "", monitorSearchQuery); }}>
                  전체
                </Chip>
                {BOARDS.map((b) => (
                  <Chip
                    key={b.id}
                    selected={monitorBoard === b.id}
                    onClick={() => { setMonitorBoard(b.id); loadMonitorPosts(1, b.id, monitorSearchQuery); }}
                  >
                    {b.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
              {monitorPosts.length === 0 && !monitorLoading ? (
                <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  게시물이 없습니다.
                </p>
              ) : (
                monitorPosts.map((p) => (
                  <Card
                    key={p._id}
                    className="flex cursor-pointer flex-col gap-1.5"
                    onClick={() => { setViewingPost(p); setViewingCommentId(null); }}
                  >
                    <div className="flex items-center justify-between">
                      <BoardBadge board={p.board} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(p.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{p.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {p.author?.nickname ?? "알 수 없음"} · 댓글 {p.comments?.length ?? 0} · 좋아요 {p.likes?.length ?? 0}
                    </p>
                  </Card>
                ))
              )}
              {monitorHasMore && (
                <Button variant="secondary" fullWidth disabled={monitorLoading} onClick={() => loadMonitorPosts(monitorPage + 1, monitorBoard, monitorSearchQuery, true)}>
                  {monitorLoading ? "불러오는 중..." : "더 보기"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1.5 px-4 pt-2">
              {([
                { key: "all", label: "전체" },
                { key: "deletePost", label: "게시물 삭제" },
                { key: "deleteComment", label: "댓글 삭제" },
              ] as { key: "all" | "deletePost" | "deleteComment"; label: string }[]).map((t) => (
                <Chip key={t.key} selected={monitorLogType === t.key} onClick={() => { setMonitorLogType(t.key); loadMonitorLogs(1, t.key); }}>
                  {t.label}
                </Chip>
              ))}
            </div>

            <div className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
              {monitorLogs.length === 0 && !monitorLogLoading ? (
                <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  삭제 로그가 없습니다.
                </p>
              ) : (
                monitorLogs.map((log) => (
                  <Card key={log._id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="danger">{log.actionType === "deletePost" ? "게시물 삭제" : "댓글 삭제"}</Badge>
                        <Badge tone="muted">{log.actorIsAdmin ? "관리자 삭제" : "본인 삭제"}</Badge>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(log.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    {log.snapshot?.title && (
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{log.snapshot.title}</p>
                    )}
                    {log.snapshot?.content && (
                      <p className="line-clamp-2 text-xs" style={{ color: "var(--text-muted)" }}>{log.snapshot.content}</p>
                    )}
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {log.board ? `${BOARDS.find((b) => b.id === log.board)?.label ?? log.board} · ` : ""}
                      원작성자: {log.targetAuthor?.nickname ?? "탈퇴한 사용자"} · 처리자: {log.actor?.nickname ?? "알 수 없음"}
                    </p>
                  </Card>
                ))
              )}
              {monitorLogHasMore && (
                <Button variant="secondary" fullWidth disabled={monitorLogLoading} onClick={() => loadMonitorLogs(monitorLogPage + 1, monitorLogType, true)}>
                  {monitorLogLoading ? "불러오는 중..." : "더 보기"}
                </Button>
              )}
            </div>
          </>
        )}

        {/* 게시물 상세 (모니터링 화면에서 탭한 게시물) — 그 자리에서 게시물/댓글 삭제 가능 */}
        {viewingPost && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <ScreenHeader
              title="게시물 상세"
              onBack={() => { setViewingPost(null); setViewingCommentId(null); }}
              action={
                <Chip selected onClick={() => deleteMonitorPost(viewingPost)} style={{ background: "var(--danger)", color: "white" }}>
                  게시물 삭제
                </Chip>
              }
            />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar src={resolveAssetUrl(viewingPost.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.author?.nickname ?? "알 수 없음"}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{getDisplayTime(viewingPost)}</p>
                    </div>
                  </div>
                  <BoardBadge board={viewingPost.board} />
                </div>
                <h3 className="mb-1 font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {viewingPost.content}
                </p>
                {viewingPost.images?.[0] && (
                  <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 max-h-72 w-full rounded-[var(--r-md)] object-cover" />
                )}
                <div className="mt-3 flex items-center gap-4 border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center gap-1.5">
                    <Heart size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.likes?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.comments?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bookmark size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.scraps?.length ?? 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="flex flex-col gap-3">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  댓글 {viewingPost.comments?.length ?? 0}개
                </p>
                {(viewingPost.comments ?? []).map((c) => (
                  <div key={c._id} className="flex items-start gap-2">
                    <Avatar src={resolveAssetUrl(c.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div className="flex-1 rounded-[var(--r-md)] px-3 py-2 text-xs" style={{ color: "var(--text-body)" }}>
                      <span className="font-semibold">{c.author?.nickname ?? "알 수 없음"} </span>{c.content}
                    </div>
                    <Chip selected onClick={() => deleteMonitorComment(viewingPost, c._id)} style={{ background: "var(--tag-danger-bg)", color: "var(--tag-danger-fg)" }}>
                      삭제
                    </Chip>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminMembers") {
    const memberBadges = (m: AdminMemberItem) => {
      const badges: { label: string; tone: "info" | "muted" | "danger" }[] = [];
      if (m.isAdmin) badges.push({ label: "관리자", tone: "info" });
      if (m.isWithdrawn) badges.push({ label: "탈퇴", tone: "muted" });
      if (m.banned) badges.push({ label: m.banType === "permanent" ? "영구차단" : "기간차단", tone: "danger" });
      if (m.commentRestrictedUntil && new Date(m.commentRestrictedUntil) > new Date()) badges.push({ label: "댓글제한", tone: "danger" });
      return badges;
    };

    const sanctionLabel = (s: SanctionItem): { label: string; tone: "info" | "muted" | "danger" } => {
      switch (s.type) {
        case "warning": return { label: "경고", tone: "muted" };
        case "ban": return { label: s.banType === "permanent" ? "영구 차단" : "기간 차단", tone: "danger" };
        case "commentRestriction": return { label: "댓글 제한", tone: "danger" };
        case "forceWithdraw": return { label: "강제 탈퇴", tone: "danger" };
        default: return { label: s.type, tone: "muted" };
      }
    };

    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="회원 관리" onBack={() => setActiveSection(null)} />
        <div className="px-4 pt-4">
          <Input
            label="학번 또는 닉네임 검색"
            hideLabel
            value={memberSearchQuery}
            onChange={(e) => { setMemberSearchQuery(e.target.value); loadMembers(1, e.target.value); }}
            placeholder="학번 또는 닉네임 검색"
          />
        </div>
        <div className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {memberList.length === 0 && !memberLoading ? (
            <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              회원이 없습니다.
            </p>
          ) : (
            memberList.map((m) => (
              <button
                key={m._id}
                onClick={() => { setViewingPost(null); setViewingMember(m); }}
                className="flex items-center gap-3 rounded-[var(--r-lg)] p-3 text-left"
                style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
              >
                <Avatar src={resolveAssetUrl(m.avatar)} fallbackSrc={defaultAvatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-strong)" }}>{m.nickname}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {m.studentId}
                    {!!m.warningCount && ` · 경고 ${m.warningCount}회`}
                    {!!m.banCount && ` · 차단 ${m.banCount}회`}
                  </p>
                </div>
                <div className="flex max-w-[40%] shrink-0 flex-wrap justify-end gap-1">
                  {memberBadges(m).map((b, i) => (
                    <Badge key={i} tone={b.tone}>{b.label}</Badge>
                  ))}
                </div>
              </button>
            ))
          )}
          {memberHasMore && (
            <Button variant="secondary" fullWidth disabled={memberLoading} onClick={() => loadMembers(memberPage + 1, memberSearchQuery, true)}>
              {memberLoading ? "불러오는 중..." : "더 보기"}
            </Button>
          )}
        </div>

        {/* 회원 상세: 상태 확인 + 그 자리에서 관리자 임명/해제, 제재, 강제 탈퇴 */}
        {viewingMember && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <ScreenHeader title="회원 상세" onBack={() => { setViewingMember(null); setViewingPost(null); }} />
            <div className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              <div className="flex items-center gap-3">
                <Avatar src={resolveAssetUrl(viewingMember.avatar)} fallbackSrc={defaultAvatar} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold" style={{ color: "var(--text-strong)" }}>{viewingMember.nickname}</p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {viewingMember.studentId && `학번 ${viewingMember.studentId}`}
                    {viewingMember.createdAt && ` · 가입 ${new Date(viewingMember.createdAt).toLocaleDateString("ko-KR")}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {memberBadges(viewingMember).length === 0 ? (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>특이사항 없음</span>
                ) : (
                  memberBadges(viewingMember).map((b, i) => <Badge key={i} tone={b.tone}>{b.label}</Badge>)
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={memberSanctionFilter === "warning" ? "primary" : "secondary"}
                  size={52}
                  className="flex-col gap-0.5"
                  onClick={() => setMemberSanctionFilter((prev) => (prev === "warning" ? null : "warning"))}
                >
                  <span className="text-lg font-bold">
                    {memberSanctions.filter((s) => s.type === "warning" || s.type === "commentRestriction").length}
                  </span>
                  <span className="text-xs font-normal">경고/댓글 제한</span>
                </Button>
                <Button
                  variant={memberSanctionFilter === "ban" ? "primary" : "secondary"}
                  size={52}
                  className="flex-col gap-0.5"
                  onClick={() => {
                    if (memberSanctionFilter === "ban" && viewingMember.banned) {
                      liftMemberBan();
                    } else {
                      setMemberSanctionFilter((prev) => (prev === "ban" ? null : "ban"));
                    }
                  }}
                >
                  <span className="text-lg font-bold">{memberSanctions.filter((s) => s.type === "ban").length}</span>
                  <span className="text-xs font-normal">차단중</span>
                </Button>
              </div>

              {viewingMember.isWithdrawn ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>탈퇴한 회원에게는 추가 조치를 할 수 없습니다.</p>
              ) : (
                <Button variant={viewingMember.isAdmin ? "secondary" : "primary"} size={52} fullWidth onClick={() => toggleFullAdmin(viewingMember)}>
                  {viewingMember.isAdmin ? "관리자 권한 해제" : "관리자 권한 부여"}
                </Button>
              )}

              {memberSanctionFilter && (
                <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                    {memberSanctionFilter === "warning" ? "경고/댓글 제한 내역" : "차단 내역"}
                  </h3>
                  {memberSanctionsLoading ? (
                    <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
                  ) : (
                    (() => {
                      const filtered = memberSanctions.filter((s) =>
                        memberSanctionFilter === "warning" ? s.type === "warning" || s.type === "commentRestriction" : s.type === "ban"
                      );
                      if (filtered.length === 0) {
                        return <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>내역이 없습니다.</p>;
                      }
                      return filtered.map((s) => {
                        const { label, tone } = sanctionLabel(s);
                        return (
                          <Card key={s._id} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <Badge tone={tone}>{label}</Badge>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {s.active
                                  ? s.type === "ban" && s.banType === "permanent"
                                    ? "영구"
                                    : s.expiresAt
                                    ? `~${new Date(s.expiresAt).toLocaleDateString("ko-KR")}`
                                    : "진행중"
                                  : "해제됨"}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: "var(--text-body)" }}>사유: {s.reason}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {new Date(s.createdAt).toLocaleString("ko-KR")} · 처리: {s.admin?.nickname ?? "-"}
                            </p>
                            {s.post && (
                              <button
                                onClick={() => openSanctionPost(s.post!)}
                                className="flex items-center gap-1 self-start text-xs font-semibold"
                                style={{ color: "var(--blue-deep)" }}
                              >
                                원본 게시물 보기 <ChevronRight size={12} />
                              </button>
                            )}
                          </Card>
                        );
                      });
                    })()
                  )}
                </div>
              )}
            </div>

            {/* 제재 내역에서 원본 게시물을 눌렀을 때, 읽기 전용으로 바로 보여준다 */}
            {viewingPost && (
              <div className="absolute inset-0 z-20 flex flex-col" style={{ background: "var(--bg-base)" }}>
                <ScreenHeader title="게시물" onBack={() => setViewingPost(null)} />
                <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                  <Card>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar src={resolveAssetUrl(viewingPost.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.author?.nickname ?? "알 수 없음"}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{getDisplayTime(viewingPost)}</p>
                        </div>
                      </div>
                      <Badge tone="muted">{BOARDS.find((b) => b.id === viewingPost.board)?.label ?? viewingPost.board}</Badge>
                    </div>
                    <h3 className="mb-1 font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {viewingPost.content}
                    </p>
                    {viewingPost.images?.[0] && (
                      <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 max-h-72 w-full rounded-[var(--r-md)] object-cover" />
                    )}
                  </Card>

                  <Card className="flex flex-col gap-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      댓글 {viewingPost.comments?.length ?? 0}개
                    </p>
                    {(viewingPost.comments ?? []).map((c) => (
                      <div key={c._id} className="flex items-start gap-2">
                        <Avatar src={resolveAssetUrl(c.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                        <div className="flex-1 rounded-[var(--r-md)] px-3 py-2 text-xs" style={{ color: "var(--text-body)" }}>
                          <span className="font-semibold">{c.author?.nickname ?? "알 수 없음"} </span>{c.content}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {SanctionModal}
        {ResolveNoteModal}
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminReports") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="신고/건의 관리" onBack={() => setActiveSection(null)} />

        <div className="mb-1 mt-4 grid grid-cols-2 gap-2 px-4">
          <Button variant={adminReportTab === "reports" ? "primary" : "secondary"} onClick={() => setAdminReportTab("reports")}>
            신고 ({adminReports.length})
          </Button>
          <Button variant={adminReportTab === "inquiries" ? "primary" : "secondary"} onClick={() => setAdminReportTab("inquiries")}>
            건의사항 ({adminInquiries.length})
          </Button>
        </div>

        {/* 미처리/처리완료 상태 필터: 커뮤니티 화면의 최신순/인기순 드롭다운과 동일한 방식 */}
        <div className="mb-1 flex justify-end px-4">
          <div className="relative">
            <Chip selected={false} onClick={() => setShowAdminStatusDropdown((v) => !v)}>
              {adminStatusFilter === "all" ? "전체" : adminStatusFilter === "pending" ? "미처리" : "처리완료"}
              {showAdminStatusDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Chip>

            {showAdminStatusDropdown && (
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-[90px] rounded-[var(--r-md)] py-1"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
              >
                {([
                  { key: "all", label: "전체" },
                  { key: "pending", label: "미처리" },
                  { key: "resolved", label: "처리완료" },
                ] as { key: "all" | "pending" | "resolved"; label: string }[]).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setAdminStatusFilter(opt.key); setShowAdminStatusDropdown(false); }}
                    className="w-full px-3 py-2 text-left text-xs"
                    style={{ color: adminStatusFilter === opt.key ? "var(--blue-deep)" : "var(--text-body)" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 상태 드롭다운 외부 클릭 닫기 */}
        {showAdminStatusDropdown && (
          <div className="absolute inset-0 z-10" onClick={() => setShowAdminStatusDropdown(false)} />
        )}

        {adminReportTab === "reports" ? (() => {
        const filteredReports = adminReports.filter((r) => adminStatusFilter === "all" || r.status === adminStatusFilter);
        const visibleReports = filteredReports.slice(0, visibleReportsCount);
        const hasMoreReports = visibleReportsCount < filteredReports.length;
        return (
        <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {filteredReports.length === 0 ? (
            <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              접수된 신고가 없습니다.
            </p>
          ) : (
            visibleReports.map((report) => (
              <Card key={report._id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Badge tone={report.status === "pending" ? "danger" : "muted"}>
                    {report.status === "pending" ? "미처리" : "처리완료"}
                  </Badge>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(report.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-body)" }}>
                  <span className="font-semibold">{report.reporter?.nickname ?? "알 수 없음"}</span>님의 신고
                  {" · "}
                  {report.targetType === "post" ? "게시물" : report.targetType === "comment" ? "댓글" : "사용자"}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>사유: {report.reason}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>대상 ID: {report.targetId}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button size={44} onClick={() => viewReportTarget(report)}>
                    {report.targetType === "post" ? "게시물 조회" : report.targetType === "comment" ? "댓글 조회" : "유저 조회"}
                  </Button>
                  {report.targetType === "post" && (
                    <Button size={44} style={{ background: "var(--danger)" }} onClick={() => deleteReportedPost(report)}>
                      게시물 삭제
                    </Button>
                  )}
                  <Button variant="secondary" size={44} onClick={() => toggleReportStatus(report)}>
                    {report.status === "pending" ? "처리완료로 표시" : "미처리로 되돌리기"}
                  </Button>
                </div>
              </Card>
            ))
          )}
          {hasMoreReports && (
            <Button variant="secondary" fullWidth onClick={() => setVisibleReportsCount((prev) => prev + 5)}>
              더 보기
            </Button>
          )}
        </div>
        );
                })() : (() => {
        const filteredInquiries = adminInquiries.filter((i) => adminStatusFilter === "all" || i.status === adminStatusFilter);
        const visibleInquiries = filteredInquiries.slice(0, visibleInquiriesCount);
        const hasMoreInquiries = visibleInquiriesCount < filteredInquiries.length;
        return (
        <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {filteredInquiries.length === 0 ? (
            <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              접수된 건의사항이 없습니다.
            </p>
          ) : (
            visibleInquiries.map((inquiry) => (
              <Card key={inquiry._id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Badge tone={inquiry.status === "pending" ? "danger" : "muted"}>
                    {inquiry.status === "pending" ? "미처리" : "처리완료"}
                  </Badge>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(inquiry.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{inquiry.title}</p>
                <p
                  className={`min-h-[2.5rem] break-words text-sm ${!expandedInquiryIds.has(inquiry._id) && inquiry.content.length > INQUIRY_PREVIEW_LENGTH ? "line-clamp-2" : ""}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  {inquiry.content}
                </p>
                {inquiry.content.length > INQUIRY_PREVIEW_LENGTH && (
                  <button
                    onClick={() => toggleInquiryExpand(inquiry._id)}
                    className="self-start text-xs font-semibold"
                    style={{ color: "var(--blue-deep)" }}
                  >
                    {expandedInquiryIds.has(inquiry._id) ? "접기" : "더보기"}
                  </button>
                )}
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  작성자: {inquiry.user?.nickname ?? "알 수 없음"}{inquiry.user?.studentId ? ` (${inquiry.user.studentId})` : ""}
                </p>
                <div className="mt-1 flex gap-2">
                  <Button variant="secondary" size={44} onClick={() => toggleInquiryStatus(inquiry)}>
                    {inquiry.status === "pending" ? "처리완료로 표시" : "미처리로 되돌리기"}
                  </Button>
                </div>
              </Card>
            ))
          )}
          {hasMoreInquiries && (
            <Button variant="secondary" fullWidth onClick={() => setVisibleInquiriesCount((prev) => prev + 5)}>
              더 보기
            </Button>
          )}
        </div>
        );
        })()}

        {/* 신고 대상 게시물/댓글 바로 조회 */}
        {viewingPost && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <ScreenHeader
              title={viewingCommentId ? "신고된 댓글" : "신고된 게시물"}
              onBack={() => { setViewingPost(null); setViewingCommentId(null); setViewingReportId(null); }}
            />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar src={resolveAssetUrl(viewingPost.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.author?.nickname ?? "알 수 없음"}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{getDisplayTime(viewingPost)}</p>
                    </div>
                  </div>
                  <BoardBadge board={viewingPost.board} />
                </div>
                <h3 className="mb-1 font-semibold" style={{ color: "var(--text-strong)" }}>{viewingPost.title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {viewingPost.content}
                </p>
                {viewingPost.images?.[0] && (
                  <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 max-h-72 w-full rounded-[var(--r-md)] object-cover" />
                )}
                {!!viewingPost.tags?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {viewingPost.tags.map((tag, i) => (
                      <Badge key={i} tone="info">#{tag}</Badge>
                    ))}
                  </div>
                )}
                {/* 신고 검토용 참고 지표 — 관리자가 직접 좋아요/싫어요를 누르는 기능은 아니라서 읽기 전용으로만 보여준다 */}
                <div className="mt-3 flex items-center gap-4 border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center gap-1.5">
                    <Heart size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.likes?.length ?? 0}</span>
                  </div>
                  {viewingPost.board === "lecture" && (
                    <div className="flex items-center gap-1.5">
                      <ThumbsDown size={14} style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.dislikes?.length ?? 0}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.comments?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bookmark size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{viewingPost.scraps?.length ?? 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="flex flex-col gap-3">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  댓글 {viewingPost.comments?.length ?? 0}개{viewingCommentId ? " (신고된 댓글은 빨간 테두리로 표시됩니다)" : ""}
                </p>
                {(viewingPost.comments ?? []).map((c) => (
                  <div
                    key={c._id}
                    className="flex items-start gap-2 rounded-[var(--r-md)]"
                    style={c._id === viewingCommentId ? { border: "1.5px solid var(--danger)", padding: "6px" } : undefined}
                  >
                    <Avatar src={resolveAssetUrl(c.author?.avatar)} fallbackSrc={defaultAvatar} size="sm" />
                    <div className="flex-1 rounded-[var(--r-md)] px-3 py-2 text-xs" style={{ color: "var(--text-body)" }}>
                      <span className="font-semibold">{c.author?.nickname ?? "알 수 없음"} </span>{c.content}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* 신고 대상이 유저일 때 바로 조회 */}
        {viewingUser && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <ScreenHeader title="신고된 사용자" onBack={() => { setViewingUser(null); setViewingReportId(null); }} />
            <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <Card className="flex items-center gap-3">
                <Avatar src={resolveAssetUrl(viewingUser.avatar)} fallbackSrc={defaultAvatar} size="lg" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{viewingUser.nickname}</p>
                  {viewingUser.studentId && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>학번: {viewingUser.studentId}</p>
                  )}
                  {viewingUser.isAdmin && (
                    <p className="text-xs" style={{ color: "var(--blue-primary)" }}>관리자 계정</p>
                  )}
                </div>
              </Card>

              <div className="flex flex-col gap-2">
                <Button size={52} fullWidth onClick={openUserProfile}>
                  프로필 보기
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="secondary" size={52} className="flex-col gap-1" onClick={() => setSanctionAction({ type: "warn" })}>
                    <AlertTriangle size={16} /> <span className="text-xs">경고</span>
                  </Button>
                  <Button size={52} className="flex-col gap-1" style={{ background: "var(--danger)" }} onClick={() => setSanctionAction({ type: "ban" })}>
                    <Ban size={16} /> <span className="text-xs">차단</span>
                  </Button>
                  <Button variant="secondary" size={52} className="flex-col gap-1" onClick={() => setSanctionAction({ type: "restrictComments" })}>
                    <MessageSquare size={16} /> <span className="text-xs">댓글 제한</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 신고된 사용자의 프로필 화면 (인스타 스타일 OtherUserProfile 재사용) */}
        {showingUserProfile && viewingUser && (
          <div className="absolute inset-0 z-20 flex flex-col" style={{ background: "var(--bg-base)" }}>
            <OtherUserProfile
              author={viewingUser as PostAuthor}
              posts={userProfilePosts}
              currentUserId={getCurrentUser()?._id}
              onBack={() => setShowingUserProfile(false)}
              onOpenPost={(postId) => {
                const post = userProfilePosts.find((p) => p._id === postId);
                if (post) {
                  setViewingPost(post);
                  setViewingCommentId(null);
                }
              }}
            />
          </div>
        )}

        {SanctionModal}
        {ResolveNoteModal}
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminUsers") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="행사공지 관리자" onBack={() => setActiveSection(null)} />
        <div className="no-scrollbar flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            여기서 부여하는 권한은 행사공지 게시판 글쓰기만 가능합니다. 신고 처리·유저 제재·관리자 관리 등 다른 권한은 없습니다.
          </p>
          <div>
            <Input
              label="학번/닉네임으로 검색해서 행사공지 작성 권한 부여"
              value={adminSearchQuery}
              onChange={(e) => searchAdminCandidates(e.target.value)}
              placeholder="학번 또는 닉네임 검색"
            />
            {adminSearchQuery.trim() && (
              <div className="mt-2 flex flex-col gap-2">
                {adminSearchResults.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>검색 결과가 없습니다.</p>
                ) : (
                  adminSearchResults.map((u) => {
                    const already = adminList.some((a) => a._id === u._id);
                    return (
                      <div key={u._id} className="flex items-center gap-3 rounded-[var(--r-md)] p-2.5" style={{ background: "var(--bg-card)" }}>
                        <Avatar src={resolveAssetUrl(u.avatar)} fallbackSrc={defaultAvatar} />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--text-strong)" }}>{u.nickname}</p>
                        <Button variant={already ? "secondary" : "primary"} size={44} onClick={() => setUserAdmin(u, !already)}>
                          {already ? "권한 해제" : "권한 부여"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium" style={{ color: "var(--text-body)" }}>
              현재 행사공지 관리자
            </label>
            <div className="flex flex-col gap-2">
              {adminList.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>행사공지 관리자가 없습니다.</p>
              ) : (
                adminList.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 rounded-[var(--r-md)] p-2.5" style={{ background: "var(--bg-card)" }}>
                    <Avatar src={resolveAssetUrl(u.avatar)} fallbackSrc={defaultAvatar} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: "var(--text-strong)" }}>{u.nickname}</p>
                    <Button variant="secondary" size={44} style={{ color: "var(--danger)" }} onClick={() => setUserAdmin(u, false)}>
                      권한 해제
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "account") {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ScreenHeader title="계정 관리" onBack={() => setActiveSection(null)} />
        <div className="flex flex-col gap-3 px-4 py-4">
          {/* 닉네임 변경 카드 */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>닉네임</span>
              {!editingNickname && (
                <Chip
                  selected
                  onClick={() => {
                    setNicknameInput(nickname);
                    setNicknameChecked(false);
                    setEditingNickname(true);
                  }}
                >
                  변경
                </Chip>
              )}
            </div>

            {!editingNickname ? (
              <span className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{nickname}</span>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => {
                      setNicknameInput(e.target.value);
                      setNicknameChecked(false);
                    }}
                    maxLength={10}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--blue-primary)] focus:bg-[var(--blue-soft)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
                  />
                  <Button size={44} onClick={checkNicknameDuplicate}>
                    중복확인
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size={44}
                    className="flex-1"
                    onClick={async () => {
                      const error = validateNickname(nicknameInput);
                      if (error) {
                        showAlert(error);
                        return;
                      }
                      if (!nicknameChecked) {
                        showAlert("닉네임 중복확인을 먼저 해주세요.");
                        return;
                      }
                      try {
                        const res = await api.patch("/users/profile", { nickname: nicknameInput });
                        setNickname(res.data.nickname);
                        updateStoredUser({ nickname: res.data.nickname });
                        setEditingNickname(false);
                        showAlert("닉네임이 변경되었습니다.");
                      } catch {
                        showAlert("닉네임 변경에 실패했습니다.");
                      }
                    }}
                  >
                    저장
                  </Button>
                  <Button variant="secondary" size={44} className="flex-1" onClick={() => setEditingNickname(false)}>
                    취소
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 담당 교수 변경 카드 */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>담당 교수</span>
              {!editingProfessor && (
                <Chip
                  selected
                  onClick={() => {
                    setProfessorInput(professor);
                    setEditingProfessor(true);
                  }}
                >
                  변경
                </Chip>
              )}
            </div>

            {!editingProfessor ? (
              <span className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{professor || "-"}</span>
            ) : (
              <div className="flex flex-col gap-2">
                <select
                  value={professorInput}
                  onChange={(e) => setProfessorInput(e.target.value)}
                  className="w-full rounded-[var(--r-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--blue-primary)] focus:ring-2 focus:ring-[var(--blue-primary)]/30"
                >
                  {PROFESSORS.map((p) => (
                    <option key={p} value={p}>{p} 교수</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button
                    size={44}
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const res = await api.patch("/users/profile", { professor: professorInput });
                        setProfessor(res.data.professor);
                        updateStoredUser({ professor: res.data.professor });
                        setEditingProfessor(false);
                        showAlert("담당 교수가 변경되었습니다.");
                      } catch {
                        showAlert("담당 교수 변경에 실패했습니다.");
                      }
                    }}
                  >
                    저장
                  </Button>
                  <Button variant="secondary" size={44} className="flex-1" onClick={() => setEditingProfessor(false)}>
                    취소
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 비공개 계정 토글 */}
          <Card className="flex items-center gap-3">
            <Lock size={18} style={{ color: "var(--blue-primary)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>비공개 계정</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                켜면 친구가 아닌 사람에게는 기본 정보만 보이고, 글/북마크/팔로워·팔로잉 목록은 가려집니다.
              </p>
            </div>
            <Switch
              checked={isPrivate}
              aria-label="비공개 계정"
              onChange={async () => {
                const next = !isPrivate;
                setIsPrivate(next);
                try {
                  const res = await api.patch("/users/profile", { isPrivate: next });
                  updateStoredUser({ isPrivate: res.data.isPrivate });
                } catch {
                  setIsPrivate(!next);
                  showAlert("설정 변경에 실패했습니다.");
                }
              }}
            />
          </Card>

          <List className="mt-2">
            <ListItem
              label="비밀번호 변경"
              onPress={() => setActiveSection("password")}
            />
            <ListItem
              label="전화번호 등록/변경"
              onPress={() => setActiveSection("phone")}
            />
            <ListItem
              label="계정 탈퇴"
              danger
              last
              onPress={() => {
                showConfirm("정말로 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.", () => {
                  showConfirm("탈퇴하시면 모든 데이터가 삭제됩니다. 계속하시겠습니까?", async () => {
                    try {
                      await api.delete("/users/account");
                    } catch {
                      showAlert("계정 탈퇴에 실패했습니다.");
                      return;
                    }
                    showAlert("계정이 탈퇴되었습니다.", () => {
                      onLogout();
                    });
                  });
                });
              }}
            />
          </List>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="shrink-0 px-4 pb-2 pt-4">
        <h1 className="text-xl font-extrabold" style={{ color: "var(--text-strong)" }}>설정</h1>
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3">
        {isAdmin && (
          <List title="관리자">
            <ListItem
              icon={<AlertTriangle size={18} style={{ color: "var(--danger)" }} />}
              label="신고/건의 관리"
              onPress={() => setActiveSection("adminReports")}
            />
            <ListItem
              icon={<User size={18} style={{ color: "var(--blue-primary)" }} />}
              label="회원 관리"
              onPress={() => setActiveSection("adminMembers")}
            />
            <ListItem
              icon={<FileText size={18} style={{ color: "var(--blue-primary)" }} />}
              label="게시물/댓글 모니터링"
              onPress={() => setActiveSection("adminMonitoring")}
              last
            />
          </List>
        )}

        <List title="계정">
          <ListItem
            icon={<User size={18} style={{ color: "var(--blue-primary)" }} />}
            label="계정 관리"
            onPress={() => setActiveSection("account")}
            last
          />
        </List>

        <List title="알림 설정">
          <ListItem
            icon={<Bell size={18} style={{ color: "var(--blue-primary)" }} />}
            label="채팅 알림"
            trailing={<Switch checked={notifications.chat} aria-label="채팅 알림" onChange={() => setNotifications((n) => ({ ...n, chat: !n.chat }))} />}
          />
          <ListItem
            icon={<Bell size={18} style={{ color: "var(--blue-primary)" }} />}
            label="커뮤니티 알림"
            trailing={<Switch checked={notifications.community} aria-label="커뮤니티 알림" onChange={() => setNotifications((n) => ({ ...n, community: !n.community }))} />}
            last
          />
        </List>

        <List title="화면">
          <ListItem
            icon={<Moon size={18} style={{ color: "var(--blue-primary)" }} />}
            label="다크 모드"
            trailing={<Switch checked={darkMode} aria-label="다크 모드" onChange={onToggleDark} />}
            last
          />
        </List>

        {!isAdmin && (
          <>
            <List title="고객 지원">
              <ListItem
                icon={<MessageSquare size={18} style={{ color: "var(--blue-primary)" }} />}
                label="건의사항"
                onPress={() => setActiveSection("inquiry")}
              />
              <ListItem
                icon={<BookOpen size={18} style={{ color: "var(--blue-primary)" }} />}
                label="커뮤니티 이용 규칙"
                onPress={() => setActiveSection("guidelines")}
                last
              />
            </List>

            <List title="안전">
              <ListItem
                icon={<AlertTriangle size={18} style={{ color: "var(--danger)" }} />}
                label="신고/건의 내역"
                onPress={() => setActiveSection("reports")}
              />
              <ListItem
                icon={<UserX size={18} style={{ color: "var(--danger)" }} />}
                label="차단 내역"
                onPress={() => setActiveSection("blocked")}
                last
              />
            </List>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2">
        <Button
          variant="secondary"
          size={44}
          fullWidth
          onClick={onLogout}
          style={{ background: "var(--tag-danger-bg)", color: "var(--tag-danger-fg)" }}
        >
          <LogOut size={16} />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
