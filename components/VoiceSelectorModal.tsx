"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  CLOUD_VOICES,
  GENDER_LABEL,
  PROVIDER_LABEL,
  PROVIDER_COLOR,
  checkVoiceAvailability,
  type VoiceGender,
} from "@/lib/cloudTtsVoices";
import { guessVoiceGender, voiceGenderLabel } from "@/lib/voiceGender";
import type { VoiceOption } from "@/components/SoundAndThemeContext";

interface VoiceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVoiceURI: string;
  onSelectVoice: (uri: string) => void;
  availableDeviceVoices: VoiceOption[];
  onPreviewSpeak: (voiceURI: string) => void;
  isSpeaking: boolean;
  speakingURI: string | null;
}

export function VoiceSelectorModal({
  isOpen,
  onClose,
  currentVoiceURI,
  onSelectVoice,
  availableDeviceVoices,
  onPreviewSpeak,
  isSpeaking,
  speakingURI,
}: VoiceSelectorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"cloud" | "device">("cloud");
  const [genderFilter, setGenderFilter] = useState<"ALL" | VoiceGender>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check which browser voices are available
  const voiceAvailability = useMemo(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return new Map<string, boolean>();
    }
    const allVoices = window.speechSynthesis.getVoices();
    return checkVoiceAvailability(allVoices);
  }, [mounted, isOpen]);

  // Close on Escape & Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  // Separate available and unavailable voices
  const availableCloudVoices = CLOUD_VOICES.filter((v) => {
    const isAvail = voiceAvailability.get(v.id) ?? false;
    if (!isAvail) return false;
    if (genderFilter !== "ALL" && v.gender !== genderFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.displayName.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.provider.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unavailableCloudVoices = CLOUD_VOICES.filter((v) => {
    const isAvail = voiceAvailability.get(v.id) ?? false;
    if (isAvail) return false;
    if (genderFilter !== "ALL" && v.gender !== genderFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.displayName.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter device voices
  const filteredDeviceVoices = availableDeviceVoices.filter((v) => {
    const guessed = guessVoiceGender(v.name);
    if (genderFilter !== "ALL" && guessed !== genderFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q);
    }
    return true;
  });

  const isCurrent = (uri: string) => currentVoiceURI === uri;
  const totalAvailable = CLOUD_VOICES.filter((v) => voiceAvailability.get(v.id)).length;

  const renderVoiceCard = (v: typeof CLOUD_VOICES[0], disabled = false) => {
    const selected = isCurrent(v.id);
    const isThisSpeaking = isSpeaking && speakingURI === v.id;
    return (
      <div
        key={v.id}
        onClick={() => !disabled && onSelectVoice(v.id)}
        className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
          disabled
            ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-sumi-800 bg-slate-50 dark:bg-sumi-950"
            : selected
            ? "border-red-500 bg-red-50/70 dark:bg-red-950/30 shadow-xs ring-1 ring-red-400/50 cursor-pointer"
            : "border-slate-200 dark:border-sumi-800 hover:border-red-200 dark:hover:border-sumi-700 bg-white dark:bg-sumi-900/60 cursor-pointer"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              {v.displayName}
            </span>
            <span
              className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                v.gender === "female"
                  ? "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300"
                  : v.gender === "male"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
              }`}
            >
              {GENDER_LABEL[v.gender]}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${PROVIDER_COLOR[v.provider]}`}
            >
              {PROVIDER_LABEL[v.provider]}
            </span>
            {v.isNeural && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                Neural HD
              </span>
            )}
            {disabled && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300">
                Không khả dụng
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
            {v.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Preview test voice button */}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewSpeak(v.id);
              }}
              title={isThisSpeaking ? "Dừng nghe thử" : "Nghe thử giọng này"}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition active:scale-95 ${
                isThisSpeaking
                  ? "bg-red-500 text-white animate-pulse shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-sumi-800 dark:text-slate-200"
              }`}
            >
              {isThisSpeaking ? "⏹️" : "▶"}
            </button>
          )}

          {/* Select radio check */}
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
              selected
                ? "border-red-600 bg-red-600 text-white"
                : "border-slate-300 dark:border-sumi-700"
            }`}
          >
            {selected && <span className="text-[10px] font-black">✓</span>}
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-sumi-900 shadow-2xl border border-slate-200 dark:border-sumi-700 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-sumi-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-red-500/10 via-rose-500/5 to-transparent">
          <div>
            <h3 id="voice-modal-title" className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎙️</span>
              <span>Cài đặt giọng đọc tiếng Nhật</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dùng giọng đọc sẵn có trên trình duyệt của bạn · Đồng bộ trên toàn site
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-sumi-800 transition"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="p-3 border-b border-slate-100 dark:border-sumi-800 flex gap-2 shrink-0 bg-slate-50 dark:bg-sumi-950">
          <button
            type="button"
            onClick={() => setTab("cloud")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-1.5 ${
              tab === "cloud"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-sumi-900"
            }`}
          >
            <span>🎤</span>
            <span>Giọng Neural (Đề xuất)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              tab === "cloud" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-sumi-800 text-slate-600 dark:text-slate-300"
            }`}>
              {totalAvailable}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("device")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-1.5 ${
              tab === "device"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-sumi-900"
            }`}
          >
            <span>💻</span>
            <span>Giọng trên máy</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              tab === "device" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-sumi-800 text-slate-600 dark:text-slate-300"
            }`}>
              {availableDeviceVoices.length}
            </span>
          </button>
        </div>

        {/* Filters: Gender & Search */}
        <div className="p-3 border-b border-slate-100 dark:border-sumi-800 flex flex-wrap gap-2 items-center justify-between shrink-0">
          {/* Gender filter */}
          <div className="flex gap-1 bg-slate-100 dark:bg-sumi-800 p-0.5 rounded-xl">
            {(["ALL", "female", "male"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenderFilter(g)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  genderFilter === g
                    ? "bg-white dark:bg-sumi-900 text-red-600 dark:text-red-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {g === "ALL" ? "Tất cả" : g === "female" ? "♀ Nữ" : "♂ Nam"}
              </button>
            ))}
          </div>

          {/* Search box */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên giọng..."
            className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-sumi-700 bg-white dark:bg-sumi-950 text-slate-800 dark:text-slate-200 outline-none focus:border-red-400 flex-1 min-w-[140px]"
          />
        </div>

        {/* Voices List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2">
          {tab === "cloud" ? (
            /* Cloud Voices */
            availableCloudVoices.length === 0 && unavailableCloudVoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy giọng đọc phù hợp.
              </div>
            ) : (
              <>
                {/* Available voices */}
                {availableCloudVoices.map((v) => renderVoiceCard(v, false))}

                {/* Unavailable voices section */}
                {unavailableCloudVoices.length > 0 && (
                  <>
                    <div className="pt-3 pb-1 text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-2">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-sumi-800" />
                      <span>Không khả dụng trên trình duyệt này</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-sumi-800" />
                    </div>
                    {unavailableCloudVoices.map((v) => renderVoiceCard(v, true))}
                  </>
                )}
              </>
            )
          ) : (
            /* Device Voices */
            filteredDeviceVoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Thiết bị này không có giọng tiếng Nhật offline cài sẵn.
                <br />
                Vui lòng dùng tab <b>Giọng Neural</b> để có giọng tiếng Nhật tự nhiên!
              </div>
            ) : (
              filteredDeviceVoices.map((v) => {
                const selected = isCurrent(v.voiceURI);
                const isThisSpeaking = isSpeaking && speakingURI === v.voiceURI;
                const guessed = guessVoiceGender(v.name);
                return (
                  <div
                    key={v.voiceURI}
                    onClick={() => onSelectVoice(v.voiceURI)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      selected
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/30 shadow-xs ring-1 ring-red-400/50"
                        : "border-slate-200 dark:border-sumi-800 hover:border-red-200 dark:hover:border-sumi-700 bg-white dark:bg-sumi-900/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {v.name}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 dark:bg-sumi-800 dark:text-slate-300">
                          {voiceGenderLabel(guessed)}
                        </span>
                        <span className="text-[10px] text-slate-400">{v.lang}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewSpeak(v.voiceURI);
                        }}
                        title={isThisSpeaking ? "Dừng nghe thử" : "Nghe thử"}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition active:scale-95 ${
                          isThisSpeaking
                            ? "bg-red-500 text-white animate-pulse shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-sumi-800 dark:text-slate-200"
                        }`}
                      >
                        {isThisSpeaking ? "⏹️" : "▶"}
                      </button>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          selected
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-300 dark:border-sumi-700"
                        }`}
                      >
                        {selected && <span className="text-[10px] font-black">✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-sumi-800 bg-slate-50 dark:bg-sumi-950 flex items-center justify-between shrink-0 text-xs">
          <button
            type="button"
            onClick={() => {
              onSelectVoice(""); // Reset to automatic
              onClose();
            }}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-sumi-800 transition"
          >
            ↺ Đặt lại Tự động
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-sm transition active:scale-95"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
