"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Icon, IconButton, Modal, SelectField } from "@/components/ui";
import { RubyWord } from "@/components/JapaneseTerm";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { notifyProgressUpdated, useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage, getLocalizedQuote, type NativeLanguage } from "@/components/LanguageContext";
import {
  toCanonicalVocabularyItem,
  parseKanjiMeaningAndHanViet,
  SCRIPT_SHORT_LABELS_VI,
  type CanonicalVocabularyItem,
  type JapaneseScriptType,
} from "@/lib/canonical-vocab";
import { Sakura } from "./Sakura";
import { LocalizedVocabMeaning } from "@/lib/vocabLocalization";
import { JouyouKanjiView } from "./JouyouKanjiView";
import { RadicalsView } from "./RadicalsView";
import { RadicalGuideView } from "./RadicalGuideView";
import { MascotCheerBanner } from "@/components/mascots/AnimeMascot";

/* ============================== TYPES ============================== */

interface KanjiItem {
  id: string;
  character: string;
  meaning: string;
  strokeCount: number;
  jlptLevel: string;
  readings: Array<{ id: string; reading: string; type: string }>;
}

interface ExampleItem {
  id?: string;
  japanese: string;
  meaning: string;
  romaji: string | null;
}

interface VocabItem {
  id: string;
  word: string;
  kana: string;
  kanji: string | null;
  romaji: string;
  meaning: string;
  partOfSpeech: string;
  jlptLevel: string;
  tags?: string;
  lessonId?: string | null;
  /** Tuỳ chọn 1–5. Nếu DB chưa có cột này, tần suất sẽ được ước lượng theo cấp JLPT. */
  frequency?: number;
  examples: ExampleItem[];
}

/** Dữ liệu đã chuẩn hoá để dùng chung cho thẻ lưới & flashcard (cả từ vựng lẫn Hán tự). */
interface CardData {
  id: string;
  type: "VOCAB" | "KANJI";
  front: string;
  frontWithReading: string;
  reading: string;
  romaji?: string;
  displayRomaji?: string;
  meaning: string;
  hanVietNote?: string | null;
  scriptBadge?: string;
  provenanceLabel?: string;
  label: string;
  level: string;
  topic: string;
  example?: ExampleItem;
  highlight?: { word: string; kana: string };
}

type ViewMode = "LIST" | "GRID" | "FLASHCARD" | "TOPIC";
type SortMode = "DEFAULT" | "KANA" | "LEVEL" | "SAVED";
type Tab = "VOCAB" | "KANJI" | "JOUYOU" | "RADICALS" | "RADICAL_GUIDE";

/* ============================== CONSTANTS & HELPERS ============================== */

const SCRIPT_BADGE_TONE: Record<JapaneseScriptType, string> = {
  HIRAGANA: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  KATAKANA: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300",
  KANJI: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300",
  MIXED: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300",
};

const POS_LABELS: Record<string, string> = {
  noun: "Danh từ",
  verb: "Động từ",
  adjective: "Tính từ",
  "na-adjective": "Tính từ -na",
  adverb: "Trạng từ",
  particle: "Trợ từ",
  expression: "Cụm từ / Giao tiếp",
  pronoun: "Đại từ",
};

function getPosLabel(pos: string, t?: (k: string) => string): string {
  if (!t) return POS_LABELS[pos] ?? pos;
  switch (pos) {
    case "noun": return t("posNoun");
    case "verb": return t("posVerb");
    case "adjective": return t("posAdjective");
    case "na-adjective": return t("posNaAdjective");
    case "adverb": return t("posAdverb");
    case "particle": return t("posParticle");
    case "expression": return t("posExpression");
    case "pronoun": return t("posPronoun");
    default: return POS_LABELS[pos] ?? pos;
  }
}

function getPosOptions(t: (k: string) => string) {
  return [
    { value: "ALL", label: t("filterAll") },
    { value: "noun", label: t("posNoun") },
    { value: "verb", label: t("posVerb") },
    { value: "adjective", label: t("posAdjective") },
    { value: "na-adjective", label: t("posNaAdjective") },
    { value: "adverb", label: t("posAdverb") },
    { value: "particle", label: t("posParticle") },
    { value: "expression", label: t("posExpression") },
    { value: "pronoun", label: t("posPronoun") },
  ];
}

function getLevelOptions(t: (k: string) => string) {
  return [
    { value: "ALL", label: t("filterAll") },
    { value: "N5", label: "N5" },
    { value: "N4", label: "N4" },
    { value: "N3", label: "N3" },
  ];
}

function getScriptFilterOptions(t: (k: string) => string): Array<{ value: "ALL" | JapaneseScriptType; label: string }> {
  return [
    { value: "ALL", label: t("vocabScriptFilterAll") },
    { value: "KANJI", label: t("vocabScriptFilterKanji") },
    { value: "MIXED", label: t("vocabScriptFilterMixed") },
    { value: "HIRAGANA", label: t("vocabScriptFilterHiragana") },
    { value: "KATAKANA", label: t("vocabScriptFilterKatakana") },
  ];
}

const LEVEL_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
const FREQUENCY_LABELS = ["Hiếm gặp", "Ít gặp", "Phổ biến", "Rất phổ biến", "Cực kỳ phổ biến"];

const KANJI_RE = /[\u3400-\u9fff]/;
const HIRAGANA_RE = /[\u3041-\u309f]/;

/** Lưới 1 hàng theo chuẩn: [Star] | Pronunciation / Romaji | Japanese writing | Vietnamese meaning | [Ví dụ ở md] | [Loa] | [Lưu] */
const ROW_GRID =
  "grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[24px_minmax(125px,155px)_minmax(130px,165px)_minmax(160px,1fr)_minmax(0,1fr)_44px_84px] lg:grid-cols-[24px_minmax(130px,165px)_minmax(140px,180px)_minmax(170px,1fr)_44px_84px]";
const ROW_EXTRA_COL = "hidden min-w-0 md:block lg:hidden";

const tagsOf = (tags?: string) => (tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : []);

/**
 * Lowercase and strip Vietnamese diacritics so an unaccented query still finds
 * accented content ("an" matches "ăn"). Uses NFD decomposition, so it also
 * folds Latin-1 accents.
 */
const foldText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const readingsOf = (k: KanjiItem, type: "ONYOMI" | "KUNYOMI") =>
  k.readings
    .filter((r) =>
      type === "ONYOMI"
        ? r.type === "ONYOMI" || r.type === "ON"
        : r.type === "KUNYOMI" || r.type === "KUN"
    )
    .map((r) => r.reading);

/** Tách phần chữ Hán của từ (để tô đỏ trong câu) và cách đọc tương ứng (để làm furigana). */
function splitWord(word: string, kana: string): { target: string; reading: string | null } {
  if (!KANJI_RE.test(word)) return { target: word, reading: null };
  let end = word.length;
  while (end > 1 && HIRAGANA_RE.test(word[end - 1])) end--;
  const target = word.slice(0, end);
  const okurigana = word.slice(end);
  if (!okurigana) return { target, reading: kana || null };
  const reading = kana.endsWith(okurigana) ? kana.slice(0, kana.length - okurigana.length) : null;
  return { target, reading: reading || null };
}

function frequencyOf(v: VocabItem) {
  const base = v.frequency ?? ({ N5: 3, N4: 2 } as Record<string, number>)[v.jlptLevel] ?? 1;
  const dots = Math.min(5, Math.max(1, Math.round(base)));
  return { dots, label: FREQUENCY_LABELS[dots - 1] };
}

function sortItems<T extends { id: string; jlptLevel: string }>(
  items: T[],
  mode: SortMode,
  saved: Set<string>,
  kana?: (item: T) => string
): T[] {
  if (mode === "DEFAULT") return items;
  const copy = [...items];
  if (mode === "KANA" && kana) copy.sort((a, b) => kana(a).localeCompare(kana(b), "ja"));
  else if (mode === "LEVEL") copy.sort((a, b) => (LEVEL_ORDER[a.jlptLevel] ?? 9) - (LEVEL_ORDER[b.jlptLevel] ?? 9));
  else if (mode === "SAVED") copy.sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id)));
  return copy;
}

function getScriptShortLabel(script: JapaneseScriptType, lang?: NativeLanguage): string {
  if (script === "HIRAGANA") return "Hiragana";
  if (script === "KATAKANA") return "Katakana";
  if (script === "KANJI") {
    if (lang === "zh-CN" || lang === "zh-TW") return "漢字";
    if (lang === "ko") return "한자";
    return "Kanji";
  }
  switch (lang) {
    case "vi": return "Kết hợp";
    case "zh-CN":
    case "zh-TW": return "混合";
    case "ko": return "혼합";
    case "es": return "Mixto";
    case "fr": return "Mixte";
    case "de": return "Gemischt";
    case "id": return "Campuran";
    case "th": return "ผสม";
    case "ru": return "Смешанный";
    case "pt": return "Misto";
    default: return "Mixed";
  }
}

function getRadicalsTabLabel(lang: NativeLanguage): string {
  switch (lang) {
    case "vi": return "214 Bộ thủ (Radicals)";
    case "zh-CN":
    case "zh-TW": return "214 康熙部首";
    case "ko": return "214 부수 (Radicals)";
    case "es": return "214 Radicales";
    case "fr": return "214 Radicaux";
    case "de": return "214 Radikale";
    case "id": return "214 Radikal";
    case "th": return "214 หมวดอักษร (Radicals)";
    case "ru": return "214 Ключей (Radicals)";
    case "pt": return "214 Radicais";
    default: return "214 Radicals";
  }
}

function getRadicalGuideTabLabel(lang: NativeLanguage): string {
  switch (lang) {
    case "vi": return "Ghép bộ thủ";
    case "zh-CN": return "部首拆分组合";
    case "zh-TW": return "部首拆分組合";
    case "ko": return "부수 조합 분석";
    case "es": return "Composición de radicales";
    case "fr": return "Composition de radicaux";
    case "de": return "Radikal-Zusammensetzung";
    case "id": return "Kombinasi Radikal";
    case "th": return "การประกอบหมวดอักษร";
    case "ru": return "Комбинации ключей";
    case "pt": return "Composição de radicais";
    default: return "Radical Combinations";
  }
}

function vocabToCard(v: VocabItem, canon: CanonicalVocabularyItem, t?: (k: string) => string, lang?: NativeLanguage): CardData {
  return {
    id: v.id,
    type: "VOCAB",
    front: canon.japanese,
    frontWithReading: canon.japaneseWithReading,
    reading: canon.kana,
    romaji: canon.romaji,
    displayRomaji: canon.displayRomaji,
    meaning: canon.meaningVi,
    hanVietNote: lang === "vi" ? canon.hanVietNote : null,
    scriptBadge: getScriptShortLabel(canon.primaryScript, lang),
    provenanceLabel: canon.provenance.shortLabelVi,
    label: getPosLabel(canon.partOfSpeech, t),
    level: v.jlptLevel,
    topic: tagsOf(v.tags)[0] ?? (t ? t("filterAll") : "Chung"),
    example: v.examples[0],
    highlight: { word: canon.japanese, kana: canon.kana },
  };
}

