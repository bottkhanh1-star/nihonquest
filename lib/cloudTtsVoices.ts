/**
 * Cloud TTS Voice Catalog — Nihon Quest
 *
 * Voice IDs:
 *   "cloud:edge:<VoiceName>"   → /api/ai/tts?voice=edge:<VoiceName>   (Microsoft Edge Neural, free)
 *   "cloud:openai:<voice>"     → /api/ai/tts?voice=openai:<voice>     (OpenAI, needs API key)
 *   "cloud:google:slow"        → /api/ai/tts?voice=google:slow        (Google TTS slow mode)
 *   ""                         → WebSpeech API device voice
 *
 * Voice IDs stored in localStorage as "nq_speech_voice".
 * A value starting with "cloud:" bypasses WebSpeech entirely.
 */

export type VoiceGender = "female" | "male" | "neutral";
export type VoiceProvider = "edge" | "openai" | "google" | "system";

export interface CloudVoice {
  id: string;           // stored value, e.g. "cloud:edge:ja-JP-NanamiNeural"
  displayName: string;  // shown in picker
  gender: VoiceGender;
  provider: VoiceProvider;
  isNeural: boolean;
  /** Require OPENAI_API_KEY to work */
  requiresKey?: boolean;
  /** Description shown in picker */
  description: string;
  /** Distinct preview phrase demonstrating the persona */
  previewText?: string;
}

