import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import "./path.css";
import { authOptions } from "@/lib/auth-options";
import { resolvePersonalizationTrack } from "@/lib/learning-level";
import { prisma } from "@/lib/prisma";
import {
  buildLearningPath,
  buildRemediationPlan,
  sanitizeAnswers,
} from "@/lib/personalization";
import { PathClient, type EnrichedModule } from "./PathClient";

export const metadata = { title: "Lộ Trình Cá Nhân — Nihon Quest" };

export default async function LearningPathPage() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect("/login");

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        learningLevel: true,
        learningGoal: true,
        dailyGoalMinutes: true,
        levelChoice: true,
        focusSkill: true,
        learningStyle: true,
        onboardingCompleted: true,
        profile: { select: { displayName: true } },
      },
    });
  } catch (err) {
    console.warn("[LearningPathPage] User fetch warning:", err);
  }

  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");

  const answers = sanitizeAnswers({
    level: resolvePersonalizationTrack(user),
    goal: user.learningGoal,
    dailyGoalMinutes: user.dailyGoalMinutes,
    focusSkill: user.focusSkill,
    learningStyle: user.learningStyle,
  });
  const path = buildLearningPath(answers);

  // Enrich LESSON / MOCK modules with real content + progress + SRS stats.
  const slugs = path.modules
    .filter((m) => (m.kind === "LESSON" || m.kind === "MOCK") && m.slug)
    .map((m) => m.slug!)
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const now = new Date();
  let lessons: any[] = [];
  let dueSrsCount = 0;
  let weakSrsCount = 0;
  let userLowLessons: any[] = [];

  try {
    const res = await Promise.all([
      prisma.lesson.findMany({
        where: { slug: { in: slugs }, isPublished: true },
        select: {
          slug: true,
          title: true,
          description: true,
          xpReward: true,
          progress: { where: { userId: uid } },
          _count: { select: { exercises: true } },
        },
      }),
      prisma.reviewItem.count({
        where: { userId: uid, dueAt: { lte: now } },
      }),
      prisma.reviewItem.count({
        where: { userId: uid, repetitions: 0 },
      }),
      prisma.userLessonProgress.findMany({
        where: { userId: uid, score: { lt: 75 } },
        include: { lesson: { select: { slug: true, title: true } } },
        orderBy: { score: "asc" },
        take: 3,
      }),
    ]);
    lessons = res[0] || [];
    dueSrsCount = res[1] || 0;
    weakSrsCount = res[2] || 0;
    userLowLessons = res[3] || [];
  } catch (err) {
    console.warn("[LearningPathPage] Non-critical enrichment query warning:", err);
  }

  const bySlug = new Map(lessons.map((l) => [l.slug, l]));

  let activeLessonSeen = false;
  let lastIncompleteLessonTitle: string | undefined;
  let lastIncompleteLessonSlug: string | undefined;

  const modules: EnrichedModule[] = path.modules.map((m) => {
    const lesson = m.slug ? bySlug.get(m.slug) : undefined;
    const raw = lesson?.progress[0]?.status;
    const score = lesson?.progress[0]?.score ?? null;

    if (!lesson) {
      return {
        ...m,
        status: "AVAILABLE",
        score: null,
        exerciseCount: null,
      };
    }

    if (raw === "COMPLETED") {
      return {
        ...m,
        title: lesson.title,
        description: lesson.description,
        xp: lesson.xpReward,
        status: "COMPLETED",
        score,
        exerciseCount: lesson._count.exercises,
      };
    }

    if (!activeLessonSeen) {
      activeLessonSeen = true;
      lastIncompleteLessonTitle = lesson.title;
      lastIncompleteLessonSlug = lesson.slug;
      return {
        ...m,
        title: lesson.title,
        description: lesson.description,
        xp: lesson.xpReward,
        status: raw === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED",
        score,
        exerciseCount: lesson._count.exercises,
      };
    }

    return {
      ...m,
      title: lesson.title,
      description: lesson.description,
      xp: lesson.xpReward,
      status: "LOCKED",
      score,
      exerciseCount: lesson._count.exercises,
      prerequisiteTitle: lastIncompleteLessonTitle,
      prerequisiteSlug: lastIncompleteLessonSlug,
    };
  });

  const remediationItems = buildRemediationPlan({
    dueSrsCount,
    weakSrsCount,
    lowScoreLessons: userLowLessons
      .filter((lp) => typeof lp.score === "number")
      .map((lp) => ({
        slug: lp.lesson.slug,
        title: lp.lesson.title,
        score: lp.score ?? 0,
      })),
  });

  const currentIdx = modules.findIndex((m) => m.status === "NOT_STARTED" || m.status === "IN_PROGRESS");
  const displayName = user.profile?.displayName || session?.user?.name || "Bạn";

  return (
    <PathClient
      displayName={displayName}
      answers={answers}
      path={path}
      modules={modules}
      remediationItems={remediationItems}
      currentIdx={currentIdx}
    />
  );
}
