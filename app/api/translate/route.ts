import { NextResponse } from "next/server";

// Server-side in-memory translation cache to minimize upstream requests
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 10000;

function getCacheKey(text: string, targetLang: string, sourceLang: string = "ja"): string {
  return `${sourceLang}:${targetLang}:${text.trim().toLowerCase()}`;
}

async function fetchGoogleTranslate(text: string, targetLang: string, sourceLang: string = "ja"): Promise<string> {
  let tl = targetLang;
  if (tl === "zh-CN") tl = "zh-CN";
  else if (tl === "zh-TW") tl = "zh-TW";
  else if (tl.includes("-")) tl = tl.split("-")[0];

  let sl = sourceLang;
  const hasJapanese = /[\u3000-\u30ff\u4e00-\u9faf]/.test(text);
  if (!hasJapanese && sl === "ja") {
    sl = "auto";
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sl
  )}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text.trim())}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    throw new Error(`Google Translate error: ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const fullText = data[0]
      .map((chunk: any) => chunk[0])
      .filter(Boolean)
      .join("");
    return fullText || text;
  }
  return text;
}

async function fetchMyMemoryTranslate(text: string, targetLang: string, sourceLang: string = "ja"): Promise<string> {
  let tl = targetLang;
  if (tl === "zh-CN") tl = "zh-CN";
  else if (tl === "zh-TW") tl = "zh-TW";
  else if (tl.includes("-")) tl = tl.split("-")[0];

  let sl = sourceLang === "auto" ? "ja" : sourceLang;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${encodeURIComponent(sl)}|${encodeURIComponent(tl)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("MyMemory error");
  const data = await res.json();
  if (data?.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  return text;
}

async function translateTextSafe(text: string, targetLang: string, sourceLang: string = "ja"): Promise<string> {
  try {
    return await fetchGoogleTranslate(text, targetLang, sourceLang);
  } catch {
    try {
      return await fetchMyMemoryTranslate(text, targetLang, sourceLang);
    } catch {
      return text;
    }
  }
}

/**
 * Translates a list of strings efficiently by joining them with a distinctive delimiter
 * into a single translation request instead of making N separate requests.
 */
async function translateBatchFast(
  items: string[],
  targetLang: string,
  sourceLang: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (items.length === 0) return result;

  const DELIM = "\n__@@__\n";
  const joined = items.join(DELIM);

  try {
    const translatedBlob = await translateTextSafe(joined, targetLang, sourceLang);
    const parts = translatedBlob.split(/__@@__/i).map((s) => s.trim());
    if (parts.length === items.length) {
      for (let i = 0; i < items.length; i++) {
        result[items[i]] = parts[i];
      }
      return result;
    }
  } catch {
    // If combined translation fails or formatting mismatches, proceed to individual
  }

  // Fallback: translate in parallel chunks of 15
  const chunkSize = 15;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (item) => {
        try {
          result[item] = await translateTextSafe(item, targetLang, sourceLang);
        } catch {
          result[item] = item;
        }
      })
    );
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, texts, targetLang, sourceLang = "ja" } = body;

    if (!targetLang || typeof targetLang !== "string") {
      return NextResponse.json({ error: "Missing or invalid targetLang" }, { status: 400 });
    }

    // Batch translation mode
    if (Array.isArray(texts)) {
      const results: Record<string, string> = {};
      const pending: string[] = [];

      for (const item of texts) {
        if (typeof item !== "string" || !item.trim()) continue;
        const key = getCacheKey(item, targetLang, sourceLang);
        if (translationCache.has(key)) {
          results[item] = translationCache.get(key)!;
        } else {
          pending.push(item);
        }
      }

      if (pending.length > 0) {
        // Chunk pending texts into batches of up to 40 items each
        const CHUNK_SIZE = 40;
        for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
          const chunk = pending.slice(i, i + CHUNK_SIZE);
          const chunkTranslations = await translateBatchFast(chunk, targetLang, sourceLang);
          for (const [orig, tr] of Object.entries(chunkTranslations)) {
            const key = getCacheKey(orig, targetLang, sourceLang);
            if (translationCache.size >= MAX_CACHE_SIZE) {
              const firstKey = translationCache.keys().next().value;
              if (firstKey) translationCache.delete(firstKey);
            }
            translationCache.set(key, tr);
            results[orig] = tr;
          }
        }
      }

      return NextResponse.json({ translations: results });
    }

    // Single item translation mode
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text to translate" }, { status: 400 });
    }

    const cacheKey = getCacheKey(text, targetLang, sourceLang);
    if (translationCache.has(cacheKey)) {
      return NextResponse.json({ translation: translationCache.get(cacheKey) });
    }

    const translated = await translateTextSafe(text, targetLang, sourceLang);
    if (translationCache.size >= MAX_CACHE_SIZE) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, translated);

    return NextResponse.json({ translation: translated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Translation failed" }, { status: 500 });
  }
}
