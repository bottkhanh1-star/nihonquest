/**
 * TTS Voice Catalog — Nihon Quest
 *
 * ⚡ ALL voices now use the browser's built-in speechSynthesis API directly.
 *    No server proxy needed → works on Netlify, Vercel, any hosting.
 *
 * Voice IDs:
 *   "browser:<voiceNamePattern>"  → Direct browser speechSynthesis voice
 *   "gtts:default"               → Google Translate TTS (server proxy, female only)
 *   "gtts:slow"                  → Google Translate TTS slow mode
 *   ""                           → Auto-detect best Japanese voice
 *
 * Voice IDs stored in localStorage as "nq_speech_voice".
 */

export type VoiceGender = "female" | "male" | "neutral";
export type VoiceProvider = "browser" | "google" | "system";

export interface CloudVoice {
  id: string;           // stored value, e.g. "browser:Nanami"
  displayName: string;  // shown in picker
  gender: VoiceGender;
  provider: VoiceProvider;
  isNeural: boolean;
  /** Description shown in picker */
  description: string;
  /** Distinct preview phrase demonstrating the persona */
  previewText: string;
  /**
   * Match patterns: voice.name must include at least one of these strings (case-insensitive).
   * Used to find the real SpeechSynthesisVoice from the browser's voice list.
   */
  matchPatterns: string[];
}

/**
 * The voice catalog. Order matters — first match wins for auto-detect.
 * Match patterns are tested against the browser's SpeechSynthesisVoice.name.
 *
 * Common browser voice names:
 *   Chrome/Edge: "Microsoft Nanami Online (Natural) - Japanese (Japan)"
 *                "Microsoft Keita Online (Natural) - Japanese (Japan)"
 *                "Google 日本語"
 *   Safari:      "Kyoko" / "Otoya" / "O-Ren"
 *   Firefox:     Uses OS voices (same as Edge on Windows)
 */
export const CLOUD_VOICES: CloudVoice[] = [
  // ── Microsoft Neural voices (Chrome / Edge / Windows) ──────────────
  {
    id: "browser:Nanami",
    displayName: "Nanami (Nữ)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ chuẩn Tokyo, tự nhiên và trong trẻo ⭐",
    previewText: "こんにちは！七海です。日本語の学習を一緒に頑張りましょう。",
    matchPatterns: ["Nanami"],
  },
  {
    id: "browser:Keita",
    displayName: "Keita (Nam)",
    gender: "male",
    provider: "browser",
    isNeural: true,
    description: "Giọng nam Tokyo chuẩn, đĩnh đạc và chuyên nghiệp ⭐",
    previewText: "こんにちは！慶太です。一緒に日本語をマスターしましょう。",
    matchPatterns: ["Keita"],
  },
  {
    id: "browser:Aoi",
    displayName: "Aoi (Nữ)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ trẻ trung, tươi sáng và năng động",
    previewText: "こんにちは、葵だよ！今日も楽しく元気に日本語を学ぼうね！",
    matchPatterns: ["Aoi"],
  },
  {
    id: "browser:Daichi",
    displayName: "Daichi (Nam)",
    gender: "male",
    provider: "browser",
    isNeural: true,
    description: "Giọng nam khỏe khoắn, tươi vui và nhiệt huyết",
    previewText: "やあ！大智だ。今日も一日気合を入れて頑張っていこう！",
    matchPatterns: ["Daichi"],
  },
  {
    id: "browser:Mayu",
    displayName: "Mayu (Nữ)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ ấm áp, dịu dàng và truyền cảm",
    previewText: "初めまして、真由です。一歩ずつ、焦らずゆっくり進みましょう。",
    matchPatterns: ["Mayu"],
  },
  {
    id: "browser:Naoki",
    displayName: "Naoki (Nam)",
    gender: "male",
    provider: "browser",
    isNeural: true,
    description: "Giọng nam trầm ấm, điềm đạm, phong cách phát thanh viên",
    previewText: "こんにちは、直樹です。落ち着いて着実に基礎を固めていきましょう。",
    matchPatterns: ["Naoki"],
  },
  {
    id: "browser:Shiori",
    displayName: "Shiori (Nữ)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ nhẹ nhàng, điềm tĩnh, thích hợp nghe chậm",
    previewText: "こんにちは、詩織です。あなたのペースで無理なく続けてくださいね。",
    matchPatterns: ["Shiori"],
  },

  // ── Apple voices (Safari / macOS / iOS) ───────────────────────────
  {
    id: "browser:Kyoko",
    displayName: "Kyoko (Nữ · Apple)",
    gender: "female",
    provider: "browser",
    isNeural: false,
    description: "Giọng nữ Apple chuẩn, có trên macOS/iOS/Safari",
    previewText: "こんにちは、京子です。日本語の発音を一緒に練習しましょう。",
    matchPatterns: ["Kyoko"],
  },
  {
    id: "browser:Otoya",
    displayName: "Otoya (Nam · Apple)",
    gender: "male",
    provider: "browser",
    isNeural: false,
    description: "Giọng nam Apple, có trên macOS/iOS/Safari",
    previewText: "こんにちは、音也です。正しい発音を身につけましょう。",
    matchPatterns: ["Otoya"],
  },
  {
    id: "browser:O-Ren",
    displayName: "O-Ren (Nữ · Apple Enhanced)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ Apple Enhanced, chất lượng cao trên macOS/iOS",
    previewText: "こんにちは、オーレンです。自然で滑らかな日本語をお届けします。",
    matchPatterns: ["O-Ren"],
  },

  // ── Google TTS voice (Chrome built-in) ────────────────────────────
  {
    id: "browser:Google-ja",
    displayName: "Google 日本語 (Nữ)",
    gender: "female",
    provider: "browser",
    isNeural: false,
    description: "Giọng Google chuẩn, có trên Chrome",
    previewText: "こんにちは。グーグルの日本語音声です。クリアに発音します。",
    matchPatterns: ["Google 日本語", "Google Japanese"],
  },

  // ── Fallback: Google Translate TTS (server proxy) ─────────────────
  {
    id: "gtts:default",
    displayName: "Google Translate (Nữ)",
    gender: "female",
    provider: "google",
    isNeural: false,
    description: "Giọng nữ Google Translate, dùng khi không có giọng trên máy",
    previewText: "こんにちは。グーグルの標準音声です。いつでも安定してご利用いただけます。",
    matchPatterns: [],
  },
  {
    id: "gtts:slow",
    displayName: "Google Translate (Chậm)",
    gender: "female",
    provider: "google",
    isNeural: false,
    description: "Giọng chậm, ngắt nhịp rõ ràng để luyện nghe người mới",
    previewText: "こんにちは。ゆっくり、ていねいに、発音します。聞き取りの練習にどうぞ。",
    matchPatterns: [],
  },
];

