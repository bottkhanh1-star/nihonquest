import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getUserProgress } from "@/lib/progress-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const progress = await getUserProgress(userId);
    if (!progress) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(progress);
  } catch (err: unknown) {
    const msg = (err as Error)?.message || String(err);
    console.error("[/api/me Error]:", msg);

    if (msg.includes("exceeded the quota") || msg.includes("53000")) {
      return NextResponse.json(
        {
          error: "DATABASE_QUOTA_EXCEEDED",
          message: "Cơ sở dữ liệu (Neon Database) đã vượt quá quota lưu trữ/tính toán miễn phí. Vui lòng kiểm tra lại tài khoản Neon hoặc cập nhật DATABASE_URL trong .env.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Database temporarily unavailable" }, { status: 503 });
  }
}
