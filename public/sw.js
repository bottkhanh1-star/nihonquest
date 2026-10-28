// Nihon Quest Web Push & Custom Chime Service Worker
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function buildNotificationOptions(payload, hasActiveClient) {
  const tag = payload.tag || "nihonquest-general-" + Date.now();
  return {
    body: payload.body || "Bạn có thông báo mới từ Nihon Quest",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    // Custom sound URL for platforms/WebAPKs supporting NotificationOptions.sound
    sound: "/sounds/nihon-chime.wav",
    tag,
    // If an app client tab (foreground or background) is alive, mute the generic OS "ding"
    // so our custom Nihon Quest Koto/Fūrin chime plays cleanly alongside the OS banner & vibration!
    // If all tabs are completely killed from RAM, fall back to silent: false so the OS still rings.
    silent: hasActiveClient ? true : false,
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

// 1. Handle Server Web Push Events
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

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const hasClient = Array.isArray(clientList) && clientList.length > 0;

        // Tell any open/background client window to play the custom Nihon Quest chime immediately!
        if (hasClient) {
          for (const client of clientList) {
            try {
              client.postMessage({
                type: "NIHON_PUSH_RECEIVED",
                payload,
              });
            } catch (e) {}
          }
        }

        const options = buildNotificationOptions(payload, hasClient);
        return self.registration.showNotification(
          payload.title || "Nihon Quest 🇯🇵",
          options
        );
      })
  );
});

// 2. Allow client pages to dispatch native OS system notifications through the Service Worker
// while playing the custom Nihon Quest chime
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "SHOW_SYSTEM_NOTIFICATION") return;
  const payload = event.data.payload || {};
  const options = buildNotificationOptions(payload, true);
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
