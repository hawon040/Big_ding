import * as React from "react";
import "@/styles/tokens.css";
import { Bell, Coffee, MessageCircle, Moon, Settings, User, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, type BoardTone, type StatusTone } from "@/components/ui/Badge";
import { TopBar } from "@/components/ui/TopBar";
import { BottomTab } from "@/components/ui/BottomTab";
import { PollCard } from "@/components/ui/PollCard";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { Avatar } from "@/components/ui/Avatar";
import { List, ListItem } from "@/components/ui/List";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { UserRow } from "@/components/ui/UserRow";
import { Dropdown } from "@/components/ui/Dropdown";
import { ImageCarousel } from "@/components/ui/ImageCarousel";
import defaultAvatar from "@/assets/default-avatar.svg";

/**
 * Standalone preview of the new light design language — not wired into the
 * app's router. Open it by pointing Vite at this file directly, or mount it
 * temporarily from main.tsx, while the real screens still run on the old
 * dark tokens.
 */

const TAG_TONES: BoardTone[] = ["free", "event", "qna", "contest", "lecture", "meeting", "alumni"];
const TAG_LABELS: Record<BoardTone, string> = {
  free: "게시판",
  event: "공지사항",
  qna: "작품 전시",
  contest: "꿀팁",
  lecture: "강의평가",
  meeting: "공강모임",
  alumni: "졸업생",
};
const STATUS_TONES: { tone: StatusTone; label: string }[] = [
  { tone: "info", label: "관리자" },
  { tone: "danger", label: "영구차단" },
  { tone: "muted", label: "탈퇴" },
  { tone: "success", label: "처리완료" },
];