function kanjiToCard(k: KanjiItem, t?: (k: string) => string, lang?: NativeLanguage): CardData {
  const on = readingsOf(k, "ONYOMI").join("、");
  const kun = readingsOf(k, "KUNYOMI").join("、");
  const parsed = parseKanjiMeaningAndHanViet(k.meaning);
  return {
    id: k.id,
    type: "KANJI",
    front: k.character,
    frontWithReading: k.character,
    reading: [on && `On: ${on}`, kun && `Kun: ${kun}`].filter(Boolean).join("  ·  "),
    meaning: parsed.meaningVi,
    hanVietNote: lang === "vi" ? parsed.hanViet : null,
    scriptBadge: "Kanji",
    label: `${k.strokeCount} ${t ? t("vocabColStrokes") : "nét"}`,
    level: k.jlptLevel,
    topic: t ? t("vocabTabKanji") : "Hán tự",
  };
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/* ============================== SMALL PIECES ============================== */

/** Câu ví dụ: tô đỏ từ đang học và gắn furigana cho phần chữ Hán của từ đó. */
function ExampleText({ sentence, highlight }: { sentence: string; highlight?: { word: string; kana: string } }) {
  if (!highlight) return <>{sentence}</>;
  const { target, reading } = splitWord(highlight.word, highlight.kana);
  const idx = target ? sentence.indexOf(target) : -1;
  if (idx < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, idx)}
      <span className="font-bold text-red-600 dark:text-red-400">
        {reading ? (
          <ruby>
            {target}
            <rt className="text-[9px] font-semibold text-red-500">{reading}</rt>
          </ruby>
        ) : (
          target
        )}
      </span>
      {sentence.slice(idx + target.length)}
    </>
  );
}

function FrequencyDots({ dots, label }: { dots: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < dots ? "bg-red-500" : "bg-red-100 dark:bg-red-950"}`} />
        ))}
      </span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </span>
  );
}

function PlayButton({ text, speakingText, onSpeak }: { text: string; speakingText: string | null; onSpeak: (t: string) => void }) {
  const playing = speakingText === text;
  return (
    <button
      type="button"
      aria-label={playing ? "Dừng phát âm" : "Nghe phát âm"}
      title={playing ? "Dừng phát âm" : "Nghe phát âm"}
      onClick={(e) => {
        e.stopPropagation();
        onSpeak(text);
      }}
      className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
        playing
          ? "border-red-500 bg-red-100 text-red-700 dark:bg-red-950/60"
          : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
      }`}
    >
      {playing ? (
        <span className="text-xs">⏹️</span>
      ) : (
        <Icon name="play" className="ml-0.5 h-4 w-4" />
      )}
      {playing && <span className="absolute inset-0 animate-ping rounded-full border border-red-400/70" />}
    </button>
  );
}

function SaveButton({ saved, onSave, className = "", t }: { saved: boolean; onSave: () => void; className?: string; t?: (k: string) => string }) {
  return (
    <Button
      size="xs"
      variant={saved ? "brand" : "brandOutline"}
      className={`h-11 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onSave();
      }}
    >
      {saved ? (
        <>
          {t ? t("vocabSavedBtn") : "Đã lưu"} <Icon name="check" className="h-3.5 w-3.5" />
        </>
      ) : (
        <>
          <Icon name="plus" className="h-3.5 w-3.5" /> {t ? t("vocabSaveBtn") : "Lưu"}
        </>
      )}
    </Button>
  );
}

const SLOGAN = "Học hôm nay, giỏi tiếng Nhật ngày mai!";

function Pagination({ page, totalPages, onPage, slogan }: { page: number; totalPages: number; onPage: (p: number) => void; slogan?: string }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );
  const circle =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-700 dark:bg-sumi-900";
  return (
    <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:bg-sumi-950 dark:text-slate-300">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4v16h16" />
          <path d="M8 15l3-4 3 2 4-6" />
        </svg>
        {slogan || SLOGAN}
      </span>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => onPage(page - 1)} className={circle}>
            ‹
          </button>
          {pages.map((p, idx) => (
            <Fragment key={p}>
              {idx > 0 && pages[idx - 1] !== p - 1 && <span className="px-1 text-xs text-slate-400">…</span>}
              <button
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`h-9 min-w-9 rounded-xl px-2 text-xs font-extrabold transition active:scale-95 ${
                  p === page
                    ? "bg-red-600 text-white shadow-sm shadow-red-600/30"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-800"
                }`}
              >
                {p}
              </button>
            </Fragment>
          ))}
          <button type="button" aria-label="Trang sau" disabled={page === totalPages} onClick={() => onPage(page + 1)} className={circle}>
            ›
          </button>
          <select
            aria-label="Đến trang"
            value=""
            onChange={(e) => e.target.value && onPage(Number(e.target.value))}
            className="ml-1 h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-300"
          >
            <option value="">Đến …</option>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                Trang {p}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}

/* ============================== LIST ROWS ============================== */

const rowClass = (selected: boolean) =>
  `rounded-2xl border px-2.5 py-2 transition-all duration-200 sm:px-3 sm:py-3 ${
    selected
      ? "border-red-400 bg-red-50/50 shadow-md dark:bg-red-950/30 scale-[1.003]"
      : "cursor-pointer border-transparent shadow-[0_1px_0_0_rgb(241_245_249)] hover:border-sakura-200 hover:bg-slate-50/90 hover:translate-x-1 dark:shadow-[0_1px_0_0_rgb(30_41_59)] dark:hover:bg-sumi-800/60"
  }`;

function StarToggle({ starred, name, onToggle }: { starred: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? `Bỏ yêu thích: ${name}` : `Đánh dấu yêu thích: ${name}`}
      title={starred ? "Bỏ yêu thích" : "Yêu thích"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex h-11 w-9 items-center justify-center transition active:scale-90 ${
        starred ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
      }`}
    >
      <Icon name="star" filled={starred} className="h-[18px] w-[18px]" />
    </button>
  );
}

function ListColumnsHeader({ tab, t }: { tab: Tab; t?: (k: string) => string }) {
  return (
    <div
      aria-hidden="true"
      className="mb-1.5 hidden rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-sumi-950/80 dark:text-slate-400 md:grid md:grid-cols-[24px_minmax(125px,155px)_minmax(130px,165px)_minmax(160px,1fr)_minmax(0,1fr)_44px_84px] md:gap-x-3 lg:grid-cols-[24px_minmax(130px,165px)_minmax(140px,180px)_minmax(170px,1fr)_44px_84px]"
    >
      <span />
      <span>{tab === "VOCAB" ? (t ? t("vocabColRomaji") : "Phát âm / Romaji") : (t ? t("vocabColOnKun") : "Phiên âm (On/Kun)")}</span>
      <span>{t ? t("vocabColJapanese") : "Chữ viết tiếng Nhật"}</span>
      <span>{t ? t("vocabColMeaning") : "Nghĩa tiếng Việt"}</span>
      <span className="hidden md:block lg:hidden">{tab === "VOCAB" ? (t ? t("vocabColExamples") : "Ví dụ") : (t ? t("vocabColStrokes") : "Số nét")}</span>
      <span className="text-center">{t ? t("vocabColListen") : "Nghe"}</span>
      <span className="text-center">{t ? t("vocabColSrs") : "Sổ SRS"}</span>
    </div>
  );
}

