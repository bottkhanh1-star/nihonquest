"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import type { SenseiCharacter, SenseiGender } from "@/lib/senseiCharacters";
import { guessVoiceGender, type VoiceGuess } from "@/lib/voiceGender";
import {
  buildTimeline,
  splitSentences,
  visemeAt,
  weightAtChar,
  type Timeline,
  type Viseme,
} from "@/lib/senseiLipSync";
import { playSenseiAudio, type WebAudioPlayback } from "@/lib/senseiWebAudio";

export interface JaVoice {
  uri: string;
  name: string;
  /** Đoán theo tên giọng. Web Speech API KHÔNG có trường giới tính. */
  guess: VoiceGuess;
  local: boolean;
}

const isJa = (v: SpeechSynthesisVoice) => {
  const lang = (v.lang || "").toLowerCase().replace("_", "-");
  const name = (v.name || "").toLowerCase();
  return (
    lang.startsWith("ja") ||
    lang.includes("jp") ||
    name.includes("japanese") ||
    name.includes("日本語") ||
    name.includes("japan")
  );
};

function scoreVoice(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 20;
  // Ưu tiên giọng cài trên máy: giọng mạng (Google…) trễ và thường không bắn onboundary,
  // làm khẩu hình kém khớp.
  if (v.localService) s += 5;
  if (/google/i.test(v.name)) s += 1;
  return s;
}

const BASE_MS_PER_MORA = 130; // ~7.7 mora/giây ở rate 1
const storeKey = (g: SenseiGender) => `nihon_sensei_voice_${g}`;

interface SpeakOptions {
  /** Cách đọc bằng kana của cả câu (nếu có) → khẩu hình chính xác hơn với kanji. */
  reading?: string;
  volume?: number;
  /** Ghi đè tốc độ; mặc định theo cài đặt chung. */
  rate?: number;
}

/**
 * Giọng đọc + khẩu hình của Sensei.
 * - Chọn giọng theo giới tính của nhân vật (không theo mặc định của thiết bị).
 * - Khẩu hình chạy theo onstart/onboundary/onend của chính utterance, nên bắt đầu
 *   và dừng đúng lúc âm thanh thật, không dùng setTimeout ước lượng.
 * - Hỗ trợ multi-tier fallback (Cloud TTS / Google mirror) nếu máy không cài sẵn gói tiếng Nhật.
 */
export type VoiceSource = "manual" | "global" | "auto";