export const CLOUD_VOICES: CloudVoice[] = [
  // ── Microsoft Edge Neural TTS (best quality, free, no API key) ──────────
  {
    id: "cloud:edge:ja-JP-NanamiNeural",
    displayName: "Nanami (Nữ)",
    gender: "female",
    provider: "edge",
    isNeural: true,
    description: "Giọng nữ chuẩn Tokyo, tự nhiên và trong trẻo ⭐",
    previewText: "こんにちは！七海です。日本語の学習を一緒に頑張りましょう。",
  },
  {
    id: "cloud:edge:ja-JP-KeitaNeural",
    displayName: "Keita (Nam)",
    gender: "male",
    provider: "edge",
    isNeural: true,
    description: "Giọng nam Tokyo chuẩn, đĩnh đạc và chuyên nghiệp ⭐",
    previewText: "こんにちは！慶太です。一緒に日本語をマスターしましょう。",
  },
  {
    id: "cloud:edge:ja-JP-AoiNeural",
    displayName: "Aoi (Nữ)",
    gender: "female",
    provider: "edge",
    isNeural: true,
    description: "Giọng nữ trẻ trung, tươi sáng và năng động",
    previewText: "こんにちは、葵だよ！今日も楽しく元気に日本語を学ぼうね！",
  },
  {
    id: "cloud:edge:ja-JP-DaichiNeural",
    displayName: "Daichi (Nam)",
    gender: "male",
    provider: "edge",
    isNeural: true,
    description: "Giọng nam khỏe khoắn, tươi vui và nhiệt huyết",
    previewText: "やあ！大智だ。今日も一日気合を入れて頑張っていこう！",
  },
  {
    id: "cloud:edge:ja-JP-MayuNeural",
    displayName: "Mayu (Nữ)",
    gender: "female",
    provider: "edge",
    isNeural: true,
    description: "Giọng nữ ấm áp, dịu dàng và truyền cảm",
    previewText: "初めまして、真由です。一歩ずつ、焦らずゆっくり進みましょう。",
  },
  {
    id: "cloud:edge:ja-JP-NaokiNeural",
    displayName: "Naoki (Nam)",
    gender: "male",
    provider: "edge",
    isNeural: true,
    description: "Giọng nam trầm ấm, điềm đạm, phong cách phát thanh viên",
    previewText: "こんにちは、直樹です。落ち着いて着実に基礎を固めていきましょう。",
  },
  {
    id: "cloud:edge:ja-JP-ShioriNeural",
    displayName: "Shiori (Nữ)",
    gender: "female",
    provider: "edge",
    isNeural: true,
    description: "Giọng nữ nhẹ nhàng, điềm tĩnh, thích hợp nghe chậm",
    previewText: "こんにちは、詩織です。あなたのペースで無理なく続けてくださいね。",
  },
  {
    id: "cloud:edge:ja-JP-SakuraNeural",
    displayName: "Sakura (Nữ)",
    gender: "female",
    provider: "edge",
    isNeural: true,
    description: "Giọng nữ dễ thương, trong trẻo, phong cách anime chibi",
    previewText: "えへへ、さくらだよ！一緒にたくさん日本語をおしゃべりしよう！",
  },
  {
    id: "cloud:edge:ja-JP-KenjiNeural",
    displayName: "Kenji (Nam)",
    gender: "male",
    provider: "edge",
    isNeural: true,
    description: "Giọng nam rất trầm, uy nghiêm, phong thái thầy giáo kỳ cựu",
    previewText: "ケンジだ。毎日コツコツ続けることこそが、上達の唯一の秘訣だぞ。",
  },
  {
    id: "cloud:edge:ja-JP-RenNeural",
    displayName: "Ren (Nam)",
    gender: "male",
    provider: "edge",
    isNeural: true,
    description: "Giọng nam shounen, năng động, nhịp điệu nhanh và dứt khoát",
    previewText: "オッス、レンだぜ！スピード上げてどんどん練習していこうぜ！",
  },

  // ── Google TTS (always available, female only) ────────────────────────
  {
    id: "cloud:google:default",
    displayName: "Google (Nữ chuẩn)",
    gender: "female",
    provider: "google",
    isNeural: false,
    description: "Giọng nữ Google Translate chuẩn, luôn khả dụng",
    previewText: "こんにちは。グーグルの標準音声です。いつでも安定してご利用いただけます。",
  },
  {
    id: "cloud:google:slow",
    displayName: "Google (Chậm)",
    gender: "female",
    provider: "google",
    isNeural: false,
    description: "Giọng chậm, ngắt nhịp rõ ràng để luyện nghe người mới",
    previewText: "こんにちは。ゆっくり、ていねいに、発音します。聞き取りの練習にどうぞ。",
  },

  // ── OpenAI TTS (high quality, requires API key) ────────────────────────
  {
    id: "cloud:openai:nova",
    displayName: "Nova (Nữ)",
    gender: "female",
    provider: "openai",
    isNeural: true,
    requiresKey: true,
    description: "OpenAI Neural — Nữ hiện đại, tự nhiên",
    previewText: "こんにちは、ノヴァです。自然な発音であなたの日本語学習を応援します。",
  },
  {
    id: "cloud:openai:onyx",
    displayName: "Onyx (Nam)",
    gender: "male",
    provider: "openai",
    isNeural: true,
    requiresKey: true,
    description: "OpenAI Neural — Nam trầm, vang, vững chãi",
    previewText: "オニキスだ。低く落ち着いた声で、じっくりと学習を支えるぞ。",
  },
  {
    id: "cloud:openai:alloy",
    displayName: "Alloy (Cân bằng)",
    gender: "neutral",
    provider: "openai",
    isNeural: true,
    requiresKey: true,
    description: "OpenAI Neural — Âm vực cân bằng, thanh thoát",
    previewText: "こんにちは、アロイです。中立的でとても聞き取りやすい発音です。",
  },
  {
    id: "cloud:openai:echo",
    displayName: "Echo (Nam)",
    gender: "male",
    provider: "openai",
    isNeural: true,
    requiresKey: true,
    description: "OpenAI Neural — Nam tươi vui, rõ ràng",
    previewText: "エコーだよ！テンポよくリズミカルに日本語を声に出していこう！",
  },
];

/** Build the ?voice= param from a cloud voice ID */
export function cloudVoiceToApiParam(cloudId: string): string {
  // "cloud:edge:ja-JP-NanamiNeural" → "edge:ja-JP-NanamiNeural"
  // "cloud:google:slow" → "google:slow"
  if (!cloudId.startsWith("cloud:")) return "";
  const withoutPrefix = cloudId.slice("cloud:".length);
  // "google:default" → just use empty (default Google)
  if (withoutPrefix === "google:default") return "";
  return withoutPrefix;
}

export function isCloudVoiceId(id: string): boolean {
  return id.startsWith("cloud:");
}

export const GENDER_LABEL: Record<VoiceGender, string> = {
  female: "♀ Nữ",
  male: "♂ Nam",
  neutral: "⚥ Trung tính",
};

export const PROVIDER_LABEL: Record<VoiceProvider, string> = {
  edge: "Edge Neural",
  google: "Google TTS",
  openai: "OpenAI",
  system: "Hệ thống",
};

export const PROVIDER_COLOR: Record<VoiceProvider, string> = {
  edge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  google: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  openai: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  system: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
