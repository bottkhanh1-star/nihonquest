"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { NativeLanguage } from "@/lib/languages";

export type Season = "spring" | "summer" | "autumn" | "winter" | "auto";
export type ResolvedSeason = "spring" | "summer" | "autumn" | "winter";

export interface SeasonConfig {
  id: ResolvedSeason;
  nameVi: string;
  nameJp: string;
  kanji: string;
  emoji: string;
  tagline: string;
  colorHex: string;
  colorBorder3d: string;
  bgGradientLight: string;
  bgGradientDark: string;
  badgeClass: string;
  accentClass: string;
  cardShadow3d: string;
}

export const SEASONS_DATA: Record<ResolvedSeason, SeasonConfig> = {
  spring: {
    id: "spring",
    nameVi: "Mùa Xuân",
    nameJp: "春 (Haru)",
    kanji: "春",
    emoji: "🌸",
    tagline: "Hoa Anh Đào Nở Rộ · Khởi Đầu Mới",
    colorHex: "#ec4899",
    colorBorder3d: "#db2777",
    bgGradientLight: "from-pink-50/80 via-white to-rose-50/60",
    bgGradientDark: "from-sumi-900 via-sumi-900 to-pink-950/30",
    badgeClass: "bg-pink-100/90 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-300/80 shadow-xs",
    accentClass: "text-pink-600 dark:text-pink-400",
    cardShadow3d: "shadow-[0_10px_24px_-4px_rgba(236,72,153,0.18)]",
  },
  summer: {
    id: "summer",
    nameVi: "Mùa Hạ",
    nameJp: "夏 (Natsu)",
    kanji: "夏",
    emoji: "🌿",
    tagline: "Hương Trà Matcha & Lễ Hội Matsuri",
    colorHex: "#10b981",
    colorBorder3d: "#059669",
    bgGradientLight: "from-emerald-50/80 via-white to-teal-50/60",
    bgGradientDark: "from-sumi-900 via-sumi-900 to-emerald-950/30",
    badgeClass: "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/80 shadow-xs",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    cardShadow3d: "shadow-[0_10px_24px_-4px_rgba(16,185,129,0.18)]",
  },
  autumn: {
    id: "autumn",
    nameVi: "Mùa Thu",
    nameJp: "秋 (Aki)",
    kanji: "秋",
    emoji: "🍁",
    tagline: "Lá Phong Momiji Rực Đỏ & Trăng Rằm",
    colorHex: "#f59e0b",
    colorBorder3d: "#d97706",
    bgGradientLight: "from-amber-50/80 via-white to-orange-50/60",
    bgGradientDark: "from-sumi-900 via-sumi-900 to-amber-950/30",
    badgeClass: "bg-amber-100/90 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/80 shadow-xs",
    accentClass: "text-amber-600 dark:text-amber-400",
    cardShadow3d: "shadow-[0_10px_24px_-4px_rgba(245,158,11,0.2)]",
  },
  winter: {
    id: "winter",
    nameVi: "Mùa Đông",
    nameJp: "冬 (Fuyu)",
    kanji: "冬",
    emoji: "❄️",
    tagline: "Tuyết Trắng Tinh Khôi Đỉnh Núi Phú Sĩ",
    colorHex: "#0284c7",
    colorBorder3d: "#0369a1",
    bgGradientLight: "from-sky-50/80 via-white to-indigo-50/60",
    bgGradientDark: "from-sumi-900 via-sumi-900 to-sky-950/30",
    badgeClass: "bg-sky-100/90 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300/80 shadow-xs",
    accentClass: "text-sky-600 dark:text-sky-400",
    cardShadow3d: "shadow-[0_10px_24px_-4px_rgba(2,132,199,0.2)]",
  },
};

export const SEASON_I18N: Record<
  ResolvedSeason,
  Record<NativeLanguage, { name: string; tagline: string }>
