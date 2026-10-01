import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ChevronLeft, Heart, ImagePlus, MoreVertical, Send } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import {
  chatApi, fromDirect, fromGroup, type ChatMessage, type ChatTarget, type GroupChat, type RawGroupMessage,
} from "@/api/chat";
import { Avatar } from "@/aplan/components/Avatar";
import { IconButton } from "@/aplan/components/IconButton";
import { BottomSheet, SheetItem } from "@/aplan/components/BottomSheet";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { TextField } from "@/aplan/components/TextField";
import { ErrorState } from "@/aplan/components/States";
import { useChatSocket } from "@/aplan/hooks/useChatSocket";
import "@/styles/aplan-tokens.css";

const REFRESH_MS = 5000;
const DIVIDER_GAP_MS = 60 * 60 * 1000;
const STICK_THRESHOLD_PX = 80;
const HEART = "❤️";

interface ChatRoomScreenProps {
  myId: string;
  target: ChatTarget;
  onBack: () => void;
  onOpenUser: (id: string) => void;
  /** 단체방 설정 > 친구 초대 */
  onInvite: (chat: GroupChat) => void;
}

type Sheet = null | "menu" | "photos" | "members" | "rename";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// 시간 구분선: "오늘 오후 2:14" / "어제 오후 2:14" / "7월 5일 오후 2:14"
const dividerLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  if (sameDay(d, now)) return `오늘 ${time}`;
  if (sameDay(d, yesterday)) return `어제 ${time}`;
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`;
};

const clockLabel = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

// 대화방 (Figma에 없는 화면 — A안 톤으로 구성). 1:1과 단체 채팅이 같은 화면을 쓰고 target으로 갈린다.
// 메시지: 탭하면 시간 표시, 더블 탭하면 하트, 입력칸이 비어 있으면 하트 버튼으로 ❤️를 바로 보낸다.
export function ChatRoomScreen({ myId, target, onBack, onOpenUser, onInvite }: ChatRoomScreenProps) {
  const isGroup = target.kind === "group";
  const [chat, setChat] = useState<GroupChat | null>(target.kind === "group" ? target.chat : null);
  const peer = target.kind === "direct" ? target.user : null;
  const roomId = target.kind === "direct" ? target.user._id : target.chat._id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [theyLeft, setTheyLeft] = useState(false);
  const [gone, setGone] = useState(false); // 방장이 단체방을 삭제함
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [photos, setPhotos] = useState<{ image: string; createdAt: string }[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [unseen, setUnseen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prevLastIdRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    // 먼저 보낸 요청의 응답이 나중에 도착해 새 메시지를 덮어쓰지 않도록 가장 최근 요청만 반영한다.
    const id = ++requestRef.current;
    try {
      if (target.kind === "direct") {
        const [raw, state] = await Promise.all([chatApi.directMessages(roomId), chatApi.directState(roomId)]);
        if (id !== requestRef.current) return;
        setMessages(raw.map((m) => fromDirect(m, myId)));
        setTheyLeft(state.theyLeft);
      } else {
        const raw = await chatApi.groupMessages(roomId);
        if (id !== requestRef.current) return;
        setMessages(raw.map((m) => fromGroup(m, myId)));
      }
      setStatus("ready");
    } catch (err: any) {
      if (id !== requestRef.current) return;
      setError(err?.response?.data?.message || null);
      setStatus((s) => (s === "ready" ? s : "error"));
    }
    // target 객체는 매번 새로 생길 수 있어 방 id·종류만 의존성으로 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, target.kind, myId]);

  useEffect(() => {
    setStatus("loading");
    setMessages([]);
    atBottomRef.current = true;
    prevLastIdRef.current = null;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const patchLiked = (id: string, liked: boolean) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, liked } : m)));

  useChatSocket({
    receive_message: (msg: { from?: { _id?: string } }) => {
      if (target.kind === "direct" && msg?.from?._id === roomId) load();
    },
    message_liked: (msg: { _id: string; liked?: boolean }) => target.kind === "direct" && patchLiked(msg._id, !!msg.liked),
    chat_left: ({ friendId }: { friendId: string }) => {
      if (target.kind === "direct" && friendId === roomId) setTheyLeft(true);
    },
    receive_group_message: (msg: RawGroupMessage) => {
      if (target.kind !== "group" || msg.groupChat !== roomId) return;
      const next = fromGroup(msg, myId);
      setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]));
    },
    group_message_liked: (msg: { _id: string; groupChat: string; liked?: boolean }) => {
      if (target.kind === "group" && msg.groupChat === roomId) patchLiked(msg._id, !!msg.liked);
    },
    group_chat_updated: (next: GroupChat) => {
      if (target.kind === "group" && next._id === roomId) setChat((prev) => (prev ? { ...prev, ...next } : next));
    },
    group_chat_deleted: ({ _id }: { _id: string }) => {
      if (target.kind === "group" && _id === roomId) setGone(true);
    },
  });

  // 스크롤: 새 메시지가 오면 맨 아래를 보고 있었을 때만 따라 내려가고, 위를 보던 중이면 "새 메시지" 버튼만 띄운다.
  const scrollToBottom = (smooth: boolean) => {
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const first = prevLastIdRef.current === null;
    const changed = last.id !== prevLastIdRef.current;
    prevLastIdRef.current = last.id;
    if (first) scrollToBottom(false);
    else if (changed) {
      if (atBottomRef.current || last.mine) scrollToBottom(true);
      else setUnseen(true);
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    if (atBottomRef.current) setUnseen(false);
  };

  const append = (msg: ChatMessage) => setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));

  const send = async (content: string, image?: File) => {
    if (sending || (!content && !image)) return;
    setSending(true);
    setSendError(null);
    try {
      if (target.kind === "direct") append(fromDirect(await chatApi.sendDirect(roomId, content, image), myId));
      else append(fromGroup(await chatApi.sendGroup(roomId, content, image), myId));
      return true;
    } catch (err: any) {
      setSendError(err?.response?.data?.message || "메시지를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text) {
      send(HEART);
      return;
    }
    setInput("");
    if (!(await send(text))) setInput(text);
  };

  const toggleLike = (m: ChatMessage) => {
    if (m.system) return;
    patchLiked(m.id, !m.liked);
    (isGroup ? chatApi.likeGroup(m.id) : chatApi.likeDirect(m.id)).catch(() => patchLiked(m.id, m.liked));
  };

  const openPhotos = () => {
    setSheet("photos");
    setPhotos(null);
    (isGroup ? chatApi.groupPhotos(roomId) : chatApi.directPhotos(roomId)).then(setPhotos).catch(() => setPhotos([]));
  };

  const run = async (job: () => Promise<unknown>, fallback: string) => {
    try {
      await job();
      return true;
    } catch (err: any) {
      window.alert(err?.response?.data?.message || fallback);
      return false;
    }
  };

  const leave = async () => {
    setSheet(null);
    if (!window.confirm(isGroup ? "채팅방을 나갈까요? 나가면 대화 내용을 다시 볼 수 없어요." : "이 대화를 삭제할까요? 상대에게는 \"나갔습니다\"가 표시돼요.")) return;
    if (await run(() => (isGroup ? chatApi.leaveGroup(roomId) : chatApi.leaveDirect(roomId)), "나가지 못했어요.")) onBack();
  };

  const deleteRoom = async () => {
    setSheet(null);
    if (!window.confirm("채팅방을 삭제할까요? 모든 멤버의 대화 내용이 사라져요.")) return;
    if (await run(() => chatApi.deleteGroup(roomId), "삭제하지 못했어요.")) onBack();
  };

  const rename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    if (await run(async () => setChat(await chatApi.renameGroup(roomId, name)), "이름을 바꾸지 못했어요.")) setSheet(null);
  };

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return;
    setSheet(null);
    await run(async () => setChat(await chatApi.setGroupAvatar(roomId, file)), "사진을 바꾸지 못했어요.");
  };

  const members = chat?.members ?? [];
  const isHost = !!chat && chat.host._id === myId;
  const title = peer
    ? peer.nickname
    : chat?.name || members.filter((m) => m._id !== myId).map((m) => m.nickname).join(", ") || "단체 채팅";
  const blocked = (!isGroup && theyLeft) || gone;
  const lastMineId = [...messages].reverse().find((m) => m.mine)?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <button
          type="button"
          onClick={() => (peer ? onOpenUser(peer._id) : setSheet("members"))}
          className="flex min-w-px flex-1 items-center gap-[10px] border-0 bg-transparent p-0 text-left"
        >
          <Avatar src={peer ? peer.avatar : chat?.avatar} size={32} />
          <span className="line-clamp-1 text-[16px] leading-[19px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{title}</span>
          {isGroup && <span className="shrink-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{members.length}</span>}
        </button>
        <IconButton icon={MoreVertical} label="채팅 설정" onClick={() => setSheet("menu")} />
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[20px] pb-[8px]">
          {status === "loading" && <p role="status" className="m-0 py-[32px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>불러오는 중…</p>}
          {status === "error" && <ErrorState message={error ?? undefined} onRetry={() => { setStatus("loading"); load(); }} />}
          {status === "ready" && messages.length === 0 && (
            <p className="m-0 py-[32px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>첫 메시지를 보내 보세요.</p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const showDivider = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > DIVIDER_GAP_MS || !sameDay(new Date(m.createdAt), new Date(prev.createdAt));
            const sameSender = (o?: ChatMessage) => !!o && !o.system && !m.system && o.mine === m.mine && o.sender?._id === m.sender?._id;
            const clusterStart = showDivider || !sameSender(prev);
            const clusterEnd = !sameSender(next) || new Date(next!.createdAt).getTime() - new Date(m.createdAt).getTime() > DIVIDER_GAP_MS;
            return (
              <div key={m.id} className="flex flex-col">
                {showDivider && (
                  <p className="m-0 my-[14px] text-center text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>{dividerLabel(m.createdAt)}</p>
                )}
                {m.system ? (
                  <p className="m-0 my-[8px] text-center text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{m.content}</p>
                ) : (
                  <Bubble
                    m={m}
                    clusterStart={clusterStart}
                    clusterEnd={clusterEnd}
                    showSender={isGroup && !m.mine && clusterStart}
                    showAvatar={!m.mine && clusterStart}
                    revealed={revealed === m.id}
                    readLabel={!isGroup && m.mine && m.id === lastMineId && m.read}
                    onOpenUser={() => m.sender && onOpenUser(m.sender._id)}
                    onToggleTime={() => setRevealed((r) => (r === m.id ? null : m.id))}
                    onLike={() => toggleLike(m)}
                    onImage={() => m.image && setViewing(m.image)}
                  />
                )}
              </div>
            );
          })}
          {blocked && (
            <p role="status" className="m-0 my-[16px] text-center text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>
              {gone ? "방장이 채팅방을 삭제했어요." : "상대방이 채팅을 나갔어요."}
            </p>
          )}
        </div>

        {unseen && (
          <button
            type="button"
            onClick={() => { scrollToBottom(true); setUnseen(false); }}
            className="absolute bottom-[8px] left-1/2 flex -translate-x-1/2 items-center gap-[4px] border-0 px-[12px] py-[7px] text-[12px] leading-[14px] font-bold"
            style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}
          >
            <ArrowDown size={14} strokeWidth={1.5} aria-hidden /> 새 메시지
          </button>
        )}
      </div>

      {sendError && <p role="alert" className="m-0 px-[20px] pb-[4px] text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{sendError}</p>}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex shrink-0 items-center gap-[10px] px-[20px] py-[10px]"
        style={{ borderTop: "1px solid var(--a-color-border)" }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) send("", f); }}
        />
        <IconButton icon={ImagePlus} label="사진 보내기" disabled={blocked || sending} onClick={() => fileRef.current?.click()} />
        <TextField
          label="메시지"
          placeholder={blocked ? "메시지를 보낼 수 없어요" : "메시지 입력"}
          value={input}
          disabled={blocked}
          maxLength={1000}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
          className="min-w-px flex-1"
        />
        <button
          type="submit"
          disabled={blocked || sending}
          aria-label={input.trim() ? "보내기" : "하트 보내기"}
          className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0 disabled:opacity-40"
        >
          {input.trim()
            ? <Send size={22} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} aria-hidden />
            : <Heart size={22} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />}
        </button>
      </form>

      <BottomSheet open={sheet === "menu"} title="채팅 설정" onClose={() => setSheet(null)}>
        <SheetItem onClick={openPhotos}>사진 모아보기</SheetItem>
        {isGroup && (
          <>
            <SheetItem onClick={() => setSheet("members")}>멤버 보기</SheetItem>
            <SheetItem onClick={() => { setRenameValue(chat?.name ?? ""); setSheet("rename"); }}>채팅방 이름 바꾸기</SheetItem>
            <SheetItem onClick={() => avatarFileRef.current?.click()}>채팅방 사진 바꾸기</SheetItem>
            <SheetItem onClick={() => { setSheet(null); chat && onInvite(chat); }}>친구 초대</SheetItem>
          </>
        )}
        <SheetItem danger onClick={leave}>{isGroup ? "채팅방 나가기" : "대화 삭제"}</SheetItem>
        {isGroup && isHost && <SheetItem danger onClick={deleteRoom}>채팅방 삭제 (모두에게서)</SheetItem>}
      </BottomSheet>
      <input ref={avatarFileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; changeAvatar(f); }} />

      <BottomSheet open={sheet === "photos"} title="사진 모아보기" onClose={() => setSheet(null)}>
        {photos === null && <p className="m-0 py-[16px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>불러오는 중…</p>}
        {photos?.length === 0 && <p className="m-0 py-[16px] text-center text-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>주고받은 사진이 없어요.</p>}
        <div className="grid max-h-[50dvh] grid-cols-3 gap-[4px] overflow-y-auto">
          {photos?.map((p) => (
            <button key={p.image} type="button" onClick={() => { setSheet(null); setViewing(p.image); }} className="aspect-square border-0 bg-transparent p-0">
              <img src={resolveAssetUrl(p.image)} alt="" loading="lazy" className="size-full object-cover" style={{ borderRadius: "var(--a-radius-icon)" }} />
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "members"} title={`멤버 ${members.length}명`} onClose={() => setSheet(null)}>
        <ul className="m-0 flex max-h-[50dvh] list-none flex-col overflow-y-auto p-0">
          {members.map((u) => (
            <li key={u._id}>
              <button
                type="button"
                onClick={() => { setSheet(null); if (u._id !== myId) onOpenUser(u._id); }}
                className="flex w-full items-center gap-[12px] border-0 bg-transparent py-[10px] px-0 text-left"
              >
                <Avatar src={u.avatar} size={36} />
                <span className="text-[14px] leading-[17px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>{u.nickname}</span>
                {u._id === chat?.host._id && <span className="text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>방장</span>}
                {u._id === myId && <span className="text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>나</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={sheet === "rename"} title="채팅방 이름" onClose={() => setSheet(null)}>
        <div className="flex flex-col gap-[12px] pt-[4px]">
          <TextField label="채팅방 이름" placeholder="채팅방 이름 (최대 30자)" value={renameValue} maxLength={30} onChange={(e) => setRenameValue(e.target.value)} />
          <PrimaryButton disabled={!renameValue.trim()} onClick={rename}>저장</PrimaryButton>
        </div>
      </BottomSheet>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
          onClick={() => setViewing(null)}
          onKeyDown={(e) => e.key === "Escape" && setViewing(null)}
          className="fixed inset-0 z-[90] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
        >
          <img src={resolveAssetUrl(viewing)} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

interface BubbleProps {
  m: ChatMessage;
  clusterStart: boolean;
  clusterEnd: boolean;
  showSender: boolean;
  showAvatar: boolean;
  revealed: boolean;
  readLabel: boolean;
  onOpenUser: () => void;
  onToggleTime: () => void;
  onLike: () => void;
  onImage: () => void;
}

// 말풍선: 내 메시지는 #212121 채움·오른쪽, 상대 메시지는 #F2F2F2·왼쪽(+아바타). 같은 사람의 연속 메시지는 간격을 좁힌다.
function Bubble({ m, clusterStart, clusterEnd, showSender, showAvatar, revealed, readLabel, onOpenUser, onToggleTime, onLike, onImage }: BubbleProps) {
  const mine = m.mine;
  const heartOnly = m.content === HEART && !m.image;
  return (
    <div className={`flex w-full items-start gap-[8px] ${mine ? "flex-row-reverse" : ""}`} style={{ marginTop: clusterStart ? 8 : 2 }}>
      {!mine && (
        <span className="w-[32px] shrink-0">
          {showAvatar && (
            <button type="button" onClick={onOpenUser} aria-label={`${m.sender?.nickname ?? "상대"} 프로필`} className="border-0 bg-transparent p-0">
              <Avatar src={m.sender?.avatar} size={32} />
            </button>
          )}
        </span>
      )}
      <div className={`flex min-w-px max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showSender && <span className="mb-[3px] text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>{m.sender?.nickname}</span>}
        <div className="relative max-w-full">
          <div
            role="button"
            tabIndex={0}
            onClick={onToggleTime}
            onDoubleClick={onLike}
            onKeyDown={(e) => e.key === "Enter" && onToggleTime()}
            className="cursor-pointer select-none"
            style={{
              background: m.image || heartOnly ? "transparent" : mine ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
              color: mine ? "var(--a-color-on-inverse)" : "var(--a-color-text-primary)",
              borderRadius: 16,
              padding: m.image || heartOnly ? 0 : "9px 13px",
            }}
          >
            {m.image && (
              <img
                src={resolveAssetUrl(m.image)}
                alt="보낸 사진"
                loading="lazy"
                onClick={(e) => { e.stopPropagation(); onImage(); }}
                className="block max-h-[260px] max-w-full object-cover"
                style={{ borderRadius: "var(--a-radius-image)" }}
              />
            )}
            {m.content && (
              <p className="m-0 text-[14px] leading-[20px] break-words whitespace-pre-wrap" style={heartOnly ? { fontSize: 28, lineHeight: "34px" } : m.image ? { padding: "6px 2px 0", color: "var(--a-color-text-primary)" } : undefined}>
                {m.content}
              </p>
            )}
          </div>
          {m.liked && (
            <span
              aria-label="하트 반응"
              className="absolute -bottom-[8px] flex size-[20px] items-center justify-center rounded-full text-[11px]"
              style={{ [mine ? "left" : "right"]: -6, background: "var(--a-color-bg)", boxShadow: "0 0 0 1px var(--a-color-border)" }}
            >
              {HEART}
            </span>
          )}
        </div>
        {(revealed || readLabel) && (
          <span className="mt-[4px] text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>
            {[revealed && clockLabel(m.createdAt), readLabel && "읽음"].filter(Boolean).join(" · ")}
          </span>
        )}
        {clusterEnd && m.liked && <span className="h-[8px]" aria-hidden />}
      </div>
    </div>
  );
}
