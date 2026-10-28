// Nihon Quest Web Push & System Notification Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function buildNotificationOptions(payload) {
  const tag = payload.tag || "nihonquest-general-" + Date.now();
  return {
    body: payload.body || "Bạn có thông báo mới từ Nihon Quest",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag,
    // silent: false + renotify: true forces Android / iOS / Windows / macOS
    // to play the device's native system notification sound & vibration per OS settings
    silent: false,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction || tag.startsWith("call-")),
    vibrate: payload.vibrate || [250, 120, 250, 120, 400],
    timestamp: Date.now(),
    data: {
      url: payload.url || "/app",
      dateOfArrival: Date.now(),
      primaryKey: tag,
      ...(payload.data || {}),
    },
    actions: payload.actions || [],
  };
}

// 1. Handle Server Web Push Events (works even when browser/web is completely closed!)
self.addEventListener("push", (event) => {
  let payload = {
    title: "Nihon Quest 🇯🇵",
    body: "Bạn có thông báo mới từ Nihon Quest",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    url: "/app",
    tag: "nihonquest-push-" + Date.now(),
    actions: [],
  };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = { ...payload, ...json };
    } catch (err) {
      try {
        payload.body = event.data.text();
      } catch (e) {}
    }
  }

  const options = buildNotificationOptions(payload);

  event.waitUntil(
    self.registration.showNotification(payload.title || "Nihon Quest 🇯🇵", options)
  );
});

// 2. Allow client pages to dispatch native OS system notifications through the Service Worker
// so mobile browsers (Android Chrome / PWA) play the native phone notification sound & vibration
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "SHOW_SYSTEM_NOTIFICATION") return;
  const payload = event.data.payload || {};
  const options = buildNotificationOptions(payload);
  event.waitUntil(
    self.registration.showNotification(payload.title || "Nihon Quest 🇯🇵", options)
  );
});

// 3. Handle clicking on the system notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
