// Web Push 구독 (앱 밖 휴대폰 알림). 서비스 워커는 src/sw.ts, 서버는 /api/push.
import api from "@/api";

export type PushStatus =
  | "unsupported" // 이 브라우저·환경에서는 안 됨 (아이폰은 홈 화면에 추가한 앱에서만 됨)
  | "denied"      // 사용자가 알림 권한을 거부함 → 휴대폰 설정에서 직접 켜야 함
  | "off"
  | "on";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isNativeApp = () => {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};

export const pushSupported = () =>
  !isNativeApp() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** 아이폰에서 홈 화면에 추가하지 않고 Safari로 열었을 때 (안내 문구용) */
export const needsInstallForPush = () => isIos() && !isStandalone();

const getSubscription = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
};

export const getPushStatus = async (): Promise<PushStatus> => {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    return (await getSubscription()) && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
};

const toUint8 = (base64url: string) => {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** 반드시 버튼 클릭 안에서 불러야 한다 (iOS는 사용자 동작 없이 권한을 물을 수 없다) */
export const enablePush = async (): Promise<PushStatus> => {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const { publicKey } = (await api.get<{ publicKey: string }>("/push/public-key")).data;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // 서버 키가 바뀌었으면 예전 구독으로는 받을 수 없으니 새로 만든다
  const currentKey = sub?.options.applicationServerKey;
  if (sub && currentKey && btoa(String.fromCharCode(...new Uint8Array(currentKey))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(publicKey) });
  }
  await api.post("/push/subscribe", sub.toJSON());
  return "on";
};

export const disablePush = async (): Promise<PushStatus> => {
  if (!pushSupported()) return "unsupported";
  const sub = await getSubscription();
  if (sub) {
    await api.delete("/push/subscribe", { data: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
};

/** 로그아웃 전에 부른다: 이 기기로 이전 계정 알림이 오지 않게 한다. 실패해도 로그아웃은 진행 */
export const unsubscribePushOnLogout = async () => {
  try {
    if (pushSupported()) await disablePush();
  } catch {
    // 무시
  }
};

/** 이미 켜 둔 기기는 앱을 열 때 서버에 다시 등록한다 (서버에서 지워졌거나 다른 계정으로 바뀐 경우 복구) */
export const resyncPush = async () => {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const sub = await getSubscription();
    if (sub) await api.post("/push/subscribe", sub.toJSON());
  } catch {
    // 무시
  }
};

export const sendTestPush = () => api.post<{ sent: number }>("/push/test").then((r) => r.data.sent);
