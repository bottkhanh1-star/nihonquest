import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendStudyReminderEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/web-push";

// Cache to prevent duplicate emails to the same user within 20 hours
const sentRemindersCache = new Map<string, number>();

/**
 * Automated Cron & System Scheduler for Daily Study Reminders
 * Can be triggered automatically by:
 * 1. Netlify Scheduled Functions or Cron
 * 2. GitHub Actions schedule / external cron service (via Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>)
 * 3. In-app background trigger
 */
export async function GET(req: NextRequest) {
  return handleCronReminders(req);
}

export async function POST(req: NextRequest) {
  return handleCronReminders(req);
}

async function handleCronReminders(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const querySecret = new URL(req.url).searchParams.get("secret");

  const isAuthorized =
    !cronSecret ||
    process.env.NODE_ENV !== "production" ||
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  try {
    // 1. Find active users with valid email
    const users = await prisma.user.findMany({
      where: {
        email: { contains: "@" },
      },
      select: {
        id: true,
        email: true,
        name: true,
        currentStreak: true,
        learningLevel: true,
        lastActivityAt: true,
        profile: { select: { displayName: true } },
      },
      take: 60,
    });

    let sentCount = 0;
    let skippedCount = 0;
    const details: Array<{ email: string; reason: string; status: "SENT" | "SKIPPED" }> = [];

    for (const u of users) {
      if (!u.email) continue;

      // Rate limit check: only 1 reminder email per user per day
      const lastSentTime = sentRemindersCache.get(u.id);
      if (lastSentTime && now.getTime() - lastSentTime < 20 * 60 * 60 * 1000) {
        skippedCount++;
        details.push({ email: u.email, reason: "Already received reminder today", status: "SKIPPED" });
        continue;
      }

      // Check due SRS cards
      const dueCards = await prisma.reviewItem.count({
        where: {
          userId: u.id,
          dueAt: { lte: now },
        },
      });

      // Check if user studied today
      const studiedToday = u.lastActivityAt
        ? new Date(u.lastActivityAt).getTime() >= todayStart
        : false;

      // Conditions to send reminder:
      // 1. Has due flashcards to review
      // 2. Has an active streak (> 0) but hasn't studied today (streak at risk!)
      // 3. Inactive for 1-3 days
      const shouldSend = dueCards > 0 || (!studiedToday && u.currentStreak > 0);

      if (!shouldSend) {
        skippedCount++;
        details.push({ email: u.email, reason: "No urgent review or streak risk", status: "SKIPPED" });
        continue;
      }

      const userName = u.profile?.displayName || u.name || "Học viên Nihon Quest";

      const res = await sendStudyReminderEmail({
        to: u.email,
        userName,
        streak: u.currentStreak,
        dueCards,
        currentLevel: u.learningLevel || "N5",
        nativeLanguage: "vi",
      });

      // Send Web Push notification to user device (even when tab is closed)
      try {
        if (!studiedToday && u.currentStreak > 0) {
          await sendPushToUser(u.id, {
            title: `🔥 Chuỗi ${u.currentStreak} ngày sắp bị gián đoạn!`,
            body: "Bạn chưa học hôm nay. Hoàn thành 1 bài để giữ ngọn lửa streak nhé!",
            url: "/app/learn",
            tag: "streak-reminder",
          });
        } else if (dueCards > 0) {
          await sendPushToUser(u.id, {
            title: "📚 Đã đến giờ ôn tập từ vựng!",
            body: `Bạn có ${dueCards} thẻ SRS đang chờ ôn tập để củng cố trí nhớ.`,
            url: "/app/review",
            tag: "srs-review",
          });
        }
      } catch (pushErr) {
        console.warn("[Cron] Web push error:", pushErr);
      }

      if (res.success) {
        sentRemindersCache.set(u.id, now.getTime());
        sentCount++;
        details.push({
          email: u.email,
          reason: `Sent (Due: ${dueCards}, Streak: ${u.currentStreak}, StudiedToday: ${studiedToday})`,
          status: "SENT",
        });
      } else {
        skippedCount++;
        details.push({ email: u.email, reason: res.error || "Email delivery failed", status: "SKIPPED" });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processedUsers: users.length,
      sentEmails: sentCount,
      skippedEmails: skippedCount,
      details,
    });
  } catch (error) {
    console.error("[Cron Study Reminders Error]:", error);
    return NextResponse.json(
      { error: "Cron execution error", details: (error as Error)?.message },
      { status: 500 }
    );
  }
}

