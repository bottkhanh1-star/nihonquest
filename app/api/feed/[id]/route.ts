import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = params.id;
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json({ error: "Bài viết không tồn tại" }, { status: 404 });
    }

    if (post.authorId !== userId) {
      return NextResponse.json({ error: "Bạn không có quyền xóa bài viết này" }, { status: 403 });
    }

    // Delete comments & likes cascade, then post
    await prisma.communityComment.deleteMany({ where: { postId } });
    await prisma.communityLike.deleteMany({ where: { postId } });
    await prisma.communityPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true, message: "Đã xóa bài viết thành công" });
  } catch (error: unknown) {
    console.error("[Delete Post Error]:", error);
    return NextResponse.json({ error: "Không thể xóa bài viết lúc này" }, { status: 500 });
  }
}

