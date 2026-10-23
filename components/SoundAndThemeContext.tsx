"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { CLOUD_VOICES, findBrowserVoice, isBrowserVoiceId, isGoogleTtsId, checkVoiceAvailability } from "@/lib/cloudTtsVoices";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

/** Các mức tốc độ đọc hiển thị trên nút "0.85x" ở thanh điều hướng. */
export const SPEECH_RATES = [0.6, 0.75, 0.85, 1, 1.25] as const;

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "xp" | "achievement" | "info";
  xp?: number;
}

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
}

interface SoundAndThemeContextType {
  theme: Theme;
  /** Theme thực tế đang áp dụng (đã giải quyết "system" thành light/dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playCorrect: () => void;
  playIncorrect: () => void;
  playClick: () => void;
  playFanfare: () => void;

  // Global Text-to-Speech Settings
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speechVoiceURI: string;
  setSpeechVoiceURI: (uri: string) => void;
  availableVoices: VoiceOption[];
  speak: (text: string, customRate?: number, customVoiceURI?: string) => void;
  speakAll: (texts: string[], customRate?: number) => void;
  stopSpeaking: () => void;
  hasJapaneseVoice: boolean;
  /** Đoạn text đang được đọc (null nếu không đọc) – dùng để làm nổi nút ▶ tương ứng. */
  speakingText: string | null;

  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const SoundAndThemeContext = createContext<SoundAndThemeContextType | null>(null);

export function SoundAndThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Speech TTS State
  const [speechRate, setSpeechRateState] = useState<number>(0.85);
  const [speechVoiceURI, setSpeechVoiceURIState] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [hasJapaneseVoice, setHasJapaneseVoice] = useState<boolean>(true);
  const speakIdRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio Synthesizer helper
  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  const stopSpeaking = useCallback(() => {
    speakIdRef.current++;
    setSpeakingText(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current.src = "";
      } catch {}
      activeAudioRef.current = null;
    }
  }, []);

  // Initialize from localStorage & load voices
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("nq_theme") as Theme | null;
      if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
        setThemeState(storedTheme);
      }
      const storedSound = localStorage.getItem("nq_sound");
      if (storedSound !== null) {
        setSoundEnabledState(storedSound === "true");
      }
      const storedRate = localStorage.getItem("nq_speech_rate");
      if (storedRate) {
        setSpeechRateState(parseFloat(storedRate) || 0.85);
      }
      const storedVoice = localStorage.getItem("nq_speech_voice");
      if (storedVoice) {
        setSpeechVoiceURIState(storedVoice);
      }
    } catch {
      // Ignore
    }

    // Load Web Speech Voices
    const updateVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        const jaVoices = voices
          .filter((v) => {
            const lang = (v.lang || "").toLowerCase();
            const name = (v.name || "").toLowerCase();
            return (
              lang.startsWith("ja") ||
              lang.includes("jp") ||
              name.includes("japanese") ||
              name.includes("日本語") ||
              name.includes("haruka") ||
              name.includes("kyoko") ||
              name.includes("otoya") ||
              name.includes("keita")
            );
          })
          .map((v) => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
          }));

        const hasJa = jaVoices.length > 0;
        setHasJapaneseVoice(hasJa);

        // If no strict Japanese match, list all voices as fallback
        const finalVoices = hasJa ? jaVoices : voices.slice(0, 15).map((v) => ({
          name: v.name,
          lang: v.lang,
          voiceURI: v.voiceURI,
        }));

        setAvailableVoices(finalVoices);
      }
    };

    updateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Sync theme with HTML document class
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = () => {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
      setResolvedTheme("dark");
    };
    const applyLight = () => {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      setResolvedTheme("light");
    };

    if (theme === "dark") {
      applyDark();
    } else if (theme === "light") {
      applyLight();
    } else {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      if (media.matches) applyDark();
      else applyLight();

      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) applyDark();
        else applyLight();
      };
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("nq_theme", t);
    } catch {}
  };

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const setSoundEnabled = (s: boolean) => {
    setSoundEnabledState(s);
    if (!s) {
      stopSpeaking();
    }
    try {
      localStorage.setItem("nq_sound", String(s));
    } catch {}
  };

  const setSpeechRate = (r: number) => {
    setSpeechRateState(r);
    try {
      localStorage.setItem("nq_speech_rate", String(r));
    } catch {}
  };

  const setSpeechVoiceURI = (uri: string) => {
    setSpeechVoiceURIState(uri);
    try {
      localStorage.setItem("nq_speech_voice", uri);
    } catch {}
  };

  // ──────────────────────────────────────────────────────────────────────
  // Global Speech Function
  // Routes to browser speechSynthesis (for "browser:" voices)
  // or Google Translate TTS proxy (for "gtts:" voices)
  // or auto-detect best Japanese voice (for "" / device voices)
  // ──────────────────────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string, customRate?: number, customVoiceURI?: string) => {
      if (!text || typeof window === "undefined") return;
      const cleanText = text
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[\(\[\{（【].*?[\)\]\}）】]/g, "")
        .trim();
      if (!cleanText) return;

      stopSpeaking();

      const speakId = ++speakIdRef.current;
      const finish = () => {
        if (speakIdRef.current === speakId) {
          setSpeakingText(null);
          activeAudioRef.current = null;
        }
      };
      setSpeakingText(text);

      const targetVoice = customVoiceURI !== undefined ? customVoiceURI : speechVoiceURI;

      /** Play via Microsoft Edge Neural TTS server endpoint (Universal HD quality) */
      const playEdgeNeuralTts = (voiceKey: string) => {
        try {
          const encoded = encodeURIComponent(cleanText.slice(0, 300));
          const url = `/api/ai/tts?text=${encoded}&voice=edge:${encodeURIComponent(voiceKey)}`;
          const audio = new Audio(url);
          activeAudioRef.current = audio;
          audio.playbackRate = customRate ?? speechRate;
          audio.onended = finish;
          audio.onerror = () => {
            if (speakIdRef.current === speakId) playGoogleTts();
          };
          audio.play().catch(() => {
            if (speakIdRef.current === speakId) playGoogleTts();
          });
        } catch {
          playGoogleTts();
        }
      };

      /** Fallback: play via Google Translate TTS (server proxy or direct) */
      const playGoogleTts = (slow = false) => {
        try {
          const encoded = encodeURIComponent(cleanText.slice(0, 300));
          const voiceQuery = slow ? "&voice=google%3Aslow" : "";
          const url = `/api/ai/tts?text=${encoded}${voiceQuery}`;

          const audio = new Audio(url);
          activeAudioRef.current = audio;
          audio.playbackRate = customRate ?? speechRate;
          audio.onended = finish;
          audio.onerror = () => {
            if (speakIdRef.current !== speakId) return;
            // Last resort: direct Google TTS
            try {
              const directAudio = new Audio(
                `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ja&client=tw-ob${slow ? "&ttsspeed=0.5" : ""}`
              );
              activeAudioRef.current = directAudio;
              directAudio.playbackRate = customRate ?? speechRate;
              directAudio.onended = finish;
              directAudio.onerror = finish;
              directAudio.play().catch(finish);
            } catch {
              finish();
            }
          };
          audio.play().catch(() => {
            if (speakIdRef.current === speakId) finish();
          });
        } catch {
          finish();
        }
      };

      /** Speak using browser speechSynthesis with a specific voice */
      const speakWithBrowserVoice = (voice: SpeechSynthesisVoice | null) => {
        try {
          if (!("speechSynthesis" in window)) {
            playGoogleTts();
            return;
          }
          window.speechSynthesis.cancel();

          const u = new SpeechSynthesisUtterance(cleanText);
          u.lang = "ja-JP";
          u.rate = customRate ?? speechRate;
          if (voice) u.voice = voice;

          u.onend = finish;
          u.onerror = (e) => {
            if (speakIdRef.current === speakId && e.error !== "canceled" && e.error !== "interrupted") {
              playGoogleTts();
            } else {
              finish();
            }
          };

          window.speechSynthesis.speak(u);
        } catch {
          playGoogleTts();
        }
      };

      // ── Google Translate TTS voice (server proxy) ──
      if (isGoogleTtsId(targetVoice)) {
        playGoogleTts(targetVoice === "gtts:slow");
        return;
      }

      // ── Cloud / Browser catalog voice ──
      if (isBrowserVoiceId(targetVoice)) {
        const allVoices = ("speechSynthesis" in window) ? window.speechSynthesis.getVoices() : [];
        const matched = findBrowserVoice(targetVoice, allVoices);
        if (matched) {
          speakWithBrowserVoice(matched);
          return;
        }
        // If not installed locally on this phone/browser, seamlessly synthesize via server Edge Neural!
        const catalogVoice = CLOUD_VOICES.find((v) => v.id === targetVoice);
        if (catalogVoice?.edgeVoiceKey) {
          playEdgeNeuralTts(catalogVoice.edgeVoiceKey);
          return;
        }
        playGoogleTts();
        return;
      }

      // ── Cloud Edge Neural IDs (e.g. cloud:edge:Nanami) ──
      if (targetVoice.startsWith("cloud:")) {
        const inner = targetVoice.slice("cloud:".length);
        if (inner.startsWith("edge:")) {
          const key = inner.slice(5);
          playEdgeNeuralTts(key);
          return;
        }
        playGoogleTts();
        return;
      }

      // ── Device voice (voiceURI) or empty (auto-detect) ──
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const allSystemVoices = window.speechSynthesis.getVoices();

          // Try to find a voice by voiceURI or name
          let matchedVoice: SpeechSynthesisVoice | null = null;
          if (targetVoice) {
            matchedVoice = allSystemVoices.find(
              (v) => v.voiceURI === targetVoice || v.name === targetVoice
            ) ?? null;
          }

          // If no specific match, find any Japanese voice
          if (!matchedVoice) {
            matchedVoice = allSystemVoices.find(
              (v) => (v.lang || "").toLowerCase().startsWith("ja")
            ) ?? null;
          }

          if (matchedVoice) {
            speakWithBrowserVoice(matchedVoice);
            return;
          }
        }
      } catch {}

      // ── No Japanese voice on device → Google TTS ──
      playGoogleTts();
    },
    [speechRate, speechVoiceURI, stopSpeaking]
  );
  const speakAll = useCallback(
    (texts: string[], customRate?: number) => {
      if (typeof window === "undefined") return;
      const items = texts
        .map((t) => (t || "").replace(/[\(\[\{].*?[\)\]\}]/g, "").trim())
        .filter(Boolean);
      if (items.length === 0) return;

      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const voices = window.speechSynthesis.getVoices();
          const isJa = (v: SpeechSynthesisVoice) =>
            v.lang.startsWith("ja") || v.lang.includes("JP") || v.lang.includes("ja");

          if (voices.some(isJa)) {
            const preferred = speechVoiceURI
              ? voices.find((v) => v.voiceURI === speechVoiceURI || v.name === speechVoiceURI)
              : undefined;
            const voice = preferred ?? voices.find(isJa);

            items.forEach((text) => {
              const u = new SpeechSynthesisUtterance(text);
              u.lang = "ja-JP";
              u.rate = customRate ?? speechRate;
              if (voice) u.voice = voice;
              window.speechSynthesis.speak(u);
            });
            return;
          }
        }
      } catch {}

      let index = 0;
      const playNext = () => {
        if (index >= items.length) return;
        const text = items[index++];
        speak(text, customRate);
      };
      playNext();
    },
    [speechRate, speechVoiceURI, speak]
  );

  const playCorrect = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [659.25, 783.99, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.36);
      });
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playIncorrect = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playClick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const playFanfare = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.001, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.06 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.85);
      });
    } catch {}
  }, [soundEnabled, getAudioContext]);

  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <SoundAndThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        soundEnabled,
        setSoundEnabled,
        playCorrect,
        playIncorrect,
        playClick,
        playFanfare,
        speechRate,
        setSpeechRate,
        speechVoiceURI,
        setSpeechVoiceURI,
        availableVoices,
        speak,
        speakAll,
        stopSpeaking,
        hasJapaneseVoice,
        speakingText,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </SoundAndThemeContext.Provider>
  );
}

export function useSoundAndTheme() {
  const ctx = useContext(SoundAndThemeContext);
  if (!ctx) throw new Error("useSoundAndTheme must be used within SoundAndThemeProvider");
  return ctx;
}

function ToastContainer({ toasts, removeToast }: { toasts: ToastItem[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none sm:bottom-6 sm:right-6 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all transform translate-y-0 animate-in fade-in slide-in-from-bottom-3 ${
            t.type === "xp"
              ? "bg-amber-500/95 text-white border-amber-400 shadow-glow-gold"
              : t.type === "achievement"
              ? "bg-fuji-600/95 text-white border-fuji-400 shadow-lg"
              : t.type === "error"
              ? "bg-red-600/95 text-white border-red-400"
              : "bg-sumi-900/95 text-white border-slate-700 dark:bg-white/95 dark:text-sumi-950 dark:border-slate-200"
          }`}
        >
          <div className="text-xl">
            {t.type === "xp" ? "✨" : t.type === "achievement" ? "🏆" : t.type === "error" ? "⚠️" : "🌸"}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm tracking-wide">{t.title}</h4>
            {t.description && <p className="text-xs opacity-90 mt-0.5">{t.description}</p>}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-xs opacity-70 hover:opacity-100 p-1"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
