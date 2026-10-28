import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/study-rooms/[code]/signals — Fetch new signals for current user
export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    const room = await prisma.groupCallRoom.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const sinceDate = since ? new Date(Number(since) || since) : new Date(Date.now() - 15 * 1000);

    const signals = await prisma.groupCallSignal.findMany({
      where: {
        roomId: room.id,
        fromUserId: { not: userId },
        OR: [{ toUserId: userId }, { toUserId: "ALL" }],
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    // Cleanup signals older than 2 minutes in background
    prisma.groupCallSignal.deleteMany({
      where: {
        roomId: room.id,
        createdAt: { lt: new Date(Date.now() - 120 * 1000) },
      },
    }).catch(() => {});

    return NextResponse.json({ signals });
  } catch (error) {
    console.error("[GET /api/study-rooms/[code]/signals Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/study-rooms/[code]/signals — Send a signal (offer, answer, candidate, chat)
export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = params;
    const body = await request.json().catch(() => ({}));
    const { toUserId = "ALL", type, payload } = body;

    if (!type || !payload) {
      return NextResponse.json({ error: "Type and payload are required" }, { status: 400 });
    }

    const room = await prisma.groupCallRoom.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);

    const signal = await prisma.groupCallSignal.create({
      data: {
        roomId: room.id,
        fromUserId: userId,
        toUserId: String(toUserId),
        type: String(type),
        payload: payloadString,
      },
    });

    return NextResponse.json({ success: true, signalId: signal.id });
  } catch (error) {
    console.error("[POST /api/study-rooms/[code]/signals Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