/**
 * Find the matching SpeechSynthesisVoice for a given CloudVoice.
 * Returns null if no match found (voice not available on this browser).
 */
export function findBrowserVoice(
  voiceId: string,
  allVoices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const catalog = CLOUD_VOICES.find((v) => v.id === voiceId);
  if (!catalog || catalog.matchPatterns.length === 0) return null;

  for (const pattern of catalog.matchPatterns) {
    const lowerPattern = pattern.toLowerCase();
    const match = allVoices.find((v) =>
      v.name.toLowerCase().includes(lowerPattern)
    );
    if (match) return match;
  }
  return null;
}

/**
 * Check which catalog voices are available in the current browser.
 * Returns a map of voiceId → true/false.
 */
export function checkVoiceAvailability(
  allVoices: SpeechSynthesisVoice[]
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const cv of CLOUD_VOICES) {
    if (cv.provider === "google") {
      // Google TTS (server proxy) is always available
      result.set(cv.id, true);
    } else {
      result.set(cv.id, findBrowserVoice(cv.id, allVoices) !== null);
    }
  }
  return result;
}

/** Check if it's a browser voice or google translate voice */
export function isBrowserVoiceId(id: string): boolean {
  return id.startsWith("browser:");
}

export function isGoogleTtsId(id: string): boolean {
  return id.startsWith("gtts:");
}

/** Legacy: check old cloud: prefix (for migration) */
export function isCloudVoiceId(id: string): boolean {
  return id.startsWith("cloud:") || id.startsWith("browser:") || id.startsWith("gtts:");
}

export const GENDER_LABEL: Record<VoiceGender, string> = {
  female: "♀ Nữ",
  male: "♂ Nam",
  neutral: "⚥ Trung tính",
};

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  browser: "Neural HD",
  google: "Google TTS",
  system: "Hệ thống",
};

export const PROVIDER_COLOR: Record<VoiceProvider, string> = {
  browser: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  google: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  system: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
