import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { getLessonCurriculumMetadata } from "@/lib/curriculum-tracks";
import { evaluateLessonAccess, resolveCanonicalUserLevel } from "@/lib/learning-level";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { JapanBackdrop, JapanScenicPanel } from "@/components/JapanIllustration";
import { LocalizedText } from "@/components/LocalizedText";
import {
  LocalizedTrackTitle,
  LocalizedShortTrackLabel,
  LocalizedLessonTitle,
  LocalizedLessonDesc,
  LocalizedChapterLabel,
  LocalizedProvenance,
} from "@/components/LocalizedLesson";
import { QuizRunner } from "./QuizRunner";
import {
  DialogueSection,
  GrammarSection,
  LessonObjectivesSection,
  LessonStepsBar,
  SectionShell,
  VocabSection,
  type DialogueLineView,
  type GrammarView,
  type LessonObjectiveNoteView,
  type VocabView,
} from "./LessonSections";
import { IconChart, IconClock, IconBook, IconHome, IconTarget } from "./LessonIcons";

const HAS_JAPANESE = /[ぁ-んァ-ン一-龯]/;

const LEVEL_LABEL: Record<string, string> = {
  N5: "Cơ bản (N5)",
  N4: "Sơ trung cấp (N4)",
  N3: "Trung cấp (N3)",
  N2: "Trung cao cấp (N2)",
  N1: "Cao cấp (N1)",
};

function cleanLessonTitle(title: string): string {
  if (!title) return "";
  return title.replace(/^(Minna\s+)?Bài\s*\d+(\s*\([^\)]+\))?:\s*/i, "").trim();
}

function scenicVariant(title: string): "konbini" | "ramen" | "street" | "kyoto" {
  const value = title.toLowerCase();
  if (value.includes("ramen") || value.includes("nhà hàng") || value.includes("ẩm thực")) return "ramen";
  if (value.includes("konbini") || value.includes("mua sắm") || value.includes("cửa hàng")) return "konbini";
  if (value.includes("du lịch") || value.includes("văn hóa")) return "kyoto";
  return "street";
}

function buildRegisterComparison(level: string, title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("kính ngữ") || level === "N3") {
    return {
      standard: "〜ます / 〜です (Lịch sự tiêu chuẩn: 行きます・見ます・言います)",
      casualOrKeigo: "Tôn kính: いらっしゃる・ご覧になる | Khiêm nhường: 参る・拝見する | Thân mật: 行く・見る",
      contextNote: "Trong công sở/khách hàng dùng Kính ngữ (尊敬語/謙譲語); với người lạ dùng 丁寧語 (ます/です); với bạn thân dùng thể thường (普通形).",
    };
  }
  if (level === "N4") {
    return {
      standard: "Thể lịch sự (丁寧形): 〜と思います / 〜てください / 〜ので",
      casualOrKeigo: "Thể thông thường (普通形): 〜と思う / 〜て / 〜から | Phương ngữ Kansai: 〜やと思う / 〜てな",
      contextNote: "Từ N4, bạn cần phân biệt rõ khi nào chia thể thường (đứng trước と思う, から, ので, 時) và khi nào giữ 〜ます ở cuối câu.",
    };
  }
  return {
    standard: "Thể lịch sự chuẩn (標準語・丁寧語): 〜です / 〜ます / 〜ませんか",
    casualOrKeigo: "Thân mật (タメ口): 〜だ / Động từ nguyên mẫu | Vùng Kansai: おおきに (Cảm ơn), あかん (Không được)",
    contextNote: "Người mới bắt đầu (N5) nên ưu tiên dùng 丁寧語 (です/ます) trong mọi tình huống thực tế để luôn lịch sự và an toàn.",
  };
}

