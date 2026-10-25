import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    if (callId) {
      // Get details of a specific call session (for polling WebRTC signals)
      const call = await prisma.callSession.findUnique({
        where: { id: callId },
        include: {
          caller: {
            select: {
              id: true,
              name: true,
              image: true,
              profile: { select: { displayName: true, avatar: true } },
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              image: true,
              profile: { select: { displayName: true, avatar: true } },
            },
          },
        },
      });

      if (!call || (call.callerId !== userId && call.receiverId !== userId)) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      return NextResponse.json({ call });
    }

    // Check for incoming calls ringing for the current user
    const incomingCall = await prisma.callSession.findFirst({
      where: {
        receiverId: userId,
        status: "RINGING",
        createdAt: {
          // Only ringing in the last 45 seconds
          gt: new Date(Date.now() - 45 * 1000),
        },
      },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            image: true,
            profile: { select: { displayName: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ incomingCall: incomingCall || null });
  } catch (err: unknown) {
    console.error("[/api/calls GET Error]:", err);
    return NextResponse.json({ error: "Failed to poll calls" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, callId, receiverId, callType, offerSdp, answerSdp, candidate } = body;

    if (action === "initiate") {
      if (!receiverId) {
        return NextResponse.json({ error: "Missing receiverId" }, { status: 400 });
      }

      // Check friendship: MUST be accepted friends to call each other!
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { userId, friendId: receiverId },
            { userId: receiverId, friendId: userId },
          ],
        },
      });

      if (!friendship) {
        return NextResponse.json(
          { error: "Bạn và người này cần kết bạn để gọi điện cho nhau!" },
          { status: 403 }
        );
      }

      // Clean up any stale ringing calls from caller
      await prisma.callSession.updateMany({
        where: {
          callerId: userId,
          status: "RINGING",
        },
        data: { status: "ENDED" },
      });

      const call = await prisma.callSession.create({
        data: {
          callerId: userId,
          receiverId,
          callType: callType === "VIDEO" ? "VIDEO" : "AUDIO",
          offerSdp: offerSdp || null,
          status: "RINGING",
        },
        include: {
          receiver: {
            select: {
              id: true,
              name: true,
              image: true,
              profile: { select: { displayName: true, avatar: true } },
            },
          },
        },
      });

      return NextResponse.json({ call });
    }

    if (action === "offer") {
      if (!callId || !offerSdp) {
        return NextResponse.json({ error: "Missing callId or offerSdp" }, { status: 400 });
      }

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || call.callerId !== userId) {
        return NextResponse.json({ error: "Call session not found" }, { status: 404 });
      }

      const updated = await prisma.callSession.update({
        where: { id: callId },
        data: { offerSdp },
      });

      return NextResponse.json({ call: updated });
    }

    if (action === "answer") {
      if (!callId || !answerSdp) {
        return NextResponse.json({ error: "Missing callId or answerSdp" }, { status: 400 });
      }

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || call.receiverId !== userId) {
        return NextResponse.json({ error: "Call session not found" }, { status: 404 });
      }

      const updated = await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: "ACCEPTED",
          answerSdp,
          startedAt: new Date(),
        },
      });

      return NextResponse.json({ call: updated });
    }

    if (action === "ice" || action === "ice-batch") {
      if (!callId) return NextResponse.json({ error: "Missing callId" }, { status: 400 });

      const candidatesToAdd: any[] = action === "ice-batch"
        ? (Array.isArray(body.candidates) ? body.candidates : [])
        : (body.candidate ? [body.candidate] : []);

      if (candidatesToAdd.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

      const isCaller = call.callerId === userId;
      const currentList: any[] = JSON.parse(
        (isCaller ? call.callerIce : call.receiverIce) || "[]"
      );

      const existingSet = new Set(
        currentList.map((c) =>
          typeof c === "string" ? c : `${c.candidate || ""}|${c.sdpMid || ""}|${c.sdpMLineIndex ?? ""}`
        )
      );

      let added = 0;
      for (const cand of candidatesToAdd) {
        if (!cand) continue;
        const key = typeof cand === "string"
          ? cand
          : `${cand.candidate || ""}|${cand.sdpMid || ""}|${cand.sdpMLineIndex ?? ""}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          currentList.push(cand);
          added++;
        }
      }

      if (added > 0) {
        await prisma.callSession.update({
          where: { id: callId },
          data: isCaller
            ? { callerIce: JSON.stringify(currentList) }
            : { receiverIce: JSON.stringify(currentList) },
        });
      }

      return NextResponse.json({ success: true, total: currentList.length, added });
    }

    if (action === "upgrade-call" || action === "upgrade-video") {
      if (!callId) return NextResponse.json({ error: "Missing callId" }, { status: 400 });

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || (call.callerId !== userId && call.receiverId !== userId)) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      const updated = await prisma.callSession.update({
        where: { id: callId },
        data: {
          callType: "VIDEO",
          ...(offerSdp ? { offerSdp } : {}),
        },
      });

      return NextResponse.json({ call: updated });
    }

    if (action === "reject") {
      if (!callId) return NextResponse.json({ error: "Missing callId" }, { status: 400 });

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || call.receiverId !== userId) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      const updated = await prisma.callSession.update({
        where: { id: callId },
        data: { status: "REJECTED", endedAt: new Date() },
      });

      return NextResponse.json({ call: updated });
    }

    if (action === "end") {
      if (!callId) return NextResponse.json({ error: "Missing callId" }, { status: 400 });

      const call = await prisma.callSession.findUnique({ where: { id: callId } });
      if (!call || (call.callerId !== userId && call.receiverId !== userId)) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      const endedAt = new Date();
      const startedAt = call.startedAt || call.createdAt;
      const durationSec = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

      const updated = await prisma.callSession.update({
        where: { id: callId },
        data: {
          status: "ENDED",
          endedAt,
          durationSec: call.status === "ACCEPTED" ? durationSec : 0,
        },
      });

      return NextResponse.json({ call: updated });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[/api/calls POST Error]:", err);
    return NextResponse.json({ error: "Failed to process call action" }, { status: 500 });
  }
}

