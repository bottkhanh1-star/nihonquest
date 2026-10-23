"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NihonQuestLogo } from "./NihonQuestLogo";
import { VoiceSelectorModal } from "./VoiceSelectorModal";
import { CLOUD_VOICES, isCloudVoiceId } from "@/lib/cloudTtsVoices";
import { SPEECH_RATES, useSoundAndTheme } from "./SoundAndThemeContext";
import { useUserProgress } from "./UserProgressContext";
import { useNativeLanguage, SUPPORTED_LANGUAGES } from "./LanguageContext";
import { NotificationDropdown } from "./NotificationDropdown";
import { UserAvatar } from "./UserAvatar";
import { guessVoiceGender, voiceGenderLabel } from "@/lib/voiceGender";
import { Icon, IconButton, type IconName } from "./ui";

interface NavItem {
  href: string;
  label: string;
  labelKey?: string;
  /** Icon line (SVG) dùng chung từ ui.tsx */
  icon?: IconName;
  /** Hoặc một ký tự Nhật làm icon (あ, 文, 学...) */
  glyph?: string;
  /** Nhãn rút gọn cho tab bar dưới màn hình */
  short: string;
  shortKey?: string;
  /** Các đường dẫn phụ cũng tính là đang active cho mục này */
  matchPrefixes?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Tổng quan", labelKey: "navOverview", icon: "dashboard", short: "Tổng quan", shortKey: "navOverview" },
  { href: "/app/path", label: "Lộ trình", labelKey: "navPath", glyph: "道", short: "Lộ trình", shortKey: "navPath" },
  { href: "/app/practice", label: "Bài học", labelKey: "navLessons", icon: "book", short: "Bài học", shortKey: "navLessons" },
  { href: "/app/review", label: "Ôn tập", labelKey: "navReview", icon: "cards", short: "Ôn tập", shortKey: "navReview" },
  { href: "/app/vocabulary", label: "Từ vựng", labelKey: "navVocab", glyph: "あ", short: "Từ vựng", shortKey: "navVocab" },
  { href: "/app/grammar", label: "Ngữ pháp", labelKey: "navGrammar", glyph: "文", short: "Ngữ pháp", shortKey: "navGrammar" },
];

const MORE_GROUPS: { title: string; titleKey?: string; items: NavItem[] }[] = [
  {
    title: "Luyện tập & Kiểm tra",
    titleKey: "groupPractice",
    items: [
      { href: "/app/test", label: "Kiểm tra năng lực (4 kỹ năng)", labelKey: "navTest", glyph: "★", short: "Kiểm tra" },
      { href: "/app/learn", label: "Bảng chữ cái Kana & Tổng quan", labelKey: "navKana", glyph: "学", short: "Kana" },
      { href: "/app/sensei", label: "Hội thoại AI Sensei", labelKey: "navSensei", glyph: "話", short: "Sensei" },
    ],
  },
  {
    title: "Tiến độ & Cộng đồng",
    titleKey: "groupProgress",
    items: [
      { href: "/app/analytics", label: "Đánh giá tiến bộ (Chu trình 8 bước)", labelKey: "navAnalytics", glyph: "進", short: "Tiến bộ" },
      { href: "/app/stats", label: "Thống kê học tập", labelKey: "navStats", glyph: "計", short: "Thống kê" },
      { href: "/app/leaderboard", label: "Bảng xếp hạng", labelKey: "navLeaderboard", glyph: "杯", short: "BXH" },
      { href: "/app/achievements", label: "Huy hiệu & Thành tựu", labelKey: "navAchievements", glyph: "🏆", short: "Huy hiệu" },
    ],
  },
  {
    title: "Trò chơi & Khám phá",
    titleKey: "groupExplore",
    items: [
      { href: "/app/journey", label: "Hành trình Nhật Bản", labelKey: "navJourney", glyph: "⌁", short: "Hành trình" },
      { href: "/app/survival", label: "Thực chiến tiếng Nhật (Survival)", labelKey: "navSurvival", glyph: "食", short: "Thực chiến" },
      { href: "/app/yokai-dash", label: "Mini-game Yōkai Dash", labelKey: "navYokaiDash", glyph: "狐", short: "Yōkai Dash" },
    ],
  },
];

