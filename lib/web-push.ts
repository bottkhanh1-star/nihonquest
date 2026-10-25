import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { VAPID_PUBLIC_KEY } from "@/lib/web-push-public";

export { VAPID_PUBLIC_KEY };

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "ZXGqACE2yoWr6dsbNUQjzBT1jwvv9GpwuWudx5C2Q3M";

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:support@nihonquest.com";

let isConfigured = false;

function ensureVapidConfig() {
  if (isConfigured) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isConfigured = true;
  } catch (err) {
    console.error("[web-push] Failed to set VAPID details:", err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, any>;
}

/**
 * Send Web Push notification to all active devices/subscriptions of a user
 * Even if user has closed all browser tabs.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureVapidConfig();

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions.length) {
      return { sent: 0, failed: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      url: payload.url || "/app",
      tag: payload.tag || "nihon-quest-alert",
      actions: payload.actions || [],
      data: payload.data || {},
    });

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSub, jsonPayload, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          });
          sent++;
        } catch (err: any) {
          failed++;
          console.warn(`[web-push] Failed to push to ${sub.id}:`, err?.statusCode || err?.message);

          // 404 or 410 means the subscription has expired or user uninstalled/cleared browser
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            try {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
              console.log(`[web-push] Removed stale push subscription ${sub.id}`);
            } catch {}
          }
        }
      })
    );

    return { sent, failed };
  } catch (error) {
    console.error("[web-push] Error sending push notification:", error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Send Web Push notification to multiple users simultaneously
 */
export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (!userIds.length) return;
  await Promise.allSettled(userIds.map((uid) => sendPushToUser(uid, payload)));
}
