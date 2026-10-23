import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";

// Must use Node.js runtime — Edge Runtime doesn't support WebSocket / crypto built-ins
export const runtime = "nodejs";

// ──────────────────────────────────────────────────────────────────────────
// Microsoft Edge Neural TTS (free, no API key, high quality Japanese voices)
// Uses the same backend as Edge browser "Read Aloud" feature.
// Package: msedge-tts (https://github.com/Migushthe2nd/MsEdgeTTS)
// ──────────────────────────────────────────────────────────────────────────

async function synthesizeEdgeTts(
  text: string,
  voiceName: string,
  options?: { pitch?: string; rate?: string; volume?: string }
): Promise<Buffer | null> {
  let tts: any = null;
  try {
    const nodeRequire =
      typeof (globalThis as unknown as { __non_webpack_require__?: (id: string) => any }).__non_webpack_require__ !== "undefined"
        ? (globalThis as unknown as { __non_webpack_require__: (id: string) => any }).__non_webpack_require__
        : eval("require");
    const { MsEdgeTTS, OUTPUT_FORMAT } = nodeRequire("msedge-tts");
    tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text, options);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.once("end", finish);
      audioStream.once("close", finish);
      audioStream.once("error", (err: any) => {
        if (!done) {
          done = true;
          reject(err);
        }
      });
    });

    if (chunks.length > 0) return Buffer.concat(chunks);
    return null;
  } catch (err) {
    console.warn("[Edge TTS] synthesis error:", (err as Error)?.message?.slice(0, 100));
    return null;
  } finally {
    // Explicitly terminate the WebSocket session so serverless containers
    // and Microsoft endpoints release the connection immediately without 429 leaks.
    if (tts && tts._ws) {
      try {
        tts._closeSocket(tts._ws);
      } catch {}
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// OpenAI TTS (optional, requires OPENAI_API_KEY env var)
// ──────────────────────────────────────────────────────────────────────────
async function synthesizeOpenAiTts(text: string, voiceName: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", input: text, voice: voiceName, response_format: "mp3" }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Google Translate TTS (no API key, female voice only, 300-char limit)
// ──────────────────────────────────────────────────────────────────────────
async function synthesizeGoogleTts(text: string, slow = false): Promise<Buffer | null> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ja&client=tw-ob${slow ? "&ttsspeed=0.5" : ""}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// GET /api/ai/tts?text=<text>&voice=<voiceId>
//
// voice param format:
//   ""                          → default Google TTS (female)
//   "edge:<VoiceName>"          → Microsoft Edge Neural TTS
//   "openai:<voice>"            → OpenAI TTS (needs OPENAI_API_KEY)
//   "google:slow"               → Google TTS slow speed
// ──────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "ai-tts", 120, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text")?.trim();
  const voiceParam = searchParams.get("voice") ?? "";

  if (!text) return new NextResponse("text param required", { status: 400 });

  // Clean text: strip emoji + parenthetical notes
  const cleanText = text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\(\[\{（【].*?[\)\]\}）】]/g, "")
    .trim()
    .slice(0, 300);

  if (!cleanText) return new NextResponse("empty text after cleaning", { status: 400 });

  let audio: Buffer | null = null;
  let providerUsed = "google";

  // Route to provider
  if (voiceParam.startsWith("edge:")) {
    const voiceKey = voiceParam.slice(5); // e.g. "ja-JP-NanamiNeural" or "daichi"
    let voiceName = "ja-JP-NanamiNeural";
    let options: { pitch?: string; rate?: string } | undefined;

    // Map presets to Edge Neural base voice + natural prosody (pitch & rate)
    if (voiceKey.includes("Keita") || voiceKey === "keita") {
      voiceName = "ja-JP-KeitaNeural";
    } else if (voiceKey.includes("Daichi") || voiceKey === "daichi") {
      voiceName = "ja-JP-KeitaNeural";
      options = { pitch: "+12Hz", rate: "+4%" };
    } else if (voiceKey.includes("Naoki") || voiceKey === "naoki") {
      voiceName = "ja-JP-KeitaNeural";
      options = { pitch: "-10Hz", rate: "-3%" };
    } else if (voiceKey.includes("Kenji") || voiceKey === "kenji") {
      voiceName = "ja-JP-KeitaNeural";
      options = { pitch: "-20Hz", rate: "-6%" };
    } else if (voiceKey.includes("Ren") || voiceKey === "ren") {
      voiceName = "ja-JP-KeitaNeural";
      options = { pitch: "+5Hz", rate: "+8%" };
    } else if (voiceKey.includes("Aoi") || voiceKey === "aoi") {
      voiceName = "ja-JP-NanamiNeural";
      options = { pitch: "+15Hz", rate: "+4%" };
    } else if (voiceKey.includes("Sakura") || voiceKey === "sakura") {
      voiceName = "ja-JP-NanamiNeural";
      options = { pitch: "+24Hz", rate: "+6%" };
    } else if (voiceKey.includes("Mayu") || voiceKey === "mayu") {
      voiceName = "ja-JP-NanamiNeural";
      options = { pitch: "-8Hz", rate: "-3%" };
    } else if (voiceKey.includes("Shiori") || voiceKey === "shiori") {
      voiceName = "ja-JP-NanamiNeural";
      options = { pitch: "-12Hz", rate: "-5%" };
    } else {
      voiceName = "ja-JP-NanamiNeural";
    }

    audio = await synthesizeEdgeTts(cleanText, voiceName, options);
    if (audio) {
      providerUsed = `edge:${voiceName}`;
    } else {
      // Fallback to Google if Edge TTS fails
      audio = await synthesizeGoogleTts(cleanText);
      providerUsed = "google:fallback";
    }
  } else if (voiceParam.startsWith("openai:")) {
    const voiceName = voiceParam.slice(7);
    audio = await synthesizeOpenAiTts(cleanText, voiceName);
    if (audio) {
      providerUsed = `openai:${voiceName}`;
    } else {
      // Smart distinct mapping when OPENAI_API_KEY is not set:
      // NEVER fall back to the first voice (Nanami)!
      if (voiceName === "onyx") {
        audio = await synthesizeEdgeTts(cleanText, "ja-JP-KeitaNeural", { pitch: "-28Hz", rate: "-10%" });
        providerUsed = "edge:kenji";
      } else if (voiceName === "echo") {
        audio = await synthesizeEdgeTts(cleanText, "ja-JP-KeitaNeural", { pitch: "+12Hz", rate: "+8%" });
        providerUsed = "edge:daichi";
      } else if (voiceName === "alloy") {
        audio = await synthesizeEdgeTts(cleanText, "ja-JP-NanamiNeural", { pitch: "-10Hz", rate: "-4%" });
        providerUsed = "edge:mayu";
      } else { // nova
        audio = await synthesizeEdgeTts(cleanText, "ja-JP-NanamiNeural", { pitch: "+25Hz", rate: "+8%" });
        providerUsed = "edge:aoi";
      }
    }
    if (!audio) {
      audio = await synthesizeGoogleTts(cleanText);
    }
  } else if (voiceParam === "google:slow") {
    audio = await synthesizeGoogleTts(cleanText, true);
    providerUsed = "google:slow";
  } else {
    // Default: Edge Nanami Neural if available, else Google TTS
    audio = await synthesizeEdgeTts(cleanText, "ja-JP-NanamiNeural");
    if (audio) {
      providerUsed = "edge:ja-JP-NanamiNeural";
    } else {
      audio = await synthesizeGoogleTts(cleanText);
      providerUsed = "google";
    }
  }

  if (!audio) {
    return new NextResponse("All TTS providers failed", { status: 502 });
  }

  const isFallback = providerUsed.includes("fallback");
  const cacheControl = isFallback
    ? "no-cache, no-store, must-revalidate"
    : `public, max-age=604800, s-maxage=604800, stale-while-revalidate=3600`;

  const uint8 = new Uint8Array(audio);
  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(uint8.byteLength),
      "Cache-Control": cacheControl,
      "X-TTS-Provider": providerUsed,
    },
  });
}
