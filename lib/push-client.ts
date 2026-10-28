"use client";

import { VAPID_PUBLIC_KEY } from "@/lib/web-push-public";

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
      // Enable local/in-app notification preference so user still gets alerts
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

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // 4. Save subscription to backend database
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
    // If browser granted Notification permission even though PushManager failed (e.g. local HTTP on mobile),
    // still return success so local/SW notifications work!
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      return { success: true, fallbackMode: true };
    }
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Trigger a server-side test Web Push notification to this user
 */
export async function sendServerTestPush(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "🔔 Nihon Quest — Kiểm tra thông báo thiết bị",
        body: "Hệ thống thông báo đẩy hoạt động chuẩn! Bạn sẽ nhận được tin nhắn, cuộc gọi và nhắc học ngay cả khi tắt web. 🚀",
      }),
    });
    const data = await res.json();
    return { success: res.ok, message: data.message || "OK" };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
