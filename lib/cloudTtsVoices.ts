/**
 * TTS Voice Catalog — Nihon Quest
 *
 * ⚡ HYBRID TTS ENGINE:
 * - High-speed: uses browser speechSynthesis directly if the neural voice is installed on device.
 * - Universal fallback: if the device (phones, tablets, Safari/Chrome) lacks the voice,
 *   it seamlessly synthesizes via the high-fidelity server endpoint (/api/ai/tts?voice=edge:...)
 *   meaning ALL neural voices are 100% AVAILABLE on every phone and device!
 */

export type VoiceGender = "female" | "male" | "neutral";
export type VoiceProvider = "cloud" | "browser" | "google" | "system";

export interface CloudVoice {
  id: string;           // e.g. "browser:Nanami" or "cloud:edge:Nanami"
  displayName: string;  // shown in picker
  gender: VoiceGender;
  provider: VoiceProvider;
  isNeural: boolean;
  edgeVoiceKey?: string; // mapping to /api/ai/tts Edge voice
  description: string;
  previewText: string;
  matchPatterns: string[];
}

export const CLOUD_VOICES: CloudVoice[] = [
  // ── Microsoft Neural voices (High fidelity, Universal across PC & Mobile) ──────────────
  {
    id: "browser:Nanami",
    displayName: "Nanami (Nữ)",
    gender: "female",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "ja-JP-NanamiNeural",
    description: "Giọng nữ chuẩn Tokyo, tự nhiên và trong trẻo ⭐",
    previewText: "こんにちは！七海です。日本語の学習を一緒に頑張りましょう。",
    matchPatterns: ["Nanami"],
  },
  {
    id: "browser:Keita",
    displayName: "Keita (Nam)",
    gender: "male",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "ja-JP-KeitaNeural",
    description: "Giọng nam Tokyo chuẩn, đĩnh đạc và chuyên nghiệp ⭐",
    previewText: "こんにちは！慶太です。一緒に日本語をマスターしましょう。",
    matchPatterns: ["Keita"],
  },
  {
    id: "browser:Aoi",
    displayName: "Aoi (Nữ)",
    gender: "female",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "aoi",
    description: "Giọng nữ trẻ trung, tươi sáng và năng động",
    previewText: "こんにちは、葵だよ！今日も楽しく元気に日本語を学ぼうね！",
    matchPatterns: ["Aoi"],
  },
  {
    id: "browser:Daichi",
    displayName: "Daichi (Nam)",
    gender: "male",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "daichi",
    description: "Giọng nam khỏe khoắn, tươi vui và nhiệt huyết",
    previewText: "やあ！大智だ。今日も一日気合を入れて頑張っていこう！",
    matchPatterns: ["Daichi"],
  },
  {
    id: "browser:Mayu",
    displayName: "Mayu (Nữ)",
    gender: "female",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "mayu",
    description: "Giọng nữ ấm áp, dịu dàng và truyền cảm",
    previewText: "初めまして、真由です。一歩ずつ、焦らずゆっくり進みましょう。",
    matchPatterns: ["Mayu"],
  },
  {
    id: "browser:Naoki",
    displayName: "Naoki (Nam)",
    gender: "male",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "naoki",
    description: "Giọng nam trầm ấm, điềm đạm, phong cách phát thanh viên",
    previewText: "こんにちは、直樹です。落ち着いて着実に基礎を固めていきましょう。",
    matchPatterns: ["Naoki"],
  },
  {
    id: "browser:Shiori",
    displayName: "Shiori (Nữ)",
    gender: "female",
    provider: "cloud",
    isNeural: true,
    edgeVoiceKey: "shiori",
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
    description: "Giọng nữ Apple chuẩn, tối ưu trên macOS/iOS/Safari",
    previewText: "こんにちは、京子です。日本語の発音を一緒に練習しましょう。",
    matchPatterns: ["Kyoko"],
  },
  {
    id: "browser:Otoya",
    displayName: "Otoya (Nam · Apple)",
    gender: "male",
    provider: "browser",
    isNeural: false,
    description: "Giọng nam Apple, có sẵn trên macOS/iOS/Safari",
    previewText: "こんにちは、音也です。正しい発音を身につけましょう。",
    matchPatterns: ["Otoya"],
  },
  {
    id: "browser:O-Ren",
    displayName: "O-Ren (Nữ · Apple Enhanced)",
    gender: "female",
    provider: "browser",
    isNeural: true,
    description: "Giọng nữ Apple Enhanced chất lượng cao trên macOS/iOS",
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
    description: "Giọng Google chuẩn tích hợp trên trình duyệt Chrome",
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
    description: "Giọng nữ Google Translate chuẩn, ổn định trên mọi mạng",
    previewText: "こんにちは。グーグルの標準音声です。いつでも安定してご利用いただけます。",
    matchPatterns: [],
  },
  {
    id: "gtts:slow",
    displayName: "Google Translate (Chậm)",
    gender: "female",
    provider: "google",
    isNeural: false,
    description: "Giọng phát âm tốc độ chậm, ngắt nhịp rõ ràng cho người mới bắt đầu",
    previewText: "こんにちは。ゆっくり、ていねいに、発音します。聞き取りの練習にどうぞ。",
    matchPatterns: [],
  },
];

/**
 * Find the matching SpeechSynthesisVoice for a given CloudVoice.
 * Returns null if not installed directly on this browser.
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
 * Check which catalog voices are available.
 * Neural Cloud and Google TTS voices are 100% available everywhere (backed by server synthesis).
 * Device-specific voices (like Apple Kyoko) are checked against window.speechSynthesis.
 */
export function checkVoiceAvailability(
  allVoices: SpeechSynthesisVoice[]
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const cv of CLOUD_VOICES) {
    if (cv.provider === "cloud" || cv.provider === "google") {
      // Cloud Neural and Google voices work on all phones and devices via API
      result.set(cv.id, true);
    } else {
      result.set(cv.id, findBrowserVoice(cv.id, allVoices) !== null);
    }
  }
  return result;
}

export function isBrowserVoiceId(id: string): boolean {
  return id.startsWith("browser:");
}

export function isGoogleTtsId(id: string): boolean {
  return id.startsWith("gtts:");
}

export function isCloudVoiceId(id: string): boolean {
  return id.startsWith("cloud:") || id.startsWith("browser:") || id.startsWith("gtts:");
}

export const GENDER_LABEL: Record<VoiceGender, string> = {
  female: "♀ Nữ",
  male: "♂ Nam",
  neutral: "⚥ Trung tính",
};

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  cloud: "Neural HD",
  browser: "Thiết bị",
  google: "Google TTS",
  system: "Hệ thống",
};

export const PROVIDER_COLOR: Record<VoiceProvider, string> = {
  cloud: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold",
  browser: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  google: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  system: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