// Lấy field tuỳ chọn (schema có thể có hoặc không có) mà không làm vỡ type-check
function pick(source: unknown, keys: string[]): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export default async function LessonRunnerPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect("/login");

  const [user, lesson] = await Promise.all([
    prisma.user.findUnique({
      where: { id: uid },
      select: { learningLevel: true, levelChoice: true },
    }),
    prisma.lesson.findUnique({
      where: { slug: params.slug },
      include: {
        items: { orderBy: { order: "asc" } },
        exercises: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      },
    }),
  ]);
  if (!lesson) notFound();

  const userLevel = resolveCanonicalUserLevel(user);

  // Bài kế tiếp, bài tiên quyết ngay trước đó cùng cấp độ + số thứ tự "Unit"
  const [
    nextLesson,
    prevLesson,
    lessonsBefore,
    currentLessonProgress,
    userLevelTotalLessons,
    userLevelCompletedLessons,
  ] = await Promise.all([
    prisma.lesson.findFirst({
      where: { isPublished: true, level: lesson.level, order: { gt: lesson.order } },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, title: true, level: true, xpReward: true },
    }),
    prisma.lesson.findFirst({
      where: { isPublished: true, level: lesson.level, order: { lt: lesson.order } },
      orderBy: { order: "desc" },
      select: { id: true, slug: true, title: true },
    }),
    prisma.lesson.count({ where: { isPublished: true, level: lesson.level, order: { lt: lesson.order } } }),
    prisma.userLessonProgress.findUnique({
      where: { userId_lessonId: { userId: uid, lessonId: lesson.id } },
      select: { status: true },
    }),
    prisma.lesson.count({ where: { isPublished: true, level: userLevel } }),
    prisma.userLessonProgress.count({
      where: { userId: uid, status: "COMPLETED", lesson: { level: userLevel, isPublished: true } },
    }),
  ]);

  const prevProgress = prevLesson
    ? await prisma.userLessonProgress.findUnique({
        where: { userId_lessonId: { userId: uid, lessonId: prevLesson.id } },
        select: { status: true },
      })
    : null;

  const completionRatio =
    userLevelTotalLessons > 0 ? userLevelCompletedLessons / userLevelTotalLessons : 0;

  const access = evaluateLessonAccess({
    userLevel,
    lessonLevel: lesson.level,
    lessonIndexInLevel: lessonsBefore,
    isCompleted: currentLessonProgress?.status === "COMPLETED",
    isInProgress: currentLessonProgress?.status === "IN_PROGRESS",
    prevLessonCompleted: !prevLesson || prevProgress?.status === "COMPLETED",
    isFirstInUnit: lessonsBefore % 5 === 0,
    isFptSupplementary: lesson.slug.startsWith("fpt-jpd"),
    currentLevelCompletionRatio: completionRatio,
  });

  if (!access.unlocked && access.lockReason === "HIGHER_LEVEL") {
    return (
      <div className="nq-workspace">
        <JapanBackdrop />
        <AppNav />
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl border border-amber-300 bg-white p-6 text-center shadow-lg dark:border-amber-800/70 dark:bg-sumi-900 sm:p-8">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950/60" aria-hidden>
              🔒
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
              <LocalizedText k="higherLevelContent" fallback="Nội dung vượt cấp" /> · JLPT {lesson.level}
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {cleanLessonTitle(lesson.title)}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {access.lockMessage}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/app/test"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-red-600/25 transition hover:bg-red-700"
              >
                <LocalizedText k="testToUnlock" fallback="Thi xếp lớp mở khóa" /> {lesson.level} →
              </Link>
              <Link
                href="/app/practice"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
              >
                <LocalizedText k="backToPath" fallback="Về lộ trình" /> {userLevel}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const unitLabel = String(lessonsBefore + 1).padStart(2, "0");

  const vocabIds = new Set<string>();
  const grammarIds = new Set<string>();
  for (const item of lesson.items) {
    if (item.contentType === "VOCAB") vocabIds.add(item.contentId);
    if (item.contentType === "GRAMMAR") grammarIds.add(item.contentId);
  }
  for (const exercise of lesson.exercises) {
    if (exercise.contentType === "VOCAB" && exercise.contentId) vocabIds.add(exercise.contentId);
    if (exercise.contentType === "GRAMMAR" && exercise.contentId) grammarIds.add(exercise.contentId);
  }

  const [resolvedVocabulary, resolvedGrammar] = await Promise.all([
    vocabIds.size
      ? prisma.vocabulary.findMany({ where: { id: { in: Array.from(vocabIds) } }, include: { examples: true }, take: 12 })
      : prisma.vocabulary.findMany({ where: { jlptLevel: lesson.level }, include: { examples: true }, orderBy: { word: "asc" }, take: 8 }),
    grammarIds.size
      ? prisma.grammar.findMany({ where: { id: { in: Array.from(grammarIds) } }, include: { examples: true }, take: 3 })
      : prisma.grammar.findMany({ where: { level: lesson.level }, include: { examples: true }, orderBy: { title: "asc" }, take: 2 }),
  ]);

  // ── Serialize cho client components ──
  const vocab: VocabView[] = resolvedVocabulary.map((w) => ({
    id: w.id,
    word: w.word,
    kana: w.kana,
    romaji: w.romaji,
    meaning: w.meaning,
    partOfSpeech: w.partOfSpeech,
    jlptLevel: w.jlptLevel,
    kanji: w.kanji || undefined,
    tags: w.tags || undefined,
    imageUrl: pick(w, ["imageUrl", "image", "imagePath"]),
  }));

  const grammar: GrammarView[] = resolvedGrammar.map((g) => ({
    id: g.id,
    title: g.title,
    romaji: pick(g, ["romaji", "reading"]),
    meaning: g.meaning,
    usage: pick(g, ["usage", "explanation", "note", "notes"]),
    commonMistakes: g.commonMistakes || undefined,
    structure: g.structure,
    examples: g.examples.slice(0, 3).map((e) => ({
      japanese: e.japanese,
      romaji: pick(e, ["romaji"]),
      translation: pick(e, ["vietnamese", "translation", "meaning", "english"]),
    })),
  }));

  // Hội thoại: ưu tiên câu ví dụ ngữ pháp (câu tiếng Nhật thật)
  const grammarSentences = resolvedGrammar.flatMap((g) =>
    g.examples.map((e) => ({
      japanese: e.japanese,
      romaji: pick(e, ["romaji"]),
      translation: pick(e, ["vietnamese", "translation", "meaning", "english"]),
    }))
  );

  let dialogue: DialogueLineView[] = [];
  if (grammarSentences.length >= 2) {
    dialogue = grammarSentences.slice(0, 4).map((s, i) => ({
      id: `grammar-${i}`,
      side: i % 2 === 0 ? "a" : "b",
      ...s,
    }));
  } else {
    // Chỉ lấy câu hỏi bài tập nếu thuần túy tiếng Nhật (không phải câu hỏi tiếng Việt chứa ký tự Nhật)
    const VIETNAMESE_LETTERS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
    const realJapaneseExercises = lesson.exercises.filter(
      (ex) => HAS_JAPANESE.test(ex.question) && !VIETNAMESE_LETTERS.test(ex.question)
    );
    if (realJapaneseExercises.length > 0) {
      dialogue = realJapaneseExercises.slice(0, 4).map((ex, i) => ({
        id: ex.id,
        side: i % 2 === 0 ? "a" : "b",
        japanese: ex.question,
        translation: ex.prompt ?? undefined,
      }));
    }
  }

  // Hero line: nếu là bài Kana, tạo hero kana đẹp từ bài học thay vì hiển thị câu hỏi tiếng Việt
  let heroLine: { japanese: string; romaji?: string } | undefined;
  if (
    lesson.slug.startsWith("hiragana-") ||
    lesson.slug.startsWith("katakana-") ||
    lesson.slug.startsWith("dakuten-") ||
    lesson.slug.startsWith("yoon-")
  ) {
    const kanaMatch = lesson.title.match(/[\(（]([ぁ-んァ-ン・\s]+)[\)）]/);
    if (kanaMatch) {
      heroLine = {
        japanese: kanaMatch[1].trim(),
        romaji: lesson.slug.replace(/^(hiragana|katakana|dakuten|yoon)-/, "").split("-").join(" · "),
      };
    } else {
      heroLine = { japanese: "あ・い・う・え・お", romaji: "a · i · u · e · o" };
    }
  } else {
    heroLine = dialogue.find((line) => HAS_JAPANESE.test(line.japanese)) || (grammarSentences[0] ? { japanese: grammarSentences[0].japanese, romaji: grammarSentences[0].romaji } : undefined);
  }

  const title = cleanLessonTitle(lesson.title);
  const levelLabel = LEVEL_LABEL[lesson.level] ?? lesson.level;
  const curriculumMeta = getLessonCurriculumMetadata(lesson);

  const objectiveInfo: LessonObjectiveNoteView = {
    level: lesson.level,
    unitLabel,
    slug: lesson.slug,
    title,
    description: lesson.description,
    trackTitleVi: curriculumMeta.textbookTitle,
    chapterLabel: curriculumMeta.chapterLabel,
    provenanceStatus: curriculumMeta.provenance,
    provenanceLabelVi: curriculumMeta.provenanceLabelVi,
    sourceReference: curriculumMeta.sourceFile,
    whyItMatters: curriculumMeta.whyItMattersVi,
    objectives: [
      curriculumMeta.learningObjectiveVi,
      `Nắm vững Phát âm / Romaji | Chữ viết | Nghĩa của ${vocab.length} từ vựng trọng tâm chủ đề「${title}」.`,
      grammar.length > 0
        ? `Vận dụng chính xác mẫu ngữ pháp ${grammar.map((g) => g.title).join(", ")} và phân biệt sắc thái sử dụng.`
        : `Đạt tối thiểu 60% điểm bài luyện tập (${lesson.exercises.length} câu hỏi) để mở khóa bài tiếp theo và đồng bộ SRS.`,
    ],
    registerComparison: buildRegisterComparison(lesson.level, title),
    prerequisiteLesson: prevLesson
      ? {
          slug: prevLesson.slug,
          title: cleanLessonTitle(prevLesson.title),
          completed: prevProgress?.status === "COMPLETED",
        }
      : null,
  };

  return (
    <div className="nq-workspace">
      <JapanBackdrop />
      <AppNav />

      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        {/* ───────── Hero ───────── */}
        <section data-intro className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/app" aria-label="Dashboard" className="hover:text-slate-900 dark:hover:text-white">
                <IconHome width={18} height={18} />
              </Link>
              <span aria-hidden>›</span>
              <Link href="/app/practice" className="hover:text-slate-900 dark:hover:text-white">
                <LocalizedText k="navLessons" fallback="Giáo trình & Bài học" />
              </Link>
              <span aria-hidden>›</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                <LocalizedChapterLabel label={curriculumMeta.chapterLabel} />: <LocalizedLessonTitle slug={lesson.slug} fallback={title} />
              </span>
            </nav>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <LocalizedText k="jlptOrientation" fallback="Định hướng" /> JLPT {lesson.level}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200">
                📚 <LocalizedShortTrackLabel label={curriculumMeta.shortTrackLabel} />
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                ✓ <LocalizedProvenance label={curriculumMeta.provenanceLabelVi} provenance={curriculumMeta.provenance} />
              </span>
            </div>

            <h1 className="mt-3 font-black leading-[1.1] tracking-tight text-slate-900 dark:text-white">
              <span className="text-3xl text-red-600 dark:text-red-400 sm:text-4xl"><LocalizedChapterLabel label={curriculumMeta.chapterLabel} />:</span>{" "}
              <span className="text-3xl sm:text-4xl"><LocalizedLessonTitle slug={lesson.slug} fallback={title} /></span>
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              <LocalizedLessonDesc slug={lesson.slug} fallback={lesson.description} />
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-2"><IconBook width={18} height={18} /> 4 <LocalizedText k="learningParts" fallback="phần học" /></span>
              <span className="inline-flex items-center gap-2"><IconClock width={18} height={18} /> ~15 <LocalizedText k="minutesShort" fallback="phút" /></span>
              <span className="inline-flex items-center gap-2"><IconChart width={18} height={18} /> <LocalizedText k={`levelLabel_${lesson.level}`} fallback={levelLabel} /></span>
            </div>
          </div>

          <div className="relative min-h-[200px] overflow-hidden rounded-3xl shadow-lg">
            <JapanScenicPanel variant={scenicVariant(lesson.title)} showLabel={false} />
            {heroLine && (
              <div className="absolute left-4 top-4 max-w-[58%] rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur dark:bg-sumi-900/90 sm:left-6 sm:top-6">
                <p className="jp-text text-lg font-black leading-snug text-slate-900 dark:text-white sm:text-2xl">{heroLine.japanese}</p>
                {heroLine.romaji && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{heroLine.romaji}</p>}
              </div>
            )}
          </div>
        </section>

        {/* ───────── Mục tiêu bài học, Tiên quyết & Lưu ý Ngữ vực ───────── */}
        <LessonObjectivesSection info={objectiveInfo} />

        {/* ───────── Thanh 4 bước ───────── */}
        <LessonStepsBar />

        {/* ───────── Nội dung + Quiz ───────── */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
          <div className="min-w-0 space-y-6">
            <VocabSection words={vocab} />
            <GrammarSection items={grammar} />
            <DialogueSection lines={dialogue} />
          </div>

          <SectionShell
            id="quick-practice"
            icon={<IconTarget />}
            title={<LocalizedText k="quickPracticeTitle" fallback="4. Luyện tập nhanh" />}
            subtitle={<LocalizedText k="quickPracticeSubtitle" fallback="Làm bài quiz để củng cố kiến thức đã học. Cần đúng ít nhất 60% để mở bài tiếp theo." />}
            action={
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                🔥 +{lesson.xpReward} XP
              </span>
            }
            className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          >
            <QuizRunner
              key={lesson.id}
              lesson={JSON.parse(JSON.stringify(lesson))}
              nextLesson={nextLesson ? JSON.parse(JSON.stringify(nextLesson)) : null}
            />
          </SectionShell>
        </div>
      </div>
    </div>
  );
}
