"use client";

import { useState, useMemo } from "react";
import { JOUYOU_KANJI_LIST, type JouyouKanjiItem } from "@/lib/jouyou-kanji-data";
import { useNativeLanguage } from "@/components/LanguageContext";
import {
  useBatchTranslation,
  getLocalizedJouyouInfo,
} from "@/lib/kanjiLocalization";
import { Icon, Modal } from "@/components/ui";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";

const GRADES: Array<{
  value: string;
  label: string;
  shortLabel: string;
  count: number;
  color: string;
}> = [
  { value: "ALL", label: "Tất cả 2,136 chữ", shortLabel: "Tất cả", count: 2136, color: "bg-slate-700" },
  { value: "1", label: "Lớp 1 (80 chữ - N5)", shortLabel: "Lớp 1", count: 80, color: "bg-emerald-500" },
  { value: "2", label: "Lớp 2 (160 chữ - N5/N4)", shortLabel: "Lớp 2", count: 160, color: "bg-teal-500" },
  { value: "3", label: "Lớp 3 (200 chữ - N4)", shortLabel: "Lớp 3", count: 200, color: "bg-sky-500" },
  { value: "4", label: "Lớp 4 (202 chữ - N3)", shortLabel: "Lớp 4", count: 202, color: "bg-blue-500" },
  { value: "5", label: "Lớp 5 (193 chữ - N3/N2)", shortLabel: "Lớp 5", count: 193, color: "bg-indigo-500" },
  { value: "6", label: "Lớp 6 (191 chữ - N2)", shortLabel: "Lớp 6", count: 191, color: "bg-purple-500" },
  { value: "S", label: "THCS & Phổ thông (1,110 chữ - N2/N1)", shortLabel: "THCS", count: 1110, color: "bg-rose-500" },
];

const JLPT_LEVELS = ["ALL", "N5", "N4", "N3", "N2", "N1"];
const PAGE_SIZE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 72, label: "72 chữ / trang" },
  { value: 144, label: "144 chữ / trang" },
  { value: 288, label: "288 chữ / trang" },
  { value: 2136, label: "Toàn bộ 2,136 chữ" },
];

interface JouyouKanjiViewProps {
  onSelectKanji?: (k: JouyouKanjiItem) => void;
  savedItemIds?: string[];
  onToggleSave?: (id: string, character: string) => void;
}