const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((g) => g.items);

function NavGlyph({ item }: { item: NavItem }) {
  if (item.icon) return <Icon name={item.icon} className="h-[18px] w-[18px]" />;
  return (
    <span className="jp-text inline-flex h-[18px] w-[18px] items-center justify-center text-[15px] font-bold leading-none">
      {item.glyph}
    </span>
  );
}

/** Đóng popover khi click ra ngoài hoặc nhấn Escape. */
function useDismiss(ref: { current: HTMLElement | null }, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  return (
    <UserAvatar
      src={image}
      name={name}
      sizeClass="h-10 w-10 text-sm"
      className="bg-gradient-to-br from-slate-800 to-red-900 ring-2 ring-white dark:ring-sumi-800"
      imgClassName="ring-2 ring-white dark:ring-sumi-800"
    />
  );
}

export function AppNav({
  userName,
  userImage,
  avatar,
  userLevel,
  userXP,
  streak,
  levelLabel,
  unreadCount = 0,
}: {
  userName?: string | null;
  userImage?: string | null;
  avatar?: string | null;
  userLevel?: number;
  userXP?: number;
  streak?: number;
  levelLabel?: string;
  /** > 0 thì hiện chấm đỏ trên chuông thông báo */
  unreadCount?: number;
}) {
  const { progress } = useUserProgress();
  const { nativeLanguage, setNativeLanguage, t } = useNativeLanguage();
  const effectiveName = progress?.displayName || userName;
  const effectiveAvatar = progress?.avatar || avatar || userImage;
  const effectiveLevel = progress?.level ?? userLevel;
  const effectiveStreak = progress?.currentStreak ?? streak;
  const effectiveXP = progress?.totalXP ?? userXP;
  const pathname = usePathname();
  const {
    resolvedTheme,
    toggleTheme,
    soundEnabled,
    setSoundEnabled,
    playClick,
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    setSpeechVoiceURI,
    availableVoices,
    speak,
    stopSpeaking,
    speakingText,
    showToast,
  } = useSoundAndTheme();

  const [moreOpen, setMoreOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [previewSpeakingURI, setPreviewSpeakingURI] = useState<string | null>(null);

  useEffect(() => {
    if (!speakingText) {
      setPreviewSpeakingURI(null);
    }
  }, [speakingText]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const speedRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useDismiss(moreRef, moreOpen, () => setMoreOpen(false));
  useDismiss(speedRef, speedOpen, () => setSpeedOpen(false));
  useDismiss(accountRef, accountOpen, () => setAccountOpen(false));
  useDismiss(langRef, langOpen, () => setLangOpen(false));

  // Đổi trang thì đóng mọi menu
  useEffect(() => {
    setMoreOpen(false);
    setSpeedOpen(false);
    setAccountOpen(false);
    setLangOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // Drawer mở thì khoá cuộn trang + khoá cuộn nền, và Escape đóng.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Đưa tiêu điểm vào drawer để bàn phím không trượt ra ngoài.
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const active = (href: string, matchPrefixes?: string[]) => {
    if (matchPrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
    return pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
  };
  const moreActive = MORE_ITEMS.some((item) => active(item.href, item.matchPrefixes));
  const accountActive = active("/app/profile", ["/app/profile", "/app/settings"]);

  const linkBase =
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500";
  const linkIdle =
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-sumi-800 dark:hover:text-white";
  const linkActive =
    "bg-slate-50 font-bold text-slate-900 shadow-sm ring-1 ring-slate-200/80 [&_svg]:text-red-600 [&_.jp-text]:text-red-600 dark:bg-sumi-800 dark:text-white dark:ring-slate-700";

  const getItemLabel = (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label);
  const getItemShort = (item: NavItem) => (item.shortKey ? t(item.shortKey) : (item.labelKey ? t(item.labelKey) : item.short));
  const getGroupTitle = (group: { title: string; titleKey?: string }) => (group.titleKey ? t(group.titleKey) : group.title);

  return (
    <>
      {/* Thanh trên: logo + hành động. Link chính chỉ hiện từ xl trở lên;
          dưới đó dùng tab bar đáy màn hình + drawer. */}
      <header
        className="sticky z-40 px-2 sm:px-6"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        data-intro
      >
        <div className="mx-auto flex max-w-[1320px] items-center gap-1.5 sm:gap-2 rounded-[22px] border border-slate-200/70 bg-white/90 px-2 sm:px-3 py-1.5 sm:py-2 shadow-[0_10px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-slate-800 dark:bg-sumi-900/90 lg:gap-3 lg:px-4">
          <Link
            href="/app"
            className="mr-0.5 flex shrink-0 items-center sm:mr-1 max-[360px]:[&_.nq-brand-type]:hidden"
            onClick={playClick}
            aria-label="NihonQuest – về Dashboard"
          >
            <NihonQuestLogo size="sm" />
          </Link>

          {/* Desktop links carried ~1040px of content into a 944px box at 1024px, and
                overflow-x-hidden clipped the overflow instead of scrolling it. */}
          <nav className="hidden flex-1 items-center gap-1 xl:flex" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={playClick}
                aria-current={active(item.href) ? "page" : undefined}
                className={`${linkBase} ${active(item.href) ? linkActive : linkIdle}`}
              >
                <NavGlyph item={item} />
                <span>{getItemLabel(item)}</span>
              </Link>
            ))}

            <div className="relative" ref={moreRef}>
              <button
                type="button"
                className={`${linkBase} ${moreActive || moreOpen ? linkActive : linkIdle}`}
                onClick={() => {
                  playClick();
                  setMoreOpen((v) => !v);
                }}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                <Icon name="bookmark" className="h-[18px] w-[18px]" />
                <span>{t("navExplore") || "Khám phá"}</span>
                <Icon name="chevron" className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="absolute left-0 top-12 z-50 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-sumi-900">
                  {MORE_GROUPS.map((group, gIdx) => (
                    <div key={group.title} className={gIdx > 0 ? "mt-2 border-t border-slate-100 pt-1 dark:border-slate-800" : ""}>
                      <p className="px-3 pb-1 pt-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {getGroupTitle(group)}
                      </p>
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            playClick();
                            setMoreOpen(false);
                          }}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                            active(item.href, item.matchPrefixes)
                              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-800"
                          }`}
                        >
                          <span className="jp-text inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold dark:bg-sumi-800">
                            {item.glyph}
                          </span>
                          <b className="flex-1 font-semibold">{getItemLabel(item)}</b>
                          <Icon name="arrow" className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Tốc độ đọc + âm thanh */}
            <div className="relative" ref={speedRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSpeedOpen((v) => !v);
                }}
                aria-expanded={speedOpen}
                aria-haspopup="true"
                aria-label={`Tốc độ đọc ${speechRate}x – mở cài đặt âm thanh`}
                className="inline-flex h-9 sm:h-10 items-center gap-1 rounded-full border border-slate-200 bg-white pl-2 sm:pl-3 pr-1.5 sm:pr-2 text-[13px] font-extrabold text-red-600 shadow-sm transition hover:border-slate-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-slate-700 dark:bg-sumi-900"
              >
                <Icon name="speaker" className={`h-4 w-4 ${soundEnabled ? "text-slate-500" : "text-slate-300"}`} />
                <span className="hidden sm:inline">{speechRate}x</span>
                <Icon name="chevron" className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>

              {speedOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(19rem,calc(100vw-1.5rem))] space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-sumi-900">
                  {speakingText && (
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeaking();
                      }}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-white px-3 py-2 text-xs font-black shadow-sm animate-pulse hover:bg-red-700 transition"
                      title="Dừng âm thanh đang phát ngay lập tức"
                    >
                      <span>⏹️</span>
                      <span>Dừng âm thanh đang phát</span>
                    </button>
                  )}
                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-500">Tốc độ đọc</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SPEECH_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setSpeechRate(rate);
                            speak("こんにちは", rate);
                          }}
                          aria-pressed={speechRate === rate}
                          className={`min-h-11 rounded-full border px-4 text-sm font-extrabold transition ${
                            speechRate === rate
                              ? "border-red-600 bg-red-600 text-white"
                              : "border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-500">Giọng đọc tiếng Nhật</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSpeedOpen(false);
                          setVoiceModalOpen(true);
                        }}
                        className="text-[11px] font-extrabold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <span>Tất cả giọng</span>
                        <span>›</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSpeedOpen(false);
                        setVoiceModalOpen(true);
                      }}
                      className="w-full min-h-11 p-2.5 rounded-xl border border-slate-200 dark:border-sumi-700 bg-slate-50 dark:bg-sumi-950 flex items-center justify-between gap-2 text-left hover:border-red-400 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {(() => {
                            if (!speechVoiceURI) return "Tự động (tiếng Nhật)";
                            if (isCloudVoiceId(speechVoiceURI)) {
                              const found = CLOUD_VOICES.find((c) => c.id === speechVoiceURI);
                              return found ? `${found.displayName} · ${found.gender === "female" ? "♀ Nữ" : "♂ Nam"}` : speechVoiceURI;
                            }
                            const dev = availableVoices.find((v) => v.voiceURI === speechVoiceURI);
                            return dev ? dev.name : speechVoiceURI;
                          })()}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {isCloudVoiceId(speechVoiceURI) ? "☁️ Giọng Cloud Neural (Đồng bộ mọi trang)" : "💻 Giọng cài trên máy"}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">⚙️ Đổi</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundEnabled}
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      if (!soundEnabled) setTimeout(playClick, 30);
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-left text-sm font-bold text-slate-700 dark:bg-sumi-950 dark:text-slate-200"
                  >
                    <span>{t("soundFx") || "Âm thanh hiệu ứng"}</span>
                    <span
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${soundEnabled ? "bg-red-600" : "bg-slate-300 dark:bg-slate-700"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${soundEnabled ? "left-5" : "left-0.5"}`}
                      />
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Native Language Dropdown Selector */}
            <div className="relative" ref={langRef} suppressHydrationWarning>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  playClick();
                  setLangOpen(!langOpen);
                }}
                className="inline-flex h-9 sm:h-10 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 active:scale-95 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-200"
                title="Chọn ngôn ngữ mẹ đẻ (Native Language)"
                aria-label="Chọn ngôn ngữ mẹ đẻ"
                aria-expanded={langOpen}
              >
                <span suppressHydrationWarning>{SUPPORTED_LANGUAGES.find((l) => l.code === nativeLanguage)?.flag || "🇻🇳"}</span>
                <span suppressHydrationWarning className="hidden sm:inline font-bold">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === nativeLanguage)?.short || nativeLanguage.toUpperCase()}
                </span>
                <Icon name="chevron" className="hidden h-3 w-3 text-slate-400 sm:block" />
              </button>

              {langOpen && (
                <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-sumi-900 max-h-72 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400">
                    {t("nativeLangTitle")} ({SUPPORTED_LANGUAGES.length})
                  </div>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        playClick();
                        setNativeLanguage(l.code);
                        setLangOpen(false);
                        showToast({
                          title: `${t("langSwitchedToast")}${l.nativeName} ${l.flag}`,
                          description: `${t("nativeLangSubtitle")}: ${l.nativeName}.`,
                          type: "info",
                        });
                      }}
                      className={`w-full px-3 py-2 text-left text-xs rounded-xl flex items-center justify-between transition ${
                        nativeLanguage === l.code
                          ? "bg-red-50 dark:bg-sumi-800 font-extrabold text-red-600 dark:text-red-400"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-sumi-800"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">{l.flag}</span>
                        <span>{l.nativeName}</span>
                      </span>
                      {nativeLanguage === l.code && <span className="text-red-600 dark:text-red-400 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <IconButton
              label={resolvedTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              className="h-10 w-10 sm:h-10 sm:w-10"
              onClick={() => {
                playClick();
                toggleTheme();
              }}
            >
              <Icon name={resolvedTheme === "dark" ? "moon" : "sun"} className="h-[18px] w-[18px]" />
            </IconButton>

            <NotificationDropdown />

            {/* Unified Account & Settings Popover (Desktop & Tablet) */}
            <div className="relative hidden sm:block" ref={accountRef}>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setAccountOpen((v) => !v);
                }}
                aria-expanded={accountOpen}
                aria-haspopup="true"
                aria-label="Hồ sơ và cài đặt tài khoản"
                className={`flex items-center gap-1.5 rounded-full p-0.5 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                  accountActive || accountOpen ? "ring-2 ring-red-500" : ""
                }`}
              >
                <Avatar name={effectiveName} image={effectiveAvatar} />
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-sumi-900">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <Avatar name={effectiveName} image={effectiveAvatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                        {effectiveName || t("learner")}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {levelLabel ? <span>{levelLabel}</span> : effectiveLevel ? <span>Lv.{effectiveLevel}</span> : null}
                        {effectiveXP != null && <span>⚡ {effectiveXP.toLocaleString("vi-VN")} XP</span>}
                        {effectiveStreak != null && <span>🔥 {effectiveStreak}d</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    <Link
                      href="/app/profile"
                      onClick={() => {
                        playClick();
                        setAccountOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/app/profile")
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-800"
                      }`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm dark:bg-sumi-800">👤</span>
                      <div className="min-w-0 flex-1">
                        <b className="block text-xs font-bold">{t("userProfile") || "Hồ sơ cá nhân"}</b>
                        <span className="block text-[11px] text-slate-400">{t("userProfileDesc") || "Ảnh đại diện, cấp độ & bảo mật"}</span>
                      </div>
                    </Link>

                    <Link
                      href="/app/settings"
                      onClick={() => {
                        playClick();
                        setAccountOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/app/settings")
                          ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-800"
                      }`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-sm dark:bg-sumi-800">⚙️</span>
                      <div className="min-w-0 flex-1">
                        <b className="block text-xs font-bold">{t("systemSettings") || "Cài đặt hệ thống"}</b>
                        <span className="block text-[11px] text-slate-400">{t("systemSettingsDesc") || "Giao diện, giọng đọc & mục tiêu"}</span>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <IconButton label="Mở menu" className="h-10 w-10 sm:h-10 sm:w-10 xl:hidden" onClick={() => setMobileOpen(true)}>
              <Icon name="menu" className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </header>

      {/* Tab bar đáy màn hình — chỉ dưới xl. Đây là điều hướng chính trên điện thoại:
          nằm trong tầm ngón cái thay vì nấp sau nút menu. */}
      <nav
        aria-label="Điều hướng nhanh"
        className="nq-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl select-none touch-manipulation dark:border-slate-800 dark:bg-sumi-900/95 xl:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const on = active(item.href, item.matchPrefixes);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={playClick}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-[10px] font-bold transition active:scale-95 touch-manipulation ${
                    on ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <span
                    className={`grid h-7 w-9 shrink-0 place-items-center rounded-full transition ${
                      on ? "bg-red-50 dark:bg-red-950/50" : ""
                    }`}
                  >
                    <NavGlyph item={item} />
                  </span>
                  <span className="min-w-0 max-w-full truncate leading-none">{getItemShort(item)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm xl:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          onMouseDown={() => setMobileOpen(false)}
        >
          <div
            ref={drawerRef}
            tabIndex={-1}
            className="ml-auto flex h-full w-[min(88vw,360px)] flex-col overflow-y-auto overscroll-contain bg-white p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl outline-none dark:bg-sumi-900"
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <NihonQuestLogo size="sm" />
              <IconButton label="Đóng menu" className="h-11 w-11 shrink-0" onClick={() => setMobileOpen(false)}>
                <Icon name="close" className="h-4 w-4" />
              </IconButton>
            </div>

            {/* Unified Account & Settings Card on Mobile Drawer */}
            <div className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-sumi-950/60">
              <div className="flex items-center gap-3">
                <Avatar name={effectiveName} image={effectiveAvatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {effectiveName || t("learner")}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {effectiveLevel ? <span>🎯 Lv.{effectiveLevel}</span> : null}
                    {effectiveXP != null && <span>⚡ {effectiveXP.toLocaleString("vi-VN")} XP</span>}
                    {effectiveStreak != null && <span>🔥 {effectiveStreak} {t("streakUnit") || "ngày"}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Link
                  href="/app/profile"
                  onClick={() => {
                    playClick();
                    setMobileOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    pathname.startsWith("/app/profile")
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-200"
                  }`}
                >
                  <span>👤</span>
                  <span>{t("navProfile") || "Hồ sơ"}</span>
                </Link>
                <Link
                  href="/app/settings"
                  onClick={() => {
                    playClick();
                    setMobileOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    pathname.startsWith("/app/settings")
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-200"
                  }`}
                >
                  <span>⚙️</span>
                  <span>{t("settings") || "Cài đặt"}</span>
                </Link>
                <div className="col-span-2 mt-1">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {t("nativeLangTitle")}
                  </label>
                  <select
                    value={nativeLanguage}
                    onChange={(e) => {
                      playClick();
                      const chosen = e.target.value as any;
                      setNativeLanguage(chosen);
                      const l = SUPPORTED_LANGUAGES.find((x) => x.code === chosen);
                      showToast({
                        title: `${t("nativeLangTitle")}: ${l?.nativeName} ${l?.flag}`,
                        description: `AI Sensei & UI: ${l?.nativeName}`,
                        type: "info",
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-sumi-900 dark:text-slate-200 outline-none"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.nativeName} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="px-2 pb-1 pt-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {getGroupTitle({ title: "Học tập & Tra cứu", titleKey: "navLessons" })}
            </p>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href, item.matchPrefixes) ? "page" : undefined}
                onClick={() => {
                  playClick();
                  setMobileOpen(false);
                }}
                className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                  active(item.href, item.matchPrefixes)
                    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-800"
                }`}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">
                  <NavGlyph item={item} />
                </span>
                <span className="flex-1">{getItemLabel(item)}</span>
                <Icon name="arrow" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </Link>
            ))}

            {MORE_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="px-2 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {getGroupTitle(group)}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active(item.href, item.matchPrefixes) ? "page" : undefined}
                    onClick={() => {
                      playClick();
                      setMobileOpen(false);
                    }}
                    className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                      active(item.href, item.matchPrefixes)
                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-800"
                    }`}
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">
                      <NavGlyph item={item} />
                    </span>
                    <span className="flex-1">{getItemLabel(item)}</span>
                    <Icon name="arrow" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Voice Selector Modal (Integrated with Portal) */}
      <VoiceSelectorModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        currentVoiceURI={speechVoiceURI}
        onSelectVoice={(uri) => {
          setSpeechVoiceURI(uri);
        }}
        availableDeviceVoices={availableVoices}
        onPreviewSpeak={(uri) => {
          if (speakingText && previewSpeakingURI === uri) {
            stopSpeaking();
            setPreviewSpeakingURI(null);
          } else {
            setPreviewSpeakingURI(uri);
            const foundCloud = CLOUD_VOICES.find((v) => v.id === uri);
            const previewText = foundCloud?.previewText || "こんにちは！日本語の学習を一緒に頑張りましょう。";
            speak(previewText, undefined, uri);
          }
        }}
        isSpeaking={Boolean(speakingText)}
        speakingURI={previewSpeakingURI}
      />
    </>
  );
}