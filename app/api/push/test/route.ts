import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { sendPushToUser } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || "🔔 Kiểm tra thông báo Nihon Quest";
    const content = body.body || "Thông báo thiết bị hoạt động tốt! Bạn sẽ nhận được tin nhắn, cuộc gọi và nhắc học ngay cả khi tắt web.";

    const result = await sendPushToUser(userId, {
      title,
      body: content,
      url: "/app",
      tag: "test-notification-" + Date.now(),
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      message: result.sent > 0 
        ? `Đã gửi thông báo tới ${result.sent} thiết bị` 
        : "Chưa có thiết bị nào đăng ký nhận push hoặc subscription chưa được lưu.",
    });
  } catch (error: any) {
    console.error("[/api/push/test Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to send test push" }, { status: 500 });
  }
}

