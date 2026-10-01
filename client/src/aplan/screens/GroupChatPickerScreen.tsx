import { useEffect, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { chatApi, type ChatTarget, type ChatUser, type GroupChat } from "@/api/chat";
import { Avatar } from "@/aplan/components/Avatar";
import { TextField } from "@/aplan/components/TextField";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { EmptyState, ErrorState } from "@/aplan/components/States";
import "@/styles/aplan-tokens.css";

type Mode = { kind: "create" } | { kind: "invite"; chat: GroupChat };

interface GroupChatPickerScreenProps {
  mode: Mode;
  onBack: () => void;
  /** 만들기 결과: 단체방, 또는 2명만 골랐을 때 연결되는 기존 1:1 대화 */
  onCreated: (target: ChatTarget) => void;
  onInvited: (chat: GroupChat) => void;
}

// 단체 채팅 만들기 / 친구 초대 (Figma에 없는 화면 — A안 톤으로 구성).
// 후보는 대화한 적 있는 사람이고, 서버가 서로 팔로우하는 사이만 허용한다(아니면 서버 메시지를 그대로 보여준다).
// 나 포함 2명이 되면 서버가 방을 만들지 않고 1:1 대화로 연결해 준다.
export function GroupChatPickerScreen({ mode, onBack, onCreated, onInvited }: GroupChatPickerScreenProps) {
  const [people, setPeople] = useState<ChatUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoadError(false);
    chatApi.conversations().then(setPeople).catch(() => setLoadError(true));
  };
  useEffect(load, []);

  const inviting = mode.kind === "invite";
  const existing = new Set(inviting ? mode.chat.members.map((m) => m._id) : []);
  const candidates = (people ?? []).filter((u) => !existing.has(u._id));

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "invite") {
        onInvited(await chatApi.inviteToGroup(mode.chat._id, selected));
      } else {
        const res = await chatApi.createGroup(selected, name.trim());
        onCreated("isDirect" in res ? { kind: "direct", user: res.friend } : { kind: "group", chat: res });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || (inviting ? "친구를 초대하지 못했어요." : "채팅방을 만들지 못했어요."));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          {inviting ? "친구 초대" : "단체 채팅 만들기"}
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[8px] overflow-y-auto px-[20px]">
        {!inviting && <TextField label="채팅방 이름" placeholder="채팅방 이름 (선택)" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
        {loadError && <ErrorState onRetry={load} />}
        {people && candidates.length === 0 && (
          <EmptyState title="초대할 수 있는 사람이 없어요" description="대화한 적 있는 사람만 초대할 수 있어요." />
        )}
        <ul className="m-0 flex list-none flex-col p-0" role="group" aria-label="초대할 사람">
          {candidates.map((u) => {
            const on = selected.includes(u._id);
            return (
              <li key={u._id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(u._id)}
                  className="flex w-full items-center gap-[12px] border-0 bg-transparent py-[10px] px-0 text-left"
                >
                  <Avatar src={u.avatar} size={40} />
                  <span className="min-w-px flex-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{u.nickname}</span>
                  <span
                    aria-hidden
                    className="flex size-[22px] shrink-0 items-center justify-center rounded-full border border-solid"
                    style={{
                      borderColor: on ? "var(--a-color-surface-inverse)" : "var(--a-color-border)",
                      background: on ? "var(--a-color-surface-inverse)" : "transparent",
                    }}
                  >
                    {on && <Check size={14} strokeWidth={2} style={{ color: "var(--a-color-on-inverse)" }} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      <div className="flex shrink-0 flex-col gap-[8px] px-[20px] pt-[8px] pb-[20px]">
        {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>}
        <PrimaryButton disabled={selected.length === 0} loading={busy} onClick={submit}>
          {selected.length > 0 ? `${inviting ? "초대하기" : "만들기"} (${selected.length}명)` : inviting ? "초대하기" : "만들기"}
        </PrimaryButton>
      </div>
    </div>
  );
}