function VocabRow({
  v,
  canon,
  selected,
  starred,
  saved,
  showRomaji,
  isHigherLevel,
  speakingText,
  onSelect,
  onToggleStar,
  onSpeak,
  onSave,
  t,
}: {
  v: VocabItem;
  canon: CanonicalVocabularyItem;
  selected: boolean;
  starred: boolean;
  saved: boolean;
  showRomaji: boolean;
  isHigherLevel: boolean;
  speakingText: string | null;
  onSelect: () => void;
  onToggleStar: () => void;
  onSpeak: (t: string) => void;
  onSave: () => void;
  t?: (k: string) => string;
}) {
  const ex = v.examples[0];
  const { nativeLanguage } = useNativeLanguage();
  return (
    <li
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`${ROW_GRID} ${rowClass(selected)} focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500`}
    >
      <StarToggle starred={starred} name={canon.japanese} onToggle={onToggleStar} />

      {/* Chuẩn trình bày: 1. Phát âm / Romaji | 2. Chữ viết tiếng Nhật | 3. Nghĩa tiếng Việt */}
      <div className="min-w-0 md:contents">
        {/* Cột 1: Phát âm / Romaji */}
        <div className="min-w-0">
          <p className="break-words text-xs font-extrabold text-red-600 dark:text-red-400 sm:text-sm">
            {showRomaji && canon.displayRomaji ? canon.displayRomaji : canon.kana || "—"}
          </p>
          {showRomaji && canon.kana && (
            <p className="jp-text break-words text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {canon.kana}
            </p>
          )}
        </div>

        {/* Cột 2: Chữ viết tiếng Nhật */}
        <div className="mt-0.5 min-w-0 md:mt-0">
          <div className="jp-text break-words text-[18px] font-black leading-tight text-slate-900 dark:text-white sm:text-[21px]">
            {canon.japaneseWithReading}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                SCRIPT_BADGE_TONE[canon.primaryScript]
              }`}
            >
              {getScriptShortLabel(canon.primaryScript, nativeLanguage)}
            </span>
          </div>
        </div>

        {/* Cột 3: Nghĩa */}
        <div className="mt-1 min-w-0 md:mt-0">
          <p className="break-words text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
            <LocalizedVocabMeaning japanese={canon.japanese} kana={canon.kana} fallback={canon.meaningVi} />
          </p>
          <div className="mt-1 flex flex-wrap gap-1 sm:gap-1.5">
            {nativeLanguage === "vi" && canon.hanVietNote && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300">
                Hán Việt: {canon.hanVietNote}
              </span>
            )}
            <Badge variant="sky" className="text-[10px] sm:text-[11px]">
              {getPosLabel(canon.partOfSpeech, t)}
            </Badge>
            <Badge variant="amber" className="text-[10px] sm:text-[11px]">
              JLPT {v.jlptLevel}
            </Badge>
            {isHigherLevel && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                {t ? t("vocabHigherLevelBadge") : "🔒 Cấp cao hơn"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={ROW_EXTRA_COL}>
        {ex && (
          <>
            <p className="jp-text flex items-start gap-2 text-[13px] font-medium leading-[2] text-slate-800 dark:text-slate-100">
              <span className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              <span className="min-w-0">
                <ExampleText sentence={ex.japanese} highlight={{ word: canon.japanese, kana: canon.kana }} />
              </span>
            </p>
            <p className="pl-3.5 text-xs text-slate-500"><LocalizedVocabMeaning japanese={ex.japanese} fallback={ex.meaning} /></p>
          </>
        )}
      </div>

      <PlayButton text={canon.kana || canon.japanese} speakingText={speakingText} onSpeak={onSpeak} />
      <SaveButton saved={saved} onSave={onSave} className="w-[84px]" t={t} />
    </li>
  );
}

function KanjiRow({
  k,
  selected,
  starred,
  saved,
  isHigherLevel,
  speakingText,
  onSelect,
  onToggleStar,
  onSpeak,
  onSave,
  t,
}: {
  k: KanjiItem;
  selected: boolean;
  starred: boolean;
  saved: boolean;
  isHigherLevel: boolean;
  speakingText: string | null;
  onSelect: () => void;
  onToggleStar: () => void;
  onSpeak: (t: string) => void;
  onSave: () => void;
  t?: (k: string) => string;
}) {
  const on = readingsOf(k, "ONYOMI");
  const kun = readingsOf(k, "KUNYOMI");
  const parsed = parseKanjiMeaningAndHanViet(k.meaning);
  const { nativeLanguage } = useNativeLanguage();
  return (
    <li
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`${ROW_GRID} ${rowClass(selected)} focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500`}
    >
      <StarToggle starred={starred} name={k.character} onToggle={onToggleStar} />

      <div className="min-w-0 md:contents">
        {/* Cột 1: Phiên âm (On / Kun) */}
        <div className="min-w-0 space-y-0.5">
          <p className="jp-text break-words text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span className="font-bold">On:</span> {on.join("、") || "—"}
          </p>
          <p className="jp-text break-words text-xs font-semibold text-sky-700 dark:text-sky-300">
            <span className="font-bold">Kun:</span> {kun.join("、") || "—"}
          </p>
        </div>

        {/* Cột 2: Chữ Nhật (Hán tự) */}
        <div className="mt-0.5 flex items-baseline gap-2 md:mt-0">
          <span className="jp-text text-[28px] font-black leading-none text-slate-900 dark:text-white sm:text-[34px]">
            {k.character}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{k.strokeCount} {t ? t("vocabColStrokes") : "nét"}</span>
        </div>

        {/* Cột 3: Nghĩa */}
        <div className="mt-1 min-w-0 md:mt-0">
          <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100"><LocalizedVocabMeaning japanese={k.character} fallback={parsed.meaningVi} /></p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {nativeLanguage === "vi" && parsed.hanViet && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200">
                Hán Việt: {parsed.hanViet}
              </span>
            )}
            <Badge variant="amber" className="text-[11px]">
              JLPT {k.jlptLevel}
            </Badge>
            {isHigherLevel && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                {t ? t("vocabHigherLevelBadge") : "🔒 Cấp cao hơn"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={ROW_EXTRA_COL}>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{k.strokeCount} {t ? t("vocabColStrokes") : "nét viết"}</p>
      </div>
      <PlayButton text={k.character} speakingText={speakingText} onSpeak={onSpeak} />
      <SaveButton saved={saved} onSave={onSave} className="w-[84px]" t={t} />
    </li>
  );
}

/* ============================== DETAIL PANELS ============================== */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[126px_1fr] border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <dt className="bg-slate-50/80 px-3.5 py-2.5 text-[12px] font-medium text-slate-500 dark:bg-sumi-950/60">{label}</dt>
      <dd className="flex flex-wrap items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

const detailTable = "overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-sumi-900";

function SrsBox({ name, saved, onSave, t }: { name: string; saved: boolean; onSave: () => void; t?: (k: string) => string }) {
  const title = t ? t("vocabSavedToSrsTitle") : "Thêm vào sổ SRS";
  const desc = t
    ? t("vocabSavedToSrsDesc").replace("{name}", name)
    : `Lưu ${name} để ôn tập định kỳ theo thuật toán lặp lại ngắt quãng.`;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50/60 p-3.5 dark:border-red-900/50 dark:from-red-950/30 dark:to-red-950/20">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 dark:border-red-900/60 dark:bg-sumi-900">
        <Icon name="cards" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-red-700 dark:text-red-300">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{desc}</p>
      </div>
      <SaveButton saved={saved} onSave={onSave} className="shrink-0 px-3.5" t={t} />
    </div>
  );
}

function parseLinguisticMeta(v: VocabItem) {
  const tags = tagsOf(v.tags);
  const originTag = tags.find((t) => t.startsWith("Xuất xứ:"));
  const standardTag = tags.find((t) => t.startsWith("Chuẩn:"));
  const nuanceTag = tags.find((t) => t.startsWith("Sắc thái:"));

  let registerLabel = "Ngôn ngữ chuẩn (標準語 / 丁寧語)";
  let registerTone = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60";
  let usageContext = "Dùng an toàn trong giao tiếp hàng ngày, lớp học, du lịch và văn viết chuẩn.";

  const raw = `${v.tags ?? ""} ${v.meaning}`;
  if (raw.includes("Tôn kính ngữ") || raw.includes("尊敬語")) {
    registerLabel = "Tôn kính ngữ (尊敬語 - Sonkeigo)";
    registerTone = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
    usageContext = "Nâng cao hành động/trạng thái của cấp trên, khách hàng, thầy cô. TUYỆT ĐỐI không dùng cho bản thân.";
  } else if (raw.includes("Khiêm nhường ngữ") || raw.includes("謙譲語")) {
    registerLabel = "Khiêm nhường ngữ (謙譲語 - Kenjōgo)";
    registerTone = "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60";
    usageContext = "Hạ thấp hành động của bản thân hoặc người trong nhóm (Uchi) để thể hiện sự kính trọng với đối phương (Soto).";
  } else if (raw.includes("Từ đệm") || raw.includes("クッション言葉")) {
    registerLabel = "Từ đệm lịch sự (クッション言葉)";
    registerTone = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60";
    usageContext = "Đặt đầu câu khi nhờ vả, hỏi thông tin hoặc từ chối khéo trong môi trường công sở/dịch vụ.";
  } else if (raw.includes("Phương ngữ") || raw.includes("方言")) {
    registerLabel = "Phương ngữ vùng miền (方言 - Hōgen)";
    registerTone = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60";
    usageContext = "Giao tiếp địa phương mang bản sắc vùng miền. Trong văn bản hành chính/thi JLPT nên quy đổi về tiếng Nhật chuẩn (標準語).";
  } else if (raw.includes("Tiếng lóng") || raw.includes("若者言葉") || raw.includes("俗語")) {
    registerLabel = "Tiếng lóng / Khẩu ngữ thân mật (若者言葉・タメ口)";
    registerTone = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60";
    usageContext = "Chỉ dùng giữa bạn bè thân thiết, mạng xã hội hoặc hội thoại suồng sã. Không dùng với cấp trên hoặc trong phỏng vấn.";
  } else if (raw.includes("Thành ngữ") || raw.includes("ことわざ") || raw.includes("慣用句") || raw.includes("四字熟語")) {
    registerLabel = "Thành ngữ / Quán dụng ngữ (慣用句・ことわざ)";
    registerTone = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60";
    usageContext = "Giàu hình ảnh văn hóa Nhật Bản; giúp câu nói tự nhiên, sâu sắc hơn ở trình độ N4–N3 trở lên.";
  }

  return {
    registerLabel,
    registerTone,
    usageContext,
    origin: originTag ? originTag.replace(/^Xuất xứ:\s*/i, "") : null,
    standardCounterpart: standardTag ? standardTag.replace(/^Chuẩn:\s*/i, "") : null,
    nuance: nuanceTag ? nuanceTag.replace(/^Sắc thái:\s*/i, "") : null,
    cleanTags: tags.filter((t) => !t.startsWith("Xuất xứ:") && !t.startsWith("Chuẩn:") && !t.startsWith("Sắc thái:") && t !== "unitcuments"),
  };
}

function VocabDetail({
  v,
  canon,
  saved,
  showRomaji,
  speakingText,
  showAllExamples,
  onToggleExamples,
  onSpeak,
  onSave,
  t,
}: {
  v: VocabItem;
  canon: CanonicalVocabularyItem;
  saved: boolean;
  showRomaji: boolean;
  speakingText: string | null;
  showAllExamples: boolean;
  onToggleExamples: () => void;
  onSpeak: (t: string) => void;
  onSave: () => void;
  t?: (k: string) => string;
}) {
  const freq = frequencyOf(v);
  const meta = parseLinguisticMeta(v);
  const examples = showAllExamples ? v.examples : v.examples.slice(0, 3);
  const hl = { word: canon.japanese, kana: canon.kana };
  const { nativeLanguage } = useNativeLanguage();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            SCRIPT_BADGE_TONE[canon.primaryScript]
          }`}
        >
          {getScriptShortLabel(canon.primaryScript, nativeLanguage)}
        </span>
        <Badge variant="amber" className="text-[11px]">
          JLPT {v.jlptLevel}
        </Badge>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300">
          {canon.provenance.status} • {canon.provenance.shortLabelVi}
        </span>
      </div>

      {/* Trình bày chuẩn: 1. Phát âm / Romaji -> 2. Chữ viết Nhật (kèm Furigana) -> 3. Nghĩa tiếng Việt */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-extrabold text-red-600 dark:text-red-400">
            {canon.displayRomaji || canon.kana}
            {canon.kana && (
              <span className="jp-text ml-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                （{canon.kana}）
              </span>
            )}
          </p>
          <h2 className="jp-text mt-1 break-words text-4xl font-black leading-tight text-slate-900 dark:text-white sm:text-5xl">
            <RubyWord word={canon.japanese} kana={canon.kana} />
          </h2>
          <p className="mt-2 text-base font-bold text-slate-800 dark:text-slate-100"><LocalizedVocabMeaning japanese={canon.japanese} kana={canon.kana} fallback={canon.meaningVi} /></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Nghe phát âm" tone="brand" active={speakingText === canon.japanese} className="h-11 w-11" onClick={() => onSpeak(canon.kana || canon.japanese)}>
            <Icon name="speaker" className="h-5 w-5" />
          </IconButton>
          <Button size="sm" variant="brand" className="h-11" onClick={onSave}>
            {saved ? (
              <>
                {t ? t("vocabSavedBtn") : "Đã lưu vào sổ"} <Icon name="check" className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 4h12v17l-6-4-6 4z" />
                </svg>
                {t ? t("vocabSaveBtn") : "Lưu vào sổ"}
              </>
            )}
          </Button>
        </div>
      </div>

      <dl className={detailTable}>
        <DetailRow label={t ? t("vocabColRomaji") : "Phát âm / Romaji"}>
          <span className="font-extrabold text-red-600 dark:text-red-400">{canon.displayRomaji}</span>
          <span className="jp-text text-xs font-bold text-slate-600 dark:text-slate-300">({canon.kana})</span>
        </DetailRow>
        <DetailRow label={t ? t("vocabColJapanese") : "Chữ viết Nhật"}>
          <span className="jp-text text-base font-black">{canon.japaneseWithReading}</span>
        </DetailRow>
        <DetailRow label={t ? t("vocabColMeaning") : "Nghĩa"}><LocalizedVocabMeaning japanese={canon.japanese} kana={canon.kana} fallback={canon.meaningVi} /></DetailRow>
        <DetailRow label="Hệ chữ (Script)">
          <span
            className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${
              SCRIPT_BADGE_TONE[canon.primaryScript]
            }`}
          >
            {canon.primaryScript} — {getScriptShortLabel(canon.primaryScript, nativeLanguage)}
          </span>
        </DetailRow>
        {nativeLanguage === "vi" && canon.hanVietNote && (
          <DetailRow label="Âm Hán Việt">
            <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200">
              {canon.hanVietNote}
            </span>
            <span className="text-[11px] font-normal text-slate-500">(Từ nguyên Hán–Việt hỗ trợ ghi nhớ)</span>
          </DetailRow>
        )}
        <DetailRow label={t ? t("vocabColPos") : "Loại từ"}>{getPosLabel(canon.partOfSpeech, t)}</DetailRow>
        {canon.usageNote && (
          <DetailRow label={t ? (t("vocabUsageNote") || "Ghi chú cú pháp") : "Ghi chú cú pháp"}>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{canon.usageNote}</span>
          </DetailRow>
        )}
        <DetailRow label={t ? (t("vocabRegister") || "Ngữ vực (Register)") : "Ngữ vực (Register)"}>
          <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${meta.registerTone}`}>
            {meta.registerLabel}
          </span>
        </DetailRow>
        <DetailRow label={t ? (t("vocabSource") || "Nguồn xác thực") : "Nguồn xác thực"}>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {canon.provenance.labelVi} ({canon.provenance.status})
          </span>
        </DetailRow>
        <DetailRow label={t ? (t("vocabFrequency") || "Tần suất") : "Tần suất"}>
          <FrequencyDots dots={freq.dots} label={freq.label} />
        </DetailRow>
      </dl>

      <section aria-labelledby="vocab-examples">
        <div className="mb-1 flex items-center justify-between">
          <h3 id="vocab-examples" className="text-sm font-extrabold text-slate-900 dark:text-white">
            {t ? t("vocabSentenceExamples") : "Ví dụ câu"}
          </h3>
          {v.examples.length > 3 && (
            <button type="button" onClick={onToggleExamples} className="text-xs font-bold text-red-600 hover:underline dark:text-red-400">
              {showAllExamples ? (t ? t("vocabCollapse") : "Thu gọn") : `${t ? t("vocabShowMore") : "Xem thêm"} (${v.examples.length})`}
            </button>
          )}
        </div>
        {v.examples.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            {t ? t("vocabNoExamples") : "Từ này chưa có câu ví dụ."}
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {examples.map((ex, i) => (
              <li
                key={ex.id ?? i}
                className="grid grid-cols-[18px_1fr_auto] items-center gap-3 rounded-2xl border border-rose-100 bg-white px-3.5 py-2.5 dark:border-red-900/40 dark:bg-sumi-900"
              >
                <Icon name="star" filled className="h-3.5 w-3.5 text-red-500" />
                <div className="min-w-0">
                  <p className="jp-text text-[14px] font-semibold leading-[1.9] text-slate-900 dark:text-white">
                    <ExampleText sentence={ex.japanese} highlight={hl} />
                  </p>
                  {showRomaji && ex.romaji && (
                    <p className="text-xs italic text-slate-400 dark:text-slate-500">{ex.romaji}</p>
                  )}
                  <p className="text-[12px] text-slate-600 dark:text-slate-300"><LocalizedVocabMeaning japanese={ex.japanese} fallback={ex.meaning} /></p>
                </div>
                <IconButton label="Nghe câu ví dụ" tone="brand" active={speakingText === ex.japanese} onClick={() => onSpeak(ex.japanese)}>
                  <Icon name="speaker" className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ol>
        )}
      </section>

      <SrsBox name={`「${canon.japanese}」`} saved={saved} onSave={onSave} t={t} />
    </div>
  );
}

