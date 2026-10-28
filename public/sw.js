// Nihon Quest Web Push Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Nihon Quest 🇯🇵",
    body: "Bạn có thông báo mới từ Nihon Quest",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    url: "/app",
    tag: "nihonquest-notification",
    actions: [],
  };

  try {
    const json = event.data.json();
    payload = { ...payload, ...json };
  } catch (err) {
    try {
      payload.body = event.data.text();
    } catch (e) {}
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "nihonquest-general",
    renotify: true,
    requireInteraction: payload.tag?.startsWith("call-") ? true : false,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || "/app",
      dateOfArrival: Date.now(),
      primaryKey: payload.tag || 1,
    },
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Nihon Quest 🇯🇵", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with the app, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

