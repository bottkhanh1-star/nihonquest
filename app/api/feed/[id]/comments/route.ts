import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const comments = await prisma.communityComment.findMany({
      where: { postId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            learningLevel: true,
            profile: { select: { displayName: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: {
        id: c.author.id,
        name: c.author.profile?.displayName || c.author.name || "Học viên",
        avatar: c.author.profile?.avatar || c.author.image,
        learningLevel: c.author.learningLevel,
      },
    }));

    return NextResponse.json({ comments: formatted });
  } catch (err: unknown) {
    console.error("[/api/feed/[id]/comments GET Error]:", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = params.id;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Nội dung bình luận không được để trống" }, { status: 400 });
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId,
        authorId: userId,
        content: content.trim(),
      },
      include: {
        author: {
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

    // Update commentsCount on post
    await prisma.communityPost.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: {
          id: comment.author.id,
          name: comment.author.profile?.displayName || comment.author.name || "Học viên",
          avatar: comment.author.profile?.avatar || comment.author.image,
          learningLevel: comment.author.learningLevel,
        },
      },
    });
  } catch (err: unknown) {
    console.error("[/api/feed/[id]/comments POST Error]:", err);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

