import { useState } from "react";
import { Bell, Moon, User, Shield, ChevronRight, LogOut, AlertTriangle, FileText, Lock, MessageSquare, BookOpen, UserX, Eye, EyeOff } from "lucide-react";

interface SettingsScreenProps {
  darkMode: boolean;
  onToggleDark: () => void;
  onLogout: () => void;
}

const REPORT_HISTORY = [
  { id: 1, type: "스팸/도배", target: "자유게시판 게시글", status: "처리 중", date: "2026.05.28" },
  { id: 2, type: "욕설/비방", target: "선후배 Q&A 게시글", status: "처리 완료", date: "2026.05.10" },
];

const BLOCKED_USERS = [
  { id: 1, name: "차단된유저1", reason: "욕설/비방", date: "2026.05.25" },
  { id: 2, name: "차단된유저2", reason: "스팸", date: "2026.05.15" },
];

export function SettingsScreen({ darkMode, onToggleDark, onLogout }: SettingsScreenProps) {
  const [notifications, setNotifications] = useState({
    chat: true,
    community: true,
    nearby: false,
    marketing: false,
  });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");

  if (activeSection === "blocked") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>차단 내역</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {BLOCKED_USERS.map((user) => (
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
                    if (confirm(`${user.name}님의 차단을 해제하시겠습니까?`)) {
                      alert("차단이 해제되었습니다.");
                    }
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
      </div>
    );
  }

  if (activeSection === "password") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
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
                alert("비밀번호가 변경되었습니다.");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setActiveSection(null);
              } else {
                alert("새 비밀번호가 일치하지 않습니다.");
              }
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm mt-2"
            style={{ background: "var(--primary)", color: "white" }}
          >
            변경하기
          </button>
        </div>
      </div>
    );
  }

  if (activeSection === "inquiry") {
  return (
  <div className="flex flex-col flex-1 overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setActiveSection(null)}>
        <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
      </button>
      <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>문의/건의사항</h2>
    </div>

    <div className="px-4 py-4 flex flex-col gap-4">

      {/* 제목 */}
      <div>
        <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
          제목
        </label>
        <input
          type="text"
          placeholder="문의 제목을 입력하세요"
          value={inquiryTitle}
          onChange={(e) => setInquiryTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white placeholder:text-white/60"
          style={{ background: "var(--input-background)", border: "1.5px solid var(--border)" }}
        />
      </div>

      {/* 내용 */}
      <div>
        <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--muted-foreground)" }}>
          내용
        </label>
        <textarea
          placeholder="문의 내용을 입력하세요"
          value={inquiryContent}
          onChange={(e) => setInquiryContent(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none text-white placeholder:text-white/60"
          style={{ background: "var(--input-background)", border: "1.5px solid var(--border)" }}
        />
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={() => {
          alert("문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.");
          setInquiryTitle("");
          setInquiryContent("");
          setActiveSection(null);
        }}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: "var(--primary)", color: "white" }}
      >
        제출하기
      </button>

    </div>
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>가이드 및 규칙</h3>
            <ul className="text-sm space-y-2" style={{ color: "var(--muted-foreground)" }}>
              <li>• 타인을 존중하고 예의 바르게 소통하세요.</li>
              <li>• 욕설, 비방, 차별적 발언은 금지됩니다.</li>
              <li>• 허위 정보나 스팸성 게시물을 작성하지 마세요.</li>
              <li>• 개인정보 유출에 주의하세요.</li>
              <li>• 타인의 저작권을 침해하지 마세요.</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>신고 및 제재</h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              규칙을 위반한 게시물이나 사용자를 발견하면 신고 기능을 이용해주세요.
              신고가 접수되면 관리자가 확인 후 적절한 조치를 취합니다.
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>개인정보 보호</h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              우리는 사용자의 개인정보를 안전하게 보호합니다.
              자세한 내용은 개인정보 처리방침을 참조해주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "reports") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>신고 내역</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {REPORT_HISTORY.map((r) => (
            <div key={r.id} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} style={{ color: "var(--primary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{r.type}</span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.target}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{r.date}</p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: r.status === "처리 완료" ? "#5cb85c22" : "#3b82f622",
                    color: r.status === "처리 완료" ? "#5cb85c" : "var(--primary)",
                  }}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === "account") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setActiveSection(null)}>
            <ChevronRight size={20} style={{ color: "var(--foreground)", transform: "rotate(180deg)" }} />
          </button>
          <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>계정 관리</h2>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          {[
            { label: "이메일", value: "student@bu.ac.kr" },
            { label: "닉네임", value: "AI빅데이터21" },
            { label: "전공", value: "AI빅데이터전공 27학번" },
            { label: "가입일", value: "2026년 06월 07일" },
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
                    if (confirm("정말로 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                      if (confirm("탈퇴하시면 모든 데이터가 삭제됩니다. 계속하시겠습니까?")) {
                        alert("계정이 탈퇴되었습니다.");
                        onLogout();
                      }
                    }
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
      </div>
    );
  }

  return (
<div className="flex flex-col flex-1 overflow-y-auto">
  <div className="px-4 pt-5 pb-3">
    <h1 className="font-bold text-xl text-white">설정</h1>
  </div>

  <div className="px-4 flex flex-col gap-4 pb-6">
    {/* Account */}
    <Section title="계정">
      <SettingRow
        icon={<User size={18} style={{ color: "var(--primary)" }} />}
        label="계정 관리"
        onPress={() => setActiveSection("account")}
      />
    </Section>

    {/* Notifications */}
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
      />
      <ToggleRow
        icon={<Bell size={18} style={{ color: "#fd7e14" }} />}
        label="근처 친구 알림"
        value={notifications.nearby}
        onChange={() => setNotifications(n => ({ ...n, nearby: !n.nearby }))}
      />
      <ToggleRow
        icon={<Bell size={18} style={{ color: "var(--muted-foreground)" }} />}
        label="마케팅 알림"
        value={notifications.marketing}
        onChange={() => setNotifications(n => ({ ...n, marketing: !n.marketing }))}
        last
      />
    </Section>

    {/* Display */}
    <Section title="화면">
      <ToggleRow
        icon={<Moon size={18} style={{ color: "#6f42c1" }} />}
        label="다크 모드"
        value={darkMode}
        onChange={onToggleDark}
        last
      />
    </Section>

    {/* Support */}
    <Section title="고객 지원">
      <SettingRow
        icon={<MessageSquare size={18} style={{ color: "#5bc0de" }} />}
        label="문의/건의사항"
        onPress={() => setActiveSection("inquiry")}
      />
      <SettingRow
        icon={<BookOpen size={18} style={{ color: "#5cb85c" }} />}
        label="가이드 및 규칙"
        onPress={() => setActiveSection("guidelines")}
        last
      />
    </Section>

    {/* Safety */}
    <Section title="안전">
      <SettingRow
        icon={<AlertTriangle size={18} style={{ color: "#d4183d" }} />}
        label="신고 내역"
        onPress={() => setActiveSection("reports")}
      />
      <SettingRow
        icon={<UserX size={18} style={{ color: "#d4183d" }} />}
        label="차단 내역"
        onPress={() => setActiveSection("blocked")}
      />
    </Section>

    {/* Logout */}
    <button
      onClick={onLogout}
      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm shadow-sm transition-all active:scale-98"
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
      <p className="text-xs font-semibold mb-2 px-1 text-white">{title}</p>
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
      className="w-full flex items-center gap-3 px-4 py-4 border-b transition-all active:bg-muted"
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
      className="flex items-center gap-3 px-4 py-4 border-b"
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
