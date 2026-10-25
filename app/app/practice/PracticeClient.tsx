"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { KanaBattleCard } from "@/components/KanaBattleCard";
import { evaluateLevelAccess, evaluateLessonAccess } from "@/lib/learning-level";
import {
  CURRICULUM_TRACKS,
  type CurriculumTrackId,
  type LessonCurriculumMetadata,
} from "@/lib/curriculum-tracks";
import { useNativeLanguage, getLocalizedQuote } from "@/components/LanguageContext";
import {
  LocalizedLessonTitle,
  LocalizedLessonDesc,
  LocalizedUnitTitle,
  LocalizedUnitDesc,
  LocalizedTrackTitle,
  LocalizedShortTrackLabel,
  LocalizedGenkiRef,
  getLocalizedTrackTitle,
} from "@/components/LocalizedLesson";
import { MascotCheerBanner } from "@/components/mascots/AnimeMascot";

export function cleanLessonTitle(title: string): string {
  if (!title) return "";
  return title.replace(/^(Minna\s+)?Bài\s*\d+(\s*\([^\)]+\))?:\s*/i, "").trim();
}

export interface UnitInfo {
  number: number;
  title: string;
  description: string;
  icon: string;
  startIndex: number;
  endIndex: number;
}

export interface PracticeLessonItem {
  id: string;
  order: number;
  slug: string;
  title: string;
  description: string;
  xpReward: number;
  level: string;
  exercisesCount: number;
  progressStatus?: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED";
  score?: number | null;
  curriculum?: LessonCurriculumMetadata;
}

type MainTab = "LESSONS" | "BATTLE";
type SortKey = "ORDER" | "SCORE" | "XP";

const LEVEL_TONE: Record<string, string> = {
  N5: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  N4: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60",
  N3: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60",
};

