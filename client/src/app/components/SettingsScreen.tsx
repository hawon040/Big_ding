import { useEffect, useState } from "react";
import { Bell, Moon, User, Shield, ChevronRight, LogOut, AlertTriangle, FileText, Lock, MessageSquare, BookOpen, UserX, Eye, EyeOff, X } from "lucide-react";
import {
  REPORTS_STORAGE_KEY, REPORTS_UPDATED_EVENT, loadReportHistory, removeReportFromHistory, type ReportHistoryItem,
  BLOCKED_STORAGE_KEY, BLOCKED_UPDATED_EVENT, loadBlockedUsers, removeBlockedUser, type BlockedUserItem,
  POSTS, loadStoredInteractions, getDummyComments, type Post, scopedKey,
} from "./CommunityScreen";

interface SettingsScreenProps {
  darkMode: boolean;
  onToggleDark: () => void;
  onLogout: () => void;
  nickname: string;
  setNickname: (name: string) => void;
}

const INQUIRY_STORAGE_KEY = "bigding_inquiry_history_v1";
const INQUIRY_UPDATED_EVENT = "bigding-inquiry-added";

interface InquiryHistoryItem {
  id: number;
  title: string;
  content: string;
  date: string;
}

const loadInquiryHistory = (): InquiryHistoryItem[] => {
  try {
    const raw = localStorage.getItem(scopedKey(INQUIRY_STORAGE_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("건의사항 내역을 불러오지 못했습니다.", err);
    return [];
  }
};

const addInquiryToHistory = (inquiry: InquiryHistoryItem) => {
  try {
    const updated = [inquiry, ...loadInquiryHistory()];
    localStorage.setItem(scopedKey(INQUIRY_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(INQUIRY_UPDATED_EVENT, { detail: updated }));
  } catch (err) {
    console.error("건의사항을 저장하지 못했습니다.", err);
  }
};

const removeInquiryFromHistory = (id: number) => {
  try {
    const updated = loadInquiryHistory().filter((i) => i.id !== id);
    localStorage.setItem(scopedKey(INQUIRY_STORAGE_KEY), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(INQUIRY_UPDATED_EVENT, { detail: updated }));
  } catch (err) {
    console.error("건의사항을 삭제하지 못했습니다.", err);
  }
};

const formatToday = () => {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
};

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
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<InquiryHistoryItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"reports" | "inquiries">("reports");

  useEffect(() => {
    setReportHistory(loadReportHistory());
    setInquiryHistory(loadInquiryHistory());
    setBlockedUsers(loadBlockedUsers());

    const handleReportsUpdated = (e: Event) => {
      const detail = (e as CustomEvent<ReportHistoryItem[]>).detail;
      setReportHistory(detail ?? loadReportHistory());
    };
    const handleInquiryUpdated = (e: Event) => {
      const detail = (e as CustomEvent<InquiryHistoryItem[]>).detail;
      setInquiryHistory(detail ?? loadInquiryHistory());
    };
    const handleBlockedUpdated = (e: Event) => {
      const detail = (e as CustomEvent<BlockedUserItem[]>).detail;
      setBlockedUsers(detail ?? loadBlockedUsers());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === scopedKey(REPORTS_STORAGE_KEY)) setReportHistory(loadReportHistory());
      if (e.key === scopedKey(INQUIRY_STORAGE_KEY)) setInquiryHistory(loadInquiryHistory());
      if (e.key === scopedKey(BLOCKED_STORAGE_KEY)) setBlockedUsers(loadBlockedUsers());
    };

    window.addEventListener(REPORTS_UPDATED_EVENT, handleReportsUpdated);
    window.addEventListener(INQUIRY_UPDATED_EVENT, handleInquiryUpdated);
    window.addEventListener(BLOCKED_UPDATED_EVENT, handleBlockedUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(REPORTS_UPDATED_EVENT, handleReportsUpdated);
      window.removeEventListener(INQUIRY_UPDATED_EVENT, handleInquiryUpdated);
      window.removeEventListener(BLOCKED_UPDATED_EVENT, handleBlockedUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // 신고/건의 내역 화면에 들어갈 때마다 localStorage에서 최신 값을 다시 읽어와
  // 이벤트를 놓쳤더라도 방금 등록한 내역이 항상 반영되도록 한다.
  useEffect(() => {
    if (activeSection === "reports") {
      setReportHistory(loadReportHistory());
      setInquiryHistory(loadInquiryHistory());
    }
  }, [activeSection]);

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
                    showConfirm(`${user.name}님의 차단을 해제하시겠습니까?`, () => {
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
                style={{ background: "var(--input-background)", color: "black", border: "1.5px solid var(--border)" }}
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
              style={{ background: "var(--input-background)", color: "black", border: "1.5px solid var(--border)" }}
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
              style={{ background: "var(--input-background)", color: "black", border: "1.5px solid var(--border)" }}
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
            onClick={() => {
              if (!inquiryTitle.trim() || !inquiryContent.trim()) {
                showAlert("제목과 내용을 입력해주세요.");
                return;
              }
              addInquiryToHistory({
                id: Date.now(),
                title: inquiryTitle,
                content: inquiryContent,
                date: formatToday(),
              });
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
                  onClick={() => {
                    const interactions = loadStoredInteractions();
                    const allPosts = [...interactions.createdPosts, ...Object.values(POSTS).flat()].filter(
                      (p) => !interactions.deletedPostIds.includes(p.id)
                    );
                    const post = allPosts.find((p) => p.id === r.postId);
                    if (post) {
                      setViewingPost(post);
                    } else {
                      showAlert("게시물을 찾을 수 없습니다. 삭제되었을 수 있습니다.");
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
                <div key={`inquiry-${item.id}`} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={14} style={{ color: "#1e88e5" }} />
                        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          {item.title}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.content}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{item.date}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showConfirm("건의사항을 취소하시겠습니까?", () => {
                          removeInquiryFromHistory(item.id);
                        });
                      }}
                      className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
                      style={{ background: "#3b82f622", color: "var(--primary)" }}
                    >
                      처리 중
                    </button>
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
                  <span className="text-xl">{viewingPost.avatar}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{viewingPost.author}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{viewingPost.time}</p>
                  </div>
                </div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{viewingPost.title}</h3>
                {viewingPost.image && (
                  <img src={viewingPost.image} alt="첨부 이미지" className="mt-2 w-full max-h-72 object-cover rounded-xl" />
                )}
                <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {viewingPost.content}
                </p>
              </div>

              <div className="rounded-2xl p-4 shadow-sm flex flex-col gap-3" style={{ background: "var(--card)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  댓글 {getDummyComments(viewingPost).length + (loadStoredInteractions().extraComments[viewingPost.id]?.length || 0)}개
                </p>
                {getDummyComments(viewingPost).map((c, i) => (
                  <div key={`dummy-${i}`} className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: "var(--muted)" }}>
                      {c.emoji}
                    </div>
                    <div className="flex-1 px-3 py-2 rounded-xl text-xs" style={{ color: "var(--foreground)" }}>
                      <span className="font-semibold">{c.user} </span>{c.text}
                    </div>
                  </div>
                ))}
                {(loadStoredInteractions().extraComments[viewingPost.id] || []).map((c, i) => (
                  <div key={`extra-${i}`} className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: "var(--muted)" }}>
                      {c.emoji}
                    </div>
                    <div className="flex-1 px-3 py-2 rounded-xl text-xs" style={{ color: "var(--foreground)" }}>
                      <span className="font-semibold">{c.user} </span>{c.text}
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
          {[
            { label: "닉네임", value: "AI빅데이터21" },
            { label: "전공", value: "AI빅데이터전공 27학번" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl p-4 flex items-center justify-between shadow-sm"
              style={{ background: "var(--card)" }}>
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{value}</span>
            </div>
          ))}
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
                      showConfirm("탈퇴하시면 모든 데이터가 삭제됩니다. 계속하시겠습니까?", () => {
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
    <div className="flex flex-col flex-1">
      <div className="px-4 pt-3 pb-2">
        <h1 className="font-bold text-xl text-white">설정</h1>
      </div>

      <div className="px-4 flex flex-col gap-2.5 pb-3">
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