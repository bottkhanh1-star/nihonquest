import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const existingLike = await prisma.communityLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.communityLike.delete({
        where: { id: existingLike.id },
      });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await prisma.communityLike.create({
        data: {
          postId,
          userId,
        },
      });
      await prisma.communityPost.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
      });
      return NextResponse.json({ liked: true });
    }
  } catch (err: unknown) {
    console.error("[/api/feed/[id]/like POST Error]:", err);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}

