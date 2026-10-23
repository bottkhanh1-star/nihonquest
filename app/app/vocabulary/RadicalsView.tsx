"use client";

import { useState, useMemo } from "react";
import {
  KANJI_RADICALS_LIST,
  TOP_50_RADICAL_NUMS,
  type KanjiRadicalItem,
  type RadicalPosition,
} from "@/lib/kanji-radicals-data";
import { useNativeLanguage, type NativeLanguage } from "@/components/LanguageContext";
import {
  useBatchTranslation,
  getLocalizedRadicalInfo,
} from "@/lib/kanjiLocalization";
import { Icon, Modal } from "@/components/ui";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";

function getPositionFilters(lang: NativeLanguage): Array<{
  value: "ALL" | RadicalPosition;
  label: string;
  badgeColor: string;
}> {
  const isVi = lang === "vi";
  const isZh = lang === "zh-CN" || lang === "zh-TW";
  const isKo = lang === "ko";
  return [
    { value: "ALL", label: isVi ? "Tất cả vị trí" : isZh ? "全部位置" : isKo ? "모든 위치" : "All positions", badgeColor: "bg-slate-100 text-slate-700 dark:bg-sumi-800 dark:text-slate-300" },
    { value: "hen", label: isVi ? "偏 (Hen - Bên trái)" : isZh ? "偏旁 (Hen - 左)" : isKo ? "변 (Hen - 좌측)" : "Hen (Left)", badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300" },
    { value: "tsukuri", label: isVi ? "旁 (Tsukuri - Bên phải)" : isZh ? "旁 (Tsukuri - 右)" : isKo ? "방 (Tsukuri - 우측)" : "Tsukuri (Right)", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300" },
    { value: "kanmuri", label: isVi ? "冠 (Kanmuri - Ở trên)" : isZh ? "冠 (Kanmuri - 上)" : isKo ? "머리 (Kanmuri - 상단)" : "Kanmuri (Top)", badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300" },
    { value: "ashi", label: isVi ? "脚 (Ashi - Ở dưới)" : isZh ? "脚 (Ashi - 下)" : isKo ? "발 (Ashi - 하단)" : "Ashi (Bottom)", badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300" },
    { value: "tare", label: isVi ? "垂 (Tare - Rủ trái)" : isZh ? "垂 (Tare - 左上垂)" : isKo ? "엄 (Tare - 좌상)" : "Tare (Top-Left)", badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300" },
    { value: "nyou", label: isVi ? "繞 (Nyou - Bao dưới)" : isZh ? "绕 (Nyou - 左下绕)" : isKo ? "받침 (Nyou - 좌하)" : "Nyou (Bottom-Left)", badgeColor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300" },
    { value: "kamae", label: isVi ? "構 (Kamae - Vây quanh)" : isZh ? "构 (Kamae - 外框包围)" : isKo ? "몸 (Kamae - 포위)" : "Kamae (Enclosure)", badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300" },
    { value: "shin", label: isVi ? "Độc lập / Lõi" : isZh ? "独立 / 核心" : isKo ? "독립 / 중심" : "Independent / Core", badgeColor: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-sumi-800 dark:text-slate-300" },
  ];
}

const STROKE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const POS_COLOR_MAP: Record<RadicalPosition, { bg: string; text: string; border: string }> = {
  hen: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/60" },
  tsukuri: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/60" },
  kanmuri: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/60" },
  ashi: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/60" },
  tare: { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800/60" },
  nyou: { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800/60" },
  kamae: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800/60" },
  shin: { bg: "bg-slate-50 dark:bg-sumi-800/60", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700/60" },
};

interface RadicalsViewProps {
  onSelectKanjiFromExample?: (char: string) => void;
}

export function RadicalsView({ onSelectKanjiFromExample }: RadicalsViewProps) {
  const { nativeLanguage } = useNativeLanguage();
  const { speak, stopSpeaking, speakingText } = useSoundAndTheme();
  const [viewMode, setViewMode] = useState<"MATRIX" | "CARDS" | "TABLE">("MATRIX");
  const [selectedStrokes, setSelectedStrokes] = useState<number | "ALL">("ALL");
  const [selectedPos, setSelectedPos] = useState<"ALL" | RadicalPosition>("ALL");
  const [onlyTop50, setOnlyTop50] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRadical, setActiveRadical] = useState<KanjiRadicalItem | null>(null);

  // Extract English meanings to fetch batch translations for non-en/non-vi mother tongues
  const visibleEnglishTexts = useMemo(
    () => KANJI_RADICALS_LIST.map((r) => r.meaningEn).filter(Boolean),
    []
  );
  const translations = useBatchTranslation(visibleEnglishTexts, nativeLanguage, "en");

  // Pronounce Japanese name with multi-tier fallback & immediate toggle
  const speakJaName = (name: string) => {
    if (!name) return;
    if (speakingText === name) {
      stopSpeaking();
    } else {
      speak(name);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return KANJI_RADICALS_LIST.filter((rad) => {
      if (onlyTop50 && !TOP_50_RADICAL_NUMS.has(rad.num)) {
        return false;
      }
      if (selectedStrokes !== "ALL" && rad.strokes !== selectedStrokes) {
        return false;
      }
      if (selectedPos !== "ALL" && rad.pos !== selectedPos) {
        return false;
      }
      if (q) {
        const matchChar = rad.char.toLowerCase().includes(q);
        const matchVariants = rad.variants.some((v) => v.toLowerCase().includes(q));
        const matchHanViet = rad.hanViet.toLowerCase().includes(q);
        const matchJa = rad.jaName.toLowerCase().includes(q) || rad.romaji.toLowerCase().includes(q);
        const matchVi = rad.meaningVi.toLowerCase().includes(q);
        const matchEn = rad.meaningEn.toLowerCase().includes(q);
        const matchNum = String(rad.num) === q || `#${rad.num}` === q;
        const matchEx = rad.examples.some((k) => k.toLowerCase().includes(q));
        if (
          !matchChar &&
          !matchVariants &&
          !matchHanViet &&
          !matchJa &&
          !matchVi &&
          !matchEn &&
          !matchNum &&
          !matchEx
        ) {
          return false;
        }
      }
      return true;
    });
  }, [selectedStrokes, selectedPos, onlyTop50, searchQuery]);

  // Group by stroke counts for Matrix view
  const strokeGroups = useMemo(() => {
    const groups = new Map<number, KanjiRadicalItem[]>();
    for (const rad of filtered) {
      if (!groups.has(rad.strokes)) {
        groups.set(rad.strokes, []);
      }
      groups.get(rad.strokes)!.push(rad);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const positionFilters = useMemo(() => getPositionFilters(nativeLanguage), [nativeLanguage]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-rose-200/80 bg-gradient-to-r from-rose-50/90 via-white to-amber-50/80 p-5 shadow-sm dark:border-rose-950/60 dark:from-rose-950/30 dark:via-sumi-900 dark:to-amber-950/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              <span>
                {nativeLanguage === "vi"
                  ? "🧩 214 Bộ Thủ Khang Hy (康煕部首)"
                  : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                  ? "🧩 214 康熙部首"
                  : nativeLanguage === "ko"
                  ? "🧩 214 강희자전 부수 (康熙部首)"
                  : "🧩 214 Kangxi Radicals (康煕部首)"}
              </span>
              <span>•</span>
              <span>
                {nativeLanguage === "vi"
                  ? "Dịch nghĩa chuẩn theo ngôn ngữ cài đặt"
                  : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                  ? "母语标准释义同步"
                  : nativeLanguage === "ko"
                  ? "모국어 맞춤 해설"
                  : "Synchronized with your native language"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
              {nativeLanguage === "vi"
                ? "Bộ thủ Kanji (Radicals)"
                : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                ? "汉字部首表 (Radicals)"
                : nativeLanguage === "ko"
                ? "한자 부수 (Radicals)"
                : "Kanji Radicals"}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-2xl sm:text-sm">
              {nativeLanguage === "vi"
                ? "Bộ thủ là những “khối gạch cơ bản” xây dựng nên toàn bộ chữ Hán. Nhận biết 214 bộ thủ giúp bạn nhận diện trường nghĩa của chữ ngay tức thì và phân biệt dễ dàng các chữ có nét tương đồng!"
                : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                ? "部首是构成汉字大厦的核心积木。掌握214部首能帮助你一眼洞察字义倾向，并迅速辨析形近字！"
                : nativeLanguage === "ko"
                ? "부수는 한자를 구성하는 가장 기초적인 블록입니다. 214개 부수를 이해하면 글자의 의미 범주를 즉시 파악하고 모양이 비슷한 한자를 쉽게 구별할 수 있습니다!"
                : "Radicals are the fundamental building blocks of all Kanji. Understanding the 214 radicals helps you grasp core meanings instantly and distinguish visually similar characters!"}
            </p>
          </div>

          {/* Quick Switch Views & Stats */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {/* View switcher */}
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-xs dark:border-slate-800 dark:bg-sumi-800">
              <button
                type="button"
                onClick={() => setViewMode("MATRIX")}
                title="Bảng ma trận gọn gàng theo số nét"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "MATRIX"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>▦</span>
                <span>{nativeLanguage === "vi" ? "Ma trận" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "矩阵" : nativeLanguage === "ko" ? "매트릭스" : "Matrix"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                title="Thẻ học chi tiết kèm ví dụ"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "CARDS"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>🗂️</span>
                <span>{nativeLanguage === "vi" ? "Thẻ chi tiết" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "卡片" : nativeLanguage === "ko" ? "상세 카드" : "Cards"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                title="Bảng danh sách tra cứu"
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewMode === "TABLE"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <span>☰</span>
                <span>{nativeLanguage === "vi" ? "Bảng" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "列表" : nativeLanguage === "ko" ? "목록표" : "Table"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter: Top 50 vs All 214 */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rose-100/90 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setOnlyTop50(false);
              setSelectedStrokes("ALL");
            }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              !onlyTop50
                ? "bg-slate-900 text-white dark:bg-white dark:text-sumi-950 shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300"
            }`}
          >
            {nativeLanguage === "vi"
              ? "Tất cả 214 Bộ Thủ"
              : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
              ? "全部 214 部首"
              : nativeLanguage === "ko"
              ? "전체 214 부수"
              : "All 214 Radicals"}
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyTop50(true);
              setSelectedStrokes("ALL");
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
              onlyTop50
                ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm shadow-amber-500/20"
                : "border border-amber-300 bg-amber-50/80 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            <span>
              {nativeLanguage === "vi"
                ? "⭐ Top 50 Cốt Lõi"
                : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                ? "⭐ Top 50 核心部首"
                : nativeLanguage === "ko"
                ? "⭐ Top 50 핵심 부수"
                : "⭐ Top 50 Essential"}
            </span>
            <span className="rounded-md bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
              75% Kanji
            </span>
          </button>

          <div className="hidden h-5 w-[1px] bg-slate-200 dark:bg-slate-700 sm:block" />

          {/* Position Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap">
            {positionFilters.map((pos) => {
              const active = selectedPos === pos.value;
              return (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setSelectedPos(pos.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? "bg-rose-600 text-white shadow-xs"
                      : "border border-slate-200/80 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-sumi-800 dark:text-slate-300 dark:hover:border-rose-700"
                  }`}
                >
                  {pos.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search & Stroke Bar */}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              nativeLanguage === "vi"
                ? "Tìm theo chữ (氵, 人), Hán Việt (thủy, nhân), số nét, số #..."
                : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                ? "输入部首(氵, 人)、释义、笔画数或编号 #..."
                : nativeLanguage === "ko"
                ? "부수 글자(氵, 人), 뜻, 획수, 번호 #... 검색"
                : "Search by radical (氵, 人), meaning, stroke count, #num..."
            }
            className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-9 text-xs sm:text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-slate-800 dark:bg-sumi-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Stroke count chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline whitespace-nowrap">
            {nativeLanguage === "vi" ? "Nét:" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "笔画:" : nativeLanguage === "ko" ? "획수:" : "Strokes:"}
          </span>
          <button
            type="button"
            onClick={() => setSelectedStrokes("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition ${
              selectedStrokes === "ALL"
                ? "bg-slate-900 text-white dark:bg-white dark:text-sumi-950"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-sumi-800 dark:text-slate-300"
            }`}
          >
            {nativeLanguage === "vi" ? "Tất cả" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "全部" : nativeLanguage === "ko" ? "전체" : "All"}
          </button>
          {STROKE_COUNTS.map((s) => {
            const active = selectedStrokes === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedStrokes(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  active
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-sumi-800 dark:text-slate-300"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
        <div>
          {nativeLanguage === "vi" ? (
            <>
              Đang hiển thị <span className="font-extrabold text-rose-600 dark:text-rose-400">{filtered.length}</span> / 214 Bộ thủ
              {onlyTop50 && " (Bộ lọc: ⭐ Top 50 cốt lõi)"}
              {selectedPos !== "ALL" && ` • Vị trí: ${selectedPos}`}
              {selectedStrokes !== "ALL" && ` • ${selectedStrokes} nét`}
            </>
          ) : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? (
            <>
              展示中 <span className="font-extrabold text-rose-600 dark:text-rose-400">{filtered.length}</span> / 214 个部首
              {onlyTop50 && " (筛选: ⭐ Top 50 核心)"}
              {selectedPos !== "ALL" && ` • 位置: ${selectedPos}`}
              {selectedStrokes !== "ALL" && ` • ${selectedStrokes} 画`}
            </>
          ) : nativeLanguage === "ko" ? (
            <>
              214개 중 <span className="font-extrabold text-rose-600 dark:text-rose-400">{filtered.length}</span>개 표시
              {onlyTop50 && " (⭐ Top 50 핵심)"}
              {selectedPos !== "ALL" && ` • 위치: ${selectedPos}`}
              {selectedStrokes !== "ALL" && ` • ${selectedStrokes} 획`}
            </>
          ) : (
            <>
              Showing <span className="font-extrabold text-rose-600 dark:text-rose-400">{filtered.length}</span> / 214 Radicals
              {onlyTop50 && " (Filter: ⭐ Top 50 Essential)"}
              {selectedPos !== "ALL" && ` • Position: ${selectedPos}`}
              {selectedStrokes !== "ALL" && ` • ${selectedStrokes} strokes`}
            </>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          {nativeLanguage === "vi"
            ? "💡 Click vào bất kỳ bộ thủ nào để xem chi tiết, biến thể & chữ mẫu"
            : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
            ? "💡 点击任意部首查看详细解析、变体与代表字"
            : nativeLanguage === "ko"
            ? "💡 부수를 클릭하면 상세 해설, 변형 및 대표 한자를 확인합니다"
            : "💡 Click any radical to inspect details, variants & sample Kanji"}
        </div>
      </div>

      {/* Main Content Render */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-sumi-900">
          <span className="text-4xl">🧩</span>
          <h3 className="mt-2 text-base font-bold text-slate-800 dark:text-slate-200">
            {nativeLanguage === "vi"
              ? "Không tìm thấy bộ thủ nào phù hợp"
              : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
              ? "未找到匹配的部首"
              : nativeLanguage === "ko"
              ? "일치하는 부수를 찾을 수 없습니다"
              : "No matching radicals found"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {nativeLanguage === "vi"
              ? "Hãy thử nhập từ khóa khác hoặc bấm “Tất cả 214 Bộ Thủ” để đặt lại."
              : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
              ? "请尝试输入其他关键词或点击“全部 214 部首”重置。"
              : nativeLanguage === "ko"
              ? "다른 검색어를 입력하거나 '전체 214 부수'를 눌러 재설정하세요."
              : "Try searching with another keyword or click 'All 214 Radicals' to reset."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedPos("ALL");
              setSelectedStrokes("ALL");
              setOnlyTop50(false);
            }}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            {nativeLanguage === "vi" ? "Đặt lại bộ lọc" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "重置筛选" : nativeLanguage === "ko" ? "필터 초기화" : "Reset filter"}
          </button>
        </div>
      ) : viewMode === "MATRIX" ? (
        /* ======================== MODE 1: MATRIX (CLEANEST & FASTEST) ======================== */
        <div className="space-y-6">
          {strokeGroups.map(([strokeNum, items]) => (
            <div
              key={strokeNum}
              className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-xs backdrop-blur dark:border-slate-800 dark:bg-sumi-900/80 sm:p-5"
            >
              {/* Group Stroke Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-600 text-xs font-black text-white">
                    {strokeNum}
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {strokeNum} {nativeLanguage === "vi" ? "Nét" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "画" : nativeLanguage === "ko" ? "획" : "Strokes"}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    ({items.length} {nativeLanguage === "vi" ? "bộ thủ" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "个部首" : nativeLanguage === "ko" ? "개 부수" : "radicals"})
                  </span>
                </div>
              </div>

              {/* Grid of Clean Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {items.map((rad) => {
                  const isTop50 = TOP_50_RADICAL_NUMS.has(rad.num);
                  const posStyle = POS_COLOR_MAP[rad.pos] || POS_COLOR_MAP.shin;
                  const { meaning, subText } = getLocalizedRadicalInfo(
                    rad,
                    nativeLanguage,
                    translations
                  );

                  return (
                    <div
                      key={rad.num}
                      onClick={() => setActiveRadical(rad)}
                      className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
                        isTop50
                          ? "border-amber-200/90 bg-gradient-to-b from-amber-50/40 to-white hover:border-amber-400 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-sumi-900"
                          : "border-slate-200/80 bg-white hover:border-rose-400 dark:border-slate-800 dark:bg-sumi-900 dark:hover:border-rose-600"
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between text-[10px] font-extrabold">
                        <span className="font-mono text-slate-400 group-hover:text-rose-600">
                          #{rad.num}
                        </span>
                        <div className="flex items-center gap-1">
                          {isTop50 && (
                            <span
                              title="Bộ thủ cốt lõi hay gặp nhất"
                              className="text-amber-500 font-black text-[11px]"
                            >
                              ★
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                          >
                            {rad.posName.split(" ")[0]}
                          </span>
                        </div>
                      </div>

                      {/* Main Character */}
                      <div className="my-2 text-center">
                        <div className="jp-text text-3xl font-black text-slate-900 transition group-hover:scale-110 group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-400">
                          {rad.char}
                        </div>
                        {rad.variants.length > 0 && (
                          <div className="jp-text mt-0.5 text-xs font-bold text-rose-500/80">
                            ({rad.variants.join(", ")})
                          </div>
                        )}
                      </div>

                      {/* Han Viet / Subtext & Localized Meaning */}
                      <div className="text-center border-t border-slate-100 pt-1.5 dark:border-slate-800/80">
                        <div className="text-xs font-black text-red-600 dark:text-red-400 tracking-wide truncate">
                          {subText}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300"
                          title={meaning}
                        >
                          {meaning.split(",")[0]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "CARDS" ? (
        /* ======================== MODE 2: SPACIOUS CARDS ======================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {filtered.map((rad) => {
            const isTop50 = TOP_50_RADICAL_NUMS.has(rad.num);
            const posStyle = POS_COLOR_MAP[rad.pos] || POS_COLOR_MAP.shin;
            const { meaning, subText } = getLocalizedRadicalInfo(
              rad,
              nativeLanguage,
              translations
            );

            return (
              <div
                key={rad.num}
                onClick={() => setActiveRadical(rad)}
                className={`group relative flex cursor-pointer flex-col justify-between rounded-3xl border p-4 shadow-xs transition hover:-translate-y-1 hover:shadow-lg ${
                  isTop50
                    ? "border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-white hover:border-amber-400 dark:border-amber-900/50 dark:from-amber-950/20 dark:via-sumi-900 dark:to-sumi-900"
                    : "border-slate-200/90 bg-white hover:border-rose-400 dark:border-slate-800 dark:bg-sumi-900 dark:hover:border-rose-600"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-rose-50 px-2 py-0.5 font-mono text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        #{rad.num}
                      </span>
                      {isTop50 && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                          ★ Cốt lõi
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-sumi-800 dark:text-slate-300">
                        {rad.strokes} nét
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                      >
                        {rad.posName}
                      </span>
                    </div>
                  </div>

                  {/* Character + Subtext */}
                  <div className="my-3 flex items-baseline justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-baseline gap-2">
                      <span className="jp-text text-5xl font-black text-slate-900 transition group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-400">
                        {rad.char}
                      </span>
                      {rad.variants.length > 0 && (
                        <span className="jp-text text-xl font-bold text-rose-500">
                          ({rad.variants.join(", ")})
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-red-600 dark:text-red-400 tracking-wider">
                        {subText}
                      </div>
                      <div className="text-xs text-slate-400">
                        {rad.jaName} ({rad.romaji})
                      </div>
                    </div>
                  </div>

                  {/* Localized Meaning */}
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {meaning}
                  </div>
                  {/* Secondary meaning if user language is not Vietnamese */}
                  {nativeLanguage !== "vi" && rad.meaningVi && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      Nghĩa Hán: {rad.meaningVi} ({rad.hanViet})
                    </div>
                  )}
                  {nativeLanguage === "vi" && rad.meaningEn && (
                    <div className="mt-0.5 text-[11px] text-slate-400 italic">
                      Tiếng Anh: {rad.meaningEn}
                    </div>
                  )}

                  {/* Examples */}
                  {rad.examples.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">
                        Kanji mẫu:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {rad.examples.slice(0, 6).map((k, i) => (
                          <span
                            key={i}
                            className="jp-text rounded-md bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 font-bold text-slate-700 dark:border-slate-800 dark:bg-sumi-800 dark:text-slate-200"
                          >
                            {k}
                          </span>
                        ))}
                        {rad.examples.length > 6 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{rad.examples.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Memory Tip */}
                {rad.tip && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-sumi-800/60 dark:text-slate-300">
                    💡 {rad.tip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ======================== MODE 3: COMPACT TABLE ======================== */
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-sumi-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-sumi-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Bộ thủ & Biến thể" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "部首与变体" : nativeLanguage === "ko" ? "부수 및 변형" : "Radical & Variants"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Tên / Đọc" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "读音 / 名称" : nativeLanguage === "ko" ? "명칭 / 독음" : "Name / Reading"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Nét" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "笔画" : nativeLanguage === "ko" ? "획수" : "Strokes"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Vị trí" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "位置" : nativeLanguage === "ko" ? "위치" : "Position"}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Ý nghĩa (VI)" : `Meaning (${nativeLanguage.toUpperCase()})`}
                  </th>
                  <th className="px-4 py-3">
                    {nativeLanguage === "vi" ? "Kanji Mẫu" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "典型汉字" : nativeLanguage === "ko" ? "대표 한자" : "Sample Kanji"}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {nativeLanguage === "vi" ? "Chi tiết" : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? "详情" : nativeLanguage === "ko" ? "상세" : "Detail"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((rad) => {
                  const isTop50 = TOP_50_RADICAL_NUMS.has(rad.num);
                  const posStyle = POS_COLOR_MAP[rad.pos] || POS_COLOR_MAP.shin;
                  const { meaning, subText } = getLocalizedRadicalInfo(
                    rad,
                    nativeLanguage,
                    translations
                  );

                  return (
                    <tr
                      key={rad.num}
                      onClick={() => setActiveRadical(rad)}
                      className="cursor-pointer transition hover:bg-rose-50/40 dark:hover:bg-rose-950/20"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">
                        #{rad.num}
                        {isTop50 && <span className="ml-1 text-amber-500 font-bold">★</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-2">
                          <span className="jp-text text-2xl font-black text-slate-900 dark:text-white">
                            {rad.char}
                          </span>
                          {rad.variants.length > 0 && (
                            <span className="jp-text text-sm font-bold text-rose-500">
                              ({rad.variants.join(", ")})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-red-600 dark:text-red-400">
                          {subText}
                        </div>
                        <div className="text-[10px] text-slate-400">{rad.jaName}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                        {rad.strokes} nét
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                        >
                          {rad.posName}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {meaning}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {rad.examples.slice(0, 4).map((k, i) => (
                            <span
                              key={i}
                              className="jp-text rounded bg-slate-100 px-1.5 py-0.2 font-bold text-slate-700 dark:bg-sumi-800 dark:text-slate-300"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
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

      {/* Radical Detail Modal */}
      {activeRadical && (
        <Modal
          isOpen={Boolean(activeRadical)}
          onClose={() => setActiveRadical(null)}
          title={`Bộ thủ #${activeRadical.num}: ${activeRadical.char} (${
            getLocalizedRadicalInfo(activeRadical, nativeLanguage, translations).subText
          })`}
        >
          {(() => {
            const { meaning, subText } = getLocalizedRadicalInfo(
              activeRadical,
              nativeLanguage,
              translations
            );
            return (
              <div className="space-y-5">
                {/* Header Display */}
                <div className="flex flex-col sm:flex-row items-center gap-5 rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 dark:from-rose-950/40 dark:via-sumi-900 dark:to-amber-950/40 border border-rose-100 dark:border-rose-900/50">
                  <div className="flex items-baseline gap-3">
                    <span className="jp-text text-7xl font-black text-slate-900 dark:text-white drop-shadow">
                      {activeRadical.char}
                    </span>
                    {activeRadical.variants.length > 0 && (
                      <span className="jp-text text-3xl font-black text-rose-600 dark:text-rose-400">
                        ({activeRadical.variants.join(", ")})
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                        {subText}
                      </span>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                        #{activeRadical.num}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-sumi-800 dark:text-slate-300">
                        {activeRadical.strokes} nét
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        {activeRadical.posName}
                      </span>
                      {TOP_50_RADICAL_NUMS.has(activeRadical.num) && (
                        <span className="rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                          ★ Top 50 Cốt Lõi
                        </span>
                      )}
                    </div>

                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {meaning}
                    </div>

                    {nativeLanguage !== "vi" && activeRadical.meaningVi && (
                      <div className="text-xs text-slate-500">
                        Tiếng Việt: <span className="font-bold text-slate-700 dark:text-slate-300">{activeRadical.meaningVi}</span> ({activeRadical.hanViet})
                      </div>
                    )}

                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Tên tiếng Nhật:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {activeRadical.jaName}
                      </span>
                      <span>({activeRadical.romaji})</span>
                      <button
                        type="button"
                        onClick={() => speakJaName(activeRadical.jaName)}
                        title="Nghe phát âm"
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600 dark:hover:bg-sumi-800"
                      >
                        <Icon name="speaker" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Memory Tip */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="font-black text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>
                      {nativeLanguage === "vi"
                        ? "Mẹo ghi nhớ & Nhận diện hình tượng:"
                        : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                        ? "记忆要诀与形象联想："
                        : nativeLanguage === "ko"
                        ? "기억 팁 및 이미지 연상:"
                        : "Memory Tip & Visual Association:"}
                    </span>
                  </div>
                  <p className="leading-relaxed">{activeRadical.tip}</p>
                </div>

                {/* Kanji examples */}
                {activeRadical.examples.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-sumi-900">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        {nativeLanguage === "vi"
                          ? "Chữ Hán tiêu biểu chứa bộ thủ này:"
                          : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                          ? "包含该部首的典型代表汉字："
                          : nativeLanguage === "ko"
                          ? "이 부수가 포함된 대표 상용 한자:"
                          : "Representative Kanji containing this radical:"}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {nativeLanguage === "vi"
                          ? "Click vào chữ để tra nhanh"
                          : nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW"
                          ? "点击汉字快速查阅"
                          : nativeLanguage === "ko"
                          ? "클릭하여 빠른 검색"
                          : "Click character to look up"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeRadical.examples.map((k, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (onSelectKanjiFromExample) {
                              onSelectKanjiFromExample(k);
                              setActiveRadical(null);
                            }
                          }}
                          className="jp-text inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-2xl font-black text-slate-800 shadow-xs transition hover:scale-110 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-sumi-800 dark:text-white dark:hover:bg-rose-950/40"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveRadical(null)}
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
