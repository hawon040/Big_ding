// A안 채팅 화면용 API 호출. 서버의 /chat(1:1)·/group-chats(단체) 라우트는 레거시 그대로라
// 응답 모양(_id, avatar)도 레거시 형태이고, 화면에서 쓰기 편한 형태로는 아래 normalize 함수가 바꿔준다.
import api from "./index";

export interface ChatUser {
  _id: string;
  nickname: string;
  avatar?: string;
}

export interface GroupChat {
  _id: string;
  post?: { _id: string; title: string; board: string } | null;
  name?: string;
  avatar?: string;
  host: ChatUser;
  members: ChatUser[];
  lastMessage?: RawGroupMessage | null;
}

interface RawDirectMessage {
  _id: string;
  from?: ChatUser;
  to?: ChatUser;
  content?: string;
  image?: string;
  read?: boolean;
  liked?: boolean;
  createdAt: string;
}

export interface RawGroupMessage {
  _id: string;
  groupChat: string;
  sender: ChatUser;
  content: string;
  image?: string;
  liked?: boolean;
  type?: "text" | "system";
  createdAt: string;
}

/** 1:1과 단체 채팅 메시지를 한 모양으로 맞춘 화면용 메시지 */
export interface ChatMessage {
  id: string;
  content: string;
  image?: string;
  createdAt: string;
  mine: boolean;
  /** 1:1에서 상대가 읽었는지 (단체방은 항상 false — 읽음 표시 없음) */
  read: boolean;
  liked: boolean;
  system: boolean;
  sender?: ChatUser;
}

/** 열려 있는 대화방의 대상: 1:1 상대 또는 단체 채팅방 */
export type ChatTarget = { kind: "direct"; user: ChatUser } | { kind: "group"; chat: GroupChat };

export const targetKey = (t: ChatTarget) => (t.kind === "direct" ? `d:${t.user._id}` : `g:${t.chat._id}`);

export const fromDirect = (m: RawDirectMessage, myId: string): ChatMessage => ({
  id: m._id,
  content: m.content || "",
  image: m.image,
  createdAt: m.createdAt,
  mine: m.from?._id === myId,
  read: !!m.read,
  liked: !!m.liked,
  system: false,
  sender: m.from,
});

export const fromGroup = (m: RawGroupMessage, myId: string): ChatMessage => ({
  id: m._id,
  content: m.content || "",
  image: m.image,
  createdAt: m.createdAt,
  mine: m.type !== "system" && m.sender?._id === myId,
  read: false,
  liked: !!m.liked,
  system: m.type === "system",
  sender: m.sender,
});

// 메시지 본문(텍스트)이나 이미지 하나를 보낸다. 이미지는 multipart로 올린다.
const payload = (content: string, image?: File): FormData | { content: string } => {
  if (!image) return { content };
  const form = new FormData();
  if (content) form.append("content", content);
  form.append("image", image);
  return form;
};

export const chatApi = {
  conversations: () => api.get<ChatUser[]>("/chat/conversations").then((r) => r.data),
  hiddenFriendIds: () => api.get<string[]>("/chat/hidden-friends").then((r) => r.data),
  directMessages: (friendId: string, opts?: { preview?: boolean }) =>
    api.get<RawDirectMessage[]>(`/chat/${friendId}`, { params: opts?.preview ? { preview: true } : undefined }).then((r) => r.data),
  directState: (friendId: string) => api.get<{ theyLeft: boolean; iLeft: boolean }>(`/chat/${friendId}/state`).then((r) => r.data),
  sendDirect: (friendId: string, content: string, image?: File) =>
    api.post<RawDirectMessage>(`/chat/${friendId}`, payload(content, image)).then((r) => r.data),
  likeDirect: (messageId: string) => api.patch(`/chat/messages/${messageId}/like`),
  leaveDirect: (friendId: string) => api.post(`/chat/${friendId}/leave`),
  directPhotos: (friendId: string) => api.get<{ image: string; createdAt: string }[]>(`/chat/${friendId}/photos`).then((r) => r.data),

  groups: () => api.get<GroupChat[]>("/group-chats").then((r) => r.data),
  createGroup: (memberIds: string[], name?: string) =>
    api
      .post<GroupChat | { isDirect: true; friend: ChatUser }>("/group-chats", { memberIds, name: name || undefined })
      .then((r) => r.data),
  groupMessages: (id: string) => api.get<RawGroupMessage[]>(`/group-chats/${id}/messages`).then((r) => r.data),
  sendGroup: (id: string, content: string, image?: File) =>
    api.post<RawGroupMessage>(`/group-chats/${id}/messages`, payload(content, image)).then((r) => r.data),
  likeGroup: (messageId: string) => api.patch(`/group-chats/messages/${messageId}/like`),
  inviteToGroup: (id: string, memberIds: string[]) => api.post<GroupChat>(`/group-chats/${id}/invite`, { memberIds }).then((r) => r.data),
  renameGroup: (id: string, name: string) => api.patch<GroupChat>(`/group-chats/${id}/name`, { name }).then((r) => r.data),
  setGroupAvatar: (id: string, image: File) => {
    const form = new FormData();
    form.append("image", image);
    return api.patch<GroupChat>(`/group-chats/${id}/avatar`, form).then((r) => r.data);
  },
  groupPhotos: (id: string) => api.get<{ image: string; createdAt: string }[]>(`/group-chats/${id}/photos`).then((r) => r.data),
  leaveGroup: (id: string) => api.post(`/group-chats/${id}/leave`),
  deleteGroup: (id: string) => api.delete(`/group-chats/${id}`),
};
