import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Users } from "lucide-react";
import { chatApi, fromDirect, type ChatTarget, type ChatUser, type GroupChat, type ChatMessage } from "@/api/chat";
import { Avatar } from "@/aplan/components/Avatar";
import { Badge, IconButton } from "@/aplan/components/IconButton";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { useChatSocket } from "@/aplan/hooks/useChatSocket";
import { formatTime } from "@/utils";
import "@/styles/aplan-tokens.css";

const REFRESH_MS = 5000;

interface ChatListScreenProps {
  myId: string;
  onBack: () => void;
  onOpenRoom: (target: ChatTarget) => void;
  onCreateGroup: () => void;
}

interface Row {
  key: string;
  target: ChatTarget;
  title: string;
  avatar?: string;
  /** 단체방이면 인원수 */
  memberCount?: number;
  preview: string;
  at: number;
  unread: number;
}

const previewText = (m: { content: string; image?: string } | null | undefined) =>
  !m ? "" : m.image && !m.content ? "사진을 보냈습니다" : m.content;

// 채팅 목록 (Figma에 없는 화면 — A안 톤으로 구성). 1:1 대화(이력 있는 상대)와 단체 채팅방을
// 마지막 메시지 시각 순으로 한 목록에 보여준다. 실시간 이벤트 + 5초 간격으로 새로 불러온다.
export function ChatListScreen({ myId, onBack, onOpenRoom, onCreateGroup }: ChatListScreenProps) {
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [direct, setDirect] = useState<Record<string, ChatMessage[]>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const [conv, hid, grp] = await Promise.all([chatApi.conversations(), chatApi.hiddenFriendIds(), chatApi.groups()]);
      setPeople(conv);
      setHidden(hid);
      setGroups(grp);
      setStatus("ready");
      // 1:1 미리보기·안 읽은 수: 읽음 처리하지 않는 preview 조회로 상대별 대화를 받아온다.
      const entries = await Promise.all(
        conv.map((u) =>
          chatApi
            .directMessages(u._id, { preview: true })
            .then((msgs) => [u._id, msgs.map((m) => fromDirect(m, myId))] as const)
            .catch(() => [u._id, [] as ChatMessage[]] as const),
        ),
      );
      setDirect(Object.fromEntries(entries));
    } catch {
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, [myId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useChatSocket({
    receive_message: load,
    receive_group_message: load,
    group_chat_created: load,
    group_chat_updated: load,
    group_chat_deleted: load,
    chat_left: load,
  });

  const rows = useMemo<Row[]>(() => {
    const directRows: Row[] = people
      .filter((u) => !hidden.includes(u._id))
      .map((u) => {
        const msgs = direct[u._id] ?? [];
        const last = msgs[msgs.length - 1];
        return {
          key: `d:${u._id}`,
          target: { kind: "direct", user: u },
          title: u.nickname,
          avatar: u.avatar,
          preview: previewText(last),
          at: last ? new Date(last.createdAt).getTime() : 0,
          unread: msgs.filter((m) => !m.mine && !m.read).length,
        };
      });
    const groupRows: Row[] = groups.map((g) => {
      const last = g.lastMessage;
      return {
        key: `g:${g._id}`,
        target: { kind: "group", chat: g },
        title: g.name || g.members.filter((m) => m._id !== myId).map((m) => m.nickname).join(", ") || "단체 채팅",
        avatar: g.avatar,
        memberCount: g.members.length,
        preview: previewText(last),
        at: last ? new Date(last.createdAt).getTime() : 0,
        unread: 0,
      };
    });
    return [...directRows, ...groupRows].sort((a, b) => b.at - a.at);
  }, [people, hidden, groups, direct, myId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>메시지</h1>
        <IconButton icon={Users} label="단체 채팅 만들기" onClick={onCreateGroup} />
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[20px]">
        {status === "loading" && <ListSkeleton />}
        {status === "error" && <ErrorState onRetry={() => { setStatus("loading"); load(); }} />}
        {status === "ready" && rows.length === 0 && (
          <EmptyState
            title="아직 대화가 없어요"
            description="프로필에서 메시지를 보내거나 단체 채팅을 만들어 보세요."
            action={{ label: "단체 채팅 만들기", onClick: onCreateGroup }}
          />
        )}
        {status === "ready" && rows.map((row) => <ChatRow key={row.key} row={row} onOpen={() => onOpenRoom(row.target)} />)}
      </main>
    </div>
  );
}

function ChatRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full shrink-0 items-center gap-[12px] border-0 bg-transparent py-[12px] px-0 text-left">
      <span className="relative shrink-0">
        <Avatar src={row.avatar} size={48} />
        {row.unread > 0 && <Badge count={row.unread} />}
      </span>
      <span className="flex min-w-px flex-1 flex-col items-start gap-[3px]">
        <span className="flex w-full items-center gap-[6px]">
          <span className="line-clamp-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{row.title}</span>
          {row.memberCount !== undefined && (
            <span className="shrink-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{row.memberCount}</span>
          )}
          {row.at > 0 && (
            <span className="ml-auto shrink-0 text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>
              {formatTime(new Date(row.at).toISOString())}
            </span>
          )}
        </span>
        <span
          className={`line-clamp-1 w-full text-[13px] leading-[16px] ${row.unread > 0 ? "font-[500]" : "font-normal"}`}
          style={{ color: row.unread > 0 ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)" }}
        >
          {row.preview || "대화를 시작해 보세요"}
        </span>
      </span>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col" role="status" aria-label="불러오는 중">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-[12px] py-[12px]">
          <Skeleton className="size-[48px]" style={{ borderRadius: "50%" }} />
          <div className="flex flex-1 flex-col gap-[6px]">
            <Skeleton className="h-[14px] w-[100px]" />
            <Skeleton className="h-[12px] w-[70%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
