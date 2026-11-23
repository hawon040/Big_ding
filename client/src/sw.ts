/// <reference lib="webworker" />
// 서비스 워커 (vite-plugin-pwa injectManifest). 오프라인용 파일 캐시 + Web Push 알림 표시.
// 앱이 꺼져 있어도 서버(server/utils/push.js)가 보낸 푸시를 받아 휴대폰 알림창에 띄운다.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

// registerType: "autoUpdate" — 새 버전이 배포되면 바로 교체한다
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA 새로고침 대응. API 요청은 캐시하지 않는다 — 오래된 게시글·채팅이 그대로 보이면 더 위험하다.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Big Ding", {
      body: data.body || "새 알림이 있어요.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: data.tag,
      data: { url: data.url || "/?open=notifications" },
    }),
  );
});

// 알림을 누르면: 열려 있는 앱 창이 있으면 그 창을 앞으로 가져와 알림 화면을 열고, 없으면 새로 연다.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url as string) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "open-notifications" });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
