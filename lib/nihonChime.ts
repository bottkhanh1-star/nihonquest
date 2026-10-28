"use client";

/**
 * Nihon Quest Signature Japanese Chime Synthesizer (Web Audio API)
 * Combines Koto (箏) plucked string envelope + Edo Fūrin (風鈴) glass wind-chime overtones
 * + Temple Echo tail for an unmistakable Japanese aesthetic.
 */

export type NihonChimeStyle = "sakura" | "furin" | "matsuri" | "call" | "connect";

export const NIHON_CHIME_STYLES: {
  id: "sakura" | "furin" | "matsuri";
  labelVi: string;
  labelEn: string;
  emoji: string;
}[] = [
  {
    id: "sakura",
    labelVi: "🎐 Chuông Gió Sakura (Koto & Fūrin)",
    labelEn: "🎐 Sakura Wind Chime (Koto & Fūrin)",
    emoji: "🌸",
  },
  {
    id: "furin",
    labelVi: "🔔 Chuông Pha Lê Edo (Fūrin)",
    labelEn: "🔔 Edo Crystal Chime (Fūrin)",
    emoji: "🎐",
  },
  {
    id: "matsuri",
    labelVi: "⛩️ Chuông Đền Kyoto (Suzu Matsuri)",
    labelEn: "⛩️ Kyoto Shrine Bell (Suzu Matsuri)",
    emoji: "⛩️",
  },
];

const CHIME_STYLE_STORAGE_KEY = "nq_chime_style";

let sharedAudioCtx: AudioContext | null = null;

function getChimeAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (sharedAudioCtx && sharedAudioCtx.state !== "closed") {
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
      }
      return sharedAudioCtx;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedAudioCtx = new AudioCtx();
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Automatically unlock AudioContext on first user interaction so background push messages can play custom chimes
if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      const ctx = getChimeAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {}
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

export function getPreferredChimeStyle(): "sakura" | "furin" | "matsuri" {
  if (typeof window === "undefined") return "sakura";
  try {
    const saved = localStorage.getItem(CHIME_STYLE_STORAGE_KEY);
    if (saved === "sakura" || saved === "furin" || saved === "matsuri") {
      return saved;
    }
  } catch {}
  return "sakura";
}

export function setPreferredChimeStyle(style: "sakura" | "furin" | "matsuri"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHIME_STYLE_STORAGE_KEY, style);
  } catch {}
}

interface ChimeNote {
  freq: number;
  startSec: number;
  durationSec: number;
  volume?: number;
  shimmer?: boolean;
}

/**
 * Synthesizes a single Japanese Koto + Fūrin bell note with crystalline harmonics and temple echo.
 */
function scheduleNihonBellNote(ctx: AudioContext, baseTime: number, note: ChimeNote) {
  const start = baseTime + note.startSec;
  const dur = note.durationSec;
  const vol = note.volume ?? 0.16;

  // 1. Primary Koto / Bell Fundamental (Triangle + Sine warmth)
  const oscMain = ctx.createOscillator();
  const gainMain = ctx.createGain();
  oscMain.type = "triangle";
  oscMain.frequency.setValueAtTime(note.freq, start);

  gainMain.gain.setValueAtTime(0.0001, start);
  gainMain.gain.linearRampToValueAtTime(vol, start + 0.012);
  gainMain.gain.exponentialRampToValueAtTime(vol * 0.35, start + dur * 0.35);
  gainMain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  oscMain.connect(gainMain);
  gainMain.connect(ctx.destination);
  oscMain.start(start);
  oscMain.stop(start + dur + 0.02);

  // 2. Octave Harmonic (2.0x) for pure resonant bell body
  const oscOctave = ctx.createOscillator();
  const gainOctave = ctx.createGain();
  oscOctave.type = "sine";
  oscOctave.frequency.setValueAtTime(note.freq * 2, start);

  gainOctave.gain.setValueAtTime(0.0001, start);
  gainOctave.gain.linearRampToValueAtTime(vol * 0.42, start + 0.008);
  gainOctave.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.75);

  oscOctave.connect(gainOctave);
  gainOctave.connect(ctx.destination);
  oscOctave.start(start);
  oscOctave.stop(start + dur * 0.76);

  // 3. Fūrin Crystalline Glass Partial (2.756x inharmonic bell overtone)
  if (note.shimmer !== false) {
    const oscShimmer = ctx.createOscillator();
    const gainShimmer = ctx.createGain();
    oscShimmer.type = "sine";
    oscShimmer.frequency.setValueAtTime(note.freq * 2.756, start);

    gainShimmer.gain.setValueAtTime(0.0001, start);
    gainShimmer.gain.linearRampToValueAtTime(vol * 0.18, start + 0.005);
    gainShimmer.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(dur * 0.45, 0.38));

    oscShimmer.connect(gainShimmer);
    gainShimmer.connect(ctx.destination);
    oscShimmer.start(start);
    oscShimmer.stop(start + Math.min(dur * 0.46, 0.4));
  }

  // 4. Temple Echo Reflection (+135ms soft tail)
  const echoDelay = 0.135;
  const oscEcho = ctx.createOscillator();
  const gainEcho = ctx.createGain();
  oscEcho.type = "sine";
  oscEcho.frequency.setValueAtTime(note.freq, start + echoDelay);

  gainEcho.gain.setValueAtTime(0.0001, start + echoDelay);
  gainEcho.gain.linearRampToValueAtTime(vol * 0.25, start + echoDelay + 0.015);
  gainEcho.gain.exponentialRampToValueAtTime(0.0001, start + echoDelay + dur * 0.9);

  oscEcho.connect(gainEcho);
  gainEcho.connect(ctx.destination);
  oscEcho.start(start + echoDelay);
  oscEcho.stop(start + echoDelay + dur * 0.92);
}

