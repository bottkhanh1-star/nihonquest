"use client";

import type { Viseme } from "./senseiLipSync";
import { getVoiceDspProfile, applyVoiceDsp } from "./voiceDsp";

/**
 * Web Audio DSP audio player for realistic Japanese Male / Female voice synthesis.
 * Uses real-time frequency analysis to drive accurate mouth visemes.
 * Includes multi-tier TTS fallback (cached /api/ai/tts -> direct Google TTS mirror -> HTMLAudioElement).
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

export async function playSenseiAudio(
  text: string,
  gender: "male" | "female",
  onStart: () => void,
  onViseme: (viseme: Viseme) => void,
  onEnd: () => void,
  voiceParam?: string
): Promise<WebAudioPlayback | null> {
  if (typeof window === "undefined" || !text) return null;

  const voiceToUse = voiceParam || (gender === "male" ? "edge:ja-JP-KeitaNeural" : "edge:ja-JP-NanamiNeural");
  const encoded = encodeURIComponent(text.slice(0, 300));
  const primaryUrl = `/api/ai/tts?text=${encoded}&voice=${encodeURIComponent(voiceToUse)}&v=edge5`;
  const directMirrorUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ja&client=tw-ob`;

  let stopped = false;
  let activeSource: AudioBufferSourceNode | null = null;
  let activeAudioElement: HTMLAudioElement | null = null;
  let animId = 0;

  const handleStop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(animId);
    onViseme("closed");

    if (activeSource) {
      try {
        activeSource.stop();
      } catch {}
      activeSource = null;
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

  const ctx = getAudioContext();

  // Helper to run viseme animation from standard HTMLAudioElement when WebAudio decode fails
  const playViaAudioElement = (url: string) => {
    if (stopped) return;
    try {
      const audio = new Audio(url);
      activeAudioElement = audio;
      audio.playbackRate = gender === "male" ? 0.9 : 1.0;

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
        if (url !== directMirrorUrl) {
          playViaAudioElement(directMirrorUrl);
        } else {
          stopped = true;
          cancelAnimationFrame(animId);
          onViseme("closed");
          onEnd();
        }
      };

      audio.play().catch(() => {
        if (url !== directMirrorUrl) {
          playViaAudioElement(directMirrorUrl);
        } else {
          stopped = true;
          cancelAnimationFrame(animId);
          onViseme("closed");
          onEnd();
        }
      });
    } catch {
      stopped = true;
      cancelAnimationFrame(animId);
      onViseme("closed");
      onEnd();
    }
  };

  // Try fetching audio array buffer for WebAudio DSP
  let arrayBuffer: ArrayBuffer | null = null;
  let isAuthenticNeural = false;
  try {
    const res = await fetch(primaryUrl);
    if (res.ok) {
      const pHeader = res.headers.get("x-tts-provider") || "";
      isAuthenticNeural = pHeader.startsWith("edge:") && !pHeader.includes("fallback");
      arrayBuffer = await res.arrayBuffer();
    }
  } catch {}

  // Fallback to direct mirror fetch if primary failed
  if (!arrayBuffer) {
    try {
      const mirrorRes = await fetch(directMirrorUrl);
      if (mirrorRes.ok) {
        arrayBuffer = await mirrorRes.arrayBuffer();
      }
    } catch {}
  }

  // If fetch failed or ctx unavailable, fallback to HTMLAudioElement
  if (!arrayBuffer || !ctx) {
    playViaAudioElement(primaryUrl);
    return playbackController;
  }

  // Decode audio data via Web Audio API
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    if (stopped) return null;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    activeSource = source;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    // Apply persona speed settings
    const dspProfile = getVoiceDspProfile(voiceToUse);
    applyVoiceDsp(ctx, source, dspProfile, analyser);

    analyser.connect(ctx.destination);

    let isPlaying = true;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkMouth = () => {
      if (!isPlaying || stopped) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      if (avg < 4) {
        onViseme("closed");
      } else if (avg < 14) {
        onViseme("u");
      } else if (avg < 26) {
        onViseme("i");
      } else if (avg < 38) {
        onViseme("e");
      } else if (avg < 52) {
        onViseme("o");
      } else {
        onViseme("a");
      }
      animId = requestAnimationFrame(checkMouth);
    };

    source.onended = () => {
      if (!isPlaying || stopped) return;
      isPlaying = false;
      stopped = true;
      cancelAnimationFrame(animId);
      onViseme("closed");
      onEnd();
    };

    onStart();
    source.start(0);
    checkMouth();

    return playbackController;
  } catch {
    // If WebAudio decoding failed, fallback smoothly to HTMLAudioElement
    playViaAudioElement(primaryUrl);
    return playbackController;
  }
}
