import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useSocket } from "@/hooks/useSocket";

type Handlers = Record<string, (payload: any) => void>;

// 채팅 화면용 소켓: 로그인 토큰으로 연결하고, 이벤트 핸들러는 최신 클로저를 쓰되 재구독은 하지 않는다
// (핸들러가 렌더마다 새로 만들어져도 소켓 이벤트가 끊기거나 중복 등록되지 않게 ref로 한 번 거쳐 호출).
export function useChatSocket(handlers: Handlers): Socket | null {
  const socket = useSocket(localStorage.getItem("token"));
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!socket) return;
    const entries = Object.keys(ref.current).map((event) => {
      const fn = (payload: unknown) => ref.current[event]?.(payload);
      socket.on(event, fn);
      return [event, fn] as const;
    });
    return () => entries.forEach(([event, fn]) => socket.off(event, fn));
  }, [socket]);

  return socket;
}
