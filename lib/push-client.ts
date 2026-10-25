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
 * Register Service Worker and subscribe user to Web Push Notifications
 * Works across desktop and mobile browsers even when tab is closed.
 */
export async function registerPushSubscription(): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
}> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { success: false, error: "Push notifications are not supported on this browser." };
  }

  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // 2. Request notification permission if not yet granted
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission was denied." };
    }

    // 3. Get existing or subscribe to new push subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    // 4. Save to backend database
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
    console.error("[PushClient] Error subscribing to push:", err);
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
