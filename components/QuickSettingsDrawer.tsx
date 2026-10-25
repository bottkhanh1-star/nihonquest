"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { SPEECH_RATES, useSoundAndTheme } from "./SoundAndThemeContext";
import { useNativeLanguage, SUPPORTED_LANGUAGES } from "./LanguageContext";
import {
  useSeason,
  SEASONS_DATA,
  type ResolvedSeason,
  getLocalizedSeasonName,
  AUTO_TOKYO_I18N,
} from "./SeasonContext";
import { CLOUD_VOICES, isCloudVoiceId } from "@/lib/cloudTtsVoices";
import { Icon } from "./ui";
import { AnimeMascot } from "./mascots/AnimeMascot";

interface QuickSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenVoiceModal: () => void;
}

export function QuickSettingsDrawer({
  open,
  onClose,
  onOpenVoiceModal,
}: QuickSettingsDrawerProps) {
  const {
    resolvedTheme,
    toggleTheme,
    soundEnabled,
    setSoundEnabled,
    playClick,
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    availableVoices,
    speak,
    stopSpeaking,
    speakingText,
    showToast,
  } = useSoundAndTheme();

  const { nativeLanguage, setNativeLanguage, t } = useNativeLanguage();
  const { isAuto, resolvedSeason, setSeason, config: seasonConfig } = useSeason();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const autoTokyo = AUTO_TOKYO_I18N[nativeLanguage] || AUTO_TOKYO_I18N.en;
  const currentSeasonName = getLocalizedSeasonName(resolvedSeason, nativeLanguage);

  // Khóa cuộn trang khi mở drawer
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop mờ mịn */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          tabIndex={-1}
          className="w-screen max-w-sm bg-white dark:bg-sumi-900 border-l border-slate-200 dark:border-sumi-800 shadow-2xl flex flex-col focus:outline-none animate-in slide-in-from-right duration-250 ease-out"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Header Drawer */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-sumi-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AnimeMascot kind="shiba" mood="happy" size={34} />
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {t("quickSettings")}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("quickSettingsSubtitle")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-sumi-800 transition"
              aria-label={t("closeMenu")}
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          {/* Body nội dung cài đặt cuộn mượt */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* 1. Chủ đề Nhật Bản 4 Mùa (Tự động theo giờ Tokyo hoặc Tự chỉnh) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("seasonTheme")}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isAuto
                    ? `🇯🇵 ${autoTokyo.activeBadge} (${currentSeasonName})`
                    : `${seasonConfig.emoji} ${currentSeasonName}`}
                </span>
              </div>

              {/* Nút bật chế độ tự động theo mùa Nhật Bản */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setSeason("auto");
                }}
                className={`mb-2 w-full flex items-center justify-between p-2.5 rounded-2xl border text-xs font-bold transition ${
                  isAuto
                    ? "border-red-500 bg-red-50/90 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 font-extrabold shadow-xs"
                    : "border-slate-200 dark:border-sumi-800 bg-white dark:bg-sumi-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇯🇵</span>
                  <div className="text-left">
                    <span className="block leading-tight font-black">{autoTokyo.title}</span>
                    <small className="block text-[10px] text-slate-500 dark:text-slate-400">
                      {autoTokyo.subtitle}: {seasonConfig.emoji} {currentSeasonName} ({seasonConfig.nameJp})
                    </small>
                  </div>
                </div>
                {isAuto && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-black">
                    {autoTokyo.activeBadge}
                  </span>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                {(["spring", "summer", "autumn", "winter"] as ResolvedSeason[]).map((sKey) => {
                  const s = SEASONS_DATA[sKey];
                  const isAct = !isAuto && resolvedSeason === sKey;
                  const localizedName = getLocalizedSeasonName(sKey, nativeLanguage);
                  return (
                    <button
                      key={sKey}
                      type="button"
                      onClick={() => {
                        playClick();
                        setSeason(sKey);
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition ${
                        isAct
                          ? "border-red-500 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 font-extrabold shadow-xs"
                          : "border-slate-200 dark:border-sumi-800 bg-white dark:bg-sumi-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-sumi-800/60 font-semibold"
                      }`}
                    >
                      <span className="text-xl shrink-0">{s.emoji}</span>
                      <div className="min-w-0">
                        <span className="block text-xs leading-none">{localizedName}</span>
                        <small className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          {s.nameJp}
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Chế độ Sáng / Tối */}
            <div>
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("themeMode")}
              </span>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  toggleTheme();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-sumi-800 bg-slate-50 dark:bg-sumi-950 text-slate-800 dark:text-slate-200 font-bold text-xs hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-2">
                  <span>{resolvedTheme === "dark" ? "🌙" : "☀️"}</span>
                  <span>{resolvedTheme === "dark" ? t("themeDarkName") : t("themeLightName")}</span>
                </div>
                <span className="text-[11px] text-red-600 dark:text-red-400 font-extrabold">
                  {t("themeChangeBtn")}
                </span>
              </button>
            </div>

            {/* 3. Âm thanh hiệu ứng */}
            <div>
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("soundFxTitle")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) setTimeout(playClick, 30);
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-sumi-800 bg-slate-50 dark:bg-sumi-950 text-slate-800 dark:text-slate-200 font-bold text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>{soundEnabled ? "🔔" : "🔕"}</span>
                  <span>{t("soundFx")}</span>
                </div>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    soundEnabled ? "bg-red-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      soundEnabled ? "left-5" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* 4. Tốc độ đọc phát âm tiếng Nhật */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("ttsSpeedTitle")}
                </span>
                <span className="text-xs font-black text-red-600 dark:text-red-400">
                  {speechRate}x
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {SPEECH_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setSpeechRate(rate);
                      speak("こんにちは", rate);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition ${
                      speechRate === rate
                        ? "border-red-600 bg-red-600 text-white shadow-xs"
                        : "border-slate-200 dark:border-sumi-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-sumi-950 hover:border-red-300"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {speakingText && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold animate-pulse"
                >
                  <span>⏹️</span>
                  <span>{t("ttsStopBtn")}</span>
                </button>
              )}
            </div>

            {/* 5. Giọng đọc tiếng Nhật (Voice) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("ttsVoiceTitle")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVoiceModal();
                  }}
                  className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline"
                >
                  {t("ttsAllVoicesBtn")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVoiceModal();
                }}
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-sumi-800 bg-slate-50 dark:bg-sumi-950 flex items-center justify-between gap-2 text-left hover:border-red-300 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {(() => {
                      if (!speechVoiceURI) return t("ttsAutoVoice");
                      if (isCloudVoiceId(speechVoiceURI)) {
                        const found = CLOUD_VOICES.find((c) => c.id === speechVoiceURI);
                        return found
                          ? `${found.displayName} · ${found.gender === "female" ? "♀" : "♂"}`
                          : speechVoiceURI;
                      }
                      const dev = availableVoices.find((v) => v.voiceURI === speechVoiceURI);
                      return dev ? dev.name : speechVoiceURI;
                    })()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {isCloudVoiceId(speechVoiceURI) ? t("ttsCloudBadge") : t("ttsLocalBadge")}
                  </div>
                </div>
                <span className="text-xs text-slate-400">⚙️</span>
              </button>
            </div>

            {/* 6. Ngôn ngữ mẹ đẻ */}
            <div>
              <span className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("nativeLangTitle")}
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      playClick();
                      setNativeLanguage(l.code);
                      showToast({
                        title: `${t("langSwitchedToast")}${l.nativeName} ${l.flag}`,
                        type: "info",
                      });
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold border transition ${
                      nativeLanguage === l.code
                        ? "border-red-500 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        : "border-slate-200 dark:border-sumi-800 bg-white dark:bg-sumi-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span className="truncate">{l.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Drawer */}
          <div className="p-4 border-t border-slate-100 dark:border-sumi-800 bg-slate-50/50 dark:bg-sumi-950/50 flex items-center justify-between gap-2">
            <Link
              href="/app/profile"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-sumi-800 bg-white dark:bg-sumi-900 text-center text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            >
              {t("profileBtn")}
            </Link>
            <Link
              href="/app/settings"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 text-white text-center text-xs font-black shadow-xs hover:bg-red-700 transition"
            >
              {t("fullSettingsBtn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