> = {
  spring: {
    vi: { name: "Mùa Xuân", tagline: "Hoa Anh Đào Nở Rộ · Khởi Đầu Mới" },
    en: { name: "Spring", tagline: "Sakura in Full Bloom · Fresh Beginnings" },
    "zh-CN": { name: "春季", tagline: "樱花盛开 · 万象更新" },
    "zh-TW": { name: "春季", tagline: "櫻花盛開 · 萬象更新" },
    ko: { name: "봄", tagline: "만개한 벚꽃 · 새로운 시작" },
    es: { name: "Primavera", tagline: "Cerezos en Flor · Nuevos Comienzos" },
    fr: { name: "Printemps", tagline: "Cerisiers en Fleur · Nouveau Départ" },
    de: { name: "Frühling", tagline: "Kirschblütenzauber · Ein neuer Anfang" },
    id: { name: "Musim Semi", tagline: "Bunga Sakura Mekar · Awal Baru" },
    th: { name: "ฤดูใบไม้ผลิ", tagline: "ซากุระบานสะพรั่ง · การเริ่มต้นใหม่" },
    ru: { name: "Весна", tagline: "Цветение сакуры · Новые начинания" },
    pt: { name: "Primavera", tagline: "Cerejeiras em Flor · Novos Começos" },
  },
  summer: {
    vi: { name: "Mùa Hạ", tagline: "Hương Trà Matcha & Lễ Hội Matsuri" },
    en: { name: "Summer", tagline: "Matcha Breeze & Traditional Matsuri" },
    "zh-CN": { name: "夏季", tagline: "夏日清凉 · 抹茶香气与夏日祭" },
    "zh-TW": { name: "夏季", tagline: "夏日清涼 · 抹茶香氣與夏日祭" },
    ko: { name: "여름", tagline: "시원한 말차와 여름 마츠리 축제" },
    es: { name: "Verano", tagline: "Brisa de Matcha & Festivales Matsuri" },
    fr: { name: "Été", tagline: "Saveur Matcha & Festivals Matsuri" },
    de: { name: "Sommer", tagline: "Matcha-Frische & Traditionelle Feste" },
    id: { name: "Musim Panas", tagline: "Aroma Matcha & Festival Matsuri" },
    th: { name: "ฤดูร้อน", tagline: "กลิ่นหอมมัทฉะและเทศกาลมัตสึริ" },
    ru: { name: "Лето", tagline: "Аромат матча и летние фестивали мацури" },
    pt: { name: "Verão", tagline: "Brisa de Matcha & Festivais Tradicionais" },
  },
  autumn: {
    vi: { name: "Mùa Thu", tagline: "Lá Phong Momiji Rực Đỏ & Trăng Rằm" },
    en: { name: "Autumn", tagline: "Crimson Momiji Leaves & Harvest Moon" },
    "zh-CN": { name: "秋季", tagline: "红叶狩 · 绯红枫叶与明月" },
    "zh-TW": { name: "秋季", tagline: "紅葉狩 · 緋紅楓葉與明月" },
    ko: { name: "가을", tagline: "붉은 모미지 단풍과 보름달" },
    es: { name: "Otoño", tagline: "Hojas Momiji Rojas & Luna de Otoño" },
    fr: { name: "Automne", tagline: "Feuilles Momiji Pourpres & Pleine Lune" },
    de: { name: "Herbst", tagline: "Rote Momiji-Ahorne & Vollmond" },
    id: { name: "Musim Gugur", tagline: "Daun Momiji Merah & Bulan Purnama" },
    th: { name: "ฤดูใบไม้ร่วง", tagline: "ใบโมมิจิสีแดงและพระจันทร์เต็มดวง" },
    ru: { name: "Осень", tagline: "Багряные клены момидзи и полнолуние" },
    pt: { name: "Outono", tagline: "Folhas Momiji Rubras & Noite de Luar" },
  },
  winter: {
    vi: { name: "Mùa Đông", tagline: "Tuyết Trắng Tinh Khôi Đỉnh Núi Phú Sĩ" },
    en: { name: "Winter", tagline: "Pristine White Snow on Mount Fuji" },
    "zh-CN": { name: "冬季", tagline: "白雪皑皑 · 富士山绝景" },
    "zh-TW": { name: "冬季", tagline: "白雪皚皚 · 富士山絕景" },
    ko: { name: "겨울", tagline: "새하얀 눈 덮인 후지산의 절경" },
    es: { name: "Invierno", tagline: "Nieve Pura en la Cima del Monte Fuji" },
    fr: { name: "Hiver", tagline: "Neige Immaculée sur le Mont Fuji" },
    de: { name: "Winter", tagline: "Klarer weißer Schnee auf dem Berg Fuji" },
    id: { name: "Musim Dingin", tagline: "Salju Putih Murni di Puncak Gunung Fuji" },
    th: { name: "ฤดูหนาว", tagline: "หิมะขาวบริสุทธิ์บนยอดเขาฟูจิ" },
    ru: { name: "Зима", tagline: "Белоснежный покров горы Фудзи" },
    pt: { name: "Inverno", tagline: "Neve Imaculada no Monte Fuji" },
  },
};