function KanjiDetail({
  k,
  saved,
  starred,
  speakingText,
  onSpeak,
  onSave,
  onToggleStar,
  t,
}: {
  k: KanjiItem;
  saved: boolean;
  starred: boolean;
  speakingText: string | null;
  onSpeak: (t: string) => void;
  onSave: () => void;
  onToggleStar: () => void;
  t?: (k: string) => string;
}) {
  const on = readingsOf(k, "ONYOMI");
  const kun = readingsOf(k, "KUNYOMI");
  const parsed = parseKanjiMeaningAndHanViet(k.meaning);
  const { nativeLanguage } = useNativeLanguage();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="brand" className="text-[11px] uppercase">
            Kanji (Chữ Hán Nhật)
          </Badge>
          <Badge variant="amber" className="text-[11px]">
            JLPT {k.jlptLevel}
          </Badge>
        </div>
        <IconButton
          label={starred ? "Bỏ đánh dấu yêu thích" : "Đánh dấu yêu thích"}
          active={starred}
          onClick={onToggleStar}
          className="border-transparent bg-transparent dark:bg-transparent"
        >
          <Icon name="star" filled={starred} className="h-5 w-5" />
        </IconButton>
      </div>

      {/* Trình bày chuẩn: Phiên âm (On/Kun) -> Chữ Nhật -> Nghĩa tiếng Việt */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="jp-text text-sm font-semibold text-red-600 dark:text-red-400">
            {[on.length > 0 && `On: ${on.join("、")}`, kun.length > 0 && `Kun: ${kun.join("、")}`].filter(Boolean).join("  ·  ") || "—"}
          </p>
          <h2 className="jp-text mt-1 text-6xl font-black leading-none text-slate-900 dark:text-white">{k.character}</h2>
          <p className="mt-2 text-base font-bold text-slate-800 dark:text-slate-100"><LocalizedVocabMeaning japanese={k.character} fallback={parsed.meaningVi} /></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Nghe phát âm" tone="brand" active={speakingText === k.character} className="h-11 w-11" onClick={() => onSpeak(k.character)}>
            <Icon name="speaker" className="h-5 w-5" />
          </IconButton>
          <Button size="sm" variant={saved ? "brand" : "brandOutline"} onClick={onSave}>
            {saved ? (
              <>
                {t ? t("vocabSavedBtn") : "Đã lưu vào SRS"} <Icon name="check" className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <Icon name="plus" className="h-3.5 w-3.5" /> {t ? t("vocabSaveBtn") : "Lưu vào SRS"}
              </>
            )}
          </Button>
        </div>
      </div>

      <dl className={detailTable}>
        <DetailRow label={t ? t("vocabOnyomiLabel") : "Âm On (Âm Hán Nhật)"}>
          {on.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            on.map((r) => (
              <span key={r} className="jp-text rounded-md bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                {r}
              </span>
            ))
          )}
        </DetailRow>
        <DetailRow label={t ? t("vocabKunyomiLabel") : "Âm Kun (Âm Thuần Nhật)"}>
          {kun.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            kun.map((r) => (
              <span key={r} className="jp-text rounded-md bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                {r}
              </span>
            ))
          )}
        </DetailRow>
        <DetailRow label={t ? t("vocabColJapanese") : "Chữ viết Nhật"}>
          <span className="jp-text text-xl font-black">{k.character}</span>
        </DetailRow>
        <DetailRow label={t ? t("vocabColMeaning") : "Nghĩa"}><LocalizedVocabMeaning japanese={k.character} fallback={parsed.meaningVi} /></DetailRow>
        {nativeLanguage === "vi" && parsed.hanViet && (
          <DetailRow label="Âm Hán Việt">
            <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200">
              {parsed.hanViet}
            </span>
          </DetailRow>
        )}
        <DetailRow label={t ? t("vocabStrokeCountLabel") : "Số nét viết"}>{k.strokeCount} {t ? t("vocabColStrokes") : "nét"}</DetailRow>
      </dl>

      <SrsBox name={`chữ 「${k.character}」`} saved={saved} onSave={onSave} t={t} />
    </div>
  );
}

/* ============================== GRID CARD ============================== */

function GridCard({
  c,
  saved,
  mastered,
  showRomaji,
  speakingText,
  onSpeak,
  onSave,
  onToggleMastered,
  t,
}: {
  c: CardData;
  saved: boolean;
  mastered: boolean;
  showRomaji: boolean;
  speakingText: string | null;
  onSpeak: (t: string) => void;
  onSave: () => void;
  onToggleMastered: () => void;
  t?: (k: string) => string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <Card hover className="flex flex-col justify-between !rounded-2xl nq-card-3d">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* 1. Phát âm / Romaji */}
            <p className="text-sm font-extrabold text-red-600 dark:text-red-400">
              {showRomaji && c.displayRomaji ? c.displayRomaji : c.reading}
              {showRomaji && c.displayRomaji && c.reading && (
                <span className="jp-text ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ({c.reading})
                </span>
              )}
            </p>
            {/* 2. Chữ viết Nhật */}
            <div className="mt-1 flex items-center gap-2">
              <h3 className="jp-text break-words text-2xl font-black text-slate-900 dark:text-white">
                {c.frontWithReading}
              </h3>
              <IconButton label="Nghe phát âm" tone="brand" active={speakingText === c.front} className="h-10 w-10" onClick={() => onSpeak(c.front)}>
                <Icon name="speaker" className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="amber" className="text-[11px]">
              JLPT {c.level}
            </Badge>
            <Badge variant="sky" className="text-[11px]">
              {c.label}
            </Badge>
            {c.scriptBadge && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300">
                {c.scriptBadge}
              </span>
            )}
          </div>
        </div>

        {/* 3. Nghĩa tiếng Việt */}
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100"><LocalizedVocabMeaning japanese={c.front} kana={c.reading} fallback={c.meaning} /></p>
          {nativeLanguage === "vi" && c.hanVietNote && (
            <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Hán Việt: {c.hanVietNote}
            </p>
          )}
        </div>

        {c.example && (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-sumi-950">
            <p className="jp-text text-sm font-semibold leading-[2] text-slate-800 dark:text-slate-100">
              <ExampleText sentence={c.example.japanese} highlight={c.highlight} />
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400"><LocalizedVocabMeaning japanese={c.example.japanese} fallback={c.example.meaning} /></p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggleMastered}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition active:scale-[0.97] ${
            mastered
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          {mastered ? (t ? t("vocabMasteredBtn") : "✓ Đã thuộc") : (t ? t("vocabMarkMasteredBtn") : "○ Đánh dấu thuộc")}
        </button>
        <SaveButton saved={saved} onSave={onSave} className="px-3" t={t} />
      </div>
    </Card>
  );
}

/* ============================== SIDEBAR & DECOR ============================== */

function ProgressCard({
  vocab,
  kanji,
  grammar,
  t,
}: {
  vocab: { done: number; total: number };
  kanji: { done: number; total: number };
  grammar: { done: number; total: number };
  t?: (k: string) => string;
}) {
  const done = vocab.done + kanji.done + grammar.done;
  const total = vocab.total + kanji.total + grammar.total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const R = 38;
  const C = 2 * Math.PI * R;
  const rows = [
    { label: t ? t("navVocab") : "Từ vựng", data: vocab, icon: <Icon name="book" className="h-5 w-5" /> },
    { label: t ? t("vocabTabKanji") : "Hán tự", data: kanji, icon: <span className="jp-text text-lg font-black leading-none">漢</span> },
    { label: t ? t("navGrammar") : "Ngữ pháp", data: grammar, icon: <span className="jp-text text-lg font-black leading-none">文</span> },
  ];
  return (
    <section
      aria-labelledby="learn-progress"
      className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-sumi-900"
    >
      <h3 id="learn-progress" className="mb-4 flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 20V10M12 20V4M19 20v-7" />
          </svg>
        </span>
        {t ? t("vocabLearningProgress") : "Tiến độ học tập"}
      </h3>
      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <div className="relative h-[120px] w-[120px]">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Hoàn thành ${pct}%`}>
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" className="stroke-slate-100 dark:stroke-slate-800" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * C} ${C}`}
              className="stroke-red-500 transition-[stroke-dasharray] duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{pct}%</span>
            <span className="text-[11px] text-slate-500">{t ? t("vocabProgressCompleted") : "Hoàn thành"}</span>
          </div>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 py-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40">{r.icon}</span>
              <div>
                <p className="text-xs text-slate-500">{r.label}</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {r.data.done} / {r.data.total}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function QuoteCard({ nativeLanguage }: { nativeLanguage?: string }) {
  const quote = getLocalizedQuote("継続は力なり", "Kiên trì chính là sức mạnh.", (nativeLanguage as any) || "vi");
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-100 via-pink-50 to-white px-5 py-5 text-center dark:from-red-950/40 dark:via-sumi-900 dark:to-sumi-900">
      <Sakura className="absolute left-4 top-3 h-6 w-6 opacity-80" />
      <Sakura className="absolute bottom-3 right-5 h-5 w-5 opacity-70" />
      <p className="jp-text text-lg font-black text-red-700 dark:text-red-300">「継続は力なり」</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{quote}</p>
    </div>
  );
}

