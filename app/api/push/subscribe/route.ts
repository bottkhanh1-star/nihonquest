import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VAPID_PUBLIC_KEY, sendPushToUser } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    let hasSubscription = false;

    if (userId) {
      const count = await prisma.pushSubscription.count({ where: { userId } });
      hasSubscription = count > 0;
    }

    return NextResponse.json({
      publicKey: VAPID_PUBLIC_KEY,
      hasSubscription,
    });
  } catch (error) {
    return NextResponse.json(
      { publicKey: VAPID_PUBLIC_KEY, hasSubscription: false },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid PushSubscription payload" }, { status: 400 });
    }

    const { endpoint, keys } = subscription;

    // Upsert subscription for this device
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get("user-agent") || null,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get("user-agent") || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Subscribed to Web Push notifications successfully" });
  } catch (error) {
    console.error("[/api/push/subscribe POST Error]:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint } = body;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId },
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId },
      });
    }

    return NextResponse.json({ success: true, message: "Unsubscribed" });
  } catch (error) {
    console.error("[/api/push/subscribe DELETE Error]:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