export const AUTO_TOKYO_I18N: Record<NativeLanguage, { title: string; subtitle: string; activeBadge: string }> = {
  vi: { title: "Tự động theo thời gian Nhật Bản", subtitle: "Hiện tại tại Tokyo", activeBadge: "✓ Đang bật" },
  en: { title: "Auto by Japan Time (Tokyo)", subtitle: "Currently in Tokyo", activeBadge: "✓ Enabled" },
  "zh-CN": { title: "根据日本时间自动切换", subtitle: "当前东京时间", activeBadge: "✓ 已开启" },
  "zh-TW": { title: "依據日本時間自動切換", subtitle: "當前東京時間", activeBadge: "✓ 已開啟" },
  ko: { title: "일본 도쿄 시간 자동 동기화", subtitle: "현재 도쿄 계절", activeBadge: "✓ 적용 중" },
  es: { title: "Automático según hora de Japón", subtitle: "Actualmente en Tokio", activeBadge: "✓ Activado" },
  fr: { title: "Auto selon l'heure de Tokyo", subtitle: "Actuellement à Tokyo", activeBadge: "✓ Activé" },
  de: { title: "Automatisch nach Tokio-Zeit", subtitle: "Aktuell in Tokio", activeBadge: "✓ Aktiviert" },
  id: { title: "Otomatis waktu Jepang (Tokyo)", subtitle: "Saat ini di Tokyo", activeBadge: "✓ Aktif" },
  th: { title: "อัตโนมัติตามเวลาญี่ปุ่น (โตเกียว)", subtitle: "ขณะนี้ที่โตเกียว", activeBadge: "✓ เปิดใช้งาน" },
  ru: { title: "Авто по времени Токио", subtitle: "Сейчас в Токио", activeBadge: "✓ Включено" },
  pt: { title: "Automático pelo horário de Tóquio", subtitle: "Atualmente em Tóquio", activeBadge: "✓ Ativado" },
};

export function getLocalizedSeasonName(seasonId: ResolvedSeason, lang: NativeLanguage = "vi"): string {
  return SEASON_I18N[seasonId]?.[lang]?.name || SEASON_I18N[seasonId]?.vi?.name || seasonId;
}

export function getLocalizedSeasonTagline(seasonId: ResolvedSeason, lang: NativeLanguage = "vi"): string {
  return SEASON_I18N[seasonId]?.[lang]?.tagline || SEASON_I18N[seasonId]?.vi?.tagline || "";
}

/** Lấy tháng hiện tại theo múi giờ Nhật Bản (Asia/Tokyo) */
export function getJapanCurrentMonth(): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    return new Date().getMonth() + 1;
  }
}

/** Tự động xác định mùa tại Nhật Bản theo tháng */
export function getAutoSeasonJapan(): ResolvedSeason {
  const month = getJapanCurrentMonth();
  // Tháng 3 - 5: Mùa Xuân (Haru - Sakura 🌸)
  if (month >= 3 && month <= 5) return "spring";
  // Tháng 6 - 8: Mùa Hạ (Natsu - Matcha & Matsuri 🌿)
  if (month >= 6 && month <= 8) return "summer";
  // Tháng 9 - 11: Mùa Thu (Aki - Momiji 🍁)
  if (month >= 9 && month <= 11) return "autumn";
  // Tháng 12 - 2: Mùa Đông (Fuyu - Yuki & Fuji ❄️)
  return "winter";
}

interface SeasonContextType {
  season: Season;
  isAuto: boolean;
  resolvedSeason: ResolvedSeason;
  setSeason: (s: Season) => void;
  config: SeasonConfig;
}

const SeasonContext = createContext<SeasonContextType | null>(null);

const STORAGE_KEY = "nq_user_season_choice_v2";

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  // Mặc định tự động theo thời gian thực tại Nhật Bản (Asia/Tokyo)
  const [season, setSeasonState] = useState<Season>("auto");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Season | null;
      if (saved && ["spring", "summer", "autumn", "winter", "auto"].includes(saved)) {
        setSeasonState(saved);
      } else {
        setSeasonState("auto");
      }
    } catch {
      // Bỏ qua nếu môi trường không có localStorage
    }
  }, []);

  const setSeason = (nextSeason: Season) => {
    setSeasonState(nextSeason);
    try {
      localStorage.setItem(STORAGE_KEY, nextSeason);
    } catch {}
  };

  const resolvedSeason: ResolvedSeason = useMemo(() => {
    if (season === "auto") return getAutoSeasonJapan();
    return season;
  }, [season]);

  const config = SEASONS_DATA[resolvedSeason];
  const isAuto = season === "auto";

  return (
    <SeasonContext.Provider value={{ season, isAuto, resolvedSeason, setSeason, config }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    const fallbackSeason = getAutoSeasonJapan();
    return {
      season: "auto" as Season,
      isAuto: true,
      resolvedSeason: fallbackSeason,
      setSeason: () => {},
      config: SEASONS_DATA[fallbackSeason],
    };
  }
  return ctx;
}
