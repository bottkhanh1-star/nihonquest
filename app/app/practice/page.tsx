import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import Link from "next/link";
import { authOptions } from "@/lib/auth-options";
import { resolveCanonicalUserLevel } from "@/lib/learning-level";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { JapanBackdrop } from "@/components/JapanIllustration";
import { PracticeClient, type UnitInfo, type PracticeLessonItem } from "./PracticeClient";
import { getLessonCurriculumMetadata } from "@/lib/curriculum-tracks";
import { LocalizedText } from "@/components/LocalizedText";
import { LocalizedLessonTitle } from "@/components/LocalizedLesson";

function cleanLessonTitle(title: string): string {
  if (!title) return "";
  return title.replace(/^(Minna\s+)?Bài\s*\d+(\s*\([^\)]+\))?:\s*/i, "").trim();
}

export const metadata = {
  title: "Khóa Học & Luyện Tập JLPT — Nihon Quest",
};

const UNITS_BY_LEVEL: Record<string, UnitInfo[]> = {
  N5: [
    { number: 1, title: "Unit 01: Nhập Môn, Kana & Chào Hỏi", description: "Bảng chữ cái Hiragana, Katakana, biến âm, ảo âm, văn hóa chào hỏi & làm quen giao tiếp", icon: "🌱", startIndex: 0, endIndex: 10 },
    { number: 2, title: "Unit 02: Đồ Vật, Nơi Chốn & Hoạt Động", description: "Chỉ thị từ Kore/Sore/Are, địa điểm, thời gian, động từ di chuyển & các cặp tính từ sơ cấp", icon: "🍱", startIndex: 10, endIndex: 20 },
    { number: 3, title: "Unit 03: Tồn Tại, So Sánh & Thể Te", description: "Tồn tại Arimasu/Imasu, số đếm, so sánh hơn nhất, nguyện vọng & bí quyết chia Thể Te", icon: "🏪", startIndex: 20, endIndex: 30 },
    { number: 4, title: "Unit 04: Thể Nai, Ta, Thể Thường & Định Ngữ", description: "Mẫu câu cấm đoán, bắt buộc làm, thể từ điển, kinh nghiệm từng trải & mệnh đề bổ ngữ danh từ", icon: "⛩️", startIndex: 30, endIndex: 40 },
    { number: 5, title: "Unit 05: Kanji Master & Mock Test JLPT N5", description: "100+ Kanji cốt lõi, 10 trợ từ then chốt, phản xạ 5 thể động từ, đọc hiểu & đề thi thử toàn diện", icon: "🏆", startIndex: 40, endIndex: 50 },
    { number: 6, title: "Unit 06: Chuyên Đề Bổ Trợ Giao Tiếp Sơ Cấp (Part 1–9)", description: "9 chuyên đề thực hành từ vựng, ngữ pháp và hội thoại giao tiếp sơ cấp mở rộng", icon: "🎓", startIndex: 50, endIndex: 60 },
  ],
  N4: [
    { number: 1, title: "Unit 01: Biến Thể Động Từ & Thể Trạng Thái", description: "Thể てしまう, やすい/にくい, すぎる và các biến thể động từ sơ trung cấp", icon: "🗂️", startIndex: 0, endIndex: 5 },
    { number: 2, title: "Unit 02: Câu Điều Kiện & Giả Định", description: "Bốn dạng câu giả định: ば, たら, なら, と — phân biệt và sử dụng đúng ngữ cảnh", icon: "🔄", startIndex: 5, endIndex: 10 },
    { number: 3, title: "Unit 03: Bị Động, Sai Khiến & Xin Phép", description: "Thể Bị động (受身), Thể Sai khiến và Mẫu câu xin phép nơi công sở", icon: "🏢", startIndex: 10, endIndex: 15 },
    { number: 4, title: "Unit 04: Cho Nhận & Diễn Đạt Ý Định", description: "Mẫu câu cho nhận あげる/もらう/くれる, khuyên nhủ ほうがいい và suy đoán", icon: "🎁", startIndex: 15, endIndex: 20 },
    { number: 5, title: "Unit 05: Kanji N4 & Đề Thi Thử JLPT N4", description: "Kanji sơ trung cấp, tổng hợp ngữ pháp N4, đọc hiểu & đề thi thử JLPT N4 toàn diện", icon: "🏅", startIndex: 20, endIndex: 25 },
  ],
  N3: [
    { number: 1, title: "Unit 01: Giao Tiếp Công Sở & Khẳng Định Logic", description: "Văn hóa Horenso công sở, に関して, わけがない, に違いない và khẳng định chắc chắn", icon: "💼", startIndex: 0, endIndex: 5 },
    { number: 2, title: "Unit 02: Thời Điểm, Nguyên Nhân & Mức Độ", description: "たとたん, うちに, おかげで, せいで, に比べて và diễn đạt mức độ so sánh", icon: "⏳", startIndex: 5, endIndex: 10 },
    { number: 3, title: "Unit 03: Phủ Định, Trạng Thái & Kính Ngữ N3", description: "わけではない, つつある, っぱなし, thụ động sai khiến và kính ngữ giao tiếp N3", icon: "🎯", startIndex: 10, endIndex: 15 },
    { number: 4, title: "Unit 04: Kanji Master N3 (Xã Hội & Công Việc)", description: "Bộ Kanji N3 cốt lõi về chính trị, kinh tế, công sở, kỹ thuật và đăng ký", icon: "🈁", startIndex: 15, endIndex: 20 },
    { number: 5, title: "Unit 05: Từ Vựng, Đọc Hiểu & Đề Thi Thử N3", description: "Động từ N3 tần suất cao, tính từ, đọc hiểu email công việc & đề thi thử JLPT N3", icon: "🏆", startIndex: 20, endIndex: 25 },
  ],
};