/* ============================== MAIN COMPONENT ============================== */

function localizeTopicTitle(title: string, lang: string): string {
  if (lang === "vi") return title;
  const TOPIC_I18N: Record<string, Record<string, string>> = {
    "🙇 Kính ngữ & Lịch sự (敬語)": {
      en: "🙇 Keigo & Polite Expressions (敬語)",
      "zh-CN": "🙇 敬语与礼貌表达 (敬語)",
      "zh-TW": "🙇 敬語與禮貌表達 (敬語)",
      ko: "🙇 경어 및 정중 표현 (敬語)",
      ja: "🙇 敬語・丁寧表現 (敬語)",
    },
    "🏮 Văn hóa & Thành ngữ (文化・慣用句)": {
      en: "🏮 Culture & Idioms (文化・慣用句)",
      "zh-CN": "🏮 文化与成语俗语 (文化・慣用句)",
      "zh-TW": "🏮 文化與成語俗語 (文化・慣用句)",
      ko: "🏮 문화 및 관용구 (文化・慣用句)",
      ja: "🏮 日本文化・慣用句 (文化・慣用句)",
    },
    "🔥 Tiếng lóng & Khẩu ngữ (若者言葉・俗語)": {
      en: "🔥 Slang & Colloquialisms (若者言葉・俗語)",
      "zh-CN": "🔥 流行语与口语俗语 (若者言葉・俗語)",
      "zh-TW": "🔥 流行語與口語俗語 (若者言葉・俗語)",
      ko: "🔥 신조어 및 구어체 (若者言葉・俗語)",
      ja: "🔥 若者言葉・俗語 (若者言葉・俗語)",
    },
    "🗾 Phương ngữ vùng miền (方言)": {
      en: "🗾 Regional Dialects (方言)",
      "zh-CN": "🗾 地域方言 (方言)",
      "zh-TW": "🗾 地域方言 (方言)",
      ko: "🗾 지역 방언 (方言)",
      ja: "🗾 地域方言 (方言)",
    },
    "💬 Giao tiếp & Chào hỏi": {
      en: "💬 Daily Greetings & Conversation",
      "zh-CN": "💬 日常问候与交流",
      "zh-TW": "💬 日常問候與交流",
      ko: "💬 일상 인사 및 회화",
      ja: "💬 日常挨拶・会話",
    },
    "🏠 Gia đình & Đời sống": {
      en: "🏠 Family & Daily Living",
      "zh-CN": "🏠 家庭与日常生活",
      "zh-TW": "🏠 家庭與日常生活",
      ko: "🏠 가족 및 일상생활",
      ja: "🏠 家族・日常生活",
    },
    "🍣 Món ăn & Nhà hàng": {
      en: "🍣 Food & Dining Out",
      "zh-CN": "🍣 美食餐饮与点餐",
      "zh-TW": "🍣 美食餐飲與點餐",
      ko: "🍣 음식 및 외식",
      ja: "🍣 料理・レストラン",
    },
    "💼 Trường học & Công việc": {
      en: "💼 School & Workplace",
      "zh-CN": "💼 职场与校园学习",
      "zh-TW": "💼 職場與校園學習",
      ko: "💼 학교 및 직장 생활",
      ja: "💼 学校・職場",
    },
    "🚗 Giao thông & Di chuyển": {
      en: "🚗 Travel & Transportation",
      "zh-CN": "🚗 交通出行与旅行",
      "zh-TW": "🚗 交通出行與旅行",
      ko: "🚗 교통 및 이동",
      ja: "🚗 交通・移動",
    },
    "☀️ Thời gian & Thời tiết": {
      en: "☀️ Time & Weather",
      "zh-CN": "☀️ 时间日期与天气",
      "zh-TW": "☀️ 時間日期與天氣",
      ko: "☀️ 시간 및 날씨",
      ja: "☀️ 時間・天気",
    },
    "🏃 Động từ thông dụng": {
      en: "🏃 Core Everyday Verbs",
      "zh-CN": "🏃 高频核心动词",
      "zh-TW": "🏃 高頻核心動詞",
      ko: "🏃 일상 핵심 동사",
      ja: "🏃 基本動詞",
    },
    "🎨 Tính từ & Trạng thái": {
      en: "🎨 Adjectives & Conditions",
      "zh-CN": "🎨 形容词与状态描述",
      "zh-TW": "🎨 形容詞與狀態描述",
      ko: "🎨 형용사 및 상태 표현",
      ja: "🎨 形容詞・状態",
    },
    "📦 Khác": {
      en: "📦 Miscellaneous",
      "zh-CN": "📦 常用综合其他",
      "zh-TW": "📦 常用綜合其他",
      ko: "📦 기타 어휘",
      ja: "📦 その他",
    },
  };
  return TOPIC_I18N[title]?.[lang] || TOPIC_I18N[title]?.en || title;
}

