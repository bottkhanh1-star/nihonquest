"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import Link from "next/link";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { LocalizedVocabMeaning } from "@/lib/vocabLocalization";
import { LocalizedGrammarText } from "@/lib/grammarLocalization";
import { useAiScreenContext } from "@/components/ai-sensei/AiScreenContext";
import { useEffect } from "react";

interface GrammarExample {
  id: string;
  japanese: string;
  romaji: string | null;
  meaning: string;
}

interface GrammarItem {
  id: string;
  title: string;
  level: string;
  meaning: string;
  structure: string;
  commonMistakes: string | null;
  examples: GrammarExample[];
}

type Level = "N5" | "N4" | "N3";

interface GrammarClientProps {
  grammar: GrammarItem[];
  defaultLevel?: string;
  displayName?: string;
  levelImages: Record<Level, string | null>;
}

const LEVELS: Level[] = ["N5", "N4", "N3"];

const LEVEL_META: Record<Level, { jp: string; tagline: string; desc: string; tint: string; fallback: string }> = {
  N5: {
    jp: "初級",
    tagline: "Bắt đầu làm quen",
    desc: "Làm quen mẫu câu cơ bản, trợ từ và các dạng chia động từ đầu tiên.",
    tint: "from-rose-950/90 via-rose-900/30",
    fallback: "bg-gradient-to-br from-rose-400 to-rose-800",
  },
  N4: {
    jp: "初中級",
    tagline: "Củng cố nền tảng",
    desc: "Củng cố nền tảng, nối câu và diễn đạt ý định, lời khuyên, điều kiện.",
    tint: "from-emerald-950/90 via-emerald-900/30",
    fallback: "bg-gradient-to-br from-emerald-400 to-emerald-800",
  },
  N3: {
    jp: "中級",
    tagline: "Nâng cao kỹ năng",
    desc: "Mở rộng sang câu phức và cách nói tự nhiên hơn trong giao tiếp hằng ngày.",
    tint: "from-indigo-950/90 via-indigo-900/30",
    fallback: "bg-gradient-to-br from-indigo-400 to-indigo-800",
  },
};

const ICON_COLORS = [
  "from-red-500 to-rose-500",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-violet-600",
  "from-teal-500 to-cyan-600",
];

// Kiểm tra lại href của "Lộ trình" và "Kiểm tra" cho đúng route của dự án.
const QUICK_LINKS = [
  { label: "Từ vựng nhanh", href: "/app/vocabulary#vocabulary", icon: "📘", color: "from-blue-500 to-blue-600" },
  { label: "Hán tự tra cứu", href: "/app/vocabulary#kanji", icon: "名", color: "from-violet-500 to-purple-600" },
  { label: "Ngữ pháp tổng hợp", href: "/app/grammar", icon: "📝", color: "from-emerald-500 to-green-600" },
  { label: "Lộ trình học của bạn", href: "/app/path", icon: "⛩️", color: "from-red-500 to-rose-500" },
  { label: "Bài kiểm tra năng lực", href: "/app/test", icon: "★", color: "from-amber-400 to-orange-500" },
];