export function PracticeClient({
  lessons,
  allLessons,
  units,
  unitsByLevel,
  userLevel,
  currentLevelCompletionRatio = 0,
}: {
  lessons: PracticeLessonItem[];
  allLessons?: PracticeLessonItem[];
  units: UnitInfo[];
  unitsByLevel?: Record<string, UnitInfo[]>;
  userLevel: string;
  currentLevelCompletionRatio?: number;
}) {
  const { t, nativeLanguage } = useNativeLanguage();
  const [mainTab, setMainTab] = useState<MainTab>("LESSONS");
  const [activeLevel, setActiveLevel] = useState<string>(userLevel || "N5");
  const [selectedUnit, setSelectedUnit] = useState<number | "ALL">("ALL");
  const [selectedTrack, setSelectedTrack] = useState<CurriculumTrackId | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "UNFINISHED">("ALL");
  const [sort, setSort] = useState<SortKey>("ORDER");
  const [query, setQuery] = useState("");
  const { playClick } = useSoundAndTheme();

  // Keep activeLevel synced if userLevel prop updates after settings change
  useEffect(() => {
    setActiveLevel(userLevel || "N5");
  }, [userLevel]);

  const levelAccess = useMemo(
    () =>
      evaluateLevelAccess({
        userLevel,
        targetLevel: activeLevel,
        currentLevelCompletionRatio,
      }),
    [userLevel, activeLevel, currentLevelCompletionRatio]
  );

  const levelLessons = useMemo(() => {
    if (allLessons && allLessons.length > 0) {
      return allLessons.filter((l) => l.level === activeLevel);
    }
    return lessons;
  }, [allLessons, lessons, activeLevel]);

  const availableTracks = useMemo(() => {
    const trackIds = new Set<CurriculumTrackId>();
    for (const l of levelLessons) {
      if (l.curriculum?.trackId) trackIds.add(l.curriculum.trackId);
    }
    return Array.from(trackIds)
      .map((id) => CURRICULUM_TRACKS[id])
      .filter(Boolean);
  }, [levelLessons]);

  const activeUnits = useMemo(() => {
    if (unitsByLevel && unitsByLevel[activeLevel]) {
      return unitsByLevel[activeLevel];
    }
    return units;
  }, [unitsByLevel, units, activeLevel]);

  const currentUnit = useMemo(
    () => (selectedUnit === "ALL" ? null : activeUnits.find((u) => u.number === selectedUnit) ?? null),
    [selectedUnit, activeUnits]
  );

  const displayedLessons = useMemo(() => {
    let result = levelLessons;
    if (currentUnit) result = levelLessons.slice(currentUnit.startIndex, currentUnit.endIndex);

    if (selectedTrack !== "ALL") {
      result = result.filter((l) => l.curriculum?.trackId === selectedTrack);
    }

    if (statusFilter === "COMPLETED") result = result.filter((l) => l.progressStatus === "COMPLETED");
    else if (statusFilter === "UNFINISHED") result = result.filter((l) => l.progressStatus !== "COMPLETED");

    const q = query.trim().toLowerCase();
    if (q) result = result.filter((l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));

    const sorted = [...result];
    if (sort === "SCORE") sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    if (sort === "XP") sorted.sort((a, b) => b.xpReward - a.xpReward);
    return sorted;
  }, [levelLessons, currentUnit, selectedTrack, statusFilter, query, sort]);

  const pill = (active: boolean) =>
    `flex min-h-12 shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-[13px] font-bold transition active:scale-[0.98] ${
      active
        ? "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25"
        : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-rose-50 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300 dark:hover:bg-sumi-800"
    }`;

  return (
    <div className="space-y-6">
      {/* ── Main tab + Level Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-sumi-900 sm:w-fit">
          <button
            type="button"
            id="practice-tab-lessons"
            onClick={() => { playClick(); setMainTab("LESSONS"); }}
            aria-pressed={mainTab === "LESSONS"}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] sm:flex-none ${
              mainTab === "LESSONS" ? "bg-red-600 text-white shadow-md shadow-red-600/25" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-800"
            }`}
          >
            📚 {t("navLessons")}
          </button>
          <button
            type="button"
            id="practice-tab-battle"
            onClick={() => { playClick(); setMainTab("BATTLE"); }}
            aria-pressed={mainTab === "BATTLE"}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] sm:flex-none ${
              mainTab === "BATTLE" ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-800"
            }`}
          >
            🃏 Kana Battle
            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-900">NEW</span>
          </button>
        </div>

        {mainTab === "LESSONS" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200/90 bg-red-50/80 px-3.5 py-2 text-xs font-black text-red-700 dark:border-red-950/60 dark:bg-red-950/40 dark:text-red-300 shadow-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[10px]">
                ✓
              </span>
              <span>
                {t("currentLevelLabel")} <b>JLPT {activeLevel}</b>
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ({levelLessons.length} {t("lessonsUnit")})
              </span>
            </div>

            {/* Subtle dropdown to preview another level if explicitly desired */}
            {allLessons && allLessons.length > 0 && (
              <select
                value={activeLevel}
                onChange={(e) => {
                  playClick();
                  setActiveLevel(e.target.value);
                  setSelectedUnit("ALL");
                  setSelectedTrack("ALL");
                }}
                aria-label={t("exploreBadge")}
                className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-sumi-900 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer shadow-xs transition"
              >
                <option value={userLevel || "N5"}>JLPT {userLevel || "N5"} {t("learningBadge")}</option>
                {(["N5", "N4", "N3"] as const)
                  .filter((lvl) => lvl !== (userLevel || "N5"))
                  .map((lvl) => (
                    <option key={lvl} value={lvl}>
                      JLPT {lvl} {t("exploreBadge")}
                    </option>
                  ))}
              </select>
            )}

            {activeLevel !== (userLevel || "N5") && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setActiveLevel(userLevel || "N5");
                  setSelectedUnit("ALL");
                  setSelectedTrack("ALL");
                }}
                className="text-xs font-bold text-red-600 dark:text-red-400 underline hover:text-red-700 transition"
              >
                ↩ {t("backToLevel")} {userLevel || "N5"}
              </button>
            )}
          </div>
        )}
      </div>

      {mainTab === "BATTLE" && (
        <div className="overflow-hidden rounded-3xl border border-violet-700/20 bg-gradient-to-br from-violet-950/80 via-indigo-950/60 to-slate-900/80 p-4 shadow-xl">
          <KanaBattleCard />
        </div>
      )}

      {mainTab === "LESSONS" && (
        <>
          {/* ── Thông báo chính sách phân cấp sư phạm (Lower Review / Higher Lock) ── */}
          {levelAccess.tier === "LOWER" && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:flex-row sm:items-center">
              <div className="space-y-0.5">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  📖 {t("lowerLevelReviewMode")} ({activeLevel})
                </p>
                <p className="text-xs text-emerald-900 dark:text-emerald-100">
                  {t("lowerLevelReviewExplanation", { userLevel, activeLevel })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveLevel(userLevel)}
                className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-sumi-900 dark:text-emerald-200"
              >
                {t("backToCurrentLevel")} ({userLevel})
              </button>
            </div>
          )}

          {levelAccess.tier === "HIGHER" && !levelAccess.fullAccess && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-4 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/40 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                    🔒 {t("higherLevelContent")} ({activeLevel})
                  </span>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {t("yourCurrentLevel")}: JLPT {userLevel}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                  {t("higherLevelPreviewExplanation", { userLevel, activeLevel })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href="/app/test"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-amber-700"
                >
                  {t("testToUnlock")} {activeLevel} →
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveLevel(userLevel)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-sumi-900 dark:text-amber-200"
                >
                  {t("backToPath")} {userLevel}
                </button>
              </div>
            </div>
          )}

          {/* ── Linh vật Anime khích lệ học tập ── */}
          <MascotCheerBanner
            kind="shiba"
            tag={t("mascotCheerTag")}
            quote={`千里の道も一歩から — ${getLocalizedQuote(
              "千里の道も一歩から",
              "Hành trình ngàn dặm bắt đầu từ một bước chân. Kiên trì mỗi ngày để sớm chinh phục JLPT nhé!",
              nativeLanguage
            )}`}
            author="NihonQuest Sensei"
          />

          {/* ── Khung Hướng Dẫn Sư Phạm & Nguồn Giáo Trình Thực Tế ── */}
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 p-4 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30">
            <span className="text-xl leading-none" aria-hidden>🧭</span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  {t("pedagogyStandardTitle")}
                </span>
                <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                  {t("verifiedCurriculumSource")}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-sky-900 dark:text-sky-200">
                {t("pedagogyStandardDesc")}
              </p>
            </div>
          </div>

          {/* ── Bộ lọc Giáo trình nguồn ── */}
          {availableTracks.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm dark:border-slate-800 dark:bg-sumi-900/80">
              <span className="px-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("curriculumLabel")}:
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedTrack("ALL");
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedTrack === "ALL"
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-sumi-800 dark:text-slate-300"
                }`}
              >
                {t("filterAll")} ({levelLessons.length})
              </button>
              {availableTracks.map((trk) => {
                const isAct = selectedTrack === trk.trackId;
                const count = levelLessons.filter((l) => l.curriculum?.trackId === trk.trackId).length;
                return (
                  <button
                    key={trk.trackId}
                    type="button"
                    onClick={() => {
                      playClick();
                      setSelectedTrack(trk.trackId);
                      setSelectedUnit("ALL");
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      isAct
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-red-600 dark:bg-sumi-800 dark:text-slate-300"
                    }`}
                  >
                    <span>{getLocalizedTrackTitle(trk.trackId, nativeLanguage, trk.shortTitle)}</span>
                    <span className={`text-[10px] ${isAct ? "text-rose-100" : "text-slate-400"}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Unit tabs ── */}
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-2 shadow-sm dark:border-slate-800 dark:bg-sumi-900/80">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <button type="button" onClick={() => { playClick(); setSelectedUnit("ALL"); }} className={pill(selectedUnit === "ALL")}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${selectedUnit === "ALL" ? "bg-white/20" : "bg-slate-100 dark:bg-sumi-800"}`}>▦</span>
                {t("filterAll")} <span className="text-[11px] opacity-70">({levelLessons.length} {t("lessonsUnit")})</span>
              </button>
              {activeUnits.map((u) => {
                const list = levelLessons.slice(u.startIndex, u.endIndex);
                const done = list.filter((l) => l.progressStatus === "COMPLETED").length;
                const active = selectedUnit === u.number;
                return (
                  <button key={u.number} type="button" onClick={() => { playClick(); setSelectedUnit(u.number); }} className={pill(active)}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${active ? "bg-white/20" : "bg-slate-100 dark:bg-sumi-800"}`}>{u.icon}</span>
                    <LocalizedUnitTitle level={activeLevel} unitNumber={u.number} fallback={u.number === 6 && activeLevel === "N5" ? "Unit 06 (Bổ trợ)" : `Unit 0${u.number}`} />
                    <span className={`text-[11px] ${active ? "text-rose-100" : "text-slate-500 dark:text-slate-400"}`}>
                      {list.length > 0 && done === list.length ? "✓" : `(${done}/${list.length})`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Tiêu đề danh sách + tìm kiếm + sắp xếp ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-2xl text-white shadow-md shadow-red-600/25">
                {currentUnit ? currentUnit.icon : "📖"}
              </span>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {currentUnit ? (
                    <LocalizedUnitTitle level={activeLevel} unitNumber={currentUnit.number} fallback={currentUnit.title} />
                  ) : (
                    `${t("jlptCourseListTitle")} ${activeLevel}`
                  )}
                </h3>
                <p className="mt-0.5 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
                  {currentUnit ? (
                    <LocalizedUnitDesc level={activeLevel} unitNumber={currentUnit.number} fallback={currentUnit.description} />
                  ) : (
                    t("exploreLessonsSubtitle").replace("{count}", String(levelLessons.length)).replace("{level}", activeLevel)
                  )}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <div className="flex min-h-11 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-sumi-800 sm:w-64 sm:flex-none">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchLessonPlaceholder")}
                  aria-label={t("searchLessonPlaceholder")}
                  className="min-w-0 flex-1 bg-transparent px-3 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 sm:text-sm"
                />
                <span className="flex w-11 items-center justify-center bg-slate-900 text-sm text-white dark:bg-white dark:text-sumi-950" aria-hidden>🔍</span>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label={t("sortPath")}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200 sm:text-sm"
              >
                <option value="ORDER">{t("sortPath")}</option>
                <option value="SCORE">{t("sortScore")}</option>
                <option value="XP">{t("sortXp")}</option>
              </select>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-sumi-800">
                {([["ALL", t("filterAll")], ["UNFINISHED", t("filterUnfinished")], ["COMPLETED", t("filterCompleted")]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    aria-pressed={statusFilter === key}
                    className={`min-h-10 sm:min-h-9 flex-1 rounded-lg px-3 text-xs font-bold transition active:scale-95 sm:flex-none ${
                      statusFilter === key ? "bg-red-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Gợi ý Ôn tập củng cố khi làm sai nhiều (< 75%) ── */}
          {levelLessons.some((l) => typeof l.score === "number" && l.score < 75) && (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/35 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  {t("remediationHeader")}
                </p>
                <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-100">
                  {t("remediationDesc")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {(() => {
                  const weak = levelLessons.find((l) => typeof l.score === "number" && l.score < 75);
                  return weak ? (
                    <Link
                      href={`/app/practice/${weak.slug}`}
                      className="inline-flex min-h-9 items-center rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
                    >
                      {t("reviewAgainPrefix")}{" "}
                      <LocalizedLessonTitle slug={weak.slug} fallback={cleanLessonTitle(weak.title)} /> ({weak.score}%) →
                    </Link>
                  ) : null;
                })()}
                <Link
                  href="/app/review"
                  className="inline-flex min-h-9 items-center rounded-xl border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-sumi-900 dark:text-amber-200"
                >
                  {t("reviewSrsCardsBtn")}
                </Link>
              </div>
            </div>
          )}

          {/* ── Lưới thẻ bài học ── */}
          {displayedLessons.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-sumi-900">
              <span className="text-3xl">🔍</span>
              <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">{t("noMatchingLessonsFound")}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("tryAdjustingFilter")}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedLessons.map((l) => {
                const done = l.progressStatus === "COMPLETED";
                const doing = l.progressStatus === "IN_PROGRESS";
                const idxInAll = levelLessons.findIndex((item) => item.id === l.id);
                const unit =
                  activeUnits.find((u) => idxInAll >= u.startIndex && idxInAll < u.endIndex) ??
                  activeUnits[0];
                const pct = typeof l.score === "number" ? l.score : done ? 100 : 0;

                const isFirstInUnit = unit ? idxInAll === unit.startIndex : idxInAll <= 0;
                const isFptSupplementary = l.slug.startsWith("fpt-jpd");
                const prevLesson = idxInAll > 0 ? levelLessons[idxInAll - 1] : null;

                const access = evaluateLessonAccess({
                  userLevel,
                  lessonLevel: l.level,
                  lessonIndexInLevel: idxInAll,
                  isCompleted: done,
                  isInProgress: doing,
                  prevLessonCompleted: !prevLesson || prevLesson.progressStatus === "COMPLETED",
                  isFirstInUnit,
                  isFptSupplementary,
                  currentLevelCompletionRatio,
                });

                const isUnlocked = access.unlocked;

                return (
                  <article
                    key={l.id}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-4 nq-card-3d dark:bg-sumi-900 ${
                      isUnlocked
                        ? "border-slate-200/80 dark:border-slate-800"
                        : "border-slate-200/60 opacity-85 dark:border-slate-800/70"
                    }`}
                  >
                    <div className="pointer-events-none absolute -right-3 -top-3 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-transparent text-5xl opacity-80 dark:from-red-950/40" aria-hidden>
                      {unit.icon}
                    </div>

                    <div className="relative flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`w-fit rounded-lg border px-2.5 py-1 text-xs font-black ${LEVEL_TONE[l.level] ?? LEVEL_TONE.N5}`}>
                          {l.curriculum?.shortTrackLabel ? (
                            <LocalizedShortTrackLabel label={l.curriculum.shortTrackLabel} />
                          ) : (
                            `${l.level} · #${String(l.order + 1).padStart(2, "0")}`
                          )}
                        </span>
                        {l.curriculum?.provenance === "TEXTBOOK_VERIFIED" ? (
                          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" title={t("badgeTextbookVerifiedTitle")}>
                            {t("badgeTextbookVerified")}
                          </span>
                        ) : l.curriculum?.provenance === "SUPPLEMENTARY_VERIFIED" ? (
                          <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" title={t("badgeSupplementaryVerifiedTitle")}>
                            {t("badgeSupplementaryVerified")}
                          </span>
                        ) : null}
                      </div>
                      {done ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          ✓ {t("statusCompleted")}
                        </span>
                      ) : access.isPreview ? (
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                          {t("statusPreview")}
                        </span>
                      ) : access.isReviewMode ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {t("statusReviewLevel")} {l.level}
                        </span>
                      ) : !isUnlocked ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {access.lockReason === "PREREQUISITE"
                            ? `🔒 ${t("badgePrerequisite")}`
                            : access.lockReason === "HIGHER_LEVEL"
                            ? `🔒 ${t("badgeLockedLevel")} ${l.level}`
                            : t("statusLocked")}
                        </span>
                      ) : null}
                    </div>

                    <h4 className="relative mt-3 text-[15px] font-black leading-snug text-slate-900 dark:text-white">
                      <LocalizedLessonTitle slug={l.slug} fallback={cleanLessonTitle(l.title)} />
                    </h4>
                    <p className="relative mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      <LocalizedLessonDesc slug={l.slug} fallback={l.description} />
                    </p>

                    {l.curriculum?.relatedGenkiLesson && (
                      <div className="relative mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-sumi-800/80 dark:text-slate-300">
                        <span className="opacity-70">📖</span>
                        <span><LocalizedGenkiRef refString={l.curriculum.relatedGenkiLesson} /></span>
                      </div>
                    )}

                    <div className="relative mt-3 flex items-center gap-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>📝 {l.exercisesCount} {t("questionsUnit")}</span>
                      <span className="text-red-500">◔ {pct}% ({t("needsSixtyPercent")})</span>
                      <span className="ml-auto rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">+{l.xpReward} XP</span>
                    </div>

                    {isUnlocked ? (
                      <Link
                        href={`/app/practice/${l.slug}`}
                        className={`relative mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border text-[13px] font-black transition active:scale-[0.98] ${
                          doing
                            ? "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/25 hover:bg-red-700"
                            : "border-red-500 bg-white text-red-600 hover:bg-red-50 dark:bg-transparent dark:hover:bg-red-950/30"
                        }`}
                      >
                        <span aria-hidden>▶</span>
                        {done
                          ? t("btnReviewAgain")
                          : doing
                            ? t("btnContinue")
                            : access.isPreview
                              ? t("btnTryPreview")
                              : access.isReviewMode
                                ? `${t("btnReviewLevel")} ${l.level}`
                                : t("btnStartLearn")}
                      </Link>
                    ) : access.lockReason === "HIGHER_LEVEL" ? (
                      <div className="relative mt-4 flex items-center gap-2">
                        <Link
                          href="/app/test"
                          title={access.lockMessage ?? undefined}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          🔒 {t("testOutToUnlockLevel")} {l.level}
                        </Link>
                      </div>
                    ) : (
                      <div className="relative mt-4 flex items-center gap-2">
                        <Link
                          href={prevLesson ? `/app/practice/${prevLesson.slug}` : `/app/practice/${l.slug}`}
                          title={prevLesson ? `${t("needCompletePrereq")}: ${cleanLessonTitle(prevLesson.title)}` : ""}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
                        >
                          {t("lockedPrerequisiteNote")}
                        </Link>
                        <Link
                          href="/app/test"
                          title={t("testExemptionTitle")}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          ⚡
                        </Link>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}