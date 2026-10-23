"use client";

import type { Viseme } from "./senseiLipSync";
import { getVoiceDspProfile, applyVoiceDsp } from "./voiceDsp";
import { CLOUD_VOICES, findBrowserVoice } from "./cloudTtsVoices";

/**
 * Web Audio DSP audio player for realistic Japanese Male / Female voice synthesis.
 * Uses real-time frequency analysis to drive accurate mouth visemes.
 *
 * Now supports two modes:
 * 1. Browser speechSynthesis (primary, for "browser:" voices)
 * 2. Google Translate TTS fallback (when no browser voices available)
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export interface WebAudioPlayback {
  stop: () => void;
}

/**
 * Play TTS for Sensei using browser speechSynthesis or Google TTS fallback.
 * 
 * @param voiceParam - The voice ID (e.g., "browser:Nanami", "browser:Keita", or legacy "edge:...")
 */
export async function playSenseiAudio(
  text: string,
  gender: "male" | "female",
  onStart: () => void,
  onViseme: (viseme: Viseme) => void,
  onEnd: () => void,
  voiceParam?: string
): Promise<WebAudioPlayback | null> {
  if (typeof window === "undefined" || !text) return null;

  let stopped = false;
  let activeAudioElement: HTMLAudioElement | null = null;
  let animId = 0;
  let activeUtterance: SpeechSynthesisUtterance | null = null;

  const handleStop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(animId);
    onViseme("closed");

    if (activeUtterance) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      activeUtterance = null;
    }

    if (activeAudioElement) {
      try {
        activeAudioElement.pause();
        activeAudioElement.src = "";
        activeAudioElement.load();
      } catch {}
      activeAudioElement = null;
    }
  };

  const playbackController: WebAudioPlayback = {
    stop: handleStop,
  };

  const encoded = encodeURIComponent(text.slice(0, 300));
  const directMirrorUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ja&client=tw-ob`;

  // ── Try browser speechSynthesis first ──
  if ("speechSynthesis" in window) {
    const allVoices = window.speechSynthesis.getVoices();
    let targetSpeechVoice: SpeechSynthesisVoice | null = null;

    if (voiceParam) {
      // Handle "browser:Nanami" format
      if (voiceParam.startsWith("browser:")) {
        targetSpeechVoice = findBrowserVoice(voiceParam, allVoices);
      }
      // Handle legacy "edge:ja-JP-NanamiNeural" format
      else if (voiceParam.startsWith("edge:")) {
        const legacyMap: Record<string, string> = {
          "edge:ja-JP-NanamiNeural": "browser:Nanami",
          "edge:ja-JP-KeitaNeural": "browser:Keita",
        };
        const mapped = legacyMap[voiceParam] || (voiceParam.includes("Keita") ? "browser:Keita" : "browser:Nanami");
        targetSpeechVoice = findBrowserVoice(mapped, allVoices);
      }
    }

    // If no specific match, try to find a voice matching the gender
    if (!targetSpeechVoice) {
      const genderVoices = CLOUD_VOICES.filter(
        (v) => v.provider === "browser" && v.gender === gender && v.matchPatterns.length > 0
      );
      for (const cv of genderVoices) {
        const found = findBrowserVoice(cv.id, allVoices);
        if (found) {
          targetSpeechVoice = found;
          break;
        }
      }
    }

    // If still no match, find ANY Japanese voice
    if (!targetSpeechVoice) {
      targetSpeechVoice = allVoices.find(
        (v) => (v.lang || "").toLowerCase().startsWith("ja")
      ) ?? null;
    }

    if (targetSpeechVoice) {
      // Use speechSynthesis with viseme animation
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.voice = targetSpeechVoice;
      u.rate = 1;
      activeUtterance = u;

      const visemeCycle: Viseme[] = ["a", "i", "u", "e", "o"];
      let vIdx = 0;
      let lastVChange = performance.now();

      const animateVisemes = () => {
        if (stopped) return;
        const now = performance.now();
        if (now - lastVChange > 120) {
          lastVChange = now;
          vIdx = (vIdx + 1) % visemeCycle.length;
          onViseme(visemeCycle[vIdx]);
        }
        animId = requestAnimationFrame(animateVisemes);
      };

      u.onstart = () => {
        if (stopped) return;
        onStart();
        animId = requestAnimationFrame(animateVisemes);
      };

      u.onboundary = (e) => {
        if (stopped) return;
        // Reset viseme cycling on word boundary for more natural look
        vIdx = e.charIndex % visemeCycle.length;
      };

      u.onend = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(animId);
        onViseme("closed");
        onEnd();
      };

      u.onerror = (e) => {
        if (stopped) return;
        if (e.error !== "canceled" && e.error !== "interrupted") {
          // Fall back to Google TTS
          playViaAudioElement(directMirrorUrl);
        } else {
          stopped = true;
          cancelAnimationFrame(animId);
          onViseme("closed");
          onEnd();
        }
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return playbackController;
    }
  }

  // ── Fallback: Google Translate TTS via HTMLAudioElement ──
  const playViaAudioElement = (url: string) => {
    if (stopped) return;
    try {
      const audio = new Audio(url);
      activeAudioElement = audio;

      const visemeCycle: Viseme[] = ["a", "i", "u", "e", "o"];
      let vIdx = 0;
      let lastVChange = performance.now();

      const animateFallback = () => {
        if (stopped || audio.paused || audio.ended) return;
        const now = performance.now();
        if (now - lastVChange > 120) {
          lastVChange = now;
          vIdx = (vIdx + 1) % visemeCycle.length;
          onViseme(visemeCycle[vIdx]);
        }
        animId = requestAnimationFrame(animateFallback);
      };

      audio.onplay = () => {
        if (stopped) return;
        onStart();
        animId = requestAnimationFrame(animateFallback);
      };

      audio.onended = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(animId);
        onViseme("closed");
        onEnd();
      };

      audio.onerror = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(animId);
        onViseme("closed");
        onEnd();
      };

      audio.play().catch(() => {
        stopped = true;
        cancelAnimationFrame(animId);
        onViseme("closed");
        onEnd();
      });
    } catch {
      stopped = true;
      cancelAnimationFrame(animId);
      onViseme("closed");
      onEnd();
    }
  };

  // Try the server API first (which will try Edge TTS then fall back to Google TTS)
  const serverUrl = `/api/ai/tts?text=${encoded}&v=edge5`;
  playViaAudioElement(serverUrl);
  return playbackController;
}
