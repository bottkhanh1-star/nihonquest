import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import "./dashboard.css";
import { authOptions } from "@/lib/auth-options";
import { resolveCanonicalUserLevel, resolvePersonalizationTrack } from "@/lib/learning-level";
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/level";
import { localDateKey } from "@/lib/streak";
import { buildEnrichedLeaderboard } from "@/lib/rivalBots";
import { AppNav } from "@/components/AppNav";
import { JapanBackdrop } from "@/components/JapanIllustration";
import {
  BrushUnderline, Daruma, Icon, ModeArt, PathDeco, ShinkansenStrip, type ModeArtKind,
} from "@/components/DashboardArt";
import { ActivityButton } from "./ActivityButton";
import { buildLearningPath, sanitizeAnswers } from "@/lib/personalization";
import { getLessonCurriculumMetadata } from "@/lib/curriculum-tracks";
import { DashboardHero } from "./DashboardHero";
import { LocalizedText } from "@/components/LocalizedText";
import { LocalizedLessonTitle, LocalizedLessonDesc, LocalizedRoadmapTag, LocalizedPathName, LocalizedPathTagline, LocalizedMissionTitle, LocalizedShortTrackLabel } from "@/components/LocalizedLesson";

export const metadata = { title: "Dashboard — Nihon Quest" };

const DAILY_INSPIRATIONS = [
  { kanji: "七転び八起き", romaji: "Nana korobi ya oki", meaning: "Ngã bảy lần, đứng dậy tám lần. Kiên trì là chìa khóa làm chủ Nhật ngữ." },
  { kanji: "継続は力なり", romaji: "Keizoku wa chikara nari", meaning: "Kiên trì tạo nên sức mạnh. Mỗi ngày 10 phút tích lũy thành thành công lớn." },
  { kanji: "一期一会", romaji: "Ichigo ichie", meaning: "Nhất kỳ nhất hội. Trân trọng từng khoảnh khắc và cơ hội học hỏi hôm nay." },
  { kanji: "千里の道も一歩から", romaji: "Senri no michi mo ippo kara", meaning: "Hành trình vạn dặm bắt đầu từ một bước chân. Hãy hoàn thành bài học hôm nay!" },
  { kanji: "日進月歩", romaji: "Nisshin geppo", meaning: "Mỗi ngày một bước tiến, mỗi tháng một bước nhảy vọt." },
  { kanji: "温故知新", romaji: "Onko chishin", meaning: "Ôn lại cái cũ để hiểu sâu cái mới. Ôn tập SRS đều đặn để nhớ mãi." },
];

