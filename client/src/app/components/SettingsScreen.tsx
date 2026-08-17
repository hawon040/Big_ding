import { useEffect, useState } from "react";
import { Bell, Moon, User, Shield, ChevronRight, LogOut, AlertTriangle, FileText, Lock, MessageSquare, BookOpen, UserX, Eye, EyeOff, X, Heart, ThumbsDown, MessageCircle, Bookmark, Ban } from "lucide-react";
import api, { resolveAssetUrl } from "@/api";
import defaultAvatar from "@/assets/default-avatar.svg";
import {
  REPORTS_STORAGE_KEY, REPORTS_UPDATED_EVENT, loadReportHistory, removeReportFromHistory, type ReportHistoryItem,
  BLOCKED_STORAGE_KEY, BLOCKED_UPDATED_EVENT, loadBlockedUsers, removeBlockedUser, type BlockedUserItem,
  getDisplayTime, type Post, scopedKey, updateStoredUser, getCurrentUser, BOARDS,
  OtherUserProfile, type PostAuthor,
} from "./CommunityScreen";

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

interface SanctionItem {
  _id: string;
  user: { _id: string; nickname: string; studentId?: string; avatar?: string } | null;
  type: "warning" | "ban" | "commentRestriction";
  reason: string;
  admin: { _id: string; nickname: string } | null;
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
  // + 신고 대상(게시물/댓글) 조회 시, viewingPost 안에서 어떤 댓글이 신고 대상인지 강조하기 위한 id
  const [viewingCommentId, setViewingCommentId] = useState<string | null>(null);
  // + 신고 대상이 사용자(user)일 때 보여줄 모달
  const [viewingUser, setViewingUser] = useState<ReportTargetUser | null>(null);
  // + 신고된 사용자의 프로필로 바로 들어가기
  const [showingUserProfile, setShowingUserProfile] = useState(false);
  const [userProfilePosts, setUserProfilePosts] = useState<Post[]>([]);
  // + 신고된 사용자에게 이 화면에서 바로 제재(경고/차단/댓글제한)를 부여하기
  const [sanctionAction, setSanctionAction] = useState<{ type: "warn" | "ban" | "restrictComments" } | null>(null);
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionBanType, setSanctionBanType] = useState<"temporary" | "permanent">("temporary");
  const [sanctionDays, setSanctionDays] = useState(7);
  const [sanctionSubmitting, setSanctionSubmitting] = useState(false);
  const [adminInquiries, setAdminInquiries] = useState<AdminInquiryItem[]>([]);
  const [adminList, setAdminList] = useState<AdminUserItem[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<AdminUserItem[]>([]);
  const [sanctionTab, setSanctionTab] = useState<"warning" | "ban" | "commentRestriction">("warning");
  const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<MyInquiryItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"reports" | "inquiries">("reports");

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
  useEffect(() => {
    if (activeSection === "adminReports") {
      api.get("/reports").then((res) => setAdminReports(res.data)).catch(() => {});
    } else if (activeSection === "adminInquiries") {
      api.get("/inquiries").then((res) => setAdminInquiries(res.data)).catch(() => {});
    } else if (activeSection === "adminUsers") {
      api.get("/admin/event-admins").then((res) => setAdminList(res.data)).catch(() => {});
      setAdminSearchQuery("");
      setAdminSearchResults([]);
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "sanctions") {
      api.get(`/admin/sanctions?type=${sanctionTab}`).then((res) => setSanctions(res.data)).catch(() => {});
    }
  }, [activeSection, sanctionTab]);

  const liftSanction = (s: SanctionItem) => {
    showConfirm("이 제재를 해제하시겠습니까?", async () => {
      try {
        await api.patch(`/admin/sanctions/${s._id}/lift`);
        setSanctions((prev) => prev.map((x) => (x._id === s._id ? { ...x, active: false } : x)));
      } catch {
        showAlert("해제에 실패했습니다.");
      }
    });
  };

  const toggleReportStatus = async (report: AdminReportItem) => {
    const nextStatus = report.status === "pending" ? "resolved" : "pending";
    try {
      await api.patch(`/reports/${report._id}`, { status: nextStatus });
      setAdminReports((prev) => prev.map((r) => (r._id === report._id ? { ...r, status: nextStatus } : r)));
    } catch {
      showAlert("신고 처리에 실패했습니다.");
    }
  };

  const deleteReportedPost = (report: AdminReportItem) => {
    showConfirm("이 게시물을 삭제하시겠습니까?", async () => {
      try {
        await api.delete(`/posts/${report.targetId}`);
        await api.patch(`/reports/${report._id}`, { status: "resolved" });
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
    const nextStatus = inquiry.status === "pending" ? "resolved" : "pending";
    try {
      await api.patch(`/inquiries/${inquiry._id}`, { status: nextStatus });
      setAdminInquiries((prev) => prev.map((i) => (i._id === inquiry._id ? { ...i, status: nextStatus } : i)));
    } catch {
      showAlert("건의사항 처리에 실패했습니다.");
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
        await api.post(`/admin/users/${viewingUser._id}/warn`, { reason: sanctionReason.trim() });
      } else if (sanctionAction.type === "ban") {
        await api.post(`/admin/users/${viewingUser._id}/ban`, {
          reason: sanctionReason.trim(),
          banType: sanctionBanType,
          days: sanctionBanType === "temporary" ? sanctionDays : undefined,
        });
      } else {
        await api.post(`/admin/users/${viewingUser._id}/restrict-comments`, {
          reason: sanctionReason.trim(),
          days: sanctionDays,
        });
      }
      setSanctionAction(null);
      setSanctionReason("");
      setSanctionBanType("temporary");
      setSanctionDays(7);
      showAlert("제재가 적용되었습니다.");
    } catch (err: any) {
      showAlert(err?.response?.data?.message || "처리에 실패했습니다.");
    } finally {
      setSanctionSubmitting(false);
    }
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
      const res = await fetch("http://localhost:5000/api/auth/check-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameInput }),
      });
      const data = await res.json();
      if (res.ok && data.available) {
        setNicknameChecked(true);
      }
      showAlert(data.message);
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

  const AlertModal = alertMessage && (
    <div className="absolute inset-0 z-[70] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4 text-base font-semibold" style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}>
          알림
          <button onClick={closeAlert} style={{ color: "var(--muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          {alertMessage}
        </div>
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <button className="w-full py-3 text-sm font-medium" style={{ color: "var(--foreground)" }} onClick={closeAlert}>
            확인
          </button>
        </div>
      </div>
    </div>
  );

  const ConfirmModal = confirmState && (
    <div className="absolute inset-0 z-[70] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "var(--background)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4 text-base font-semibold" style={{ background: "var(--muted, #1a1f2e)", color: "var(--foreground)" }}>
          확인
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
          <button className="flex-1 py-3 text-sm font-medium" style={{ color: "var(--foreground)" }} onClick={closeConfirm}>
            취소
          </button>
        </div>
      </div>
    </div>
  );

  if (activeSection === "blocked") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>차단 내역</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {blockedUsers.length === 0 && (
            <p className="text-sm text-center mt-8" style={{ color: "var(--muted-foreground)" }}>
              차단한 사용자가 없습니다.
            </p>
          )}
          {blockedUsers.map((user) => (
            <div key={user.id} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <UserX size={14} style={{ color: "#d4183d" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{user.name}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>사유: {user.reason}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{user.date}</p>
                </div>
                <button
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
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  차단 해제
                </button>
              </div>
            </div>
          ))}
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "password") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>비밀번호 변경</h2>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              현재 비밀번호
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-12"
                style={{ background: "var(--input-background)", color: "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff size={18} style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <Eye size={18} style={{ color: "var(--muted-foreground)" }} />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              새 비밀번호
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
             style={{ background: "var(--input-background)", color: "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              비밀번호 (8~15자의 영문, 숫자 또는 특수문자 조합)
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              새 비밀번호 확인
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              안전한 사용을 위해 8자 이상 입력해주세요!
            </p>
          </div>
          <button
            onClick={() => {
              if (newPassword === confirmPassword) {
                showAlert("비밀번호가 변경되었습니다.", () => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setActiveSection(null);
                });
              } else {
                showAlert("새 비밀번호가 일치하지 않습니다.");
              }
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm mt-2"
            style={{ background: "var(--primary)", color: "white" }}
          >
            변경하기
          </button>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "inquiry") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>건의사항</h2>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              제목
            </label>
            <input
              type="text"
              placeholder="건의사항 제목을 입력하세요"
              value={inquiryTitle}
              onChange={(e) => setInquiryTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white placeholder:text-white/60"
              style={{ background: "var(--input-background)", border: "1.5px solid var(--border)" }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              내용
            </label>
            <textarea
              placeholder="건의사항 내용을 입력하세요"
              value={inquiryContent}
              onChange={(e) => setInquiryContent(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none text-white placeholder:text-white/60 no-scrollbar"
              style={{ background: "var(--input-background)", border: "1.5px solid var(--border)" }}
            />
          </div>

          <button
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
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ background: "var(--primary)", color: "white" }}
          >
            제출하기
          </button>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "guidelines") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>커뮤니티 이용 규칙</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
          <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>가이드 및 규칙</h3>
            <ul className="text-sm space-y-2" style={{ color: "var(--muted-foreground)" }}>
              <li>• 타인을 존중하고 예의 바르게 소통하세요.</li>
              <li>• 욕설, 비방, 차별적 발언은 금지됩니다.</li>
              <li>• 허위 정보나 스팸성 게시물을 작성하지 마세요.</li>
              <li>• 타인의 저작권을 침해하지 마세요.</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>신고 및 제재</h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              규칙을 위반한 게시물이나 사용자를 발견하면 신고 기능을 이용해주세요.
              신고가 접수되면 관리자가 확인 후 적절한 조치를 취합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "reports") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>신고/건의 내역</h2>
        </div>

        {/* 신고 내역 / 건의사항 내역 탭 */}
        <div className="grid grid-cols-2 px-4 gap-2 mt-4 mb-1">
          <button
            onClick={() => setHistoryTab("reports")}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: historyTab === "reports" ? "var(--primary)" : "var(--muted)",
              color: historyTab === "reports" ? "white" : "var(--muted-foreground)",
            }}
          >
            <AlertTriangle size={14} /> 신고 내역 ({reportHistory.length})
          </button>
          <button
            onClick={() => setHistoryTab("inquiries")}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: historyTab === "inquiries" ? "var(--primary)" : "var(--muted)",
              color: historyTab === "inquiries" ? "white" : "var(--muted-foreground)",
            }}
          >
            <MessageSquare size={14} /> 건의사항 내역 ({inquiryHistory.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {historyTab === "reports" ? (
            reportHistory.length === 0 ? (
              <p className="text-sm text-center mt-8" style={{ color: "var(--muted-foreground)" }}>
                신고 내역이 없습니다.
              </p>
            ) : (
              reportHistory.map((r) => (
                <div
                  key={`report-${r.id}`}
                  className="rounded-2xl p-4 shadow-sm cursor-pointer transition-all active:scale-98"
                  style={{ background: "var(--card)" }}
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
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} style={{ color: "var(--primary)" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{r.type}</span>
                      </div>
                      <p className="text-xs font-medium mt-1" style={{ color: "var(--foreground)" }}>
                        "{r.target}"
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{r.date}</p>
                    </div>
                    {r.status === "처리 완료" ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showAlert(r.sanction || "현재 검토 중이며, 아직 확정된 제재 내용이 없습니다.");
                        }}
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: "#5cb85c22", color: "#5cb85c" }}
                      >
                        처리 완료
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm("신고를 취소하시겠습니까?", () => {
                            removeReportFromHistory(r.id);
                          });
                        }}
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: "#3b82f622", color: "var(--primary)" }}
                      >
                        {r.status}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            inquiryHistory.length === 0 ? (
              <p className="text-sm text-center mt-8" style={{ color: "var(--muted-foreground)" }}>
                건의사항 내역이 없습니다.
              </p>
            ) : (
              inquiryHistory.map((item) => (
                <div key={`inquiry-${item._id}`} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={14} style={{ color: "#1e88e5" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.content}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(item.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    {item.status === "resolved" ? (
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
                        style={{ background: "#5cb85c22", color: "#5cb85c" }}
                      >
                        처리 완료
                      </span>
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
                        className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
                        style={{ background: "#3b82f622", color: "var(--primary)" }}
                      >
                        처리 중
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* 신고/건의 내역에서 게시물 클릭 시, 커뮤니티 탭으로 이동하지 않고 이 화면 위에 바로 상세를 띄운다 */}
        {viewingPost && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--background)" }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setViewingPost(null)} className="text-lg" style={{ color: "var(--foreground)" }}>←</button>
              <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>게시물</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
              <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <img src={resolveAssetUrl(viewingPost.author.avatar) || defaultAvatar} alt="프로필 사진" className="w-7 h-7 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{viewingPost.author.nickname}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getDisplayTime(viewingPost)}</p>
                  </div>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{viewingPost.title}</h3>
                <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {viewingPost.content}
                </p>
                {viewingPost.images[0] && (
                  <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 w-full max-h-72 object-cover rounded-xl" />
                )}
              </div>

              <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: "var(--card)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  댓글 {viewingPost.comments.length}개
                </p>
                {viewingPost.comments.map((c) => (
                  <div key={c._id} className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm overflow-hidden" style={{ background: "var(--muted)" }}>
                      <img src={resolveAssetUrl(c.author.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 px-3 py-2 rounded-xl text-xs" style={{ color: "var(--foreground)" }}>
                      <span className="font-semibold">{c.author.nickname} </span>{c.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminReports") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>신고 관리</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {adminReports.length === 0 ? (
            <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
              접수된 신고가 없습니다.
            </p>
          ) : (
            adminReports.map((report) => (
              <div key={report._id} className="rounded-2xl p-4 shadow-sm flex flex-col gap-2" style={{ background: "var(--card)" }}>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: report.status === "pending" ? "#d4183d22" : "var(--muted)",
                      color: report.status === "pending" ? "#d4183d" : "var(--muted-foreground)",
                    }}
                  >
                    {report.status === "pending" ? "미처리" : "처리완료"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(report.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground)" }}>
                  <span className="font-semibold">{report.reporter?.nickname ?? "알 수 없음"}</span>님의 신고
                  {" · "}
                  {report.targetType === "post" ? "게시물" : report.targetType === "comment" ? "댓글" : "사용자"}
                </p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>사유: {report.reason}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>대상 ID: {report.targetId}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <button
                    onClick={() => viewReportTarget(report)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    {report.targetType === "post" ? "게시물 조회" : report.targetType === "comment" ? "댓글 조회" : "유저 조회"}
                  </button>
                  {report.targetType === "post" && (
                    <button
                      onClick={() => deleteReportedPost(report)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "#d4183d", color: "white" }}
                    >
                      게시물 삭제
                    </button>
                  )}
                  <button
                    onClick={() => toggleReportStatus(report)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    {report.status === "pending" ? "처리완료로 표시" : "미처리로 되돌리기"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 신고 대상 게시물/댓글 바로 조회 */}
        {viewingPost && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--background)" }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => { setViewingPost(null); setViewingCommentId(null); }} className="text-lg" style={{ color: "var(--foreground)" }}>←</button>
              <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>
                {viewingCommentId ? "신고된 댓글" : "신고된 게시물"}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
              <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img src={resolveAssetUrl(viewingPost.author?.avatar) || defaultAvatar} alt="프로필 사진" className="w-7 h-7 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{viewingPost.author?.nickname ?? "알 수 없음"}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{getDisplayTime(viewingPost)}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                    {BOARDS.find((b) => b.id === viewingPost.board)?.label ?? viewingPost.board}
                  </span>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{viewingPost.title}</h3>
                <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {viewingPost.content}
                </p>
                {viewingPost.images?.[0] && (
                  <img src={resolveAssetUrl(viewingPost.images[0])} alt="첨부 이미지" className="mt-2 w-full max-h-72 object-cover rounded-xl" />
                )}
                {!!viewingPost.tags?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {viewingPost.tags.map((tag, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--secondary)", color: "var(--primary)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {/* 신고 검토용 참고 지표 — 관리자가 직접 좋아요/싫어요를 누르는 기능은 아니라서 읽기 전용으로만 보여준다 */}
                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-1.5">
                    <Heart size={14} style={{ color: "var(--muted-foreground)" }} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{viewingPost.likes?.length ?? 0}</span>
                  </div>
                  {viewingPost.board === "lecture" && (
                    <div className="flex items-center gap-1.5">
                      <ThumbsDown size={14} style={{ color: "var(--muted-foreground)" }} />
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{viewingPost.dislikes?.length ?? 0}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={14} style={{ color: "var(--muted-foreground)" }} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{viewingPost.comments?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bookmark size={14} style={{ color: "var(--muted-foreground)" }} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{viewingPost.scraps?.length ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: "var(--card)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  댓글 {viewingPost.comments?.length ?? 0}개{viewingCommentId ? " (신고된 댓글은 빨간 테두리로 표시됩니다)" : ""}
                </p>
                {(viewingPost.comments ?? []).map((c) => (
                  <div
                    key={c._id}
                    className="flex gap-2 items-start rounded-xl"
                    style={c._id === viewingCommentId ? { border: "1.5px solid #d4183d", padding: "6px" } : undefined}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm overflow-hidden shrink-0" style={{ background: "var(--muted)" }}>
                      <img src={resolveAssetUrl(c.author?.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 px-3 py-2 rounded-xl text-xs" style={{ color: "var(--foreground)" }}>
                      <span className="font-semibold">{c.author?.nickname ?? "알 수 없음"} </span>{c.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 신고 대상이 유저일 때 바로 조회 */}
        {viewingUser && (
          <div className="absolute inset-0 z-10 flex flex-col" style={{ background: "var(--background)" }}>
            <div className="flex items-center gap-3 px-4 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setViewingUser(null)} className="text-lg" style={{ color: "var(--foreground)" }}>←</button>
              <h2 className="font-semibold text-sm flex-1" style={{ color: "var(--foreground)" }}>신고된 사용자</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
              <div className="rounded-2xl p-4 shadow-sm flex items-center gap-3" style={{ background: "var(--card)" }}>
                <img src={resolveAssetUrl(viewingUser.avatar) || defaultAvatar} alt="프로필 사진" className="w-12 h-12 rounded-full object-cover shrink-0" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{viewingUser.nickname}</p>
                  {viewingUser.studentId && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>학번: {viewingUser.studentId}</p>
                  )}
                  {viewingUser.isAdmin && (
                    <p className="text-xs" style={{ color: "var(--primary)" }}>관리자 계정</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={openUserProfile}
                  className="w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  프로필 보기
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSanctionAction({ type: "warn" })}
                    className="py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    <AlertTriangle size={16} /> 경고
                  </button>
                  <button
                    onClick={() => setSanctionAction({ type: "ban" })}
                    className="py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1"
                    style={{ background: "#d4183d22", color: "#d4183d" }}
                  >
                    <Ban size={16} /> 차단
                  </button>
                  <button
                    onClick={() => setSanctionAction({ type: "restrictComments" })}
                    className="py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    <MessageSquare size={16} /> 댓글 제한
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 신고된 사용자의 프로필 화면 (인스타 스타일 OtherUserProfile 재사용) */}
        {showingUserProfile && viewingUser && (
          <div className="absolute inset-0 z-20 flex flex-col" style={{ background: "var(--background)" }}>
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

        {/* 신고된 사용자에게 이 화면에서 바로 제재 부여 */}
        {sanctionAction && viewingUser && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="w-full rounded-3xl px-4 py-6 flex flex-col gap-3" style={{ background: "var(--background)" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                  {sanctionAction.type === "warn" ? "유저 경고" : sanctionAction.type === "ban" ? "앱 차단" : "댓글 제한"}
                </h3>
                <button onClick={() => setSanctionAction(null)}>
                  <X size={20} style={{ color: "var(--foreground)" }} />
                </button>
              </div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>대상: {viewingUser.nickname}</p>

              {sanctionAction.type === "ban" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSanctionBanType("temporary")}
                    className="py-2.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: sanctionBanType === "temporary" ? "var(--primary)" : "var(--muted)",
                      color: sanctionBanType === "temporary" ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    기간 지정
                  </button>
                  <button
                    onClick={() => setSanctionBanType("permanent")}
                    className="py-2.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: sanctionBanType === "permanent" ? "var(--primary)" : "var(--muted)",
                      color: sanctionBanType === "permanent" ? "white" : "var(--muted-foreground)",
                    }}
                  >
                    영구 정지
                  </button>
                </div>
              )}

              {(sanctionAction.type === "restrictComments" || (sanctionAction.type === "ban" && sanctionBanType === "temporary")) && (
                <div className="flex gap-2 items-center">
                  {[3, 7, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSanctionDays(d)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: sanctionDays === d ? "var(--primary)" : "var(--muted)",
                        color: sanctionDays === d ? "white" : "var(--muted-foreground)",
                      }}
                    >
                      {d}일
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    value={sanctionDays}
                    onChange={(e) => setSanctionDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 px-2 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>일</span>
                </div>
              )}

              <textarea
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="사유를 입력하세요"
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />

              <button
                onClick={submitSanctionAction}
                disabled={!sanctionReason.trim() || sanctionSubmitting}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "#d4183d", color: "white" }}
              >
                {sanctionSubmitting ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        )}

        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminInquiries") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>건의사항 내역</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {adminInquiries.length === 0 ? (
            <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
              접수된 건의사항이 없습니다.
            </p>
          ) : (
            adminInquiries.map((inquiry) => (
              <div key={inquiry._id} className="rounded-2xl p-4 shadow-sm flex flex-col gap-2" style={{ background: "var(--card)" }}>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: inquiry.status === "pending" ? "#d4183d22" : "var(--muted)",
                      color: inquiry.status === "pending" ? "#d4183d" : "var(--muted-foreground)",
                    }}
                  >
                    {inquiry.status === "pending" ? "미처리" : "처리완료"}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(inquiry.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{inquiry.title}</p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{inquiry.content}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  작성자: {inquiry.user?.nickname ?? "알 수 없음"}{inquiry.user?.studentId ? ` (${inquiry.user.studentId})` : ""}
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => toggleInquiryStatus(inquiry)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    {inquiry.status === "pending" ? "처리완료로 표시" : "미처리로 되돌리기"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "adminUsers") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>행사공지 관리자</h2>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            여기서 부여하는 권한은 행사공지 게시판 글쓰기만 가능합니다. 신고 처리·유저 제재·관리자 관리 등 다른 권한은 없습니다.
          </p>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              학번/닉네임으로 검색해서 행사공지 작성 권한 부여
            </label>
            <input
              value={adminSearchQuery}
              onChange={(e) => searchAdminCandidates(e.target.value)}
              placeholder="학번 또는 닉네임 검색"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            />
            {adminSearchQuery.trim() && (
              <div className="flex flex-col gap-2 mt-2">
                {adminSearchResults.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>검색 결과가 없습니다.</p>
                ) : (
                  adminSearchResults.map((u) => {
                    const already = adminList.some((a) => a._id === u._id);
                    return (
                      <div key={u._id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "var(--card)" }}>
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                          <img src={resolveAssetUrl(u.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                        </div>
                        <p className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{u.nickname}</p>
                        <button
                          onClick={() => setUserAdmin(u, !already)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                          style={{ background: already ? "var(--muted)" : "var(--primary)", color: already ? "var(--muted-foreground)" : "white" }}
                        >
                          {already ? "권한 해제" : "권한 부여"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
              현재 행사공지 관리자
            </label>
            <div className="flex flex-col gap-2">
              {adminList.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>행사공지 관리자가 없습니다.</p>
              ) : (
                adminList.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "var(--card)" }}>
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                      <img src={resolveAssetUrl(u.avatar) || defaultAvatar} alt="프로필 사진" className="w-full h-full object-cover" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{u.nickname}</p>
                    <button
                      onClick={() => setUserAdmin(u, false)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                      style={{ background: "var(--muted)", color: "#d4183d" }}
                    >
                      권한 해제
                    </button>
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

  if (activeSection === "sanctions") {
    const SANCTION_TABS: { key: typeof sanctionTab; label: string }[] = [
      { key: "warning", label: "경고" },
      { key: "ban", label: "차단" },
      { key: "commentRestriction", label: "댓글제한" },
    ];
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>제재 관리</h2>
        </div>
        <div className="grid grid-cols-3 px-4 gap-2 mt-4 mb-1">
          {SANCTION_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSanctionTab(t.key)}
              className="py-2.5 rounded-xl text-xs font-semibold"
              style={{
                background: sanctionTab === t.key ? "var(--primary)" : "var(--muted)",
                color: sanctionTab === t.key ? "white" : "var(--muted-foreground)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 no-scrollbar">
          {sanctions.length === 0 ? (
            <p className="text-sm text-center mt-10" style={{ color: "var(--muted-foreground)" }}>
              내역이 없습니다.
            </p>
          ) : (
            sanctions.map((s) => (
              <div key={s._id} className="rounded-2xl p-4 shadow-sm flex flex-col gap-2" style={{ background: "var(--card)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {s.user?.nickname ?? "탈퇴한 사용자"}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: s.active ? "#d4183d22" : "var(--muted)",
                      color: s.active ? "#d4183d" : "var(--muted-foreground)",
                    }}
                  >
                    {s.active
                      ? s.type === "ban" && s.banType === "permanent"
                        ? "영구"
                        : s.expiresAt
                        ? `~${new Date(s.expiresAt).toLocaleDateString("ko-KR")}`
                        : "진행중"
                      : "해제됨"}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground)" }}>사유: {s.reason}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {new Date(s.createdAt).toLocaleString("ko-KR")} · 처리: {s.admin?.nickname ?? "-"}
                </p>
                {s.active && (
                  <button
                    onClick={() => liftSanction(s)}
                    className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--muted)", color: "var(--foreground)" }}
                  >
                    해제
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  if (activeSection === "account") {
    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>계정 관리</h2>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* 닉네임 변경 카드 */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>닉네임</span>
              {!editingNickname && (
                <button
                  onClick={() => {
                    setNicknameInput(nickname);
                    setNicknameChecked(false);
                    setEditingNickname(true);
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "var(--secondary)", color: "var(--primary)" }}
                >
                  변경
                </button>
              )}
            </div>

            {!editingNickname ? (
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{nickname}</span>
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
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                  />
                  <button
                    onClick={checkNicknameDuplicate}
                    className="px-3 py-2 rounded-xl font-semibold text-xs whitespace-nowrap"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    중복확인
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
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
                    className="flex-1 py-2 rounded-xl font-semibold text-xs"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingNickname(false)}
                    className="flex-1 py-2 rounded-xl font-semibold text-xs"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 담당 교수 변경 카드 */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>담당 교수</span>
              {!editingProfessor && (
                <button
                  onClick={() => {
                    setProfessorInput(professor);
                    setEditingProfessor(true);
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "var(--secondary)", color: "var(--primary)" }}
                >
                  변경
                </button>
              )}
            </div>

            {!editingProfessor ? (
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{professor || "-"}</span>
            ) : (
              <div className="flex flex-col gap-2">
                <select
                  value={professorInput}
                  onChange={(e) => setProfessorInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                >
                  {PROFESSORS.map((p) => (
                    <option key={p} value={p}>{p} 교수</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
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
                    className="flex-1 py-2 rounded-xl font-semibold text-xs"
                    style={{ background: "var(--primary)", color: "white" }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingProfessor(false)}
                    className="flex-1 py-2 rounded-xl font-semibold text-xs"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 비공개 계정 토글 */}
          <div className="rounded-2xl p-4 shadow-sm flex items-center gap-3" style={{ background: "var(--card)" }}>
            <Lock size={18} style={{ color: "var(--muted-foreground)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>비공개 계정</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                켜면 친구가 아닌 사람에게는 기본 정보만 보이고, 글/북마크/팔로워·팔로잉 목록은 가려집니다.
              </p>
            </div>
            <button
              onClick={async () => {
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
              className="relative w-12 h-6 rounded-full transition-all duration-300 shrink-0"
              style={{ background: isPrivate ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
                style={{ left: isPrivate ? "calc(100% - 22px)" : "2px" }}
              />
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm mt-2">
            {[
              { label: "비밀번호 변경", danger: false, action: "password" },
              { label: "계정 탈퇴", danger: true, action: "delete" },
            ].map(({ label, danger, action }) => (
              <button
                key={label}
                onClick={() => {
                  if (action === "password") {
                    setActiveSection("password");
                  } else if (action === "delete") {
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
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-4 border-b last:border-b-0 transition-all"
                style={{ background: "var(--card)", borderColor: "var(--border)", color: danger ? "#d4183d" : "var(--foreground)" }}
              >
                <span className="text-sm">{label}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
        {AlertModal}
        {ConfirmModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <h1 className="font-bold text-xl text-white">설정</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-2.5 pb-3 no-scrollbar">
        {isAdmin && (
          <Section title="관리자">
            <SettingRow
              icon={<AlertTriangle size={18} style={{ color: "#d4183d" }} />}
              label="신고 관리"
              onPress={() => setActiveSection("adminReports")}
            />
            <SettingRow
              icon={<MessageSquare size={18} style={{ color: "#5bc0de" }} />}
              label="건의사항 내역"
              onPress={() => setActiveSection("adminInquiries")}
            />
            <SettingRow
              icon={<Shield size={18} style={{ color: "var(--primary)" }} />}
              label="행사공지 관리자"
              onPress={() => setActiveSection("adminUsers")}
            />
            <SettingRow
              icon={<UserX size={18} style={{ color: "#d4183d" }} />}
              label="제재 관리"
              onPress={() => setActiveSection("sanctions")}
              last
            />
          </Section>
        )}

        <Section title="계정">
          <SettingRow
            icon={<User size={18} style={{ color: "var(--primary)" }} />}
            label="계정 관리"
            onPress={() => setActiveSection("account")}
          />
        </Section>

        <Section title="알림 설정">
          <ToggleRow
            icon={<Bell size={18} style={{ color: "#5bc0de" }} />}
            label="채팅 알림"
            value={notifications.chat}
            onChange={() => setNotifications(n => ({ ...n, chat: !n.chat }))}
          />
          <ToggleRow
            icon={<Bell size={18} style={{ color: "#5cb85c" }} />}
            label="커뮤니티 알림"
            value={notifications.community}
            onChange={() => setNotifications(n => ({ ...n, community: !n.community }))}
            last
          />
        </Section>

        <Section title="화면">
          <ToggleRow
            icon={<Moon size={18} style={{ color: "#6f42c1" }} />}
            label="다크 모드"
            value={darkMode}
            onChange={onToggleDark}
            last
          />
        </Section>

        {!isAdmin && (
          <>
            <Section title="고객 지원">
              <SettingRow
                icon={<MessageSquare size={18} style={{ color: "#5bc0de" }} />}
                label="건의사항"
                onPress={() => setActiveSection("inquiry")}
              />
              <SettingRow
                icon={<BookOpen size={18} style={{ color: "#5cb85c" }} />}
                label="커뮤니티 이용 규칙"
                onPress={() => setActiveSection("guidelines")}
                last
              />
            </Section>

            <Section title="안전">
              <SettingRow
                icon={<AlertTriangle size={18} style={{ color: "#d4183d" }} />}
                label="신고/건의 내역"
                onPress={() => setActiveSection("reports")}
              />
              <SettingRow
                icon={<UserX size={18} style={{ color: "#d4183d" }} />}
                label="차단 내역"
                onPress={() => setActiveSection("blocked")}
              />
            </Section>
          </>
        )}
      </div>

      <div className="px-4 pb-4 pt-2 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm shadow-sm transition-all active:scale-98"
          style={{ background: "var(--card)", color: "#d4183d", border: "1.5px solid #d4183d30" }}
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1 px-1 text-white">{title}</p>
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "var(--card)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon, label, onPress, last = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 px-4 py-3 border-b transition-all active:bg-muted"
      style={{ borderColor: last ? "transparent" : "var(--border)" }}
    >
      {icon}
      <span className="flex-1 text-sm text-left text-white">{label}</span>
      <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
    </button>
  );
}

function ToggleRow({
  icon, label, value, onChange, last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: () => void;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: last ? "transparent" : "var(--border)" }}
    >
      {icon}
      <span className="flex-1 text-sm text-white">{label}</span>
      <button
        onClick={onChange}
        className="relative w-12 h-6 rounded-full transition-all duration-300"
        style={{ background: value ? "var(--primary)" : "var(--muted-foreground)" }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
          style={{ left: value ? "calc(100% - 22px)" : "2px" }}
        />
      </button>
    </div>
  );
}