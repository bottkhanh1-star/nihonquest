import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

    const staleThreshold = new Date(Date.now() - 30 * 1000);
    await prisma.groupCallParticipant.deleteMany({
      where: {
        room: { code },
        lastPingAt: { lt: staleThreshold },
      },
    }).catch(() => {});

    const room = await prisma.groupCallRoom.findUnique({
      where: { code },
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
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found or closed" }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error("[GET /api/study-rooms/[code] Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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
    const { action, peerId, pinCode, isAudioMuted, isVideoOff, isScreenSharing } = body;

    const room = await prisma.groupCallRoom.findUnique({
      where: { code },
      include: {
        participants: true,
      },
    });

    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Room not found or has ended" }, { status: 404 });
    }

    // ACTION: JOIN
    if (action === "join") {
      if (room.isPrivate && room.pinCode) {
        if (room.pinCode !== String(pinCode || "").trim()) {
          return NextResponse.json({ error: "Mã PIN phòng không chính xác" }, { status: 403 });
        }
      }

      const isAlreadyIn = room.participants.some((p) => p.userId === userId);
      if (!isAlreadyIn && room.participants.length >= room.maxMembers) {
        return NextResponse.json(
          { error: `Phòng học đã đủ số lượng thành viên (tối đa ${room.maxMembers} người)` },
          { status: 409 }
        );
      }

      const participant = await prisma.groupCallParticipant.upsert({
        where: {
          roomId_userId: { roomId: room.id, userId },
        },
        create: {
          roomId: room.id,
          userId,
          peerId: peerId || `peer-${userId.slice(-6)}-${Date.now().toString().slice(-4)}`,
          lastPingAt: new Date(),
        },
        update: {
          peerId: peerId || undefined,
          lastPingAt: new Date(),
        },
      });

      const updatedRoom = await prisma.groupCallRoom.findUnique({
        where: { code },
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
            orderBy: { joinedAt: "asc" },
          },
        },
      });

      return NextResponse.json({ success: true, participant, room: updatedRoom });
    }

    // ACTION: LEAVE
    if (action === "leave") {
      await prisma.groupCallParticipant.deleteMany({
        where: { roomId: room.id, userId },
      }).catch(() => {});

      // Cleanup signals sent to or from user in this room
      await prisma.groupCallSignal.deleteMany({
        where: {
          roomId: room.id,
          OR: [{ fromUserId: userId }, { toUserId: userId }],
        },
      }).catch(() => {});

      // Room remains active for 3 days so host or friends can rejoin anytime
      return NextResponse.json({ success: true });
    }

    // ACTION: PING & SYNC STATE
    if (action === "ping") {
      await prisma.groupCallParticipant.updateMany({
        where: { roomId: room.id, userId },
        data: {
          lastPingAt: new Date(),
          isAudioMuted: typeof isAudioMuted === "boolean" ? isAudioMuted : undefined,
          isVideoOff: typeof isVideoOff === "boolean" ? isVideoOff : undefined,
          isScreenSharing: typeof isScreenSharing === "boolean" ? isScreenSharing : undefined,
        },
      }).catch(() => {});

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/study-rooms/[code] Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

