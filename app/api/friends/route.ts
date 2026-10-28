import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q")?.trim();

    // If searching for users to add as friends
    if (searchQuery) {
      const users = await prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { email: { contains: searchQuery, mode: "insensitive" } },
            { profile: { displayName: { contains: searchQuery, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          name: true,
          image: true,
          learningLevel: true,
          currentStreak: true,
          totalXP: true,
          profile: {
            select: { displayName: true, avatar: true, bio: true },
          },
        },
        take: 15,
      });

      // Get status with each user
      const existingFriendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userId, friendId: { in: users.map((u) => u.id) } },
            { friendId: userId, userId: { in: users.map((u) => u.id) } },
          ],
        },
      });

      const results = users.map((u) => {
        const relation = existingFriendships.find(
          (f) =>
            (f.userId === userId && f.friendId === u.id) ||
            (f.friendId === userId && f.userId === u.id)
        );
        return {
          id: u.id,
          name: u.profile?.displayName || u.name || "Học viên",
          avatar: u.profile?.avatar || u.image,
          bio: u.profile?.bio,
          learningLevel: u.learningLevel,
          currentStreak: u.currentStreak,
          totalXP: u.totalXP,
          friendshipStatus: relation
            ? relation.status === "ACCEPTED"
              ? "FRIENDS"
              : relation.userId === userId
              ? "REQUEST_SENT"
              : "REQUEST_RECEIVED"
            : "NONE",
          friendshipId: relation?.id,
        };
      });

      return NextResponse.json({ searchResults: results });
    }

    // Otherwise, return friends list + incoming requests + outgoing requests
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            learningLevel: true,
            currentStreak: true,
            totalXP: true,
            lastActivityAt: true,
            profile: { select: { displayName: true, avatar: true, bio: true } },
          },
        },
        friend: {
          select: {
            id: true,
            name: true,
            image: true,
            learningLevel: true,
            currentStreak: true,
            totalXP: true,
            lastActivityAt: true,
            profile: { select: { displayName: true, avatar: true, bio: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const acceptedFriends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    for (const f of friendships) {
      const isInitiator = f.userId === userId;
      const otherUser = isInitiator ? f.friend : f.user;

      const formattedOther = {
        friendshipId: f.id,
        userId: otherUser.id,
        name: otherUser.profile?.displayName || otherUser.name || "Học viên",
        avatar: otherUser.profile?.avatar || otherUser.image,
        bio: otherUser.profile?.bio,
        learningLevel: otherUser.learningLevel,
        currentStreak: otherUser.currentStreak,
        totalXP: otherUser.totalXP,
        lastActivityAt: otherUser.lastActivityAt,
        updatedAt: f.updatedAt,
        status: f.status,
      };

      if (f.status === "ACCEPTED") {
        acceptedFriends.push(formattedOther);
      } else if (f.status === "PENDING") {
        if (isInitiator) {
          outgoingRequests.push(formattedOther);
        } else {
          incomingRequests.push(formattedOther);
        }
      }
    }

    // Suggested classmates
    const relatedUserIds = friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
    const suggested = await prisma.user.findMany({
      where: {
        id: { notIn: [...relatedUserIds, userId] },
      },
      select: {
        id: true,
        name: true,
        image: true,
        learningLevel: true,
        currentStreak: true,
        totalXP: true,
        profile: { select: { displayName: true, avatar: true, bio: true } },
      },
      take: 8,
      orderBy: { totalXP: "desc" },
    });

    const formattedSuggested = suggested.map((u) => ({
      id: u.id,
      name: u.profile?.displayName || u.name || "Bạn học",
      avatar: u.profile?.avatar || u.image,
      learningLevel: u.learningLevel,
      currentStreak: u.currentStreak,
      totalXP: u.totalXP,
    }));

    return NextResponse.json({
      friends: acceptedFriends,
      incomingRequests,
      outgoingRequests,
      suggestedLearners: formattedSuggested,
    });
  } catch (err: unknown) {
    console.error("[/api/friends GET Error]:", err);
    return NextResponse.json({ error: "Failed to load friends" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, targetUserId, friendshipId } = body;

    if (action === "request") {
      if (!targetUserId || targetUserId === userId) {
        return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
      }

      // Check existing friendship
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId, friendId: targetUserId },
            { userId: targetUserId, friendId: userId },
          ],
        },
      });

      if (existing) {
        if (existing.status === "ACCEPTED") {
          return NextResponse.json({ message: "Already friends", status: "ACCEPTED" });
        }
        if (existing.status === "PENDING") {
          // If the other user already sent a request, auto-accept!
          if (existing.userId === targetUserId) {
            const updated = await prisma.friendship.update({
              where: { id: existing.id },
              data: { status: "ACCEPTED" },
            });
            (async () => {
              try {
                const me = await prisma.user.findUnique({
                  where: { id: userId },
                  select: { name: true, profile: { select: { displayName: true } } },
                });
                const myName = me?.profile?.displayName || me?.name || "Học viên";
                await sendPushToUser(targetUserId, {
                  title: "🌸 Đã trở thành bạn bè!",
                  body: `${myName} đã đồng ý kết bạn trên Nihon Quest. Hãy nhắn tin hoặc gọi điện luyện nói ngay!`,
                  url: `/app/messages?friendId=${userId}`,
                  tag: `friend-accept-${userId}`,
                });
              } catch (pushErr) {
                console.warn("[/api/friends] Push error:", pushErr);
              }
            })();
            return NextResponse.json({ message: "Friend request accepted", friendship: updated });
          }
          return NextResponse.json({ message: "Friend request already sent", status: "PENDING" });
        }
        // If declined before, re-request
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { userId, friendId: targetUserId, status: "PENDING" },
        });
        (async () => {
          try {
            const me = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true, profile: { select: { displayName: true } } },
            });
            const myName = me?.profile?.displayName || me?.name || "Học viên";
            await sendPushToUser(targetUserId, {
              title: "🤝 Lời mời kết bạn mới!",
              body: `${myName} muốn kết bạn và cùng học tiếng Nhật với bạn trên Nihon Quest!`,
              url: `/app/messages?tab=REQUESTS`,
              tag: `friend-req-${userId}`,
            });
          } catch (pushErr) {
            console.warn("[/api/friends] Push error:", pushErr);
          }
        })();
        return NextResponse.json({ message: "Friend request sent", friendship: updated });
      }

      const created = await prisma.friendship.create({
        data: {
          userId,
          friendId: targetUserId,
          status: "PENDING",
        },
      });

      // Dispatch Web Push notification to targetUserId
      (async () => {
        try {
          const me = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, profile: { select: { displayName: true } } },
          });
          const myName = me?.profile?.displayName || me?.name || "Học viên";
          await sendPushToUser(targetUserId, {
            title: "🤝 Lời mời kết bạn mới!",
            body: `${myName} muốn kết bạn và cùng học tiếng Nhật với bạn trên Nihon Quest!`,
            url: `/app/messages?tab=REQUESTS`,
            tag: `friend-req-${userId}`,
          });
        } catch (pushErr) {
          console.warn("[/api/friends] Push error:", pushErr);
        }
      })();

      return NextResponse.json({ message: "Friend request sent", friendship: created });
    }

    if (action === "accept") {
      if (!friendshipId) {
        return NextResponse.json({ error: "Missing friendshipId" }, { status: 400 });
      }

      const req = await prisma.friendship.findUnique({ where: { id: friendshipId } });
      if (!req || req.friendId !== userId) {
        return NextResponse.json({ error: "Friend request not found or not for you" }, { status: 404 });
      }

      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED" },
      });

      // Notify requester that their friend request was accepted
      (async () => {
        try {
          const me = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, profile: { select: { displayName: true } } },
          });
          const myName = me?.profile?.displayName || me?.name || "Học viên";
          await sendPushToUser(req.userId, {
            title: "🌸 Đã trở thành bạn bè!",
            body: `${myName} đã đồng ý lời mời kết bạn! Hãy nhắn tin hoặc gọi điện luyện tiếng Nhật ngay!`,
            url: `/app/messages?friendId=${userId}`,
            tag: `friend-accept-${userId}`,
          });
        } catch (pushErr) {
          console.warn("[/api/friends] Push error:", pushErr);
        }
      })();

      return NextResponse.json({ message: "Friend request accepted", friendship: updated });
    }

    if (action === "reject") {
      if (!friendshipId) {
        return NextResponse.json({ error: "Missing friendshipId" }, { status: 400 });
      }

      const req = await prisma.friendship.findUnique({ where: { id: friendshipId } });
      if (!req || req.friendId !== userId) {
        return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
      }

      await prisma.friendship.delete({ where: { id: friendshipId } });
      return NextResponse.json({ message: "Friend request rejected" });
    }

    if (action === "cancel") {
      if (!friendshipId) {
        return NextResponse.json({ error: "Missing friendshipId" }, { status: 400 });
      }

      const req = await prisma.friendship.findUnique({ where: { id: friendshipId } });
      if (!req || req.userId !== userId) {
        return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
      }

      await prisma.friendship.delete({ where: { id: friendshipId } });
      return NextResponse.json({ message: "Friend request cancelled" });
    }

    if (action === "unfriend") {
      if (!targetUserId) {
        return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
      }

      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId: targetUserId },
            { userId: targetUserId, friendId: userId },
          ],
        },
      });

      return NextResponse.json({ message: "Unfriended successfully" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[/api/friends POST Error]:", err);
    return NextResponse.json({ error: "Failed to process friend action" }, { status: 500 });
  }
}