/**
 * Plays the signature Nihon Quest Japanese chime.
 * Works immediately on user gesture or when AudioContext is unlocked.
 */
export function playNihonQuestChime(style?: NihonChimeStyle): void {
  if (typeof window === "undefined") return;
  const ctx = getChimeAudioContext();

  // Fallback to pre-rendered /sounds/nihon-chime.wav if Web Audio context is unavailable or blocked
  if (!ctx || ctx.state === "suspended") {
    try {
      const audio = new Audio("/sounds/nihon-chime.wav");
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {}
    if (!ctx) return;
  }

  const chosenStyle = style || getPreferredChimeStyle();
  const now = ctx.currentTime + 0.01;

  if (chosenStyle === "sakura") {
    // Iconic Japanese Pentatonic "Sakura / In-sen" motif:
    // A5 -> B5 -> C6 -> B5 -> A5 -> E6 (with Fūrin wind-chime sparkle)
    const notes: ChimeNote[] = [
      { freq: 880.0, startSec: 0.0, durationSec: 0.55, volume: 0.16 }, // A5
      { freq: 987.77, startSec: 0.13, durationSec: 0.55, volume: 0.16 }, // B5
      { freq: 1046.5, startSec: 0.26, durationSec: 0.75, volume: 0.18 }, // C6
      { freq: 987.77, startSec: 0.46, durationSec: 0.5, volume: 0.14 }, // B5
      { freq: 880.0, startSec: 0.60, durationSec: 0.65, volume: 0.16 }, // A5
      { freq: 1318.51, startSec: 0.76, durationSec: 1.25, volume: 0.20 }, // E6 (Fūrin climax)
      { freq: 1760.0, startSec: 0.88, durationSec: 1.1, volume: 0.10 }, // A6 delicate wind chime breeze
    ];
    notes.forEach((n) => scheduleNihonBellNote(ctx, now, n));
    return;
  }

  if (chosenStyle === "furin") {
    // Edo Fūrin Crystal Wind Chime (Yo-scale ascending breeze):
    // E5 -> A5 -> B5 -> C#6 -> E6 -> A6
    const notes: ChimeNote[] = [
      { freq: 659.25, startSec: 0.0, durationSec: 0.6, volume: 0.15 }, // E5
      { freq: 880.0, startSec: 0.11, durationSec: 0.65, volume: 0.16 }, // A5
      { freq: 987.77, startSec: 0.22, durationSec: 0.7, volume: 0.16 }, // B5
      { freq: 1318.51, startSec: 0.34, durationSec: 1.1, volume: 0.19 }, // E6
      { freq: 1760.0, startSec: 0.48, durationSec: 1.25, volume: 0.13 }, // A6
    ];
    notes.forEach((n) => scheduleNihonBellNote(ctx, now, n));
    return;
  }

  if (chosenStyle === "matsuri") {
    // Kyoto Shrine Suzu & Matsuri Harmony:
    // D5 -> E5 -> G5 -> A5 -> B5 -> D6
    const notes: ChimeNote[] = [
      { freq: 587.33, startSec: 0.0, durationSec: 0.5, volume: 0.16 }, // D5
      { freq: 659.25, startSec: 0.10, durationSec: 0.5, volume: 0.15 }, // E5
      { freq: 783.99, startSec: 0.20, durationSec: 0.6, volume: 0.17 }, // G5
      { freq: 880.0, startSec: 0.32, durationSec: 0.65, volume: 0.17 }, // A5
      { freq: 987.77, startSec: 0.45, durationSec: 0.75, volume: 0.18 }, // B5
      { freq: 1174.66, startSec: 0.60, durationSec: 1.3, volume: 0.21 }, // D6
    ];
    notes.forEach((n) => scheduleNihonBellNote(ctx, now, n));
    return;
  }

  if (chosenStyle === "call") {
    // Tokyo JR Station Hassha-inspired Koto Ringtone Phrase
    // E5 -> G#5 -> B5 -> E6 -> D#6 -> B5 -> C#6
    const notes: ChimeNote[] = [
      { freq: 659.25, startSec: 0.0, durationSec: 0.45, volume: 0.17 }, // E5
      { freq: 830.61, startSec: 0.16, durationSec: 0.45, volume: 0.17 }, // G#5
      { freq: 987.77, startSec: 0.32, durationSec: 0.5, volume: 0.18 }, // B5
      { freq: 1318.51, startSec: 0.48, durationSec: 0.65, volume: 0.20 }, // E6
      { freq: 1244.51, startSec: 0.72, durationSec: 0.45, volume: 0.16 }, // D#6
      { freq: 987.77, startSec: 0.88, durationSec: 0.5, volume: 0.16 }, // B5
      { freq: 1108.73, startSec: 1.06, durationSec: 1.05, volume: 0.19 }, // C#6
    ];
    notes.forEach((n) => scheduleNihonBellNote(ctx, now, n));
    return;
  }

  if (chosenStyle === "connect") {
    // Gentle 3-note Koto confirmation chord
    const notes: ChimeNote[] = [
      { freq: 587.33, startSec: 0.0, durationSec: 0.4, volume: 0.14 }, // D5
      { freq: 880.0, startSec: 0.1, durationSec: 0.5, volume: 0.15 }, // A5
      { freq: 1174.66, startSec: 0.2, durationSec: 0.8, volume: 0.17 }, // D6
    ];
    notes.forEach((n) => scheduleNihonBellNote(ctx, now, n));
  }
}