export function JouyouKanjiView({ savedItemIds = [], onToggleSave }: JouyouKanjiViewProps) {
  const { nativeLanguage } = useNativeLanguage();
  const { speak, stopSpeaking, speakingText } = useSoundAndTheme();
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedJlpt, setSelectedJlpt] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(72);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const [activeItem, setActiveItem] = useState<JouyouKanjiItem | null>(null);

  // Play audio pronunciation with multi-tier fallback & immediate toggle
  const speakReading = (reading: string) => {
    const clean = reading.replace(/[・\.\-\s]/g, "");
    if (!clean) return;
    if (speakingText === clean) {
      stopSpeaking();
    } else {
      speak(clean);
    }
  };

  // Filter list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return JOUYOU_KANJI_LIST.filter((item) => {
      // Grade filter
      if (selectedGrade !== "ALL" && String(item.grade) !== selectedGrade) {
        return false;
      }
      // JLPT filter
      if (selectedJlpt !== "ALL" && item.jlptLevel !== selectedJlpt) {
        return false;
      }
      // Search query
      if (q) {
        const matchChar = item.character.toLowerCase().includes(q);
        const matchOld = item.oldCharacter?.toLowerCase().includes(q);
        const matchHanViet = item.hanViet.toLowerCase().includes(q);
        const matchMeaningEn = item.meaningEn.toLowerCase().includes(q);
        const matchMeaningVi = item.meaningVi.toLowerCase().includes(q);
        const matchOn = item.onyomi.some((r) => r.toLowerCase().includes(q));
        const matchKun = item.kunyomi.some((r) => r.toLowerCase().includes(q));
        const matchRad = item.radical.toLowerCase().includes(q);
        if (
          !matchChar &&
          !matchOld &&
          !matchHanViet &&
          !matchMeaningEn &&
          !matchMeaningVi &&
          !matchOn &&
          !matchKun &&
          !matchRad
        ) {
          return false;
        }
      }
      return true;
    });
  }, [selectedGrade, selectedJlpt, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(() => {
    if (pageSize >= 2136) return filtered;
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Batch translate visible English meanings for mother tongue support
  const visibleEnglishTexts = useMemo(
    () => paginated.map((k) => k.meaningEn).filter(Boolean),
    [paginated]
  );
  const translations = useBatchTranslation(visibleEnglishTexts, nativeLanguage, "en");

  const handleGradeChange = (val: string) => {
    setSelectedGrade(val);
    setPage(1);
  };

  const handleJlptChange = (val: string) => {
    setSelectedJlpt(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/80 p-5 shadow-sm dark:border-indigo-950/60 dark:from-indigo-950/30 dark:via-sumi-900 dark:to-sky-950/30">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span>✓ ĐẦY ĐỦ 2,136 / 2,136 CHỮ HÁN TIÊU CHUẨN MEXT</span>
              <span>•</span>
              <span>DỊCH NGHĨA THEO NGÔN NGỮ CÀI ĐẶT</span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              Jouyou Kanji (常用漢字 - Thường Dụng Hán Tự)
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-2xl sm:text-sm">
              Bộ tiêu chuẩn 2,136 chữ Hán do Bộ Giáo dục Nhật Bản (MEXT) quy định. Đầy đủ cấp Tiểu học (Lớp 1-6) và Trung học, hiển thị chuẩn nghĩa theo tiếng mẹ đẻ cài đặt của bạn!
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            {/* View Switcher */}
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-xs dark:border-slate-800 dark:bg-sumi-800">
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`rounded-xl p-2 transition ${
                  viewMode === "GRID"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-700"
                }`}
                title="Chế độ lưới ô vuông"
              >
                <Icon name="grid" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={`rounded-xl p-2 transition ${
                  viewMode === "LIST"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-700"
                }`}
                title="Chế độ danh sách chi tiết"
              >
                <Icon name="list" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Grade Breakdown Bar */}
        <div className="mt-4 border-t border-indigo-100/90 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Phân bố theo cấp lớp học (1,026 Tiểu học + 1,110 Trung học = 2,136 chữ):</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">2,136 chữ</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-sumi-800">
            <div style={{ width: `${(80 / 2136) * 100}%` }} className="bg-emerald-500" title="Lớp 1: 80 chữ" />
            <div style={{ width: `${(160 / 2136) * 100}%` }} className="bg-teal-500" title="Lớp 2: 160 chữ" />
            <div style={{ width: `${(200 / 2136) * 100}%` }} className="bg-sky-500" title="Lớp 3: 200 chữ" />
            <div style={{ width: `${(202 / 2136) * 100}%` }} className="bg-blue-500" title="Lớp 4: 202 chữ" />
            <div style={{ width: `${(193 / 2136) * 100}%` }} className="bg-indigo-500" title="Lớp 5: 193 chữ" />
            <div style={{ width: `${(191 / 2136) * 100}%` }} className="bg-purple-500" title="Lớp 6: 191 chữ" />
            <div style={{ width: `${(1110 / 2136) * 100}%` }} className="bg-rose-500" title="THCS: 1,110 chữ" />
          </div>

          {/* Grade filter tabs */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap">
            {GRADES.map((g) => {
              const active = selectedGrade === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => handleGradeChange(g.value)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    active
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "border border-slate-200/80 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-sumi-800 dark:text-slate-300 dark:hover:border-indigo-700"
                  }`}
                >
                  {g.value !== "ALL" && (
                    <span className={`h-2 w-2 rounded-full ${g.color}`} />
                  )}
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search and Secondary Filter Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder={
              nativeLanguage === "vi"
                ? "Tìm theo chữ Hán, Hán Việt, nghĩa, âm On/Kun..."
                : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                ? "搜索汉字、释义、音读/训读..."
                : nativeLanguage === "ko"
                ? "한자, 뜻, 음독/훈독 검색..."
                : "Search by Kanji, meaning, Onyomi/Kunyomi..."
            }
            className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-sumi-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* JLPT Filter and Page Size selector */}
        <div className="flex flex-wrap items-center gap-3">
          {/* JLPT pills */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline">JLPT:</span>
            {JLPT_LEVELS.map((lvl) => {
              const active = selectedJlpt === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleJlptChange(lvl)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? "bg-slate-900 text-white dark:bg-white dark:text-sumi-950"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-sumi-800 dark:text-slate-300"
                  }`}
                >
                  {lvl === "ALL" ? "Tất cả" : lvl}
                </button>
              );
            })}
          </div>

          {/* Page size selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Số chữ hiển thị mỗi trang"
            className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-xs outline-none dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-200"
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result Count Status */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
        <div>
          Hiển thị <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{filtered.length}</span> / 2,136 chữ Jouyou
          {selectedGrade !== "ALL" && ` • Lọc: Lớp ${selectedGrade}`}
          {selectedJlpt !== "ALL" && ` • Cấp ${selectedJlpt}`}
        </div>
        <div>
          Trang {safePage} / {totalPages}
        </div>
      </div>

      {/* Content: Grid or List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-sumi-900">
          <span className="text-4xl">🔍</span>
          <h3 className="mt-2 text-base font-bold text-slate-800 dark:text-slate-200">
            {nativeLanguage === "vi"
              ? "Không tìm thấy chữ Hán nào phù hợp"
              : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
              ? "未找到匹配的汉字"
              : nativeLanguage === "ko"
              ? "일치하는 한자를 찾을 수 없습니다"
              : "No matching Kanji found"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {nativeLanguage === "vi"
              ? "Hãy thử tìm bằng chữ Hán khác, âm Hán Việt hoặc từ khóa nghĩa."
              : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
              ? "请尝试输入其他汉字、读音或含义关键词。"
              : nativeLanguage === "ko"
              ? "다른 한자나 뜻, 발음으로 다시 검색해 보세요."
              : "Try searching with another character, reading, or meaning."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedGrade("ALL");
              setSelectedJlpt("ALL");
            }}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : viewMode === "GRID" ? (
        /* ======================== GRID MODE ======================== */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {paginated.map((item) => {
            const isSaved = savedItemIds.includes(item.character);
            const { meaning, subText } = getLocalizedJouyouInfo(
              item,
              nativeLanguage,
              translations
            );

            return (
              <div
                key={item.num}
                onClick={() => setActiveItem(item)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:-translate-y-1 hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-sumi-900 dark:hover:border-indigo-500"
              >
                {/* Header: Num + JLPT / Grade */}
                <div className="flex items-center justify-between text-[10px] font-extrabold">
                  <span className="font-mono text-slate-400 group-hover:text-indigo-600">
                    #{item.num}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-sky-50 px-1.5 py-0.2 text-[9px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                      {item.jlptLevel}
                    </span>
                    <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      L{item.grade}
                    </span>
                  </div>
                </div>

                {/* Character */}
                <div className="my-2 text-center">
                  <div className="jp-text text-4xl font-black text-slate-900 transition group-hover:scale-110 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                    {item.character}
                  </div>
                </div>

                {/* Han Viet / Reading + Localized Meaning */}
                <div className="text-center border-t border-slate-100 pt-1.5 dark:border-slate-800">
                  <div className="text-xs font-black text-red-600 dark:text-red-400 tracking-wide truncate">
                    {subText}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    title={meaning}
                  >
                    {meaning}
                  </div>
                </div>

                {/* Bookmark Toggle */}
                {onToggleSave && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave(item.character, item.character);
                    }}
                    className={`absolute top-2 right-2 rounded-full p-1 transition opacity-0 group-hover:opacity-100 ${
                      isSaved
                        ? "text-amber-500 opacity-100"
                        : "text-slate-300 hover:text-amber-500"
                    }`}
                    title={isSaved ? "Bỏ lưu" : "Lưu vào sổ tay"}
                  >
                    <Icon name="bookmark" className="h-3.5 w-3.5 fill-current" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ======================== LIST MODE ======================== */
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-sumi-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-sumi-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Chữ Hán" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "汉字" : nativeLanguage === "ko" ? "한자" : "Kanji"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Hán Việt" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "读音" : nativeLanguage === "ko" ? "독음" : "Reading"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Nét / Bộ" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "笔画 / 部首" : nativeLanguage === "ko" ? "획수 / 부수" : "Strokes / Radical"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Cấp lớp" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "学年" : nativeLanguage === "ko" ? "학년" : "Grade"}
                  </th>
                  <th className="px-4 py-3">JLPT</th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Ý nghĩa (VI)" : `Meaning (${nativeLanguage.toUpperCase()})`}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Âm On / Kun" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "音读 / 训读" : nativeLanguage === "ko" ? "음독 / 훈독" : "On / Kun"}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {nativeLanguage === "vi" ? "Chi tiết" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "详情" : nativeLanguage === "ko" ? "상세" : "Detail"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.map((item) => {
                  const { meaning, subText } = getLocalizedJouyouInfo(
                    item,
                    nativeLanguage,
                    translations
                  );

                  return (
                    <tr
                      key={item.num}
                      onClick={() => setActiveItem(item)}
                      className="cursor-pointer transition hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">
                        #{item.num}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-2">
                          <span className="jp-text text-2xl font-black text-slate-900 dark:text-white">
                            {item.character}
                          </span>
                          {item.oldCharacter && (
                            <span className="jp-text text-xs text-slate-400" title="Phồn thể">
                              ({item.oldCharacter})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-black text-red-600 dark:text-red-400">
                        {subText}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold">
                          {item.strokeCount} {nativeLanguage === "vi" ? "nét" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "画" : nativeLanguage === "ko" ? "획" : "strokes"}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">({item.radical})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {nativeLanguage === "vi" ? `Lớp ${item.grade}` : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? `${item.grade}年级` : nativeLanguage === "ko" ? `${item.grade}학년` : `Grade ${item.grade}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                          {item.jlptLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {meaning}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-[11px]">
                          {item.onyomi.length > 0 && (
                            <span className="jp-text font-bold text-indigo-600 dark:text-indigo-400">
                              {item.onyomi.join(", ")}
                            </span>
                          )}
                          {item.kunyomi.length > 0 && (
                            <span className="jp-text text-emerald-600 dark:text-emerald-400">
                              {item.kunyomi.join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300"
                        >
                          Xem →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            Hiển thị {(safePage - 1) * pageSize + 1} -{" "}
            {Math.min(safePage * pageSize, filtered.length)} trên tổng số {filtered.length} chữ
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
            >
              « Đầu
            </button>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
            >
              ‹ Trước
            </button>

            <span className="px-3 py-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
            >
              Sau ›
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
            >
              Cuối »
            </button>
          </div>
        </div>
      )}

      {/* Kanji Detail Modal */}
      {activeItem && (
        <Modal
          isOpen={Boolean(activeItem)}
          onClose={() => setActiveItem(null)}
          title={`Hán tự #${activeItem.num}: ${activeItem.character} (${
            getLocalizedJouyouInfo(activeItem, nativeLanguage, translations).subText
          })`}
        >
          {(() => {
            const { meaning, subText } = getLocalizedJouyouInfo(
              activeItem,
              nativeLanguage,
              translations
            );
            return (
              <div className="space-y-5">
                {/* Main display card */}
                <div className="flex flex-col sm:flex-row items-center gap-5 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 p-6 dark:from-indigo-950/40 dark:via-sumi-900 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex flex-col items-center">
                    <div className="jp-text text-7xl font-black text-slate-900 dark:text-white drop-shadow">
                      {activeItem.character}
                    </div>
                    {activeItem.oldCharacter && (
                      <div className="mt-1 text-xs text-slate-500">
                        Phồn thể (Cũ): <span className="jp-text font-bold">{activeItem.oldCharacter}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                        {subText}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                        Lớp {activeItem.grade}
                      </span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                        {activeItem.jlptLevel}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-sumi-800 dark:text-slate-300">
                        {activeItem.strokeCount} nét
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        Bộ: {activeItem.radical}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-600 dark:bg-sumi-800 dark:text-slate-300">
                        #{activeItem.num}
                      </span>
                    </div>

                    <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {meaning}
                    </div>

                    {nativeLanguage !== "en" && activeItem.meaningEn && (
                      <div className="text-xs text-slate-400 italic">
                        {nativeLanguage === "vi" ? "Tiếng Anh: " : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "英语释义: " : nativeLanguage === "ko" ? "영어: " : "English: "}
                        {activeItem.meaningEn}
                      </div>
                    )}
                  </div>
                </div>

                {/* Readings Table */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-sumi-900">
                  <div>
                    <div className="text-xs font-extrabold uppercase text-slate-400">
                      {nativeLanguage === "vi"
                        ? "Âm On (Onyomi - Âm Hán Nhật)"
                        : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                        ? "音读 (Onyomi)"
                        : nativeLanguage === "ko"
                        ? "음독 (Onyomi)"
                        : "Onyomi (Chinese reading)"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {activeItem.onyomi.length > 0 ? (
                        activeItem.onyomi.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => speakReading(r)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-indigo-300"
                          >
                            <span className="jp-text">{r}</span>
                            <Icon name="speaker" className="h-3.5 w-3.5 opacity-60" />
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          {nativeLanguage === "vi"
                            ? "Không có âm On thông dụng"
                            : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                            ? "无常用音读"
                            : nativeLanguage === "ko"
                            ? "상용 음독 없음"
                            : "No common Onyomi"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="text-xs font-extrabold uppercase text-slate-400">
                      {nativeLanguage === "vi"
                        ? "Âm Kun (Kunyomi - Âm Thuần Nhật)"
                        : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                        ? "训读 (Kunyomi)"
                        : nativeLanguage === "ko"
                        ? "훈독 (Kunyomi)"
                        : "Kunyomi (Japanese reading)"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {activeItem.kunyomi.length > 0 ? (
                        activeItem.kunyomi.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => speakReading(r)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-emerald-300"
                          >
                            <span className="jp-text">{r}</span>
                            <Icon name="speaker" className="h-3.5 w-3.5 opacity-60" />
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">
                          {nativeLanguage === "vi"
                            ? "Không có âm Kun thông dụng"
                            : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                            ? "无常用训读"
                            : nativeLanguage === "ko"
                            ? "상용 훈독 없음"
                            : "No common Kunyomi"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeItem.character);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
                  >
                    <Icon name="bookmark" className="h-3.5 w-3.5" /> Sao chép chữ Hán
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveItem(null)}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs dark:bg-white dark:text-sumi-950"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