const MODES: {
  tone: "rose" | "blue" | "green" | "amber";
  art: ModeArtKind;
  titleKey: string;
  title: string;
  bodyKey: string;
  body: string;
  href: string;
  ctaKey: string;
  cta: string;
}[] = [
  {
    tone: "rose",
    art: "torii",
    titleKey: "modeYokaiTitle",
    title: "Yōkai Dash — Mini Game 3D",
    bodyKey: "modeYokaiDesc",
    body: "Chạy vô tận 3 làn, né chướng ngại vật & chọn cổng tri thức tiếng Nhật nhận XP.",
    href: "/app/yokai-dash",
    ctaKey: "modeYokaiCta",
    cta: "Chơi Yōkai Dash ngay",
  },
  {
    tone: "rose",
    art: "srs",
    titleKey: "modeSrsTitle",
    title: "Hàng đợi Ôn tập (SRS)",
    bodyKey: "modeSrsDesc",
    body: "Chống quên lãng với thuật toán SM-2. Ôn tập thông minh, ghi nhớ dài hạn.",
    href: "/app/review",
    ctaKey: "modeSrsCta",
    cta: "Xem kho thẻ ôn tập",
  },
  {
    tone: "blue",
    art: "kana",
    titleKey: "modeKanaTitle",
    title: "Kana Lab — Bảng Chữ Cái",
    bodyKey: "modeKanaDesc",
    body: "Luyện viết nét Hiragana & Katakana kèm âm thanh chuẩn và vẽ trên canvas.",
    href: "/app/learn",
    ctaKey: "modeKanaCta",
    cta: "Luyện vẽ bảng chữ cái",
  },
  {
    tone: "green",
    art: "mountain",
    titleKey: "modeVocabTitle",
    title: "Kho Từ Vựng & Hán Tự",
    bodyKey: "modeVocabDesc",
    body: "Tra cứu nghĩa, phát âm và ví dụ thực tế, kèm tính năng lưu SRS 1 chạm.",
    href: "/app/vocabulary",
    ctaKey: "modeVocabCta",
    cta: "Tra cứu từ vựng & Kanji",
  },
  {
    tone: "amber",
    art: "bird",
    titleKey: "modeSurvivalTitle",
    title: "Survival Mode — Sinh Tồn",
    bodyKey: "modeSurvivalDesc",
    body: "Thử thách phản xạ từ vựng và xử lý tình huống giao tiếp theo thời gian thực.",
    href: "/app/survival",
    ctaKey: "modeSurvivalCta",
    cta: "Bắt đầu thử thách sinh tồn",
  },
  {
    tone: "rose",
    art: "torii",
    titleKey: "modeGrammarTitle",
    title: "Ngữ Pháp Cơ Bản",
    bodyKey: "modeGrammarDesc",
    body: "Giải thích dễ hiểu, ví dụ minh họa rõ ràng, luyện tập ngay.",
    href: "/app/grammar",
    ctaKey: "modeGrammarCta",
    cta: "Học ngữ pháp",
  },
];

// Thanh điều hướng nhanh bên trái (chỉ hiện ≥ 1100px, dưới đó AppNav lo).
const RAIL = [
  { icon: "home", labelKey: "railHome", label: "Trang chủ", href: "/app", active: true },
  { icon: "book", labelKey: "railLearn", label: "Học tập", href: "/app/learn", active: false },
  { icon: "chart", labelKey: "railStats", label: "Thống kê", href: "/app/stats", active: false },
  { icon: "gear", labelKey: "railSettings", label: "Cài đặt", href: "/app/settings", active: false },
] as const;

