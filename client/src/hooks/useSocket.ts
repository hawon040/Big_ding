import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

// api/index.ts의 resolveEnvHost와 동일한 이유: .env의 localhost를 다른 기기에서 그대로 쓰면
// 소켓 연결이 실패한다. localhost로 설정돼 있는데 지금 브라우저는 localhost가 아니라면,
// 지금 접속 중인 호스트를 그대로 사용하도록 보정한다.
const resolveSocketUrl = (raw: string): string => {
  try {
    const configured = new URL(raw);
    const isLocalhostConfigured = ["localhost", "127.0.0.1"].includes(configured.hostname);
    const isBrowserOnLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalhostConfigured && !isBrowserOnLocalhost) {
      configured.hostname = window.location.hostname;
      configured.protocol = window.location.protocol === "https:" ? "https:" : configured.protocol;
      return configured.toString().replace(/\/$/, "");
    }
    return raw.replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
};

const SOCKET_URL = resolveSocketUrl(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");

export const useSocket = (token: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const instance = io(SOCKET_URL, {
      auth: { token },
    });
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [token]);

  return socket;
};
