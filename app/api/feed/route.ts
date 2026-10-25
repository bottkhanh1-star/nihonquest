import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category");
    const levelTag = searchParams.get("levelTag");
    const search = searchParams.get("q")?.trim();
    const onlyFriends = searchParams.get("friends") === "true";
    const sort = searchParams.get("sort");
    const orderByClause: any =
      sort === "popular"
        ? [{ likesCount: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" };

    const whereClause: any = {};

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (levelTag && levelTag !== "ALL") {
      whereClause.levelTag = levelTag;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    if (onlyFriends && userId) {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ userId }, { friendId: userId }],
        },
      });
      const friendIds = friendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
      whereClause.authorId = { in: [...friendIds, userId] };
    }

    const posts = await prisma.communityPost.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            learningLevel: true,
            currentStreak: true,
            profile: { select: { displayName: true, avatar: true } },
          },
        },
        likes: userId ? { where: { userId } } : false,
        _count: {
          select: { comments: true, likes: true },
        },
      },
      orderBy: orderByClause,
      take: 40,
    });

    const formattedPosts = posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      levelTag: p.levelTag,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      author: {
        id: p.author.id,
        name: p.author.profile?.displayName || p.author.name || "Học viên",
        avatar: p.author.profile?.avatar || p.author.image,
        learningLevel: p.author.learningLevel,
        currentStreak: p.author.currentStreak,
      },
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      hasLiked: Boolean(p.likes && p.likes.length > 0),
    }));

    return NextResponse.json({ posts: formattedPosts });
  } catch (err: unknown) {
    console.error("[/api/feed GET Error]:", err);
    return NextResponse.json({ error: "Failed to load feed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, category, levelTag, imageUrl } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Nội dung bài viết không được để trống" }, { status: 400 });
    }

    const post = await prisma.communityPost.create({
      data: {
        authorId: userId,
        title: title?.trim() || null,
        content: content.trim(),
        category: category || "GENERAL",
        levelTag: levelTag || "ALL",
        imageUrl: imageUrl || null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            learningLevel: true,
            currentStreak: true,
            profile: { select: { displayName: true, avatar: true } },
          },
        },
      },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        levelTag: post.levelTag,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        author: {
          id: post.author.id,
          name: post.author.profile?.displayName || post.author.name || "Học viên",
          avatar: post.author.profile?.avatar || post.author.image,
          learningLevel: post.author.learningLevel,
          currentStreak: post.author.currentStreak,
        },
        likesCount: 0,
        commentsCount: 0,
        hasLiked: false,
      },
    });
  } catch (err: unknown) {
    console.error("[/api/feed POST Error]:", err);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

