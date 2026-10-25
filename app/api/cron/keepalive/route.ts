import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const start = Date.now();
    // Lightweight heartbeat query to keep database active & avoid Supabase auto-pause
    await prisma.$queryRaw`SELECT 1`;
    const duration = Date.now() - start;

    return NextResponse.json({
      status: "healthy",
      dbLatencyMs: duration,
      timestamp: new Date().toISOString(),
      message: "Database keepalive ping successful. Supabase will stay active.",
    });
  } catch (error: unknown) {
    console.error("[Keepalive Error]:", error);
    return NextResponse.json(
      { status: "unhealthy", error: (error as Error)?.message || "DB unreachable" },
      { status: 500 }
    );
  }
}