export function useSenseiVoice(character: SenseiCharacter) {
  const gender = character.gender;
  // Cài đặt âm thanh dùng chung của cả app (nút loa trên navbar).
  const { speechRate, speechVoiceURI } = useSoundAndTheme();
  const rateRef = useRef(speechRate);
  rateRef.current = speechRate;
  const [raw, setRaw] = useState<SpeechSynthesisVoice[]>([]);
  const [overrideMap, setOverrideMap] = useState<Record<SenseiGender, string | null>>(() => {
    if (typeof window === "undefined") return { female: null, male: null };
    try {
      return {
        female: localStorage.getItem(storeKey("female")),
        male: localStorage.getItem(storeKey("male")),
      };
    } catch {
      return { female: null, male: null };
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [viseme, setViseme] = useState<Viseme>("closed");
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const override = overrideMap[gender];

  // Danh sách giọng nạp bất đồng bộ (getVoices() rỗng ở lần đầu trên Chrome).
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const all = synth.getVoices();
      const ja = all.filter(isJa);
      setRaw(ja.length > 0 ? ja : all);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [supported]);

  const hasJapaneseVoice = useMemo(() => {
    return raw.some(isJa);
  }, [raw]);

  const voices: JaVoice[] = useMemo(
    () => raw.map((v) => ({ uri: v.voiceURI, name: v.name, guess: guessVoiceGender(v.name), local: v.localService })),
    [raw]
  );

  // Giọng chung người học chọn trên navbar (chỉ tính giọng tiếng Nhật).
  const globalVoice = useMemo(
    () => (speechVoiceURI ? raw.find((v) => v.voiceURI === speechVoiceURI || v.name === speechVoiceURI) : undefined),
    [raw, speechVoiceURI]
  );
  const globalGender: VoiceGuess = globalVoice ? guessVoiceGender(globalVoice.name) : "unknown";

  /**
   * Thứ tự chọn giọng:
   * 1. Giọng người học chọn riêng cho Sensei (nhớ theo giới tính).
   * 2. Giọng nam/nữ khớp chính xác theo giới tính của nhân vật.
   * 3. Giọng chung ở navbar, nếu cùng giới tính với nhân vật.
   * 4. Giọng tiếng Nhật tốt nhất sẵn có + hạ/nâng tông pitch tự động.
   */
  const picked = useMemo(() => {
    type Pick = { voice: SpeechSynthesisVoice | null; exact: boolean; source: VoiceSource };
    if (!raw.length) return { voice: null, exact: false, source: "auto" } as Pick;

    // 1. Lựa chọn thủ công riêng cho giới tính này
    const manual = override ? raw.find((v) => v.voiceURI === override || v.name === override) : undefined;
    if (manual) {
      const isExact = guessVoiceGender(manual.name) === gender;
      return { voice: manual, exact: isExact, source: "manual" } as Pick;
    }

    const byScore = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => scoreVoice(b) - scoreVoice(a);

    // 2. Tìm giọng chuẩn khớp giới tính
    const match = raw.filter((v) => guessVoiceGender(v.name) === gender).sort(byScore);
    if (match.length) return { voice: match[0], exact: true, source: "auto" } as Pick;

    // 3. Nếu là nhân vật Nam, thử các giọng không bị nhận diện cứng là Nữ
    if (gender === "male") {
      const nonFemale = raw.filter((v) => guessVoiceGender(v.name) !== "female").sort(byScore);
      if (nonFemale.length) return { voice: nonFemale[0], exact: false, source: "auto" } as Pick;
    }

    // 4. Giọng chung ở navbar nếu cùng giới tính
    if (globalVoice && globalGender === gender) {
      return { voice: globalVoice, exact: true, source: "global" } as Pick;
    }

    // 5. Fallback giọng tiếng Nhật tốt nhất với pitch bù theo giới tính
    const chosen = [...raw].sort(byScore)[0];
    const isExact = chosen ? guessVoiceGender(chosen.name) === gender : false;
    return { voice: chosen ?? null, exact: isExact, source: "auto" } as Pick;
  }, [raw, override, gender, globalVoice, globalGender]);

  // ── Trạng thái chạy, giữ trong ref để speak() ổn định và không re-render ──
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const charRef = useRef(character);
  charRef.current = character;

  const runId = useRef(0);
  const raf = useRef(0);
  const cur = useRef<{ tl: Timeline; start: number; t0: number; ms: number } | null>(null);
  const msPerMora = useRef(BASE_MS_PER_MORA);
  const shown = useRef<Viseme>("closed");

  const activeAudioPlayback = useRef<WebAudioPlayback | null>(null);

  const show = useCallback((v: Viseme) => {
    if (shown.current !== v) {
      shown.current = v;
      setViseme(v);
    }
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    cur.current = null;
    show("closed");
  }, [show]);

  const cancel = useCallback(() => {
    runId.current++;
    if (activeAudioPlayback.current) {
      try {
        activeAudioPlayback.current.stop();
      } catch {}
      activeAudioPlayback.current = null;
    }
    stopLoop();
    setIsSpeaking(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, [stopLoop]);

  const speak = useCallback(
    (rawText: string, opts: SpeakOptions = {}) => {
      if (typeof window === "undefined" || !rawText) return;
      const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

      const jp = rawText.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F々ー！？!?]+/g);
      const text = jp ? jp.join(" ") : rawText;

      const sentences = splitSentences(text);
      if (!sentences.length) return;
      // Ghép cách đọc theo từng câu; nếu số câu lệch nhau thì bỏ cách đọc (an toàn hơn lệch nhịp).
      let readings: (string | undefined)[] = [];
      if (opts.reading) {
        const r = splitSentences(opts.reading);
        readings = r.length === sentences.length ? r : [];
      }

      const wasBusy = synth ? (synth.speaking || synth.pending) : false;
      cancel();
      const id = ++runId.current;
      const { voice, exact } = pickedRef.current;
      const ch = charRef.current;
      const pitch = exact ? ch.voice.pitch : ch.voice.fallbackPitch;
      const rate = opts.rate ?? rateRef.current;

      const hasJa = raw.some(isJa);
      const isCloudSelected = speechVoiceURI.startsWith("cloud:");
      // Nếu chọn giọng Cloud HOẶC máy không có giọng tiếng Nhật HOẶC nhân vật Nam không có giọng nam tự nhiên
      if (isCloudSelected || !hasJa || (ch.gender === "male" && !exact)) {
        setIsSpeaking(true);
        const cloudVoiceParam = isCloudSelected ? speechVoiceURI.slice("cloud:".length) : undefined;
        playSenseiAudio(
          text,
          ch.gender,
          () => {
            if (id === runId.current) setIsSpeaking(true);
          },
          (viseme) => {
            if (id === runId.current) show(viseme);
          },
          () => {
            if (id === runId.current) {
              setIsSpeaking(false);
              show("closed");
            }
          },
          cloudVoiceParam
        ).then((playback) => {
          if (id === runId.current && playback) {
            activeAudioPlayback.current = playback;
          } else if (id === runId.current && !playback && synth && hasJa) {
            run();
          }
        }).catch(() => {
          if (id === runId.current && synth && hasJa) run();
        });
        return;
      }

      const begin = (i: number) => {
        const tl = buildTimeline(sentences[i], readings[i]);
        const ms = msPerMora.current / rate;
        const now = performance.now();
        cur.current = { tl, start: now, t0: now, ms };
        setIsSpeaking(true);
        cancelAnimationFrame(raf.current);
        const tick = () => {
          const c = cur.current;
          if (!c || id !== runId.current) return;
          show(visemeAt(c.tl, (performance.now() - c.start) / c.ms));
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      };

      const endChunk = (i: number) => {
        const c = cur.current;
        if (c && c.tl.total > 4) {
          // Học nhịp đọc thật của giọng này để lần sau lệch ít hơn.
          const measured = ((performance.now() - c.t0) / c.tl.total) * (rate);
          msPerMora.current = Math.max(70, Math.min(260, msPerMora.current * 0.6 + measured * 0.4));
        }
        stopLoop();
        if (i === sentences.length - 1) setIsSpeaking(false);
      };

      const started = new Set<number>();
      const run = () => {
        if (id !== runId.current || !synth) return;
        sentences.forEach((s, i) => {
          const u = new SpeechSynthesisUtterance(s);
          u.lang = "ja-JP";
          if (voice) u.voice = voice;
          u.pitch = pitch;
          u.rate = rate;
          u.volume = opts.volume ?? 1;
          u.onstart = () => {
            if (id !== runId.current) return;
            started.add(i);
            begin(i);
          };
          u.onboundary = (e) => {
            const c = cur.current;
            if (!c || id !== runId.current || (e.name && e.name !== "word")) return;
            // Neo lại theo vị trí chữ thật mà engine báo (Safari/Edge/giọng local).
            const w = weightAtChar(c.tl, e.charIndex, s.length);
            c.start = performance.now() - w * c.ms;
          };
          u.onend = () => id === runId.current && endChunk(i);
          u.onerror = (e) => {
            if (id !== runId.current) return;
            if (e.error !== "canceled" && e.error !== "interrupted") {
              // Fallback to Cloud TTS WebAudio
              const cloudVoiceParam = speechVoiceURI.startsWith("cloud:") ? speechVoiceURI.slice("cloud:".length) : undefined;
              playSenseiAudio(
                s,
                ch.gender,
                () => { if (id === runId.current) setIsSpeaking(true); },
                (v) => { if (id === runId.current) show(v); },
                () => {
                  if (id === runId.current) {
                    setIsSpeaking(false);
                    show("closed");
                  }
                },
                cloudVoiceParam
              ).then((p) => {
                if (id === runId.current && p) activeAudioPlayback.current = p;
              });
            } else {
              stopLoop();
              if (i === sentences.length - 1) setIsSpeaking(false);
            }
          };
          synth.speak(u);
        });
        // Một số trình duyệt không bắn onstart: nếu sau 1,5s đang đọc mà chưa bắt đầu thì chạy khẩu hình.
        window.setTimeout(() => {
          if (id === runId.current && !started.size && synth.speaking) begin(0);
        }, 1500);
      };

      // Chrome đôi khi nuốt lệnh speak() ngay sau cancel(): chờ một nhịp ngắn.
      if (wasBusy) window.setTimeout(run, 60);
      else run();
    },
    [cancel, show, stopLoop, raw]
  );

  // Đổi nhân vật hoặc rời trang: dừng ngay, tránh giọng cũ đọc tiếp.
  useEffect(() => cancel, [character.id, cancel]);

  const setVoiceURI = useCallback(
    (uri: string | null) => {
      setOverrideMap((prev) => ({ ...prev, [gender]: uri }));
      try {
        if (uri) localStorage.setItem(storeKey(gender), uri);
        else localStorage.removeItem(storeKey(gender));
      } catch {
        /* localStorage bị chặn: bỏ qua, chỉ không nhớ lựa chọn */
      }
    },
    [gender]
  );

  return {
    supported,
    speak,
    cancel,
    isSpeaking,
    hasJapaneseVoice,
    viseme,
    voices,
    activeVoice: picked.voice
      ? { uri: picked.voice.voiceURI, name: picked.voice.name }
      : null,
    /** Giọng đang dùng đến từ đâu: chọn riêng / cài đặt chung / tự chọn theo giới tính. */
    source: picked.source,
    /** Giới tính (đoán) của giọng chung trên navbar; "unknown" nếu chưa chọn hoặc không đoán được. */
    globalGender,
    speechRate,
    /** false = thiết bị không có giọng đúng giới tính, đang dùng giọng sẵn có đã đổi tông. */
    exactMatch: picked.exact,
    selectedURI: override,
    setVoiceURI,
  };
}
