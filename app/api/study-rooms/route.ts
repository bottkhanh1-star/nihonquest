import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/study-rooms — List all active public study rooms
export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level") || "ALL";

    const staleThreshold = new Date(Date.now() - 35 * 1000);

    // Auto cleanup stale participants who disconnected without clicking leave
    await prisma.groupCallParticipant.deleteMany({
      where: {
        lastPingAt: { lt: staleThreshold },
      },
    }).catch(() => {});

    // Auto mark rooms older than 3 days inactive
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.groupCallRoom.updateMany({
      where: {
        isActive: true,
        createdAt: { lt: threeDaysAgo },
      },
      data: { isActive: false },
    }).catch(() => {});

    // Upgrade legacy 4/6-member active rooms to 20 members capacity
    await prisma.groupCallRoom.updateMany({
      where: {
        isActive: true,
        maxMembers: { lte: 6 },
      },
      data: { maxMembers: 20 },
    }).catch(() => {});

    const whereClause: Record<string, unknown> = {
      isActive: true,
      isPrivate: false,
    };
    if (level !== "ALL") {
      whereClause.levelTag = level;
    }

    const rooms = await prisma.groupCallRoom.findMany({
      where: whereClause,
      include: {
        host: {
          select: {
            id: true,
            name: true,
            image: true,
            profile: { select: { displayName: true, avatar: true } },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                profile: { select: { displayName: true, avatar: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("[GET /api/study-rooms Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/study-rooms — Create a new study room
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, levelTag = "ALL", isPrivate = false, pinCode, maxMembers = 20 } = body;

    const trimmedName = String(name || "").trim() || "Phòng học Kaiwa Nihon Quest";
    const roomCode = `KAIWA-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const room = await prisma.groupCallRoom.create({
      data: {
        code: roomCode,
        name: trimmedName,
        levelTag: String(levelTag).toUpperCase(),
        hostId: userId,
        isPrivate: Boolean(isPrivate),
        pinCode: pinCode ? String(pinCode).trim() : null,
        maxMembers: Math.min(Math.max(Number(maxMembers) || 20, 2), 30),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error("[POST /api/study-rooms Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