export default async function AppHome() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: uid }, include: { profile: true } });
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");

  const level = calculateLevel(user.totalXP);
  const userLevel = resolveCanonicalUserLevel(user);

  const allLessons = await prisma.lesson.findMany({
    where: { isPublished: true, level: userLevel },
    orderBy: { order: "asc" },
    include: { progress: { where: { userId: uid } } },
  });
  const completed = allLessons.filter((l) => l.progress[0]?.status === "COMPLETED").length;
  const currentLesson = allLessons.find((l) => l.progress[0]?.status !== "COMPLETED") || allLessons[0];
  const currentCurriculum = currentLesson ? getLessonCurriculumMetadata(currentLesson) : null;
  const lessonPercent = Math.round((completed / Math.max(1, allLessons.length)) * 100);

  const allJourneyLocations = await prisma.journeyLocation.findMany({
    orderBy: { order: "asc" },
    include: { userProgress: { where: { userId: uid } } },
  });

  for (const loc of allJourneyLocations) {
    const p = loc.userProgress[0];
    if (p && p.progress >= 100 && p.status !== "COMPLETED") {
      await prisma.userJourneyProgress.update({
        where: { id: p.id },
        data: { status: "COMPLETED", completedAt: p.completedAt || new Date() },
      });
      p.status = "COMPLETED";
    }
  }
  const journeyLocations = allJourneyLocations.slice(0, 5);

  const dueReviewCount = await prisma.reviewItem.count({
    where: { userId: uid, dueAt: { lte: new Date() } },
  });

  const today = localDateKey(new Date(), user.timezone || "UTC");
  let missions = await prisma.userDailyMission.findMany({ where: { userId: uid, date: today }, include: { mission: true } });
  if (!missions.length) {
    const templates = await prisma.dailyMission.findMany();
    for (const t of templates) {
      await prisma.userDailyMission.upsert({
        where: { userId_missionId_date: { userId: uid, missionId: t.id, date: today } },
        update: {},
        create: { userId: uid, missionId: t.id, date: today, targetCount: t.targetCount },
      });
    }
    missions = await prisma.userDailyMission.findMany({ where: { userId: uid, date: today }, include: { mission: true } });
  }

  for (const m of missions) {
    if (m.status !== "COMPLETED" && m.progress >= m.targetCount) {
      await prisma.userDailyMission.update({
        where: { id: m.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      m.status = "COMPLETED";
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const txSums = await prisma.xpTransaction.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: sevenDaysAgo } },
    _sum: { amount: true },
  });
  const weeklyXp = new Map<string, number>();
  txSums.forEach((t) => weeklyXp.set(t.userId, t._sum.amount || 0));

  const users = await prisma.user.findMany({
    select: { id: true, name: true, image: true, totalXP: true, level: true, currentStreak: true, profile: { select: { displayName: true, avatar: true } } },
    orderBy: [{ totalXP: "desc" }, { currentStreak: "desc" }],
    take: 20,
  });
  const formatted = users.map((u) => ({
    id: u.id, name: u.name, totalXP: u.totalXP, level: u.level, currentStreak: u.currentStreak,
    displayName: u.profile?.displayName || u.name, avatar: u.profile?.avatar || u.image || null, weeklyXp: weeklyXp.get(u.id) || 0,
  }));
  const { weeklyList } = buildEnrichedLeaderboard(formatted, uid);

  const isBeginner = userLevel === "N5" && completed < 2;
  const intro = isBeginner
    ? "Hãy bắt đầu với bảng chữ cái và các câu chào hỏi căn bản nhất. Mỗi bước nhỏ hôm nay sẽ đưa bạn đến gần hơn với Nhật Bản."
    : user.learningGoal === "TRAVEL"
      ? "Tiếp tục tích lũy từ vựng du lịch, mở khóa bài học và những chặng Shinkansen mới."
      : user.learningGoal === "CONVERSATION"
        ? "Củng cố phản xạ đối đáp và biến kiến thức thành giao tiếp thực tế."
        : "Tiếp tục nhịp học đều đặn để biến tiếng Nhật thành một phần tự nhiên trong ngày của bạn.";

  // Personalized learning path (lộ trình cá nhân hóa) from the 5
  // onboarding answers, with per-module completion resolved from lessons.
  const pathAnswers = sanitizeAnswers({
    level: resolvePersonalizationTrack(user),
    goal: user.learningGoal,
    dailyGoalMinutes: user.dailyGoalMinutes,
    focusSkill: user.focusSkill,
    learningStyle: user.learningStyle,
  });
  const myPath = buildLearningPath(pathAnswers);
  const pathSlugs = myPath.modules
    .filter((m) => m.slug)
    .map((m) => m.slug!)
    .filter((s, i, arr) => arr.indexOf(s) === i);
  const pathLessons = await prisma.lesson.findMany({
    where: { slug: { in: pathSlugs }, isPublished: true },
    select: { slug: true, title: true, progress: { where: { userId: uid } } },
  });
  const pathDone = new Set(
    pathLessons.filter((l) => l.progress[0]?.status === "COMPLETED").map((l) => l.slug),
  );
  const pathCompleted = myPath.modules.filter((m) => !m.slug || pathDone.has(m.slug)).length;
  const pathPercent = Math.round((pathCompleted / Math.max(1, myPath.modules.length)) * 100);
  const nextPathModule = myPath.modules.find((m) => m.slug && !pathDone.has(m.slug)) ?? myPath.modules[0];
  const focusSkillLine: Record<string, string> = {
    LISTENING: "Kỹ năng trọng tâm của bạn là Nghe — ưu tiên nghe hiểu mỗi ngày.",
    SPEAKING: "Kỹ năng trọng tâm của bạn là Nói — đừng ngại nói chuyện với AI Sensei.",
    READING: "Kỹ năng trọng tâm của bạn là Đọc — đọc báo & thực đơn mỗi ngày.",
    WRITING: "Kỹ năng trọng tâm của bạn là Viết — luyện viết Hán tự qua SRS.",
  };
  const skillIntro = focusSkillLine[user.focusSkill] ?? "";

  const quote = DAILY_INSPIRATIONS[new Date().getDate() % DAILY_INSPIRATIONS.length];
  const displayName = user.profile?.displayName || user.name || user.email.split("@")[0];
  const xpPercent = Math.min(100, Math.round((user.totalXP / Math.max(1, level.nextLevelXP)) * 100));
  const isLocCompleted = (l: (typeof allJourneyLocations)[number]) =>
    l.userProgress[0]?.status === "COMPLETED" || (l.userProgress[0]?.progress ?? 0) >= 100;
  const doneJourney = allJourneyLocations.filter(isLocCompleted).length;
  const totalJourney = allJourneyLocations.length;

  // Bài chưa từng mở → hiện nhãn "New" như trong thiết kế.
  const isNewLesson = !!currentLesson && !currentLesson.progress[0];
  const journeyPercent = Math.round((doneJourney / Math.max(1, totalJourney)) * 100);

  return (
    <div className="nqd">
      <JapanBackdrop />
      <div className="nqd-footer" aria-hidden="true">
        <Image src={BASE64_IMAGES.footerSakura} unoptimized alt="" fill sizes="100vw" />
      </div>
      <div className="nqd-cheer" aria-hidden="true">一緒にがんばろう!</div>

      <div className="nqd-wrap">
        <AppNav userName={displayName} userLevel={level.level} userXP={user.totalXP} avatar={user.profile?.avatar} />

        <div className="nqd-shell">
          <div className="nqd-rail-wrap">
            <nav className="nqd-rail" aria-label="Điều hướng nhanh">
              {RAIL.map((r) => (
                <Link key={r.href} href={r.href} className={`nqd-rail-item ${r.active ? "is-active" : ""}`} aria-current={r.active ? "page" : undefined}>
                  <Icon name={r.icon} size={26} />
                  <span><LocalizedText k={r.labelKey} fallback={r.label} /></span>
                </Link>
              ))}
            </nav>
            <div className="nqd-mascot" aria-hidden="true">
              <span className="cheer">がんばろう!</span>
              <Image src={BASE64_IMAGES.manekiNeko} unoptimized alt="" width={480} height={518} />
            </div>
          </div>

          <div className="nqd-main">
            <DashboardHero
              displayName={displayName}
              isBeginner={isBeginner}
              learningGoal={user.learningGoal}
              focusSkill={user.focusSkill}
              quote={quote}
              initialIntro={intro}
              initialSkillIntro={skillIntro}
            />

            <div className="nqd-grid">
              <div className="nqd-col">
                <section className="nqd-path-spotlight">
                  <div className="nqd-path-deco" aria-hidden="true"><PathDeco /></div>
                  <div className="nqd-path-head">
                    <span className="nqd-pill-soft">
                      <span className="rk"><Icon name="rocket" size={14} /></span>
                      <LocalizedText k="yourPath" fallback="LỘ TRÌNH CỦA BẠN" />
                    </span>
                    <div className="nqd-path-prog">
                      <span className="nqd-pct">{pathPercent}% <LocalizedText k="completedPct" fallback="hoàn thành" /></span>
                      <div className="nqd-bar"><span style={{ width: `${pathPercent}%` }} /></div>
                    </div>
                  </div>
                  <h2>
                    <LocalizedPathName
                      goal={pathAnswers.goal}
                      style={pathAnswers.learningStyle}
                      fallback={myPath.name}
                    />
                  </h2>
                  <p>
                    <LocalizedPathTagline
                      goal={pathAnswers.goal}
                      style={pathAnswers.learningStyle}
                      level={pathAnswers.level}
                      skill={pathAnswers.focusSkill}
                      fallback={myPath.tagline}
                    />
                  </p>
                  <div className="nqd-path-meta">
                    <span>{myPath.modules.length} <LocalizedText k="topics" fallback="chủ đề" /></span>
                    <span>{myPath.estWeeks} <LocalizedText k="weeks" fallback="tuần" /></span>
                    <span>{myPath.answers.dailyMinutes} <LocalizedText k="minsPerDay" fallback="phút/ngày" /></span>
                    <span className="nqd-path-tags">
                      <LocalizedRoadmapTag tagKey={pathAnswers.goal} fallback={myPath.answers.goalLabel} /> -{" "}
                      <LocalizedRoadmapTag tagKey={pathAnswers.focusSkill} fallback={myPath.answers.skillLabel} /> -{" "}
                      <LocalizedRoadmapTag tagKey={pathAnswers.learningStyle} fallback={myPath.answers.styleLabel} />
                    </span>
                  </div>
                  <div className="nqd-btns">
                    <Link className="nqd-btn-red" href="/app/path"><LocalizedText k="viewPersonalPath" fallback="Xem lộ trình cá nhân →" /></Link>
                    {nextPathModule && (
                      <Link className="nqd-btn-outline" href={nextPathModule.target}>
                        <LocalizedText k="unlockNext" fallback="Mở khóa tiếp theo:" /> <LocalizedLessonTitle slug={nextPathModule.slug} fallback={nextPathModule.title} />
                      </Link>
                    )}
                  </div>
                </section>

                <section className="nqd-focus">
                  <div className="nqd-focus-bg" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="nqd-bg-light" src={BASE64_IMAGES.dashLight} alt="" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="nqd-bg-dark" src={BASE64_IMAGES.dashDark} alt="" />
                  </div>
                  <div className="nqd-focus-top">
                    {isNewLesson && <span className="nqd-new">New</span>}
                    <span className="nqd-pill"><LocalizedText k="todaysLesson" fallback="BÀI HỌC HÔM NAY" /></span>
                    {currentCurriculum && (
                      <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-black text-red-700 dark:bg-red-950/60 dark:text-red-300">
                        <LocalizedShortTrackLabel label={currentCurriculum.shortTrackLabel} />
                      </span>
                    )}
                    <span>
                      {allLessons.length ? (
                        <>
                          <LocalizedText k="lessonCounter" fallback="Bài" />{" "}
                          {Math.min(completed + 1, allLessons.length)} / {allLessons.length}
                        </>
                      ) : (
                        <LocalizedText k="noLessonsYet" fallback="Chưa có bài học" />
                      )}
                    </span>
                    <span className="nqd-focus-pct">{lessonPercent}% <LocalizedText k="completedPct" fallback="hoàn thành" /></span>
                  </div>
                  <h2>{currentLesson ? <LocalizedLessonTitle slug={currentLesson.slug} fallback={currentLesson.title} /> : <LocalizedText k="pathCompletedToday" fallback="Hoàn thành lộ trình hôm nay" />}</h2>
                  <p>{currentLesson ? <LocalizedLessonDesc slug={currentLesson.slug} fallback={currentLesson.description} /> : <LocalizedText k="pathCompletedDesc" fallback={`Bạn đã hoàn thành toàn bộ bài học ${userLevel}. Hãy ôn tập SRS hoặc tiếp tục hành trình.`} />}</p>
                  <div className="nqd-btns">
                    <Link className="nqd-btn-red" href={currentLesson ? `/app/practice/${currentLesson.slug}` : "/app/review"}>
                      {currentLesson ? <LocalizedText k="continueLesson" fallback="Tiếp tục bài học" /> : <LocalizedText k="reviewSrs" fallback="Ôn tập SRS" />} →
                    </Link>
                    <Link className="nqd-btn-ghost" href="/app/practice"><LocalizedText k="viewAllLessons" fallback="Xem tất cả bài học" /></Link>
                  </div>
                  <div className="nqd-focus-vert" aria-hidden="true">
                    <div>日本語</div>
                    <div>が好き<i>♥</i></div>
                  </div>
                </section>

                <section className="nqd-explore">
                  <div className="nqd-sec-title">
                    <h2><Icon name="sakura" size={26} /><LocalizedText k="exploreTopics" fallback="Khám phá các chủ đề học tập" /></h2>
                    <span><LocalizedText k="exploreSubtitle" fallback="Mỗi chủ đề là một bước tiến gần hơn đến mục tiêu của bạn!" /></span>
                  </div>
                  <div className="nqd-modes">
                    {MODES.map((m) => (
                      <article key={m.href} className="nqd-card nqd-mode">
                        <span className={`art ${m.tone}`} aria-hidden="true"><ModeArt kind={m.art} /></span>
                        <div className="body">
                          <h3><LocalizedText k={m.titleKey} fallback={m.title} /></h3>
                          <p><LocalizedText k={m.bodyKey} fallback={m.body} /></p>
                          <Link href={m.href}><LocalizedText k={m.ctaKey} fallback={m.cta} /> →</Link>
                        </div>
                        {m.href === "/app/review" && dueReviewCount === 0 && (
                          <span className="nqd-tag"><LocalizedText k="srsAllDone" fallback="Đã ôn hết hôm nay" /></span>
                        )}
                        {m.href === "/app/review" && dueReviewCount > 0 && (
                          <span className="nqd-tag font-bold text-red-600 dark:text-red-400">
                            🔥 {dueReviewCount} <LocalizedText k="srsDueTag" fallback="thẻ cần ôn" />
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="nqd-col nqd-aside">
                <div className="nqd-mini-row">
                  <div className="nqd-card nqd-mini nqd-streak">
                    <div className="nqd-mini-top"><Icon name="flame" size={30} /><small><LocalizedText k="streakTitle" fallback="Chuỗi ngày học" /></small></div>
                    <b className="big">{user.currentStreak}</b>
                    <span className="unit"><LocalizedText k="streakUnit" fallback="ngày" /></span>
                    <p className="foot"><LocalizedText k="recordStreak" fallback="Kỷ lục:" /> {user.longestStreak} <LocalizedText k="streakUnit" fallback="ngày" /></p>
                    <span className="act"><ActivityButton /></span>
                    <span className="daruma"><Daruma /></span>
                  </div>
                  <div className="nqd-card nqd-mini nqd-level">
                    <div className="nqd-mini-top"><span className="badge"><Icon name="shield" size={28} /></span><small><LocalizedText k="levelTitle" fallback="Cấp độ học viên" /></small></div>
                    <b className="lv">Level {level.level}</b>
                    <div className="nqd-bar"><span style={{ width: `${xpPercent}%` }} /></div>
                    <p className="foot">{user.totalXP} / {level.nextLevelXP} XP</p>
                  </div>
                </div>

                <section className="nqd-card nqd-side-card">
                  <div className="nqd-side-head">
                    <h3><span className="hico red"><Icon name="target" size={24} /></span><LocalizedText k="dailyMissions" fallback="Nhiệm vụ hôm nay" /></h3>
                    <Link href="/app/practice"><LocalizedText k="viewAll" fallback="Xem tất cả →" /></Link>
                  </div>
                  {missions.slice(0, 3).map((m, i) => {
                    // Progress can exceed the target (e.g. 2 lessons done for a
                    // "1 lesson" mission), which rendered as "2 / 1".
                    const target = Math.max(1, m.targetCount);
                    const done = Math.min(Math.max(0, m.progress), target);
                    const pct = Math.round((done / target) * 100);
                    return (
                      <div className="nqd-mission" key={m.id}>
                        <span className={`chk ${pct >= 100 ? "done" : ""}`} />
                        <span className={`mi m${i}`} aria-hidden="true">
                          {i === 0 ? "あ" : <Icon name={i === 1 ? "book" : "headphones"} size={20} />}
                        </span>
                        <div>
                          <b><LocalizedMissionTitle missionKey={m.mission.key} fallback={m.mission.title} /></b>
                          <div className="nqd-bar"><span style={{ width: `${pct}%` }} /></div>
                          <small>{done} / {target}</small>
                        </div>
                        <em>+{m.mission.xpReward} XP</em>
                      </div>
                    );
                  })}
                </section>

                <section className="nqd-card nqd-side-card">
                  <div className="nqd-side-head">
                    <h3><span className="hico orange"><Icon name="trophy" size={24} /></span><LocalizedText k="weeklyLeaderboard" fallback="Bảng xếp hạng tuần này" /></h3>
                    <Link href="/app/leaderboard"><LocalizedText k="viewAll" fallback="Xem tất cả →" /></Link>
                  </div>
                  {weeklyList.slice(0, 4).map((row, i) => {
                    const label = row.displayName || row.name;
                    const isImg =
                      typeof row.avatar === "string" &&
                      (row.avatar.startsWith("data:image/") ||
                        row.avatar.startsWith("http://") ||
                        row.avatar.startsWith("https://") ||
                        row.avatar.startsWith("/"));
                    return (
                      <div className={`nqd-rank ${row.id === uid ? "me" : ""}`} key={row.id}>
                        <span className={`n ${i < 3 ? `r${i + 1}` : ""}`}>{i + 1}</span>
                        <span className="av overflow-hidden">
                          {isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.avatar!} alt={label || "Learner"} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            row.avatar && row.avatar.length <= 4 ? row.avatar : (label ? label.slice(0, 1).toUpperCase() : "学")
                          )}
                        </span>
                        <b>
                          <span className="nqd-rank-name">{label || <LocalizedText k="learner" fallback="Học viên" />}</span>
                          {/*row.isBot && (
                            <span className="ml-1.5 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-sumi-800 dark:text-slate-400">
                              🤖 AI
                            </span>
                          )*/} 
                        </b>
                        <em>{row.xp.toLocaleString("vi-VN")} XP</em>
                      </div>
                    );
                  })}
                  {weeklyList.some((row) => row.isBot) && (
                    <p className="nqd-bot-note"><LocalizedText k="simulatedOpponents" fallback="💡 Nhân vật có nhãn 🤖 AI là đối thủ mô phỏng để duy trì nhịp độ luyện tập." /></p>
                  )}
                </section>

                <section className="nqd-card nqd-side-card">
                  <div className="nqd-side-head">
                    <h3><span className="hico blue"><Icon name="train" size={24} /></span><LocalizedText k="shinkansenJourney" fallback="Hành trình Shinkansen" /></h3>
                    <Link href="/app/journey"><LocalizedText k="journeyMap" fallback="Bản đồ →" /></Link>
                  </div>
                  <div className="nqd-train"><ShinkansenStrip /></div>
                  <div className="nqd-track">
                    {journeyLocations.map((loc) => (
                      <div key={loc.id} className={`nqd-station ${isLocCompleted(loc) ? "is-done" : ""}`}>
                        <i /><span>{loc.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="nqd-bar thick"><span style={{ width: `${journeyPercent}%` }} /></div>
                  <p className="nqd-journey-count">
                    <b>{doneJourney}</b> / {totalJourney} <LocalizedText k="citiesExplored" fallback="thành phố đã khám phá" />
                  </p>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}