const COLOR_SWATCHES: { name: string; varName: string }[] = [
  { name: "bg-base", varName: "--bg-base" },
  { name: "bg-card", varName: "--bg-card" },
  { name: "bg-input", varName: "--bg-input" },
  { name: "blue-soft", varName: "--blue-soft" },
  { name: "blue-primary", varName: "--blue-primary" },
  { name: "blue-primary-2", varName: "--blue-primary-2" },
  { name: "blue-deep", varName: "--blue-deep" },
  { name: "text-strong", varName: "--text-strong" },
  { name: "text-body", varName: "--text-body" },
  { name: "text-muted", varName: "--text-muted" },
  { name: "border-subtle", varName: "--border-subtle" },
  { name: "danger", varName: "--danger" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPreview() {
  const [chipSelected, setChipSelected] = React.useState<"free" | "event">("free");
  const [activeTab, setActiveTab] = React.useState("community");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [chatAlerts, setChatAlerts] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState("latest");
  const [pick1, setPick1] = React.useState(true);
  const [pick2, setPick2] = React.useState(false);

  return (
    <div className="min-h-screen pb-16" style={{ background: "var(--bg-base)" }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
        <header>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-strong)" }}>
            Design Preview
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            새 라이트 디자인 언어 기반 컴포넌트 모음 — client/src/components/ui
          </p>
        </header>

        <Section title="Colors">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLOR_SWATCHES.map((c) => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div
                  className="h-14 rounded-[var(--r-md)] border"
                  style={{ background: `var(${c.varName})`, borderColor: "var(--border-subtle)" }}
                />
                <span className="text-xs font-mono" style={{ color: "var(--text-body)" }}>
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius & Shadow">
          <div className="flex flex-wrap gap-4">
            {[
              ["r-sm", "10px"],
              ["r-md", "12px"],
              ["r-lg", "16px"],
              ["r-pill", "999px"],
            ].map(([name, value]) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div
                  className="h-14 w-14 border"
                  style={{ borderRadius: `var(--${name})`, borderColor: "var(--blue-primary)", background: "var(--blue-soft)" }}
                />
                <span className="text-xs font-mono" style={{ color: "var(--text-body)" }}>
                  {name} ({value})
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-14 w-14 rounded-[var(--r-md)]" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }} />
              <span className="text-xs font-mono" style={{ color: "var(--text-body)" }}>
                shadow-card
              </span>
            </div>
          </div>
        </Section>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary 44</Button>
            <Button variant="primary" size={52}>
              Primary 52
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" loading={loading} onClick={() => setLoading((v) => !v)}>
              {loading ? "Loading" : "Toggle loading"}
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section title="Input">
          <div className="grid max-w-md gap-4">
            <Input label="학번" placeholder="EX): 20210001" />
            <Input label="비밀번호" type="password" error="비밀번호가 일치하지 않습니다." />
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-sm">
            <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
              카드 제목
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              bg-card + border-subtle + r-lg + shadow-card 조합의 기본 패널입니다.
            </p>
          </Card>
        </Section>

        <Section title="Chip">
          <div className="flex flex-wrap gap-2">
            <Chip selected={chipSelected === "free"} onClick={() => setChipSelected("free")}>
              게시만
            </Chip>
            <Chip selected={chipSelected === "event"} onClick={() => setChipSelected("event")}>
              행사공지
            </Chip>
          </div>
        </Section>

        <Section title="IconButton">
          <div className="flex items-center gap-3">
            <IconButton aria-label="검색">
              <Users size={18} />
            </IconButton>
            <IconButton aria-label="활성 상태" active>
              <Users size={18} />
            </IconButton>
          </div>
        </Section>

        <Section title="Badge">
          <div className="flex flex-wrap gap-2">
            {TAG_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {TAG_LABELS[tone]}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TONES.map(({ tone, label }) => (
              <Badge key={tone} tone={tone}>
                {label}
              </Badge>
            ))}
          </div>
        </Section>

        <Section title="Switch">
          <div className="flex items-center gap-4">
            <Switch checked={chatAlerts} onChange={() => setChatAlerts((v) => !v)} aria-label="채팅 알림" />
            <Switch checked={darkMode} onChange={() => setDarkMode((v) => !v)} aria-label="다크 모드" />
            <Switch checked={false} onChange={() => {}} disabled aria-label="비활성 예시" />
          </div>
        </Section>

        <Section title="Avatar">
          <div className="flex items-center gap-3">
            <Avatar src={null} fallbackSrc={defaultAvatar} size="sm" />
            <Avatar src={null} fallbackSrc={defaultAvatar} size="md" />
            <Avatar src={null} fallbackSrc={defaultAvatar} size="lg" />
          </div>
        </Section>

        <Section title="List / ListItem">
          <div className="max-w-sm">
            <List title="계정">
              <ListItem icon={<User size={18} style={{ color: "var(--blue-primary)" }} />} label="계정 관리" onPress={() => {}} />
            </List>
          </div>
          <div className="max-w-sm">
            <List title="알림 설정">
              <ListItem
                icon={<Bell size={18} style={{ color: "var(--blue-primary)" }} />}
                label="채팅 알림"
                trailing={<Switch checked={chatAlerts} onChange={() => setChatAlerts((v) => !v)} aria-label="채팅 알림" />}
              />
              <ListItem
                icon={<Moon size={18} style={{ color: "var(--blue-primary)" }} />}
                label="다크 모드"
                trailing={<Switch checked={darkMode} onChange={() => setDarkMode((v) => !v)} aria-label="다크 모드" />}
                last
              />
            </List>
          </div>
        </Section>

        <Section title="TopBar">
          <div className="max-w-sm overflow-hidden rounded-[var(--r-lg)]" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}>
            <TopBar hasNotification />
          </div>
        </Section>

        <Section title="BottomTab">
          <div className="max-w-sm overflow-hidden rounded-[var(--r-lg)]" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}>
            <BottomTab
              activeId={activeTab}
              onChange={setActiveTab}
              onWriteClick={() => setModalOpen(true)}
              leftItems={[
                { id: "community", label: "커뮤니티", icon: Users },
                { id: "chat", label: "채팅", icon: MessageCircle },
              ]}
              rightItems={[
                { id: "lunch", label: "점심", icon: Coffee },
                { id: "profile", label: "프로필", icon: User },
              ]}
            />
          </div>
        </Section>

        <Section title="PollCard">
          <PollCard
            title="다음 특강 언제가 좋아요?"
            options={[
              { label: "이번주 금요일", percent: 72 },
              { label: "다음주 월요일", percent: 28 },
            ]}
            participantCount={18}
          />
        </Section>

        <Section title="Modal">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              알림 모달
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              확인 모달
            </Button>
          </div>
          <Modal open={modalOpen} title="알림" onClose={() => setModalOpen(false)}>
            글쓰기 버튼을 눌러 새 게시물을 작성할 수 있습니다.
          </Modal>
          <Modal
            open={confirmOpen}
            title="확인"
            onClose={() => setConfirmOpen(false)}
            cancelText="취소"
            onCancel={() => setConfirmOpen(false)}
            confirmText="탈퇴"
            onConfirm={() => setConfirmOpen(false)}
          >
            정말로 계정을 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Modal>
        </Section>

        <Section title="ScreenHeader">
          <div className="max-w-sm overflow-hidden rounded-[var(--r-lg)]" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}>
            <ScreenHeader title="게시물 수정" onBack={() => {}} action={<span style={{ color: "var(--blue-deep)", fontWeight: 600, fontSize: 14 }}>완료</span>} />
          </div>
        </Section>

        <Section title="UserRow">
          <div className="flex max-w-sm flex-col gap-2">
            <UserRow avatarSrc={null} fallbackSrc={defaultAvatar} name="김민수" secondaryText="20210001" trailing={<Button size={44} className="h-8 px-3">팔로우</Button>} />
            <UserRow avatarSrc={null} fallbackSrc={defaultAvatar} name="이서연" selectable selected={pick1} onPress={() => setPick1((v) => !v)} />
            <UserRow avatarSrc={null} fallbackSrc={defaultAvatar} name="박지훈" selectable selected={pick2} onPress={() => setPick2((v) => !v)} />
          </div>
        </Section>

        <Section title="Dropdown">
          <Dropdown
            value={sortOrder}
            onChange={setSortOrder}
            options={[
              { value: "latest", label: "최신순" },
              { value: "popular", label: "인기순" },
            ]}
          />
        </Section>

        <Section title="ImageCarousel">
          <div className="w-40">
            <ImageCarousel
              aspect="square"
              images={[
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%233B82F6'/></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%234ADE80'/></svg>",
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23F472B6'/></svg>",
              ]}
            />
          </div>
        </Section>

        <Section title="Settings (미리보기용)">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <Settings size={16} />
            이 페이지는 기존 화면 라우팅에 연결되어 있지 않습니다.
          </div>
        </Section>
      </div>
    </div>
  );
}
