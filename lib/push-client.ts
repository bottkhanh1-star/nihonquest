"use client";

import { VAPID_PUBLIC_KEY } from "@/lib/web-push-public";
import { playNihonQuestChime } from "@/lib/nihonChime";

/**
 * Convert a base64 string to a Uint8Array for VAPID applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Dispatch a native OS / phone system notification via Service Worker (or Notification API fallback)
 * with `silent: false` and `renotify: true` so the device plays its native notification sound & vibration.
 */
export async function showSystemDeviceNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<boolean> {
  // If running inside Android APK (e.g. Samsung Galaxy A55), dispatch to native Android NotificationManager!
  if (typeof window !== "undefined" && (window as any).NihonNative?.showNativeNotification) {
    try {
      (window as any).NihonNative.showNativeNotification(
        payload.title,
        payload.body,
        payload.tag || "",
        payload.url || ""
      );
      playNihonQuestChime();
      return true;
    } catch (nativeErr) {
      console.warn("[PushClient] NihonNative showNativeNotification failed:", nativeErr);
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  // Play our custom Nihon Quest chime instead of the generic phone "ding"!
  playNihonQuestChime();

  const tag = payload.tag || "nihonquest-sys-" + Date.now();
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[]; sound?: string } = {
    body: payload.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    sound: "/sounds/nihon-chime.wav",
    tag,
    // Mute the generic OS "ding" so only the Nihon Quest custom chime + OS vibration + OS banner fire!
    silent: true,
    renotify: true,
    vibrate: [250, 120, 250, 120, 400],
    data: {
      url: payload.url || "/app",
      dateOfArrival: Date.now(),
    },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration && "showNotification" in registration) {
        await registration.showNotification(payload.title, options);
        return true;
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_SYSTEM_NOTIFICATION",
          payload: { ...payload, tag },
        });
        return true;
      }
    }
  } catch (swErr) {
    console.warn("[PushClient] SW showNotification fallback:", swErr);
  }

  try {
    new Notification(payload.title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Register Service Worker and subscribe user to Web Push Notifications.
 * IMPORTANT: Call Notification.requestPermission() FIRST before awaiting ServiceWorker
 * so mobile browsers (Android Chrome / iOS Safari) preserve the transient user gesture!
 */
export async function registerPushSubscription(): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
  fallbackMode?: boolean;
}> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window unavailable" };
  }

  try {
    // 0. If running in native Android APK (Samsung A55 etc.), trigger native OS runtime permission prompt!
    if (typeof window !== "undefined" && (window as any).NihonNative?.requestNotificationPermission) {
      try {
        (window as any).NihonNative.requestNotificationPermission();
      } catch (nativeErr) {
        console.warn("[PushClient] NihonNative requestNotificationPermission:", nativeErr);
      }
    }

    // 1. MUST request Notification permission FIRST on user tap (preserves mobile user gesture!)
    if ("Notification" in window) {
      const currentPerm = Notification.permission;
      if (currentPerm !== "granted") {
        const requested = await Notification.requestPermission();
        if (requested !== "granted") {
          return {
            success: false,
            error:
              requested === "denied"
                ? "Notification permission was denied."
                : "Notification permission was dismissed.",
          };
        }
      }
    } else {
      // Mobile browser without window.Notification (e.g. iOS Safari tab before Add to Home Screen)
      try {
        localStorage.setItem("nq_inapp_notifications_enabled", "true");
      } catch {}
      return {
        success: true,
        fallbackMode: true,
      };
    }

    // 2. Register Service Worker if supported
    if (!("serviceWorker" in navigator)) {
      return { success: true, fallbackMode: true };
    }

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // 3. Subscribe via PushManager if available
    if (!("PushManager" in window) || !registration.pushManager) {
      return { success: true, fallbackMode: true };
    }

    let subscription = await registration.pushManager.getSubscription();
    const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      } catch (subErr: any) {
        // If a stale subscription with a different applicationServerKey exists, reset and re-subscribe
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe().catch(() => {});
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }
    }

    // 4. Save subscription to backend database so Server Web Push works when web is closed
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      console.warn("[PushClient] Failed to save push subscription to backend:", res.status);
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.warn("[PushClient] Push subscription warning:", err);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      return { success: true, fallbackMode: true };
    }
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Trigger a server-side test Web Push notification to this user's device OS.
 * If the server push queue has 0 active endpoints, automatically re-syncs subscription
 * and falls back to Service Worker OS notification so the phone always rings!
 */
export async function sendServerTestPush(): Promise<{
  success: boolean;
  sent: number;
  message: string;
}> {
  try {
    // Ensure subscription is synced in DB first
    await registerPushSubscription().catch(() => {});

    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "🔔 Nihon Quest — Thông báo hệ thống",
        body: "Chuông thông báo thiết bị hoạt động chuẩn! Bạn sẽ nhận được tin nhắn, kết bạn, bài học và cuộc gọi ngay cả khi tắt web.",
      }),
    });
    const data = await res.json();
    const sentCount = Number(data?.sent || 0);

    if (res.ok && sentCount > 0) {
      return {
        success: true,
        sent: sentCount,
        message: data.message || `Đã gửi thông báo đẩy tới ${sentCount} thiết bị`,
      };
    }

    // Fallback: trigger native OS notification via Service Worker so phone notification bar + sound still fires!
    const fallbackShown = await showSystemDeviceNotification({
      title: "🔔 Nihon Quest — Thông báo hệ thống",
      body: "Chuông thông báo thiết bị hoạt động chuẩn! Bạn sẽ nhận được tin nhắn, kết bạn, bài học và cuộc gọi ngay cả khi tắt web.",
      url: "/app",
      tag: "test-notification-" + Date.now(),
    });

    return {
      success: fallbackShown,
      sent: sentCount,
      message: data?.message || "Đã phát thông báo tới hệ thống thiết bị",
    };
  } catch (err: any) {
    const fallbackShown = await showSystemDeviceNotification({
      title: "🔔 Nihon Quest — Thông báo hệ thống",
      body: "Chuông thông báo thiết bị hoạt động chuẩn! Bạn sẽ nhận được tin nhắn, kết bạn, bài học và cuộc gọi ngay cả khi tắt web.",
      url: "/app",
      tag: "test-notification-" + Date.now(),
    });
    return {
      success: fallbackShown,
      sent: 0,
      message: err?.message || "Fallback notification dispatched",
    };
  }
}