export function VocabKanjiClient({
  vocabulary,
  kanji,
  savedItemIds = [],
  defaultLevel = "N5",
  grammarProgress = { done: 0, total: 0 },
}: {
  vocabulary: VocabItem[];
  kanji: KanjiItem[];
  savedItemIds?: string[];
  defaultLevel?: string;
  /** Tuỳ chọn: tiến độ ngữ pháp (đã học / tổng). Chưa truyền thì hiển thị 0 / 0. */
  grammarProgress?: { done: number; total: number };
}) {
  const [tab, setTab] = useState<Tab>("VOCAB");
  const { progress: userProgress } = useUserProgress();
  const currentLearningLevel = userProgress?.learningLevel || defaultLevel || "N5";
  const [levelFilter, setLevelFilter] = useState<string>(currentLearningLevel);

  useEffect(() => {
    setLevelFilter(currentLearningLevel);
  }, [currentLearningLevel]);
  const [viewMode, setViewMode] = useState<ViewMode>("LIST");
  const [sortMode, setSortMode] = useState<SortMode>("DEFAULT");
  const [posFilter, setPosFilter] = useState("ALL");
  const [scriptFilter, setScriptFilter] = useState<"ALL" | JapaneseScriptType>("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [srsOnlyFilter, setSrsOnlyFilter] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Debounced mirror of `query`: the filters below re-run 340 items, rebuild the
  // flashcard map and regroup topics, which was far too slow per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set(savedItemIds));
  const [masteredSet, setMasteredSet] = useState<Set<string>>(new Set());
  const [starredSet, setStarredSet] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [showRomaji, setShowRomaji] = useState(true);

  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const isDesktop = useIsDesktop();
  const { nativeLanguage, t } = useNativeLanguage();
  const { playClick, playCorrect, showToast, speak, stopSpeaking, speakingText } = useSoundAndTheme();

  const handleToggleSpeak = useCallback((t: string) => {
    if (speakingText === t) {
      stopSpeaking();
    } else {
      speak(t);
    }
  }, [speakingText, speak, stopSpeaking]);
  const userRank = LEVEL_ORDER[defaultLevel] ?? 0;

  const canonicalVocabMap = useMemo(() => {
    const map = new Map<string, CanonicalVocabularyItem>();
    for (const v of vocabulary) {
      map.set(v.id, toCanonicalVocabularyItem(v));
    }
    return map;
  }, [vocabulary]);

  /* ---------- effects ---------- */

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#kanji") setTab("KANJI");
      else if (hash === "#jouyou") setTab("JOUYOU");
      else if (hash === "#radicals" || hash === "#bothu") setTab("RADICALS");
      else if (hash === "#guide" || hash === "#radical-guide") setTab("RADICAL_GUIDE");
      else if (hash === "#vocabulary") setTab("VOCAB");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nq_starred_items");
      if (raw) setStarredSet(new Set(JSON.parse(raw) as string[]));
    } catch {
      // bỏ qua
    }
  }, []);

  // Đổi bộ lọc → về trang 1 và bỏ chọn
  useEffect(() => {
    setCurrentPage(1);
    setFlashcardIndex(0);
    setIsFlipped(false);
    setSelectedId(null);
  }, [levelFilter, tab, posFilter, scriptFilter, tagFilter, srsOnlyFilter, query, viewMode, sortMode]);

  useEffect(() => {
    setShowAllExamples(false);
  }, [selectedId]);

  // Một số tuỳ chọn chỉ có ở tab Từ vựng
  useEffect(() => {
    if (tab === "KANJI") {
      if (viewMode === "TOPIC") setViewMode("LIST");
      if (sortMode === "KANA") setSortMode("DEFAULT");
    }
  }, [tab, viewMode, sortMode]);

  /* ---------- actions ---------- */

  const switchTab = (next: Tab) => {
    playClick();
    setTab(next);
    try {
      window.history.replaceState(null, "", next === "KANJI" ? "#kanji" : "#vocabulary");
      const hash =
        next === "KANJI"
          ? "#kanji"
          : next === "JOUYOU"
          ? "#jouyou"
          : next === "RADICALS"
          ? "#radicals"
          : next === "RADICAL_GUIDE"
          ? "#guide"
          : "#vocabulary";
      window.history.replaceState(null, "", hash);
    } catch {
      // bỏ qua
    }
  };

  const handleAddToSrs = async (contentType: "VOCAB" | "KANJI", contentId: string, name: string) => {
    playClick();
    if (savedSet.has(contentId)) {
      showToast({ title: `${name} ${t("vocabSavedToSrsTitle")}`, type: "info" });
      return;
    }
    try {
      const res = await fetch("/api/review/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      if (res.ok) {
        playCorrect();
        setSavedSet((prev) => new Set(prev).add(contentId));
        notifyProgressUpdated();
        showToast({
          title: `${t("vocabSavedToSrsTitle")}: ${name}! 🎴`,
          description: t("vocabSavedToSrsDesc").replace("{name}", name),
          type: "xp",
        });
      } else {
        showToast({ title: t("serverError") || "Không thể lưu thẻ, vui lòng thử lại.", type: "error" });
      }
    } catch {
      showToast({ title: t("serverError") || "Không thể lưu thẻ, vui lòng thử lại.", type: "error" });
    }
  };

  const toggleMastered = (id: string) => {
    playClick();
    setMasteredSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStar = (id: string) => {
    playClick();
    const next = new Set(starredSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStarredSet(next);
    try {
      localStorage.setItem("nq_starred_items", JSON.stringify(Array.from(next)));
    } catch {
      // bỏ qua
    }
  };

  const toggleTopicExpand = (title: string) => {
    playClick();
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectItem = (id: string) => {
    playClick();
    setSelectedId(id);
    if (!isDesktop) setDetailOpen(true);
  };

  const goToPage = (p: number) => {
    playClick();
    setCurrentPage(p);
  };

  const resetFilters = () => {
    setQuery("");
    setLevelFilter(currentLearningLevel);
    setPosFilter("ALL");
    setScriptFilter("ALL");
    setTagFilter("ALL");
    setSrsOnlyFilter(false);
  };

  /* ---------- derived data ---------- */

  const filteredVocab = useMemo(() => {
    let result = levelFilter === "ALL" ? vocabulary : vocabulary.filter((v) => v.jlptLevel === levelFilter);
    if (posFilter !== "ALL") result = result.filter((v) => v.partOfSpeech === posFilter);
    if (scriptFilter !== "ALL") {
      result = result.filter((v) => canonicalVocabMap.get(v.id)?.scriptType === scriptFilter);
    }
    if (tagFilter !== "ALL") result = result.filter((v) => v.tags && v.tags.includes(tagFilter));
    if (srsOnlyFilter) result = result.filter((v) => savedSet.has(v.id));
    if (debouncedQuery.trim()) {
      const q = foldText(debouncedQuery);
      result = result.filter(
        (v) =>
          foldText(v.word).includes(q) ||
          foldText(v.kana).includes(q) ||
          foldText(v.romaji).includes(q) ||
          foldText(v.meaning).includes(q) ||
          (v.tags && foldText(v.tags).includes(q))
      );
    }
    return sortItems(result, sortMode, savedSet, (v) => v.kana);
  }, [vocabulary, canonicalVocabMap, debouncedQuery, levelFilter, posFilter, scriptFilter, tagFilter, srsOnlyFilter, savedSet, sortMode]);

  const filteredKanji = useMemo(() => {
    let result = levelFilter === "ALL" ? kanji : kanji.filter((k) => k.jlptLevel === levelFilter);
    if (srsOnlyFilter) result = result.filter((k) => savedSet.has(k.id));
    if (debouncedQuery.trim()) {
      const q = foldText(debouncedQuery);
      result = result.filter(
        (k) =>
          k.character.includes(q) ||
          foldText(k.meaning).includes(q) ||
          k.readings.some((r) => foldText(r.reading).includes(q))
      );
    }
    return sortItems(result, sortMode, savedSet);
  }, [kanji, debouncedQuery, levelFilter, srsOnlyFilter, savedSet, sortMode]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    vocabulary.forEach((v) => tagsOf(v.tags).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [vocabulary]);

  const levelOptions = useMemo(() => getLevelOptions(t), [t]);
  const scriptFilterOptions = useMemo(() => getScriptFilterOptions(t), [t]);
  const posOptions = useMemo(() => getPosOptions(t), [t]);

  const topicOptions = useMemo(
    () => [{ value: "ALL", label: t("filterAll") }, ...availableTags.map((t) => ({ value: t, label: t }))],
    [availableTags, t]
  );

  const sortOptions = useMemo(
    () => [
      { value: "DEFAULT", label: t("vocabSortDefault") },
      ...(tab === "VOCAB" ? [{ value: "KANA", label: t("vocabSortKana") }] : []),
      { value: "LEVEL", label: t("vocabSortLevel") },
      { value: "SAVED", label: t("vocabSortSaved") },
    ],
    [tab, t]
  );

  const topicGroups = useMemo(() => {
    const groups: Record<string, VocabItem[]> = {
      "🙇 Kính ngữ & Lịch sự (敬語)": [],
      "🏮 Văn hóa & Thành ngữ (文化・慣用句)": [],
      "🔥 Tiếng lóng & Khẩu ngữ (若者言葉・俗語)": [],
      "🗾 Phương ngữ vùng miền (方言)": [],
      "💬 Giao tiếp & Chào hỏi": [],
      "🏠 Gia đình & Đời sống": [],
      "🍣 Món ăn & Nhà hàng": [],
      "💼 Trường học & Công việc": [],
      "🚗 Giao thông & Di chuyển": [],
      "☀️ Thời gian & Thời tiết": [],
      "🏃 Động từ thông dụng": [],
      "🎨 Tính từ & Trạng thái": [],
      "📦 Khác": [],
    };
    filteredVocab.forEach((v) => {
      const tag = v.tags || "";
      const pos = v.partOfSpeech || "";
      if (tag.includes("Kính ngữ") || tag.includes("尊敬語") || tag.includes("謙譲語") || tag.includes("クッション言葉")) {
        groups["🙇 Kính ngữ & Lịch sự (敬語)"].push(v);
      } else if (tag.includes("Thành ngữ") || tag.includes("Văn hóa") || tag.includes("ことわざ") || tag.includes("慣用句")) {
        groups["🏮 Văn hóa & Thành ngữ (文化・慣用句)"].push(v);
      } else if (tag.includes("Tiếng lóng") || tag.includes("若者言葉") || tag.includes("俗語")) {
        groups["🔥 Tiếng lóng & Khẩu ngữ (若者言葉・俗語)"].push(v);
      } else if (tag.includes("Phương ngữ") || tag.includes("方言")) {
        groups["🗾 Phương ngữ vùng miền (方言)"].push(v);
      } else if (tag.includes("Giao tiếp") || pos === "expression") groups["💬 Giao tiếp & Chào hỏi"].push(v);
      else if (tag.includes("Gia đình") || tag.includes("Đời sống")) groups["🏠 Gia đình & Đời sống"].push(v);
      else if (tag.includes("Ăn uống") || tag.includes("Ẩm thực")) groups["🍣 Món ăn & Nhà hàng"].push(v);
      else if (tag.includes("Công việc") || tag.includes("Học tập") || tag.includes("Công sở")) groups["💼 Trường học & Công việc"].push(v);
      else if (tag.includes("Giao thông") || tag.includes("Địa điểm") || tag.includes("Du lịch")) groups["🚗 Giao thông & Di chuyển"].push(v);
      else if (tag.includes("Thời tiết") || tag.includes("Thời gian")) groups["☀️ Thời gian & Thời tiết"].push(v);
      else if (pos === "verb" || tag.includes("Động từ")) groups["🏃 Động từ thông dụng"].push(v);
      else if (pos.includes("adjective") || tag.includes("Tính từ")) groups["🎨 Tính từ & Trạng thái"].push(v);
      else groups["📦 Khác"].push(v);
    });
    return groups;
  }, [filteredVocab]);

  const totalItems = tab === "VOCAB" ? filteredVocab.length : filteredKanji.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const vocabSlice = useMemo(
    () => filteredVocab.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredVocab, currentPage, itemsPerPage]
  );
  const kanjiSlice = useMemo(
    () => filteredKanji.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredKanji, currentPage, itemsPerPage]
  );

  const activeVocab = tab === "VOCAB" ? (vocabSlice.find((v) => v.id === selectedId) ?? vocabSlice[0] ?? null) : null;
  const activeKanji = tab === "KANJI" ? (kanjiSlice.find((k) => k.id === selectedId) ?? kanjiSlice[0] ?? null) : null;

  const sliceCards = useMemo<CardData[]>(
    () =>
      tab === "VOCAB"
        ? vocabSlice.map((v) => vocabToCard(v, canonicalVocabMap.get(v.id)!, t, nativeLanguage))
        : kanjiSlice.map((k) => kanjiToCard(k, t, nativeLanguage)),
    [tab, vocabSlice, kanjiSlice, canonicalVocabMap, t, nativeLanguage]
  );
  const flashcards = useMemo<CardData[]>(
    () =>
      tab === "VOCAB"
        ? filteredVocab.map((v) => vocabToCard(v, canonicalVocabMap.get(v.id)!, t, nativeLanguage))
        : filteredKanji.map((k) => kanjiToCard(k, t, nativeLanguage)),
    [tab, filteredVocab, filteredKanji, canonicalVocabMap, t, nativeLanguage]
  );
  const flashcard = flashcards.length > 0 ? flashcards[Math.min(flashcardIndex, flashcards.length - 1)] : null;

  const unit = tab === "VOCAB" ? t("vocabUnitVocab") : t("vocabUnitKanji");
  const rangeFrom = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeTo = Math.min(currentPage * itemsPerPage, totalItems);

  // "Đã học" = số mục đã lưu vào sổ (SRS)
  const progress = useMemo(
    () => ({
      vocab: { done: vocabulary.filter((v) => savedSet.has(v.id)).length, total: vocabulary.length },
      kanji: { done: kanji.filter((k) => savedSet.has(k.id)).length, total: kanji.length },
    }),
    [vocabulary, kanji, savedSet]
  );
  const advancedCount = (srsOnlyFilter ? 1 : 0) + (viewMode === "FLASHCARD" || viewMode === "TOPIC" ? 1 : 0);

  const detail = activeVocab ? (
    <VocabDetail
      v={activeVocab}
      canon={canonicalVocabMap.get(activeVocab.id)!}
      saved={savedSet.has(activeVocab.id)}
      showRomaji={showRomaji}
      speakingText={speakingText}
      showAllExamples={showAllExamples}
      onToggleExamples={() => setShowAllExamples((s) => !s)}
      onSpeak={handleToggleSpeak}
      onSave={() => handleAddToSrs("VOCAB", activeVocab.id, canonicalVocabMap.get(activeVocab.id)?.writtenForm || activeVocab.word)}
      t={t}
    />
  ) : activeKanji ? (
    <KanjiDetail
      k={activeKanji}
      saved={savedSet.has(activeKanji.id)}
      starred={starredSet.has(activeKanji.id)}
      speakingText={speakingText}
      onSpeak={handleToggleSpeak}
      onSave={() => handleAddToSrs("KANJI", activeKanji.id, activeKanji.character)}
      onToggleStar={() => toggleStar(activeKanji.id)}
      t={t}
    />
  ) : null;

  const emptyState = (
    <EmptyState
      icon="🔍"
      title={t("vocabEmptyState")}
      body={t("vocabEmptyHint")}
      action={
        <Button variant="brandOutline" size="sm" onClick={resetFilters}>
          {t("btnResetFilters") || "Xóa bộ lọc"}
        </Button>
      }
    />
  );

  /* ---------- styles ---------- */

  const tabBase =
    "flex h-11 sm:h-12 min-w-[120px] items-center justify-center gap-2 rounded-2xl px-4 sm:px-5 text-xs sm:text-sm font-extrabold transition-all duration-200 active:scale-95 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500";
  const tabActive = "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30 scale-[1.02]";
  const tabIdle = "border border-slate-200/80 bg-slate-50/80 text-slate-700 hover:border-red-200 hover:bg-red-50/50 hover:text-red-700 dark:border-slate-800 dark:bg-sumi-800/80 dark:text-slate-300 dark:hover:bg-sumi-700";
  const segBtn = (on: boolean) =>
    `rounded-lg px-3 py-2.5 min-h-11 text-xs font-bold transition ${
      on ? "bg-red-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-sumi-900 dark:text-slate-300 dark:hover:bg-sumi-800"
    }`;
  const viewToggle = (on: boolean) =>
    `inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition ${
      on ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
    }`;

  /* ============================== RENDER ============================== */

  const safeT = (key: string, fallback: string) => {
    const v = t(key);
    return !v || v === key ? fallback : v;
  };

  const activeFilterCount =
    (scriptFilter !== "ALL" ? 1 : 0) +
    (tagFilter !== "ALL" ? 1 : 0) +
    (posFilter !== "ALL" ? 1 : 0) +
    (srsOnlyFilter ? 1 : 0);

  return (
    <div id="dictionary" className="space-y-4">
      {/* ── Linh vật Anime khích lệ tra cứu & học từ vựng ── */}
      <MascotCheerBanner
        kind="kitsune"
        tag={`${t ? t("navVocab") : "Từ vựng"} · JLPT ${currentLearningLevel}`}
        quote={`一期一会 — ${getLocalizedQuote(
          "一期一会",
          "Mỗi từ vựng là một cơ duyên gặp gỡ. Hãy kiên trì tích lũy từng từ mỗi ngày nhé!",
          nativeLanguage
        )}`}
        author="Kitsune Sensei"
      />

      <div className="rounded-3xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-sumi-900 sm:p-5">
        {/* ---------- Tabs + Navigation (Mobile Horizontal Scrollable) ---------- */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none sm:flex-wrap">
          <button
            type="button"
            onClick={() => switchTab("VOCAB")}
            aria-pressed={tab === "VOCAB"}
            className={`${tabBase} ${tab === "VOCAB" ? tabActive : tabIdle} whitespace-nowrap`}
          >
            <Icon name="book" className="h-4 w-4" /> {safeT("navVocab", "Từ vựng")} ({vocabulary.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab("KANJI")}
            aria-pressed={tab === "KANJI"}
            className={`${tabBase} ${tab === "KANJI" ? tabActive : tabIdle} whitespace-nowrap`}
          >
            <span className="jp-text leading-none">漢</span> {safeT("vocabTabKanji", "Kanji")} ({kanji.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab("JOUYOU")}
            aria-pressed={tab === "JOUYOU"}
            className={`${tabBase} ${tab === "JOUYOU" ? tabActive : tabIdle} whitespace-nowrap`}
          >
            <span>🏛️</span> {
              nativeLanguage === "zh-CN"
                ? "常用汉字 (2,136)"
                : nativeLanguage === "zh-TW"
                ? "常用漢字 (2,136)"
                : nativeLanguage === "ko"
                ? "상용한자 (2,136)"
                : "Jouyou Kanji (2,136)"
            }
          </button>
          <button
            type="button"
            onClick={() => switchTab("RADICALS")}
            aria-pressed={tab === "RADICALS"}
            className={`${tabBase} ${tab === "RADICALS" ? tabActive : tabIdle} whitespace-nowrap`}
          >
            <span>🧩</span> {getRadicalsTabLabel(nativeLanguage)}
          </button>
          <button
            type="button"
            onClick={() => switchTab("RADICAL_GUIDE")}
            aria-pressed={tab === "RADICAL_GUIDE"}
            className={`${tabBase} ${tab === "RADICAL_GUIDE" ? tabActive : tabIdle} whitespace-nowrap`}
          >
            <span>💡</span> {getRadicalGuideTabLabel(nativeLanguage)}
          </button>
          <Link href="/app/grammar" onClick={playClick} className={`${tabBase} ${tabIdle} whitespace-nowrap`}>
            <Icon name="star" className="h-4 w-4" /> {safeT("navGrammar", "Ngữ pháp")}
          </Link>
        </div>

        {/* ---------- CONDITIONAL VIEWS: JOUYOU, RADICALS, GUIDE ---------- */}
        {tab === "JOUYOU" && (
          <div className="mt-4">
            <JouyouKanjiView
              savedItemIds={Array.from(savedSet)}
              onToggleSave={(id, char) => handleAddToSrs("KANJI", id, char)}
            />
          </div>
        )}

        {tab === "RADICALS" && (
          <div className="mt-4">
            <RadicalsView
              onSelectKanjiFromExample={(char) => {
                switchTab("JOUYOU");
                setQuery(char);
              }}
            />
          </div>
        )}

        {tab === "RADICAL_GUIDE" && (
          <div className="mt-4">
            <RadicalGuideView />
          </div>
        )}

        {(tab === "VOCAB" || tab === "KANJI") && (
          <>
            {/* ---------- Search & primary controls (Clean & Compact) ---------- */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "VOCAB"
                      ? safeT("vocabSearchInputPlaceholderVocab", "Tìm theo chữ Hán, Hiragana, Romaji, nghĩa...")
                      : safeT("vocabSearchInputPlaceholderKanji", "Tìm chữ Hán, Hán Việt, âm On/Kun...")
                  }
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-xs sm:text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-4 focus:ring-red-500/10 dark:border-slate-700 dark:bg-sumi-900 dark:text-white"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-0 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Quick filters row */}
              <div className="flex items-center gap-2">
                {/* Focused JLPT Level Selector (Locked to learner's level by default) */}
                <div
                  title={`Cấp độ học hiện tại: JLPT ${currentLearningLevel}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-red-200/90 bg-red-50/90 px-3 text-xs font-black text-red-700 shadow-xs dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>JLPT</span>
                  <select
                    value={levelFilter}
                    onChange={(e) => {
                      playClick();
                      setLevelFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Cấp độ JLPT"
                    className="bg-transparent font-black text-red-700 dark:text-red-300 outline-none cursor-pointer"
                  >
                    <option value={currentLearningLevel} className="dark:bg-sumi-900 text-slate-800 dark:text-slate-100">
                      {currentLearningLevel} {t ? t("learningBadge") : "(Đang học)"}
                    </option>
                    {(["N5", "N4", "N3"] as const)
                      .filter((l) => l !== currentLearningLevel)
                      .map((l) => (
                        <option key={l} value={l} className="dark:bg-sumi-900 text-slate-800 dark:text-slate-100">
                          {l} {t ? t("exploreBadgeAlt") : "(Khám phá)"}
                        </option>
                      ))}
                    <option value="ALL" className="dark:bg-sumi-900 text-slate-800 dark:text-slate-100">
                      {t ? t("allFilter") : "Tất cả"}
                    </option>
                  </select>
                </div>

                {tab === "VOCAB" && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showRomaji}
                    onClick={() => {
                      playClick();
                      setShowRomaji((r) => !r);
                    }}
                    title="Bật/Tắt phiên âm Romaji"
                    className={`inline-flex h-10 items-center gap-1 rounded-2xl border px-3 text-xs font-bold shadow-xs transition ${
                      showRomaji
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-300"
                    }`}
                  >
                    <span>あ/A</span>
                    <span className="hidden sm:inline">Romaji: {showRomaji ? "ON" : "OFF"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setAdvancedOpen((o) => !o);
                  }}
                  aria-expanded={advancedOpen}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs sm:text-sm font-bold shadow-xs transition ${
                    advancedOpen || activeFilterCount > 0
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-100"
                  }`}
                >
                  <Icon name="filter" className="h-4 w-4" />
                  <span>Bộ lọc</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Advanced Filters Drawer */}
            {advancedOpen && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-xs dark:border-slate-800 dark:bg-sumi-950/50">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  {tab === "VOCAB" && (
                    <>
                      <div>
                        <p className="mb-1 text-xs font-bold text-slate-500">
                          {safeT("vocabScript", "Hệ chữ")}
                        </p>
                        <SelectField
                          label={safeT("vocabScript", "Hệ chữ")}
                          value={scriptFilter}
                          options={scriptFilterOptions}
                          onChange={(v) => setScriptFilter(v as "ALL" | JapaneseScriptType)}
                          className="w-full text-xs"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-bold text-slate-500">
                          {safeT("vocabTopic", "Chủ đề")}
                        </p>
                        <SelectField
                          label={safeT("vocabTopic", "Chủ đề")}
                          value={tagFilter}
                          options={topicOptions}
                          onChange={setTagFilter}
                          className="w-full text-xs"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-bold text-slate-500">
                          {safeT("vocabPos", "Loại từ")}
                        </p>
                        <SelectField
                          label={safeT("vocabPos", "Loại từ")}
                          value={posFilter}
                          options={posOptions}
                          onChange={setPosFilter}
                          className="w-full text-xs"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-bold text-slate-500">
                      {safeT("vocabSavedCardsLabel", "Thẻ lưu SRS")}
                    </p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={srsOnlyFilter}
                      onClick={() => {
                        playClick();
                        setSrsOnlyFilter((s) => !s);
                      }}
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-200"
                    >
                      <span className="truncate">Chỉ hiện thẻ đã lưu ({savedSet.size})</span>
                      <span className={`relative h-4 w-8 shrink-0 rounded-full transition ${srsOnlyFilter ? "bg-red-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${srsOnlyFilter ? "left-[18px]" : "left-0.5"}`} />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Reset Filters button */}
                {activeFilterCount > 0 && (
                  <div className="mt-3 flex justify-end border-t border-slate-200/80 pt-2 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setScriptFilter("ALL");
                        setTagFilter("ALL");
                        setPosFilter("ALL");
                        setSrsOnlyFilter(false);
                      }}
                      className="rounded-xl px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      ✕ {t ? t("resetAllFilters") : "Đặt lại tất cả bộ lọc"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ---------- Quick Cultural Category Pills (Single horizontal scroll row) ---------- */}
            {tab === "VOCAB" && (
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap mr-1">
                  Chuyên mục:
                </span>
                {[
                  { key: "ALL", label: "📚 Tất cả" },
                  { key: "Kính ngữ", label: "🙇 Kính ngữ" },
                  { key: "Phương ngữ", label: "🗾 Phương ngữ" },
                  { key: "Tiếng lóng", label: "🔥 Tiếng lóng" },
                  { key: "Thành ngữ", label: "🏮 Thành ngữ" },
                  { key: "Văn hóa Nhật Bản", label: "⛩️ Văn hóa" },
                ].map((pill) => {
                  const active = tagFilter === pill.key;
                  return (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => {
                        playClick();
                        setTagFilter(active ? "ALL" : pill.key);
                        if (pill.key !== "ALL" && levelFilter !== "ALL") {
                          setLevelFilter(currentLearningLevel);
                        }
                      }}
                      className={`whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? "bg-red-600 text-white shadow-xs"
                          : "border border-slate-200/80 bg-white text-slate-600 hover:border-red-300 dark:border-slate-800 dark:bg-sumi-800 dark:text-slate-300"
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ---------- Results Header & View Mode Switcher ---------- */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Hiển thị{" "}
                <b className="font-black text-slate-900 dark:text-white">
                  {rangeFrom}-{rangeTo}
                </b>{" "}
                {unit}
                <span className="text-slate-400"> (tổng {totalItems})</span>
              </div>

              <div className="flex items-center gap-2">
                <SelectField
                  plain
                  label={safeT("sortLabel", "Sắp xếp")}
                  value={sortMode}
                  options={sortOptions}
                  onChange={(v) => setSortMode(v as SortMode)}
                  className="text-xs"
                />

                {/* View modes toggle */}
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-sumi-900">
                  <button
                    type="button"
                    aria-label="Dạng danh sách"
                    title="Dạng danh sách"
                    aria-pressed={viewMode === "LIST"}
                    onClick={() => {
                      playClick();
                      setViewMode("LIST");
                    }}
                    className={viewToggle(viewMode === "LIST")}
                  >
                    <Icon name="list" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Dạng thẻ lưới"
                    title="Dạng thẻ lưới"
                    aria-pressed={viewMode === "GRID"}
                    onClick={() => {
                      playClick();
                      setViewMode("GRID");
                    }}
                    className={viewToggle(viewMode === "GRID")}
                  >
                    <Icon name="grid" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

        {/* ---------- VIEW: LIST + DETAIL ---------- */}
        {viewMode === "LIST" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">
              {totalItems === 0 ? (
                emptyState
              ) : (
                <>
                  <ListColumnsHeader tab={tab} t={t} />
                  <ul className="space-y-0.5">
                    {tab === "VOCAB"
                      ? vocabSlice.map((v) => {
                          const canon = canonicalVocabMap.get(v.id)!;
                          return (
                            <VocabRow
                              key={v.id}
                              v={v}
                              canon={canon}
                              showRomaji={showRomaji}
                              selected={isDesktop && activeVocab?.id === v.id}
                              starred={starredSet.has(v.id)}
                              saved={savedSet.has(v.id)}
                              isHigherLevel={(LEVEL_ORDER[v.jlptLevel] ?? 0) > userRank}
                              speakingText={speakingText}
                              onSelect={() => selectItem(v.id)}
                              onToggleStar={() => toggleStar(v.id)}
                              onSpeak={handleToggleSpeak}
                              onSave={() => handleAddToSrs("VOCAB", v.id, canon.writtenForm)}
                              t={t}
                            />
                          );
                        })
                      : kanjiSlice.map((k) => (
                          <KanjiRow
                            key={k.id}
                            k={k}
                            selected={isDesktop && activeKanji?.id === k.id}
                            starred={starredSet.has(k.id)}
                            saved={savedSet.has(k.id)}
                            isHigherLevel={(LEVEL_ORDER[k.jlptLevel] ?? 0) > userRank}
                            speakingText={speakingText}
                            onSelect={() => selectItem(k.id)}
                            onToggleStar={() => toggleStar(k.id)}
                            onSpeak={handleToggleSpeak}
                            onSave={() => handleAddToSrs("KANJI", k.id, k.character)}
                            t={t}
                          />
                        ))}
                  </ul>
                </>
              )}
              <Pagination page={currentPage} totalPages={totalPages} onPage={goToPage} slogan={t("vocabSlogan")} />
            </div>

            <aside className="hidden space-y-5 lg:block" aria-label="Chi tiết">
              <div className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-white p-5 shadow-[0_12px_40px_rgba(244,114,182,0.12)] dark:border-slate-800 dark:bg-sumi-900">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_right,rgba(251,182,210,0.55),transparent_65%),linear-gradient(to_bottom,rgba(255,241,245,0.9),transparent)] dark:opacity-30"
                />
                <Sakura className="pointer-events-none absolute right-5 top-4 h-9 w-9 opacity-80" />
                <Sakura className="pointer-events-none absolute right-16 top-10 h-5 w-5 opacity-60" />
                <div className="relative">
                  {detail ?? <p className="py-10 text-center text-sm text-slate-500">{t("vocabSelectPrompt")}</p>}
                </div>
              </div>
              <ProgressCard vocab={progress.vocab} kanji={progress.kanji} grammar={{ done: grammarProgress.done, total: grammarProgress.total }} t={t} />
              <QuoteCard nativeLanguage={nativeLanguage} />
            </aside>
          </div>
        )}

        {/* Màn hình nhỏ: chi tiết mở dạng hộp thoại */}
        <Modal
          isOpen={!isDesktop && detailOpen && viewMode === "LIST" && detail !== null}
          onClose={() => setDetailOpen(false)}
          title={tab === "VOCAB" ? t("vocabDetailModalVocab") : t("vocabDetailModalKanji")}
          maxWidth="lg"
        >
          {detail}
        </Modal>

        {/* ---------- VIEW: GRID ---------- */}
        {viewMode === "GRID" && (
          <>
            {totalItems === 0 ? (
              emptyState
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sliceCards.map((c) => (
                  <GridCard
                    key={c.id}
                    c={c}
                    saved={savedSet.has(c.id)}
                    mastered={masteredSet.has(c.id)}
                    showRomaji={showRomaji}
                    speakingText={speakingText}
                    onSpeak={handleToggleSpeak}
                    onSave={() => handleAddToSrs(c.type, c.id, c.front)}
                    onToggleMastered={() => toggleMastered(c.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
            <Pagination page={currentPage} totalPages={totalPages} onPage={goToPage} slogan={t("vocabSlogan")} />
          </>
        )}

        {/* ---------- VIEW: FLASHCARD ---------- */}
        {viewMode === "FLASHCARD" && (
          <div className="mx-auto max-w-xl space-y-4">
            {!flashcard ? (
              emptyState
            ) : (
              <>
                <div className="flex items-center justify-between px-1 text-xs font-black text-slate-500">
                  <span>
                    {Math.min(flashcardIndex, flashcards.length - 1) + 1} / {flashcards.length}
                  </span>
                  <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-sumi-800">
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${((Math.min(flashcardIndex, flashcards.length - 1) + 1) / flashcards.length) * 100}%` }}
                    />
                  </div>
                  <Badge variant="amber">JLPT {flashcard.level}</Badge>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label={isFlipped ? (t("flashcardFlipBack") || "Lật thẻ để xem lại mặt trước") : (t("flashcardFlipFront") || "Lật thẻ để xem nghĩa")}
                  onClick={() => {
                    playClick();
                    setIsFlipped((f) => !f);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      playClick();
                      setIsFlipped((f) => !f);
                    }
                  }}
                  className="flex min-h-[300px] w-full cursor-pointer flex-col justify-between rounded-3xl border-2 border-red-100 bg-gradient-to-br from-white via-red-50/30 to-rose-50/50 p-8 shadow-xl transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-950 dark:from-sumi-900 dark:via-sumi-900 dark:to-sumi-950 sm:min-h-[340px]"
                >
                  {!isFlipped ? (
                    <div className="my-auto flex flex-col items-center space-y-3 text-center">
                      <span className="text-xs font-bold text-slate-400">
                        {t("vocabStandardBanner")}
                      </span>
                      {/* 1. Phát âm / Romaji -> 2. Chữ Nhật */}
                      <p className="text-base font-extrabold text-red-600 dark:text-red-400">
                        {showRomaji && flashcard.displayRomaji ? flashcard.displayRomaji : flashcard.reading}
                      </p>
                      {showRomaji && flashcard.displayRomaji && flashcard.reading && (
                        <p className="jp-text text-xs font-medium text-slate-500 dark:text-slate-400">{flashcard.reading}</p>
                      )}
                      <h2 className="jp-text text-4xl font-black text-slate-900 dark:text-white sm:text-5xl">
                        {flashcard.frontWithReading}
                      </h2>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSpeak(flashcard.reading || flashcard.front);
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-red-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300"
                      >
                        <Icon name="speaker" className="h-4 w-4 text-red-600" /> {t("vocabColListen") || "Nghe phát âm"}
                      </button>
                    </div>
                  ) : (
                    <div className="my-auto flex flex-col items-center space-y-3 text-center">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {t("vocabStandardBanner")}
                      </span>
                      <p className="text-sm font-extrabold text-red-600 dark:text-red-400">
                        {showRomaji && flashcard.displayRomaji ? flashcard.displayRomaji : flashcard.reading}
                      </p>
                      <p className="jp-text text-2xl font-black text-slate-700 dark:text-slate-200">
                        {flashcard.frontWithReading}
                      </p>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white"><LocalizedVocabMeaning japanese={flashcard.front} kana={flashcard.reading} fallback={flashcard.meaning} /></h3>
                      {nativeLanguage === "vi" && flashcard.hanVietNote && (
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Hán Việt: {flashcard.hanVietNote}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <Badge variant="sky">{flashcard.label}</Badge>
                        {flashcard.scriptBadge && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200">
                            {flashcard.scriptBadge}
                          </span>
                        )}
                      </div>
                      {flashcard.example && (
                        <div className="mt-3 w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-4 text-left dark:border-slate-800 dark:bg-sumi-950/80">
                          <p className="jp-text text-base font-semibold leading-[2] text-slate-800 dark:text-slate-100">
                            <ExampleText sentence={flashcard.example.japanese} highlight={flashcard.highlight} />
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400"><LocalizedVocabMeaning japanese={flashcard.example.japanese} fallback={flashcard.example.meaning} /></p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200/60 pt-4 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span>{isFlipped ? (t("flashcardFlipBack") || "Chạm để xem lại mặt trước") : (t("flashcardFlipFront") || "Chạm để xem nghĩa")}</span>
                    <span>{safeT("vocabTopic", "Chủ đề")}: {flashcard.topic}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    disabled={flashcardIndex === 0}
                    onClick={() => {
                      playClick();
                      setIsFlipped(false);
                      setFlashcardIndex((i) => Math.max(0, i - 1));
                    }}
                  >
                    {t("testPrevQuestion") || "‹ Thẻ trước"}
                  </Button>
                  <Button
                    variant={savedSet.has(flashcard.id) ? "brand" : "brandOutline"}
                    onClick={() => handleAddToSrs(flashcard.type, flashcard.id, flashcard.front)}
                  >
                    {savedSet.has(flashcard.id) ? (
                      <>
                        {t("vocabSavedBtn") || "Đã lưu SRS"} <Icon name="check" className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <Icon name="plus" className="h-4 w-4" /> {t("vocabSaveBtn") || "Lưu vào SRS"}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={flashcardIndex >= flashcards.length - 1}
                    onClick={() => {
                      playClick();
                      setIsFlipped(false);
                      setFlashcardIndex((i) => Math.min(flashcards.length - 1, i + 1));
                    }}
                  >
                    {t("testNextQuestion") || "Thẻ tiếp ›"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---------- VIEW: THEO CHỦ ĐỀ ---------- */}
        {viewMode === "TOPIC" && tab === "VOCAB" && (
          <div className="space-y-5">
            {filteredVocab.length === 0 && emptyState}
            {Object.entries(topicGroups).map(([title, items]) => {
              if (items.length === 0) return null;
              const expanded = expandedTopics.has(title);
              const visible = expanded ? items : items.slice(0, 6);
              return (
                <section
                  key={title}
                  className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-sumi-900/90"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <h3 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                      {localizeTopicTitle(title, nativeLanguage)}
                      <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                        {items.length} {t("vocabUnitVocab") || "từ"}
                      </span>
                    </h3>
                    {items.length > 6 && (
                      <Button size="xs" variant="brandSoft" onClick={() => toggleTopicExpand(title)}>
                        {expanded ? (t("btnCollapse") || "Thu gọn") : `${t("btnExpandAll") || "Mở rộng"} ${items.length}`}
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((v) => {
                      const canon = canonicalVocabMap.get(v.id)!;
                      return (
                        <div
                          key={v.id}
                          className="flex items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 transition hover:border-red-300 dark:border-slate-800 dark:bg-sumi-950"
                        >
                          <div className="min-w-0">
                            {/* 1. Phát âm / Romaji -> 2. Chữ Nhật -> 3. Nghĩa tiếng Việt */}
                            <p className="text-xs font-extrabold text-red-600 dark:text-red-400">
                              {showRomaji ? canon.displayRomaji : canon.kanaReading}
                              {showRomaji && canon.kanaReading && (
                                <span className="jp-text ml-1.5 font-normal text-slate-500">({canon.kanaReading})</span>
                              )}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="jp-text text-lg font-black text-slate-900 dark:text-white">
                                {canon.displayWrittenWithReading}
                              </span>
                              <button
                                type="button"
                                aria-label={`Nghe phát âm ${canon.writtenForm}`}
                                onClick={() => handleToggleSpeak(canon.kanaReading || canon.writtenForm)}
                                className="text-slate-500 hover:text-red-600 dark:text-slate-400"
                              >
                                <Icon name="speaker" className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200"><LocalizedVocabMeaning japanese={canon.writtenForm} kana={canon.kanaReading} fallback={canon.meaningVi} /></p>
                            {nativeLanguage === "vi" && canon.hanVietNote && (
                              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Hán Việt: {canon.hanVietNote}
                              </p>
                            )}
                          </div>
                          <SaveButton
                            saved={savedSet.has(v.id)}
                            onSave={() => handleAddToSrs("VOCAB", v.id, canon.writtenForm)}
                            className="h-8 shrink-0 px-2.5"
                            t={t}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}