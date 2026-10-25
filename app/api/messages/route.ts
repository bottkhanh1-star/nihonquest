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
    const friendId = searchParams.get("friendId");
    const after = searchParams.get("after"); // ISO string for incremental polling

    if (!friendId) {
      // Return conversations list with last message and unread counts
      // Find all friends
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userId }, { friendId: userId }],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              learningLevel: true,
              profile: { select: { displayName: true, avatar: true } },
            },
          },
          friend: {
            select: {
              id: true,
              name: true,
              image: true,
              learningLevel: true,
              profile: { select: { displayName: true, avatar: true } },
            },
          },
        },
      });

      const conversations = await Promise.all(
        friendships.map(async (f) => {
          const other = f.userId === userId ? f.friend : f.user;
          const lastMsg = await prisma.directMessage.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: other.id },
                { senderId: other.id, receiverId: userId },
              ],
            },
            orderBy: { createdAt: "desc" },
          });

          const unreadCount = await prisma.directMessage.count({
            where: {
              senderId: other.id,
              receiverId: userId,
              isRead: false,
            },
          });

          return {
            friend: {
              id: other.id,
              name: other.profile?.displayName || other.name || "Học viên",
              avatar: other.profile?.avatar || other.image,
              learningLevel: other.learningLevel,
            },
            lastMessage: lastMsg
              ? {
                  id: lastMsg.id,
                  content: lastMsg.content,
                  senderId: lastMsg.senderId,
                  createdAt: lastMsg.createdAt,
                  isRead: lastMsg.isRead,
                }
              : null,
            unreadCount,
          };
        })
      );

      // Sort by latest message
      conversations.sort((a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

      return NextResponse.json({ conversations, totalUnread });
    }

    // Check friendship before reading messages
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Bạn cần kết bạn trước khi xem hoặc nhắn tin" },
        { status: 403 }
      );
    }

    const whereClause: any = {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    };

    if (after) {
      whereClause.createdAt = { gt: new Date(after) };
    }

    const messages = await prisma.directMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Mark incoming messages as read
    await prisma.directMessage.updateMany({
      where: {
        senderId: friendId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ messages });
  } catch (err: unknown) {
    console.error("[/api/messages GET Error]:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, content, attachmentType, attachmentData } = body;

    const hasAttachment = Boolean(attachmentData);
    const trimmedContent = content?.trim() || "";

    if (!receiverId || (!trimmedContent && !hasAttachment)) {
      return NextResponse.json({ error: "Nội dung tin nhắn không được để trống" }, { status: 400 });
    }

    // Default placeholder content if message contains an attachment without typed text
    let finalContent = trimmedContent;
    if (!finalContent && hasAttachment) {
      if (attachmentType === "AUDIO") finalContent = "🎤 Tin nhắn thoại";
      else if (attachmentType === "IMAGE") finalContent = "📷 Hình ảnh";
      else finalContent = "📎 Tệp đính kèm";
    }

    // Strict friendship check: Users must be ACCEPTED friends to message!
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
        { error: "Hai bạn cần kết bạn với nhau trước khi nhắn tin!" },
        { status: 403 }
      );
    }

    const message = await prisma.directMessage.create({
      data: {
        senderId: userId,
        receiverId,
        content: finalContent,
        attachmentType: attachmentType || "NONE",
        attachmentData: attachmentData ? (typeof attachmentData === "string" ? attachmentData : JSON.stringify(attachmentData)) : null,
      },
    });

    // Send Web Push notification to receiver (even if offline / tab closed)
    (async () => {
      try {
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, profile: { select: { displayName: true } } },
        });
        const senderName = sender?.profile?.displayName || sender?.name || "Bạn bè";
        await sendPushToUser(receiverId, {
          title: `💬 Tin nhắn từ ${senderName}`,
          body: finalContent.length > 80 ? finalContent.slice(0, 77) + "..." : finalContent,
          url: `/app/messages?friendId=${userId}`,
          tag: `msg-${userId}`,
        });
      } catch (pushErr) {
        console.warn("[/api/messages] Push error:", pushErr);
      }
    })();

    return NextResponse.json({ message });
  } catch (err: unknown) {
    console.error("[/api/messages POST Error]:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