/* ------------------------------------------------------------------ */
/* Chi tiết một điểm ngữ pháp (dùng cho cả panel bên phải và mobile)   */
/* ------------------------------------------------------------------ */
function GrammarDetail({ item }: { item: GrammarItem }) {
  const { speak } = useSoundAndTheme();
  const { t } = useNativeLanguage();

  return (
    <div className="space-y-4">
      <section>
        <h4 className="text-[11px] font-bold text-fuji-500 dark:text-fuji-400">{t("grammarMeaning")}</h4>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200"><LocalizedGrammarText text={item.meaning} keyContext={item.title} /></p>
      </section>

      <section>
        <h4 className="text-[11px] font-bold text-matcha-600 dark:text-matcha-400">{t("grammarStructure")}</h4>
        <div className="mt-1 rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3 dark:border-matcha-900 dark:bg-matcha-950/30">
          <p className="font-mono text-sm font-bold text-matcha-800 dark:text-matcha-200"><LocalizedGrammarText text={item.structure} /></p>
        </div>
      </section>

      {item.commonMistakes && (
        <section>
          <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{t("grammarMistakes")}</h4>
          <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200"><LocalizedGrammarText text={item.commonMistakes} /></p>
          </div>
        </section>
      )}

      {item.examples.length > 0 && (
        <section>
          <h4 className="text-[11px] font-bold text-sakura-500 dark:text-sakura-400">{t("grammarRealExamples")}</h4>
          <ul className="mt-2 space-y-2.5">
            {item.examples.map((ex) => (
              <li
                key={ex.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-sumi-900"
              >
                <div className="min-w-0">
                  <p className="jp-text text-base font-black text-slate-900 dark:text-white">{ex.japanese}</p>
                  {ex.romaji && <p className="mt-0.5 text-xs italic text-fuji-500 dark:text-fuji-400">{ex.romaji}</p>}
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300"><LocalizedGrammarText text={ex.meaning} /></p>
                </div>
                <button
                  onClick={() => speak(ex.japanese)}
                  aria-label={t("grammarPronounce")}
                  title={t("grammarPronounce")}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sakura-300 hover:text-sakura-500 dark:border-slate-700 dark:text-slate-300"
                >
                  🔊
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component chính                                                     */
/* ------------------------------------------------------------------ */
export function GrammarClient({ grammar, defaultLevel = "N5", displayName = "bạn", levelImages }: GrammarClientProps) {
  const { t } = useNativeLanguage();
  const { setScreenItem } = useAiScreenContext();
  const initialLevel = (LEVELS as string[]).includes(defaultLevel) ? defaultLevel : "N5";
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>(initialLevel);
  const [sort, setSort] = useState<"level" | "title">("level");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { playClick } = useSoundAndTheme();

  const getLevelTagline = useCallback(
    (lv: Level) => {
      switch (lv) {
        case "N5":
          return t("grammarN5Tagline") || LEVEL_META.N5.tagline;
        case "N4":
          return t("grammarN4Tagline") || LEVEL_META.N4.tagline;
        case "N3":
          return t("grammarN3Tagline") || LEVEL_META.N3.tagline;
      }
    },
    [t]
  );

  const getLevelDesc = useCallback(
    (lv: Level) => {
      switch (lv) {
        case "N5":
          return t("grammarN5Desc") || LEVEL_META.N5.desc;
        case "N4":
          return t("grammarN4Desc") || LEVEL_META.N4.desc;
        case "N3":
          return t("grammarN3Desc") || LEVEL_META.N3.desc;
      }
    },
    [t]
  );

  const quickLinks = useMemo(() => [
    { label: t("grammarQuickVocab"), href: "/app/vocabulary#vocabulary", icon: "📘", color: "from-blue-500 to-blue-600" },
    { label: t("grammarQuickKanji"), href: "/app/vocabulary#kanji", icon: "名", color: "from-violet-500 to-purple-600" },
    { label: t("grammarQuickSummary"), href: "/app/grammar", icon: "📝", color: "from-emerald-500 to-green-600" },
    { label: t("grammarQuickPath"), href: "/app/path", icon: "⛩️", color: "from-red-500 to-rose-500" },
    { label: t("grammarQuickTest"), href: "/app/test", icon: "★", color: "from-amber-400 to-orange-500" },
  ], [t]);

  const levelFiltered = useMemo(
    () => (levelFilter === "ALL" ? grammar : grammar.filter((g) => g.level === levelFilter)),
    [grammar, levelFilter]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = levelFiltered.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.meaning.toLowerCase().includes(q) ||
        g.structure.toLowerCase().includes(q)
    );
    return sort === "title" ? [...list].sort((a, b) => a.title.localeCompare(b.title, "ja")) : list;
  }, [levelFiltered, search, sort]);

  // Nếu bài đang chọn bị lọc mất thì coi như chưa chọn
  const selected = filtered.find((g) => g.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setScreenItem(
        {
          term: selected.title,
          meaning: selected.meaning,
          type: "GRAMMAR",
          examples: selected.examples?.map((ex) => ({ ja: ex.japanese, vi: ex.meaning })),
          extraPrompt: selected.structure ? `Cấu trúc: ${selected.structure}. Lỗi thường gặp: ${selected.commonMistakes || 'Không có'}` : undefined,
        },
        `Ngữ pháp ${selected.level} · ${selected.title}`
      );
    } else {
      setScreenItem(null);
    }
  }, [selected, setScreenItem]);
  const exampleCount = levelFiltered.reduce((acc, g) => acc + g.examples.length, 0);
  const activeLevel = (LEVELS as string[]).includes(levelFilter) ? (levelFilter as Level) : null;

  const scrollToList = () =>
    document.getElementById("grammar-list")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const selectLevel = (lv: string) => {
    playClick();
    setLevelFilter(lv);
    setSelectedId(null);
  };

  const countOf = (lv: Level) => grammar.filter((g) => g.level === lv).length;

  return (
    <div className="space-y-8">
      {/* ============ STATS BANNER ============ */}
      <section className="flex flex-col gap-5 rounded-2xl bg-[#0d1535] px-5 py-5 text-white sm:px-7 md:flex-row md:items-center">
        <div className="flex items-center gap-4 md:flex-1">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/90 text-3xl" aria-hidden="true">
            ⛩️
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold">{t("grammarHello")}, {displayName}!</p>
            <p className="text-xs text-white/70">{t("grammarSub")}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 md:flex-[2] md:border-l md:border-white/10 md:pl-6">
          {[
            { v: levelFiltered.length, l: t("grammarPoints"), c: "text-white", bg: "bg-rose-500", i: "📖" },
            { v: exampleCount, l: t("grammarExamples"), c: "text-emerald-400", bg: "bg-emerald-500", i: "★" },
            { v: levelFilter === "ALL" ? t("filterAll") : levelFilter, l: t("statsCurrentLevel"), c: "text-orange-400", bg: "bg-orange-500", i: "🔥" },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-3">
              <span className={`hidden h-11 w-11 shrink-0 place-items-center rounded-full ${s.bg} text-lg sm:grid`} aria-hidden="true">
                {s.i}
              </span>
              <div>
                <dd className={`text-2xl font-black leading-none ${s.c}`}>{s.v}</dd>
                <dt className="mt-1 text-[11px] text-white/70">{s.l}</dt>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* ============ QUICK LINKS ============ */}
      <nav aria-label={t("grammarQuickLinks")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {quickLinks.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-red-200 hover:shadow-md dark:border-slate-800 dark:bg-sumi-900"
          >
            <span
              className={`jp-text grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${q.color} text-lg font-black text-white`}
              aria-hidden="true"
            >
              {q.icon}
            </span>
            <span className="text-sm font-bold leading-snug text-slate-900 dark:text-white">{q.label}</span>
          </Link>
        ))}
      </nav>

      {/* ============ KHÓA HỌC THEO CẤP ĐỘ ============ */}
      <section aria-labelledby="levels-title">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="levels-title" className="text-lg font-black text-slate-900 dark:text-white">{t("tabLessons")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("exploreLessonsSubtitle")}</p>
          </div>
          <button
            onClick={() => {
              selectLevel("ALL");
              scrollToList();
            }}
            className="min-h-11 px-2 text-sm font-bold text-red-600 hover:underline dark:text-red-400"
          >
            {t("filterAll")} ›
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* 3 thẻ dọc */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
            {LEVELS.map((lv) => {
              const meta = LEVEL_META[lv];
              const src = levelImages[lv];
              const active = levelFilter === lv;
              return (
                <button
                  key={lv}
                  onClick={() => {
                    selectLevel(lv);
                    scrollToList();
                  }}
                  aria-pressed={active}
                  className={`group relative isolate aspect-[3/4] w-[56vw] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl text-left text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:w-auto sm:max-w-none ${
                    src ? "bg-slate-900" : meta.fallback
                  } ${active ? "ring-4 ring-red-500/70" : ""}`}
                >
                  {src && (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 20vw, 56vw"
                      className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className={`absolute inset-0 -z-10 bg-gradient-to-t ${meta.tint} to-transparent`} aria-hidden="true" />
                  <div className="flex h-full flex-col justify-end p-4">
                    <span className="text-3xl font-black leading-none">{lv}</span>
                    <span className="jp-text mt-1 text-sm font-bold text-white/90">{meta.jp}</span>
                    <span className="mt-0.5 text-xs text-white/85">{getLevelTagline(lv)}</span>
                    <span className="mt-3 inline-flex min-h-9 items-center justify-between rounded-full bg-white px-4 text-xs font-bold text-slate-900">
                      {t("btnLearnNow")} <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tóm tắt cấp độ đang chọn: lấp đầy hàng, không để trống hai bên */}
          <aside className="flex flex-col justify-between rounded-2xl bg-[#0d1535] p-6 text-white">
            {activeLevel ? (
              <>
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black leading-none">{activeLevel}</span>
                    <span className="jp-text text-lg font-bold text-white/80">{LEVEL_META[activeLevel].jp}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-red-400">{getLevelTagline(activeLevel)}</p>
                  <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">{getLevelDesc(activeLevel)}</p>
                </div>
                <div className="mt-6 flex items-end justify-between gap-4">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-2xl font-black">{countOf(activeLevel)}</p>
                      <p className="text-[11px] text-white/60">{t("grammarPoints")}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-emerald-400">
                        {grammar.filter((g) => g.level === activeLevel).reduce((a, g) => a + g.examples.length, 0)}
                      </p>
                      <p className="text-[11px] text-white/60">{t("grammarExamples")}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const first = grammar.find((g) => g.level === activeLevel);
                      playClick();
                      setSelectedId(first?.id ?? null);
                      scrollToList();
                    }}
                    className="min-h-11 shrink-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 px-5 text-sm font-bold shadow-lg shadow-red-900/30 transition hover:brightness-110"
                  >
                    {t("statsStartFirstLesson")}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className="text-2xl font-black">{t("grammarAllLevels")}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  {t("exploreLessonsSubtitle")}
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ============ DANH SÁCH BÀI HỌC ============ */}
      <section id="grammar-list" aria-labelledby="lessons-title" className="scroll-mt-24">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="lessons-title" className="text-lg font-black text-slate-900 dark:text-white">{t("jlptCourseListTitle")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} / {grammar.length} {t("grammarPoints")}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:w-[420px]">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("grammarSearchPlaceholder")}
                aria-label={t("grammarSearchPlaceholder")}
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-base text-slate-800 placeholder-slate-400 transition focus:border-red-400 focus:outline-none dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-100 sm:text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label={t("commonClearSearch") || "Clear search"}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-slate-400 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "level" | "title")}
              aria-label={t("grammarSortLevel") || "Sort"}
              className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-200"
            >
              <option value="level">{t("grammarSortLevel")}</option>
              <option value="title">{t("grammarSortName")}</option>
            </select>
          </div>
        </div>

        {/* Một khối duy nhất: danh sách cuộn bên trái, chi tiết/ảnh bên phải */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-sumi-900 lg:grid lg:h-[640px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* ---- Cột trái: bộ lọc + danh sách ---- */}
          <div className="flex min-h-0 flex-col lg:border-r lg:border-slate-200 lg:dark:border-slate-800">
            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3 dark:border-slate-800" role="group" aria-label={t("vocabColLevel") || "Filter by level"}>
              {[...LEVELS, "ALL" as const].map((lv) => {
                const on = levelFilter === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => selectLevel(lv)}
                    aria-pressed={on}
                    className={`min-h-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition ${
                      on
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {lv === "ALL" ? t("filterAll") : lv}
                    <span className="ml-1 opacity-70">({lv === "ALL" ? grammar.length : countOf(lv)})</span>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{t("grammarNoResults")}. {t("grammarNoResultsSub")} 🌸</p>
            ) : (
              <ul className="max-h-[70vh] min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-800 lg:max-h-none">
                {filtered.map((item, i) => {
                  const isSel = selected?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          playClick();
                          setSelectedId(isSel ? null : item.id);
                        }}
                        aria-expanded={isSel}
                        className={`flex w-full items-center gap-3 border-l-4 px-3 py-2.5 text-left transition ${
                          isSel
                            ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <span
                          className={`jp-text grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${
                            ICON_COLORS[i % ICON_COLORS.length]
                          } text-lg font-black text-white`}
                          aria-hidden="true"
                        >
                          文
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="jp-text block truncate text-sm font-black text-slate-900 dark:text-white">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400"><LocalizedGrammarText text={item.meaning} keyContext={item.title} /></span>
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                          {item.level}
                        </span>
                        <span className={`shrink-0 text-slate-400 transition-transform lg:rotate-0 ${isSel ? "rotate-90" : ""}`} aria-hidden="true">
                          ›
                        </span>
                      </button>

                      {/* Mobile/tablet: chi tiết mở ngay dưới dòng */}
                      {isSel && (
                        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40 lg:hidden">
                          <GrammarDetail item={item} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ---- Cột phải (desktop): ảnh cảnh đêm hoặc chi tiết ---- */}
          <div className="relative hidden min-h-0 lg:block">
            {selected ? (
              <div className="flex h-full flex-col">
                <div className="relative h-36 shrink-0 overflow-hidden">
                  <Image src={BASE64_IMAGES.grammar} unoptimized alt="" fill sizes="50vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1535]/95 via-[#0d1535]/50 to-[#0d1535]/10" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                    <div className="min-w-0">
                      <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">{selected.level}</span>
                      <h3 className="jp-text mt-2 text-xl font-black leading-snug">{selected.title}</h3>
                    </div>
                    <button
                      onClick={() => {
                        playClick();
                        setSelectedId(null);
                      }}
                      aria-label={t("commonClose") || "Close details"}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                  <GrammarDetail item={selected} />
                </div>
              </div>
            ) : (
              <>
                <Image src={BASE64_IMAGES.grammar} unoptimized alt="Tokyo night scene" fill sizes="50vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1535]/80 via-transparent to-transparent" aria-hidden="true" />
                <p className="absolute inset-x-0 bottom-0 p-6 text-sm font-semibold text-white/90">
                  {t("grammarSelectHint")}
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}