const LEVEL_DESCS: Record<string, string> = {
  N5: "Hệ thống bài học cơ bản từ Kana đến giao tiếp hàng ngày kèm trắc nghiệm giúp bạn chinh phục JLPT hiệu quả.",
  N4: "Lộ trình sơ trung cấp: Biến thể động từ, câu điều kiện, bị động và sai khiến thực chiến.",
  N3: "Ngữ pháp trung cấp: Diễn đạt sắc thái, thời điểm và giao tiếp nơi công sở chuyên nghiệp.",
};

export default async function PracticePage() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { learningLevel: true, levelChoice: true },
  });
  const userLevel = resolveCanonicalUserLevel(user);

  const allLessons = await prisma.lesson.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: { progress: { where: { userId: uid } }, _count: { select: { exercises: true } } },
  });

  const lessons = allLessons.filter((l) => l.level === userLevel);
  const completedCount = lessons.filter((l) => l.progress[0]?.status === "COMPLETED").length;
  const completionRatio = lessons.length > 0 ? completedCount / lessons.length : 0;
  const progressPercent = Math.round(completionRatio * 100);
  const nextLesson = lessons.find((l) => l.progress[0]?.status !== "COMPLETED") || lessons[0];
  const units = UNITS_BY_LEVEL[userLevel] ?? UNITS_BY_LEVEL["N5"];

  const serializeLesson = (l: (typeof allLessons)[number]): PracticeLessonItem => ({
    id: l.id,
    order: l.order,
    slug: l.slug,
    title: l.title,
    description: l.description,
    xpReward: l.xpReward,
    level: l.level,
    exercisesCount: l._count.exercises,
    progressStatus: l.progress[0]?.status as "COMPLETED" | "IN_PROGRESS" | undefined,
    score: l.progress[0]?.score,
    curriculum: getLessonCurriculumMetadata(l),
  });

  const serializedLessons: PracticeLessonItem[] = lessons.map(serializeLesson);
  const serializedAllLessons: PracticeLessonItem[] = allLessons.map(serializeLesson);

  const stats = [
    { icon: "📚", tone: "bg-red-50 text-red-600 dark:bg-red-950/40", value: `${allLessons.length} bài học`, label: "N5・N4・N3 & FPT" },
    { icon: "⏱️", tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40", value: "~15 phút/bài", label: "học ngắn gọn" },
    { icon: "📈", tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40", value: `${progressPercent}%`, label: `hoàn thành ${userLevel}` },
  ];

  return (
    <div className="nq-workspace">
      <JapanBackdrop />
      <AppNav />

      {/* ───────── HERO: ảnh Phú Sĩ làm nền, mờ dần sang trái ───────── */}
      <section className="relative mx-auto max-w-[1320px] overflow-hidden sm:px-6" data-intro>
        <div className="relative overflow-hidden lg:rounded-3xl">
          {/* Ảnh Phú Sĩ nằm trong khung, mờ dần sang trái bằng mask (không còn khối trắng) */}
          <div
            className="absolute inset-y-0 right-0 w-full lg:w-[72%]"
            style={{
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 38%)",
              maskImage: "linear-gradient(to right, transparent 0%, #000 38%)",
            }}
          >
            <Image
              src={BASE64_IMAGES.fujiHero} unoptimized
              alt=""
              fill
              priority
              sizes="(min-width: 1320px) 950px, 100vw"
              className="object-cover object-[60%_center]"
            />
          </div>
          <div className="absolute inset-0 bg-white/80 dark:bg-sumi-950/80 lg:hidden" />
        <div className="relative px-4 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold tracking-[0.3em] text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
              <LocalizedText k="learnJapaneseTag" fallback="HỌC TIẾNG NHẬT" /> · JLPT {userLevel}
            </div>
            <h1 className="text-[clamp(2.25rem,8vw,4rem)] font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white">
              <LocalizedText k="practiceHeroLine1" fallback="Học tiếng Nhật qua" />
              <br />
              <LocalizedText k="practiceHeroLine2" fallback="hành trình" />{" "}
              <span className="relative text-red-600">
                <LocalizedText k="practiceHeroHighlight" fallback="thực tế." />
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 6 Q60 1 120 4 T198 3" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
              <LocalizedText k={`levelDesc_${userLevel}`} fallback={LEVEL_DESCS[userLevel] ?? LEVEL_DESCS["N5"]} />
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3.5 py-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-sumi-900/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg bg-red-50 text-red-600 dark:bg-red-950/40">📚</span>
                <div className="leading-tight">
                  <b className="block text-[13px] text-slate-900 dark:text-white">{allLessons.length} <LocalizedText k="lessonCountUnit" fallback="bài học" /></b>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400">N5・N4・N3 & FPT</small>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3.5 py-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-sumi-900/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">⏱️</span>
                <div className="leading-tight">
                  <b className="block text-[13px] text-slate-900 dark:text-white">~15 <LocalizedText k="minsPerLesson" fallback="phút/bài" /></b>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400"><LocalizedText k="biteSizedLearning" fallback="học ngắn gọn" /></small>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3.5 py-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-sumi-900/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">📈</span>
                <div className="leading-tight">
                  <b className="block text-[13px] text-slate-900 dark:text-white">{progressPercent}%</b>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400"><LocalizedText k="completedOfLevel" fallback="hoàn thành" /> {userLevel}</small>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {nextLesson && (
                <Link
                  href={`/app/practice/${nextLesson.slug}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-red-600 px-7 text-sm font-black text-white nq-btn-3d active:scale-[0.98]"
                >
                  <LocalizedText k="btnStartNow" fallback="Bắt đầu học ngay" /> <span aria-hidden>→</span>
                </Link>
              )}
              <a
                href="#courses"
                className="inline-flex min-h-12 items-center gap-3 rounded-full border border-slate-200 bg-white/95 py-1 pl-1 pr-5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-sumi-900/90 dark:text-slate-200 nq-btn-3d-white"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs dark:bg-sumi-800">▶</span>
                <LocalizedText k="btnViewLessonList" fallback="Xem danh sách bài học" />
              </a>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ───────── TIẾN ĐỘ + MASCOT MÈO THẦN TÀI ───────── */}
      <section className="mx-auto mt-4 mb-8 max-w-[1320px] px-4 sm:px-6" data-reveal>
        <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-r from-rose-50 via-white to-rose-50/60 p-5 shadow-sm dark:border-red-900/40 dark:from-sumi-900 dark:via-sumi-900 dark:to-red-950/30 md:p-6">
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto] lg:grid-cols-[1.1fr_1fr_auto]">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-4xl dark:bg-red-950/50" aria-hidden>🏮</span>
              <div className="min-w-0 flex-1">
                <small className="text-[10px] font-bold tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  <LocalizedText k="pathProgressLabel" fallback="TIẾN ĐỘ LỘ TRÌNH JLPT" /> {userLevel}
                </small>
                <h2 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                  {progressPercent === 100 ? (
                    <LocalizedText k="courseCompletedTitle" fallback={`Hoàn thành khóa ${userLevel}!`} />
                  ) : (
                    <LocalizedText k="continueJourneyTitle" fallback="Tiếp tục hành trình học tập." />
                  )}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <LocalizedText k="youCompleted" fallback="Bạn đã hoàn thành" /> <b>{completedCount}/{lessons.length}</b> <LocalizedText k="lessonCountUnit" fallback="bài học" />.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-rose-100 dark:bg-sumi-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <b className="text-xs text-slate-700 dark:text-slate-200">{progressPercent}%</b>
                </div>
              </div>
            </div>

            {nextLesson && (
              <div className="flex items-center gap-4 rounded-2xl border border-rose-100 bg-white/80 p-4 dark:border-slate-800 dark:bg-sumi-950/60">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-lg font-black text-white shadow-md">
                  {userLevel}
                </span>
                <div className="min-w-0">
                  <b className="block text-sm text-slate-900 dark:text-white">
                    <LocalizedText k="nextLesson" fallback="Bài tiếp theo" />
                  </b>
                  <small className="mb-2 block truncate text-xs text-slate-500 dark:text-slate-400">
                    <LocalizedLessonTitle slug={nextLesson.slug} fallback={cleanLessonTitle(nextLesson.title)} />
                  </small>
                  <Link
                    href={`/app/practice/${nextLesson.slug}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-red-600 px-5 text-xs font-black text-white shadow-md shadow-red-600/25 hover:bg-red-700"
                  >
                    <LocalizedText k="btnLearnNow" fallback="Học ngay" /> →
                  </Link>
                </div>
              </div>
            )}

            <div className="relative hidden h-32 w-32 justify-self-end md:block lg:h-36 lg:w-36">
              <Image src={BASE64_IMAGES.catHand} unoptimized alt="Mèo thần tài Maneki-neko" fill sizes="144px" className="object-contain drop-shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      <div id="courses" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-20 sm:px-6" data-reveal>
        <PracticeClient
          lessons={serializedLessons}
          allLessons={serializedAllLessons}
          units={units}
          unitsByLevel={UNITS_BY_LEVEL}
          userLevel={userLevel}
          currentLevelCompletionRatio={completionRatio}
        />
      </div>
    </div>
  );
}