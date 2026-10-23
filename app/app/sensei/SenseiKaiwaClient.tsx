"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Button, Icon, Modal } from "@/components/ui";
import {
  BriefcaseIcon, BulbIcon, ChevronRight, DoubleCheckIcon, KebabIcon,
  SakuraFlower, SendIcon, SparkleIcon, StarIcon, UserIcon, WaveIcon,
} from "./SenseiDecor";
import { SenseiSideRail, type RecentLesson } from "./SenseiSideRail";
import { SenseiAvatar, type AvatarEmotion, type AvatarState } from "@/components/SenseiAvatar";
import { SenseiDailyDungeon } from "@/components/SenseiDailyDungeon";
import { N3_KAIWA_SCENARIOS, type KaiwaScenario } from "@/lib/n3KaiwaScenarios";
import { getLocalizedScenario, getLocalizedSenseiGreeting } from "@/lib/senseiLocalization";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { kanaToRomaji } from "@/lib/romajiConverter";
import { SENSEI_CHARACTERS, DEFAULT_SENSEI_ID, type SenseiCharacterId } from "@/lib/senseiCharacters";
import { useSenseiVoice, type VoiceSource } from "@/lib/useSenseiVoice";
import { voiceGenderLabel } from "@/lib/voiceGender";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { FormattedSenseiMessage } from "@/components/ai-sensei/markdownHelper";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  furigana?: string;
  meaning?: string;
  createdAt: string;
}

/** Con dấu đỏ "葵" (hanko) — định danh Sensei trong khung chat. */
function Seal({ className = "", char = "葵" }: { className?: string; char?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 font-jp font-black text-white shadow-sm ring-2 ring-white dark:ring-sumi-900 ${className}`}
    >
      {char}
    </span>
  );
}

const SOURCE_LABEL: Record<VoiceSource, string> = {
  manual: "chọn riêng cho Sensei",
  global: "theo cài đặt âm thanh chung",
  auto: "tự chọn theo giới tính",
};

function MicIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </svg>
  );
}

/** Pill bật/tắt hiển thị (Furigana, Romaji, Dịch nghĩa, Tự đọc) — gọn gàng trên mobile, dễ chạm. */
function Pill({
  on,
  onClick,
  title,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`inline-flex h-8.5 sm:h-10 shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border pl-1 pr-3 sm:pl-1.5 sm:pr-3.5 text-xs sm:text-[13px] font-extrabold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${
        on
          ? "border-transparent bg-gradient-to-r from-[#ff3d6e] to-[#f0245a] text-white shadow-sm sm:shadow-md shadow-rose-500/30"
          : "border-rose-100 bg-white/90 text-slate-700 hover:border-rose-200 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
      }`}
    >
      <span
        className={`grid h-6.5 w-6.5 sm:h-7 sm:w-7 place-items-center rounded-full text-xs ${
          on ? "bg-white/25 text-white" : "bg-rose-50 text-rose-500 dark:bg-rose-950/40"
        }`}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

/** Chân dung tròn của Sensei. Có `character.portrait` thì dùng ảnh, không thì dùng con dấu hanko. */
function SenseiPortrait({
  character,
  className = "h-10 w-10",
}: {
  character: { seal: string; portrait?: string; nameRomaji: string };
  className?: string;
}) {
  if (character.portrait) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={character.portrait}
        alt=""
        className={`shrink-0 rounded-full bg-white object-cover ring-2 ring-white dark:ring-sumi-900 ${className}`}
      />
    );
  }
  return <Seal char={character.seal} className={`${className} text-sm`} />;
}

/** Bỏ emoji và phần chú thích tiếng Việt trong ngoặc để giọng Nhật không đọc lẫn. */
function toSpeechText(raw: string): string {
  const cleaned = raw
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s*[（(][^()（）]*[)）]\s*$/u, (m) => (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(m) ? m : ""))
    .trim();
  return cleaned || raw;
}

const cardShell =
  "rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_14px_40px_-16px_rgba(244,63,94,0.25)] backdrop-blur dark:border-slate-800 dark:bg-sumi-900/85";


interface SenseiKaiwaClientProps {
  /** Bài học gần đây của người học (lấy từ server). Bỏ trống sẽ hiện trạng thái rỗng. */
  recentLessons?: RecentLesson[];
}

export function SenseiKaiwaClient({ recentLessons = [] }: SenseiKaiwaClientProps) {
  const { playClick, playCorrect, speechVoiceURI } = useSoundAndTheme();
  const { progress } = useUserProgress();
  const { nativeLanguage, t } = useNativeLanguage();

  // Main Tab State (Kaiwa vs Dungeon)
  const [activeSenseiTab, setActiveSenseiTab] = useState<"KAIWA" | "DUNGEON">("KAIWA");

  // Selected scenario
  const [selectedScenario, setSelectedScenario] = useState<KaiwaScenario>(() => getLocalizedScenario(N3_KAIWA_SCENARIOS[0], nativeLanguage));

  // Messages in current conversation
  const [messages, setMessages] = useState<Message[]>(() => {
    const sc = getLocalizedScenario(N3_KAIWA_SCENARIOS[0], nativeLanguage);
    return [
      {
        id: "init_1",
        role: "assistant",
        content: sc.initialMessage,
        furigana: sc.initialFurigana,
        meaning: sc.initialMeaning,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("IDLE");
  // Cảm xúc tách riêng khỏi trạng thái nói/nghe, tự về bình thường sau vài giây.
  const [emotion, setEmotion] = useState<AvatarEmotion>("NEUTRAL");
  const emotionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scenarioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashEmotion = useCallback((e: AvatarEmotion, ms = 4500) => {
    if (emotionTimer.current) clearTimeout(emotionTimer.current);
    setEmotion(e);
    if (e !== "NEUTRAL") emotionTimer.current = setTimeout(() => setEmotion("NEUTRAL"), ms);
  }, []);
  const [characterId, setCharacterId] = useState<SenseiCharacterId>(DEFAULT_SENSEI_ID);
  const character = SENSEI_CHARACTERS[characterId];
  // Giọng đọc + khẩu hình theo giới tính của nhân vật (không dùng giọng mặc định của thiết bị).
  const voice = useSenseiVoice(character);
  const isSpeaking = voice.isSpeaking;
  const greetOnSwitch = useRef(false);
  const hasSavedCharacter = useRef(false);
  const derivedFromGlobal = useRef(false);
  const lastGlobalURI = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [showRomaji, setShowRomaji] = useState(true);
  const [showTranslations, setShowTranslations] = useState(true);
  const [autoVoice, setAutoVoice] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.6-flash");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");
  const [tempModelInput, setTempModelInput] = useState("gemini-3.6-flash");


  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>("");

  useEffect(() => {
    setMounted(true);
    return () => {
      if (emotionTimer.current) clearTimeout(emotionTimer.current);
      if (scenarioTimer.current) clearTimeout(scenarioTimer.current);
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* bỏ qua */
      }
    };
  }, []);

  // Nhớ Sensei người học đã chọn
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nihon_sensei_character");
      if (saved && saved in SENSEI_CHARACTERS) {
        setCharacterId(saved as SenseiCharacterId);
        hasSavedCharacter.current = true;
      }
      // Mốc để phân biệt "context vừa nạp giọng đã lưu" với "người học vừa đổi giọng chung".
      lastGlobalURI.current = localStorage.getItem("nq_speech_voice") ?? "";
    } catch {
      lastGlobalURI.current = "";
      /* localStorage bị chặn: dùng mặc định */
    }
  }, []);

  // Load API Key & Model from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("nihon_gemini_key");
      const savedModel = localStorage.getItem("nihon_gemini_model");
      if (savedKey) {
        setApiKey(savedKey);
        setTempKeyInput(savedKey);
      }
      if (savedModel) {
        setSelectedModel(savedModel);
        setTempModelInput(savedModel);
      }
    }
  }, []);

  const handleSaveApiKey = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nihon_gemini_key", tempKeyInput.trim());
      localStorage.setItem("nihon_gemini_model", tempModelInput.trim());
      setApiKey(tempKeyInput.trim());
      setSelectedModel(tempModelInput.trim());
      setIsKeyModalOpen(false);
      playCorrect();
    }
  };

  // Ổn định tham chiếu: Modal chạy lại effect (và đoạt focus) khi onClose đổi,
  // nên nếu truyền arrow inline thì mỗi lần gõ phím sẽ nhảy focus khỏi ô nhập key.
  const closeKeyModal = useCallback(() => setIsKeyModalOpen(false), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Giọng đọc theo giới tính nhân vật. Khẩu hình chạy theo sự kiện của chính utterance
  // (onstart / onboundary / onend), không còn setTimeout ước lượng độ dài.
  const speakJapanese = useCallback(
    (text: string, reading?: string) => {
      if (!text) return;
      voice.speak(text, { reading });
    },
    [voice.speak] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Avatar đang "nói" đúng khi âm thanh thật đang phát.
  useEffect(() => {
    if (voice.isSpeaking) setAvatarState("TALKING");
    else setAvatarState((st) => (st === "TALKING" ? "IDLE" : st));
  }, [voice.isSpeaking]);

  const switchCharacter = (id: SenseiCharacterId, greet: boolean) => {
    if (id === characterId) return;
    try {
      localStorage.setItem("nihon_sensei_character", id);
    } catch {
      /* bỏ qua */
    }
    hasSavedCharacter.current = true;
    greetOnSwitch.current = greet;
    setCharacterId(id);
  };

  const handleSelectCharacter = (id: SenseiCharacterId) => {
    voice.cancel();
    if (id === characterId) return;
    playClick();
    switchCharacter(id, autoVoice);
  };

  // Nhân vật bám theo cài đặt âm thanh chung: chọn giọng nam/nữ ở nút loa trên navbar
  // thì Sensei đổi sang nhân vật cùng giới. Lần đầu vào trang (chưa chọn Sensei nào)
  // cũng lấy theo giọng chung. Đổi Sensei bằng tay không ghi ngược lên cài đặt chung,
  // nên các module khác (flashcard, nghe…) không bị ảnh hưởng.
  const globalGender = voice.globalGender;
  useEffect(() => {
    const prev = lastGlobalURI.current;
    lastGlobalURI.current = speechVoiceURI;
    const userChanged = prev !== null && prev !== "" && prev !== speechVoiceURI;
    const initialDerive = !hasSavedCharacter.current && !derivedFromGlobal.current;
    if (globalGender === "unknown" || (!userChanged && !initialDerive)) return;
    if (hasSavedCharacter.current && !userChanged) return;
    derivedFromGlobal.current = true;
    if (globalGender === character.gender) return;
    const target = Object.values(SENSEI_CHARACTERS).find((c) => c.gender === globalGender);
    if (target) switchCharacter(target.id, userChanged && autoVoice);
  }, [speechVoiceURI, globalGender]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chào bằng giọng mới ngay sau khi đổi Sensei (người học nghe là biết giới tính có khớp không).
  // Effect của hook (cancel giọng cũ) chạy trước effect này trong cùng một lần commit.
  useEffect(() => {
    if (!greetOnSwitch.current) return;
    greetOnSwitch.current = false;
    flashEmotion("HAPPY");
    speakJapanese(character.greeting.ja, character.greeting.reading);
  }, [characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play initial scenario message speech on change if autoVoice is on
  const handleSelectScenario = (sc: KaiwaScenario) => {
    playClick();
    setSelectedScenario(sc);
    setConversationId(null);
    const firstMsg: Message = {
      id: `init_${Date.now()}`,
      role: "assistant",
      content: sc.initialMessage,
      furigana: sc.initialFurigana,
      meaning: sc.initialMeaning,
      createdAt: new Date().toISOString(),
    };
    setMessages([firstMsg]);
    setEmotion("NEUTRAL");
    if (scenarioTimer.current) clearTimeout(scenarioTimer.current);
    if (autoVoice) {
      scenarioTimer.current = setTimeout(() => speakJapanese(sc.initialMessage, sc.initialFurigana), 300);
    }
  };

  // Web Speech Recognition (Microphone STT) - Accumulate speech without overwriting
  const toggleListening = () => {
    playClick();

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setAvatarState("IDLE");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói. Bạn có thể gõ phím để trò chuyện!");
      return;
    }

    voice.cancel(); // không để giọng Sensei lọt vào micro
    // Save current text in input as base so new speech appends rather than overwrites
    baseInputRef.current = input.trim();

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ja-JP";
      recognition.continuous = true; // Continuous listening across pauses
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setAvatarState("LISTENING");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");

        const base = baseInputRef.current;
        const combined = base ? `${base} ${transcript}` : transcript;
        setInput(combined);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setAvatarState("IDLE");
      };

      recognition.onend = () => {
        setIsListening(false);
        setAvatarState("IDLE");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setAvatarState("IDLE");
    }
  };

  // Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput("");
    playClick();

    const matched = selectedScenario.suggestedReplies.find(
      (r) => r.ja.trim() === text.trim()
    );

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      furigana: matched?.furigana,
      meaning: matched?.vi,
      createdAt: new Date().toISOString(),
    };

    const historyPayload = messages.slice(-14).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setEmotion("NEUTRAL");
    voice.cancel();
    setAvatarState("THINKING");

    try {
      const activeKey =
        apiKey?.trim() ||
        (typeof window !== "undefined" ? localStorage.getItem("nihon_gemini_key")?.trim() : "") ||
        undefined;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined,
          history: historyPayload,
          scenarioId: selectedScenario.id,
          nativeLanguage: nativeLanguage,
          apiKey: activeKey,
          model: selectedModel || "gemini-2.5-flash",
          userProgress: progress
            ? {
                userLevel: progress.learningLevel,
                level: progress.level,
                totalXP: progress.totalXP,
                currentStreak: progress.currentStreak,
                completedLessonsCount: progress.stats?.completedLessonsCount,
                totalLessonsInLevel: progress.stats?.totalLessonsInLevel,
                dueReviewCount: progress.stats?.dueReviewCount,
                accuracyPercent: progress.stats?.reviewAccuracy ?? 100,
                stats: progress.stats,
              }
            : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (data?.conversationId) {
        setConversationId(data.conversationId);
      }
      if (res.ok && data?.message?.content) {
        const aiContent: string = data.message.content;
        const aiMsg: Message = {
          id: data.message.id || `ai_${Date.now()}`,
          role: "assistant",
          content: aiContent,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, aiMsg]);
        playCorrect();
        setAvatarState("IDLE");
        flashEmotion("HAPPY");
        if (autoVoice) speakJapanese(toSpeechText(aiContent));
      } else {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
    } catch {
      // Lỗi mạng / API: báo rõ cho người học thay vì im lặng, Sensei tỏ vẻ lo lắng.
      const fallbackMsg: Message = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: "ごめんなさい、うまく聞こえませんでした。もう一度言ってもらえますか？",
        meaning: t("senseiError"),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setAvatarState("IDLE");
      flashEmotion("WORRIED", 5000);
    } finally {
      setLoading(false);
      setAvatarState((st) => (st === "THINKING" ? "IDLE" : st));
    }
  };

  // Lưu chủ đề yêu thích ("Đã lưu") — chỉ lưu trên trình duyệt.
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const closeGrammarModal = useCallback(() => setGrammarOpen(false), []);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const closeTopicModal = useCallback(() => setIsTopicModalOpen(false), []);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nihon_sensei_saved_scenarios");
      if (raw) setSavedIds(JSON.parse(raw));
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isSaved = savedIds.includes(selectedScenario.id);
  const toggleSaved = () => {
    playClick();
    const next = isSaved ? savedIds.filter((id) => id !== selectedScenario.id) : [...savedIds, selectedScenario.id];
    setSavedIds(next);
    try {
      localStorage.setItem("nihon_sensei_saved_scenarios", JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
  };

  // ── Dữ liệu dẫn xuất cho giao diện (không ảnh hưởng logic) ──
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const isVi = nativeLanguage === "vi";
  const statusLabel = loading
    ? (t("senseiThinking") || "Đang soạn câu trả lời...")
    : isSpeaking
    ? (isVi ? "Đang nói..." : "Speaking...")
    : isListening
    ? (t("senseiListening") || "Đang lắng nghe...")
    : (isVi ? "Đang online" : "Online");
  const statusDot = loading ? "bg-amber-500" : isSpeaking ? "bg-rose-500" : isListening ? "bg-violet-500" : "bg-emerald-500";

  // Câu thoại của Sensei trong bong bóng — là text thật, đổi theo trạng thái.
  const bubble = loading
    ? { ja: "少し考えますね…", vi: isVi ? `Để ${character.viRef} suy nghĩ một chút nhé…` : "Let me think for a moment…" }
    : isListening
    ? { ja: "どうぞ、聞いていますよ。", vi: isVi ? `Mời em nói, ${character.viRef} đang nghe đây.` : "Please speak, I'm listening." }
    : isSpeaking
    ? { ja: "よく聞いてくださいね。", vi: isVi ? "Em nghe kỹ nhé." : "Listen carefully." }
    : emotion === "HAPPY"
    ? { ja: "いいですね！その調子！", vi: isVi ? "Rất tốt! Cứ thế phát huy nhé!" : "Great job! Keep it up!" }
    : emotion === "WORRIED"
    ? { ja: "もう一度お願いします。", vi: isVi ? "Em thử lại một lần nữa nhé." : "Please try again." }
    : { ja: "今日は何を話しましょうか？", vi: isVi ? "Hôm nay chúng ta nói về chủ đề gì nhỉ?" : "What shall we talk about today?" };

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500";

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      {/* ── Chuyển chế độ: Kaiwa / Daily Dungeon ── */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={t("senseiTitle")}
          className="inline-flex rounded-full border border-white/80 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-sumi-900/80"
        >
          {(
            [
              { id: "KAIWA", label: "AI Kaiwa", icon: "chat" },
              { id: "DUNGEON", label: "Daily Dungeon", icon: "flame" },
            ] as const
          ).map((t) => {
            const on = activeSenseiTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  playClick();
                  setActiveSenseiTab(t.id);
                }}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-extrabold transition ${focusRing} ${
                  on
                    ? "bg-gradient-to-r from-[#ff3d6e] to-[#f0245a] text-white shadow-sm shadow-rose-500/30"
                    : "text-slate-600 hover:text-rose-600 dark:text-slate-300"
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeSenseiTab === "DUNGEON" ? (
        <SenseiDailyDungeon />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start xl:grid-cols-[320px_minmax(0,1fr)_300px]">
            {/* ═════════ CỘT TRÁI — SENSEI ═════════ */}
            <section aria-label={character.nameRomaji} className={`overflow-hidden ${cardShell}`}>
              {/* Avatar chuyển động dựng từ ảnh (ảnh đã có sẵn nền lớp học) */}
              <div className="relative h-[180px] sm:h-[260px] md:h-[290px] overflow-hidden bg-rose-50 dark:bg-sumi-800">
                <SenseiAvatar
                  state={avatarState}
                  emotion={emotion}
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  size={260}
                  character={character}
                  viseme={voice.viseme}
                  className="absolute inset-0"
                />
                <span className="absolute left-3 top-3 z-10 inline-flex max-w-[60%] items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} />
                  <span className="truncate" role="status" aria-live="polite">{statusLabel}</span>
                </span>
                <span className="absolute right-3 top-3 z-10 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 shadow-sm">
                  JLPT N3
                </span>
              </div>

              {/* Thân thẻ — mép trên bo cong đè lên ảnh */}
              <div className="relative -mt-7 rounded-t-[2rem] bg-white px-4 pb-4 pt-4 dark:bg-sumi-900">
                <div className="flex items-center gap-3">
                  <SakuraFlower className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-baseline gap-x-2">
                      <span lang="ja" className="font-jp text-base font-black text-slate-900 dark:text-white">
                        {character.nameJa}
                      </span>
                      <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{character.nameRomaji}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("senseiTeacherTitle")}</p>
                  </div>
                </div>

                {/* Bong bóng thoại */}
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-sumi-800">
                  <div className="min-w-0 flex-1">
                    <p lang="ja" className="font-jp text-[14px] font-bold leading-snug text-slate-900 dark:text-white">
                      「{bubble.ja}」
                    </p>
                    {showTranslations && (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{bubble.vi}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      speakJapanese(bubble.ja);
                    }}
                    aria-label="Nghe câu Sensei vừa nói"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:bg-rose-950/40 ${focusRing}`}
                  >
                    <WaveIcon className={`h-5 w-5 ${isSpeaking ? "motion-safe:animate-pulse" : ""}`} />
                  </button>
                </div>

                {/* Hành động nhanh */}
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={toggleListening}
                    aria-pressed={isListening}
                    className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#ff3d6e] to-[#f0245a] px-3 text-left text-white shadow-md shadow-rose-500/30 transition hover:brightness-105 ${focusRing}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/25">
                      <MicIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13px] font-extrabold">
                        {isListening ? t("senseiStopListening") : t("senseiSpeakToSensei")}
                      </span>
                      <span className="block text-[10px] opacity-90">{isListening ? t("senseiRecording") : t("senseiVoiceLabel")}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!lastAssistant}
                    onClick={() => {
                      if (!lastAssistant) return;
                      playClick();
                      speakJapanese(lastAssistant.content, lastAssistant.furigana);
                    }}
                    className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 text-left shadow-sm transition hover:border-rose-200 disabled:opacity-50 dark:border-slate-700 dark:bg-sumi-800 ${focusRing}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-sumi-900 dark:text-slate-300">
                      <Icon name="speaker" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13px] font-extrabold text-slate-800 dark:text-white">{t("senseiVoiceListenAgain")}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">{t("senseiRecentLine")}</span>
                    </span>
                  </button>
                </div>

                {/* Nút cuộn nhanh tới khung chat trên mobile */}
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("sensei-chat-box")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 active:scale-98 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 lg:hidden"
                >
                  <Icon name="chat" className="h-4 w-4" />
                  <span>{t("senseiJumpToChat")} ↓</span>
                </button>

                {/* Chọn Sensei */}
                <p className="mt-4 text-[11px] font-extrabold tracking-wide text-slate-500 dark:text-slate-400">{t("senseiSelectTeacher")}</p>
                <div role="radiogroup" aria-label="Chọn giáo viên và giọng đọc" className="mt-2 grid grid-cols-2 gap-2.5">
                  {Object.values(SENSEI_CHARACTERS).map((c) => {
                    const on = c.id === characterId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => handleSelectCharacter(c.id)}
                        className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition ${focusRing} ${
                          on
                            ? "bg-gradient-to-r from-[#ff3d6e] to-[#f0245a] text-white shadow-md shadow-rose-500/30"
                            : "bg-slate-100/80 text-slate-800 hover:bg-slate-100 dark:bg-sumi-800 dark:text-slate-200"
                        }`}
                      >
                        <SenseiPortrait character={c} className="h-9 w-9" />
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-[13px] font-extrabold">{c.nameRomaji}</span>
                          <span className={`block text-[10px] ${on ? "opacity-90" : "text-slate-500 dark:text-slate-400"}`}>
                            {c.gender === "female" ? t("senseiFemale") : t("senseiMale")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Giọng đọc đang dùng (bấm để mở chi tiết / đổi thủ công) */}
                <button
                  type="button"
                  onClick={() => setVoicePanelOpen((v) => !v)}
                  aria-expanded={voicePanelOpen}
                  className={`mt-4 flex w-full items-center gap-3 rounded-2xl bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100/70 dark:bg-amber-950/25 ${focusRing}`}
                >
                  <BulbIcon className="h-8 w-8 shrink-0 text-amber-400" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {!mounted
                        ? "Đang khởi tạo giọng đọc..."
                        : !voice.supported
                        ? "Trình duyệt chưa hỗ trợ giọng đọc"
                        : voice.activeVoice
                        ? voice.activeVoice.name
                        : "Chưa tìm thấy giọng tiếng Nhật"}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {mounted && voice.supported && voice.activeVoice
                        ? `${SOURCE_LABEL[voice.source]} · ${voice.speechRate}x`
                        : "Từ vựng, hội thoại, ngữ pháp, luyện phản xạ."}
                    </span>
                  </span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${voicePanelOpen ? "rotate-90" : ""}`} />
                </button>

                {voicePanelOpen && mounted && (
                  <div className="mt-2 space-y-2 rounded-2xl border border-amber-100 bg-white p-3 text-[11px] text-slate-600 dark:border-amber-900/40 dark:bg-sumi-800 dark:text-slate-300">
                    {!voice.supported ? (
                      <p className="text-amber-700 dark:text-amber-400">
                        Trình duyệt này không hỗ trợ giọng đọc. Hãy thử Chrome, Edge hoặc Safari.
                      </p>
                    ) : (
                      <>
                        {!voice.exactMatch && voice.activeVoice && (
                          <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                            Thiết bị chưa có giọng {character.genderLabel.toLowerCase()} tiếng Nhật riêng, nên hệ thống{" "}
                            {character.gender === "male" ? "hạ" : "nâng"} tông giọng sẵn có (pitch{" "}
                            {character.voice.fallbackPitch}) để phân biệt thầy Ren và cô Aoi.
                          </p>
                        )}
                        {voice.voices.length > 0 && (
                          <>
                            <label htmlFor="sensei-voice" className="block font-bold">
                              Đổi giọng đọc thủ công
                            </label>
                            <select
                              id="sensei-voice"
                              value={voice.selectedURI ?? ""}
                              onChange={(e) => voice.setVoiceURI(e.target.value || null)}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-sumi-950 dark:text-slate-200 sm:text-xs"
                            >
                              <option value="">{t("senseiVoiceAuto")}</option>
                              {voice.voices.map((v) => (
                                <option key={v.uri} value={v.uri}>
                                  {v.name} ({voiceGenderLabel(v.guess)})
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ═════════ CỘT GIỮA — HỘI THOẠI ═════════ */}
            <div className="flex min-w-0 flex-col gap-3">
              <section
                id="sensei-chat-box"
                aria-label={`Hội thoại với ${character.nameRomaji}`}
                className={`flex h-[560px] sm:h-[680px] flex-col overflow-hidden p-3 sm:p-4 lg:h-[min(840px,calc(100dvh-7rem))] lg:min-h-[640px] ${cardShell}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 sm:pb-3 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsTopicModalOpen(true)}
                      title={t("senseiChangeTopic")}
                      className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-xl sm:text-2xl transition hover:scale-105 hover:bg-rose-100 active:scale-95 dark:bg-rose-950/40"
                    >
                      {selectedScenario.icon || <BriefcaseIcon className="h-5 w-5 text-rose-500" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h2 className="truncate text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {selectedScenario.title}
                        </h2>
                        <button
                          type="button"
                          onClick={() => setIsTopicModalOpen(true)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95 dark:bg-rose-950/50 dark:text-rose-300"
                          title={t("senseiChangeTopic")}
                        >
                          <span>{t("senseiChangeTopic")}</span>
                          <ChevronRight className="h-3 w-3 rotate-90" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">{t("senseiWithTeacher", { name: character.nameRomaji })}</span>
                        <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot}`} />
                        <span className="truncate text-[10px] sm:text-[11px]" role="status" aria-live="polite">{statusLabel}</span>
                        {!voice.hasJapaneseVoice && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-700 dark:text-amber-300 font-bold"
                            title="Thiết bị chưa có giọng Nhật offline. Đang dùng Cloud TTS trực tuyến."
                          >
                            Cloud TTS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {voice.isSpeaking && (
                      <button
                        type="button"
                        onClick={() => {
                          voice.cancel();
                          playClick();
                        }}
                        className="inline-flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full border border-red-300 bg-red-50 text-red-600 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold transition hover:bg-red-100 active:scale-95 animate-pulse"
                        title="Dừng âm thanh Sensei ngay lập tức"
                      >
                        <span className="text-xs">⏹️</span>
                        <span>Dừng nói</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleSaved}
                      aria-pressed={isSaved}
                      className={`inline-flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full border px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold transition active:scale-95 ${focusRing} ${
                        isSaved
                          ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300"
                      }`}
                    >
                      <StarIcon className="h-3.5 w-3.5" filled={isSaved} />
                      <span className="hidden xs:inline">{isSaved ? t("vocabSavedBtn") : t("vocabSaveBtn")}</span>
                    </button>

                    <div className="relative" ref={menuRef}>
                      <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-label="Thêm tuỳ chọn"
                        className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95 dark:hover:bg-sumi-800 ${focusRing}`}
                      >
                        <KebabIcon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-sumi-800"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              setIsTopicModalOpen(true);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-rose-50 dark:text-slate-200 dark:hover:bg-sumi-900"
                          >
                            <SparkleIcon className="h-4 w-4 text-rose-500" />
                            Đổi chủ đề đàm thoại
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              handleSelectScenario(selectedScenario);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-rose-50 dark:text-slate-200 dark:hover:bg-sumi-900"
                          >
                            <Icon name="refresh" className="h-4 w-4 text-slate-500" />
                            Bắt đầu lại cuộc thoại
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              setTempKeyInput(apiKey);
                              setIsKeyModalOpen(true);
                              playClick();
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-rose-50 dark:text-slate-200 dark:hover:bg-sumi-900"
                          >
                            <Icon name="settings" className="h-4 w-4 text-slate-500" />
                            <span className="flex-1">{apiKey ? t("senseiAiKeySet") : t("senseiAiKey")}</span>
                            {apiKey && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tuỳ chọn hiển thị */}
                <div
                  role="group"
                  aria-label="Tùy chọn hiển thị"
                  className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-2 sm:py-3"
                >
                  <Pill
                    on={showFurigana}
                    onClick={() => {
                      setShowFurigana(!showFurigana);
                      playClick();
                    }}
                    title={t("senseiFuriganaToggle")}
                    icon={<span lang="ja" className="font-jp font-black">あ</span>}
                  >
                    Furigana
                  </Pill>
                  <Pill
                    on={showRomaji}
                    onClick={() => {
                      setShowRomaji(!showRomaji);
                      playClick();
                    }}
                    title={t("senseiRomajiToggle")}
                    icon={<span className="text-[11px] font-black">Aa</span>}
                  >
                    Romaji
                  </Pill>
                  <Pill
                    on={showTranslations}
                    onClick={() => {
                      setShowTranslations(!showTranslations);
                      playClick();
                    }}
                    title={t("senseiTranslationToggle")}
                    icon={<span className="text-[11px] font-black uppercase">{nativeLanguage.split("-")[0]}</span>}
                  >
                    Dịch nghĩa
                  </Pill>
                  <Pill
                    on={autoVoice}
                    onClick={() => {
                      setAutoVoice(!autoVoice);
                      playClick();
                    }}
                    title={t("senseiAutoVoiceToggle")}
                    icon={<Icon name="speaker" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  >
                    {autoVoice ? t("senseiAutoSpeechOn") : t("senseiAutoSpeechOff")}
                  </Pill>
                </div>

                {/* Tin nhắn */}
                <div className="min-h-0 flex-1 space-y-3 sm:space-y-4 overflow-y-auto rounded-2xl border border-slate-100 bg-white/70 p-2.5 sm:p-4 dark:border-slate-800 dark:bg-sumi-950/40">
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    const romaji = showRomaji ? kanaToRomaji(msg.furigana || msg.content) : "";
                    return isUser ? (
                      <div key={msg.id} className="flex justify-end items-end gap-2">
                        <div className="relative max-w-[85%] rounded-2xl rounded-br-sm bg-[#1c2745] px-3.5 py-2.5 text-white shadow-md sm:max-w-[75%] sm:px-4 sm:py-3">
                          <p lang="ja" className="whitespace-pre-wrap font-jp text-[14px] sm:text-[15px] font-medium leading-relaxed">
                            {msg.content}
                          </p>
                          {showFurigana && msg.furigana && (
                            <p className="mt-0.5 font-jp text-xs text-slate-300">{msg.furigana}</p>
                          )}
                          {romaji && <p className="mt-0.5 text-xs text-slate-300">{romaji}</p>}
                          {showTranslations && msg.meaning && (
                            <p className="mt-1.5 border-t border-white/15 pt-1.5 text-xs text-slate-200">{msg.meaning}</p>
                          )}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                            <DoubleCheckIcon className="h-3.5 w-3.5 text-rose-300" />
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className="hidden sm:grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600 mb-1"
                        >
                          <UserIcon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex items-start gap-2 sm:gap-3">
                        <SenseiPortrait character={character} className="mt-0.5 h-8 w-8 sm:h-10 sm:w-10" />
                        <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm dark:border-slate-700 dark:bg-sumi-800 sm:px-4 sm:py-3">
                          <div lang="ja" className="font-jp text-[14px] sm:text-[15px] font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                            <FormattedSenseiMessage content={msg.content} />
                          </div>
                          {(romaji || (showFurigana && msg.furigana)) && (
                            <p className="mt-1 text-xs leading-relaxed text-sky-700 dark:text-sky-300">
                              {romaji}
                              {romaji && showFurigana && msg.furigana ? " " : ""}
                              {showFurigana && msg.furigana && <span lang="ja" className="font-jp">{msg.furigana}</span>}
                            </p>
                          )}
                          {showTranslations && msg.meaning && (
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {msg.meaning.startsWith("(") ? msg.meaning : `(${msg.meaning})`}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              speakJapanese(msg.content, msg.furigana);
                            }}
                            className={`mt-2 inline-flex h-7 sm:h-8 items-center gap-1.5 rounded-full bg-rose-50 px-2.5 sm:px-3 text-[11px] font-extrabold text-rose-600 transition hover:bg-rose-100 active:scale-95 dark:bg-rose-950/40 dark:text-rose-300 ${focusRing}`}
                          >
                            <Icon name="speaker" className="h-3.5 w-3.5" />
                            <span>Nghe lại</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <SenseiPortrait character={character} className="h-8 w-8 sm:h-10 sm:w-10 motion-safe:animate-pulse" />
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-sumi-800">
                        <span aria-hidden="true" className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 motion-safe:animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 motion-safe:animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 motion-safe:animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                        Sensei đang suy nghĩ câu trả lời...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Trả lời nhanh */}
                {!loading && selectedScenario.suggestedReplies.length > 0 && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                        <SparkleIcon className="h-3 w-3 text-rose-500" />
                        Gợi ý đối đáp nhanh:
                      </span>
                      <span className="text-[10px] text-slate-400">{t("senseiTapToSend")}</span>
                    </div>
                    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1" aria-label="Gợi ý trả lời nhanh">
                      {selectedScenario.suggestedReplies.map((reply, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(reply.ja)}
                          title={reply.vi}
                          className={`group flex max-w-[260px] sm:max-w-[280px] shrink-0 items-center justify-between gap-2 rounded-2xl border border-rose-100 bg-white/90 px-3 py-1.5 text-left shadow-xs transition hover:border-rose-300 hover:bg-rose-50 active:scale-95 dark:border-slate-700 dark:bg-sumi-800 dark:hover:bg-rose-950/30 ${focusRing}`}
                        >
                          <div className="min-w-0">
                            <span lang="ja" className="block truncate font-jp text-xs font-bold text-slate-800 dark:text-slate-200">
                              {reply.ja}
                            </span>
                            <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">{reply.vi}</span>
                          </div>
                          <SendIcon className="h-3.5 w-3.5 shrink-0 text-rose-400 opacity-60 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ô nhập */}
                <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-full border border-slate-200 bg-white p-1 sm:p-1.5 shadow-sm transition focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/20 dark:border-slate-700 dark:bg-sumi-950">
                  <button
                    type="button"
                    onClick={toggleListening}
                    aria-pressed={isListening}
                    aria-label={isListening ? "Đang thu âm — nhấn để dừng" : "Nói tiếng Nhật bằng micro"}
                    title={isListening ? "Đang thu âm... Nhấn để dừng" : "Nhấn để nói tiếng Nhật (Micro)"}
                    className={`grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full transition active:scale-95 ${focusRing} ${
                      isListening
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 motion-safe:animate-pulse"
                        : "bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-950/40"
                    }`}
                  >
                    <MicIcon className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    aria-label="Nhập câu tiếng Nhật"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="send"
                    placeholder={
                      isListening
                        ? "Sensei đang nghe..."
                        : "Nhập câu tiếng Nhật hoặc bấm mic..."
                    }
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 font-jp text-[14px] sm:text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white sm:text-sm"
                  />

                  {input.trim() && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      aria-label="Xoá nội dung vừa nhập"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-90 dark:hover:bg-sumi-800"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || loading}
                    aria-label="Gửi tin nhắn"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-r from-[#ff3d6e] to-[#f0245a] text-white shadow-md shadow-rose-500/25 transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:h-11 sm:w-auto sm:px-5 sm:inline-flex sm:items-center sm:gap-2 sm:rounded-full ${focusRing}`}
                  >
                    <span className="hidden sm:inline text-xs sm:text-sm font-black">{t("senseiSend")}</span>
                    <SendIcon className="h-4 w-4" />
                  </button>
                </div>
              </section>

              {/* Gợi ý chủ đề nhanh (đặt bên ngoài khung chat để không chiếm diện tích tin nhắn) */}
              <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-xs backdrop-blur dark:border-slate-800 dark:bg-sumi-900/75">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    <SparkleIcon className="h-3.5 w-3.5 text-rose-500" />
                    Chủ đề đàm thoại hôm nay
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsTopicModalOpen(true)}
                    className="text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Xem tất cả ({N3_KAIWA_SCENARIOS.length}) ↗
                  </button>
                </div>
                <div className="no-scrollbar flex items-stretch gap-2 overflow-x-auto pb-1">
                  {N3_KAIWA_SCENARIOS.map((rawSc) => {
                    const sc = getLocalizedScenario(rawSc, nativeLanguage);
                    const on = selectedScenario.id === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => handleSelectScenario(sc)}
                        aria-pressed={on}
                        className={`flex min-w-[170px] shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${focusRing} ${
                          on
                            ? "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30"
                            : "border-slate-100 bg-white hover:border-rose-200 dark:border-slate-700 dark:bg-sumi-800"
                        }`}
                      >
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">{sc.title}</span>
                          <span lang="ja" className="block truncate font-jp text-[10px] text-slate-500 dark:text-slate-400">
                            {sc.titleJa}
                          </span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═════════ CỘT PHẢI ═════════ */}
            <div className="lg:col-span-2 xl:col-span-1">
              <SenseiSideRail
                grammarPatterns={selectedScenario.keyGrammar.map((g) => g.pattern)}
                onOpenGrammar={() => {
                  playClick();
                  setGrammarOpen(true);
                }}
                recentLessons={recentLessons}
              />
            </div>
          </div>

          {/* Mẫu câu N3 trọng tâm (mở từ "Ngữ pháp hôm nay") */}
          <Modal isOpen={grammarOpen} onClose={closeGrammarModal} title={t("senseiKeyGrammarModalTitle")} maxWidth="md">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedScenario.keyGrammar.map((g, idx) => (
                <li key={idx} className="py-3 first:pt-0 last:pb-0">
                  <span lang="ja" className="block font-jp text-base font-bold text-slate-900 dark:text-white">
                    {g.pattern}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{g.meaning}</span>
                </li>
              ))}
            </ul>
          </Modal>

          {/* Modal Chọn chủ đề đàm thoại N3 */}
          <Modal isOpen={isTopicModalOpen} onClose={closeTopicModal} title={t("senseiChooseScenarioTitle")} maxWidth="lg">
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t("senseiChooseScenarioSub", { name: character.nameRomaji })}
              </p>
              <div className="no-scrollbar max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                {N3_KAIWA_SCENARIOS.map((rawSc) => {
                  const sc = getLocalizedScenario(rawSc, nativeLanguage);
                  const on = selectedScenario.id === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        handleSelectScenario(sc);
                        closeTopicModal();
                      }}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${focusRing} ${
                        on
                          ? "border-rose-400 bg-rose-50/80 shadow-sm dark:border-rose-700 dark:bg-rose-950/40"
                          : "border-slate-100 bg-white hover:border-rose-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-sumi-800 dark:hover:bg-sumi-700"
                      }`}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-2xl shadow-sm dark:bg-sumi-900">
                        {sc.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="truncate text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                            {sc.title}
                          </h3>
                          {on && (
                            <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              Đang chọn
                            </span>
                          )}
                        </div>
                        <p lang="ja" className="font-jp text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {sc.titleJa}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {sc.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-sumi-900 dark:text-slate-300">
                            {sc.badge}
                          </span>
                          {sc.keyGrammar.slice(0, 2).map((g, gi) => (
                            <span key={gi} className="rounded-md bg-rose-50 px-1.5 py-0.5 font-jp text-[10px] font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
                              {g.pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Modal>


          {/* API Key Modal (dùng Modal chung: focus trap, Escape, khóa cuộn nền) */}
          <Modal isOpen={isKeyModalOpen} onClose={closeKeyModal} title="Cấu hình Google Gemini AI Key" maxWidth="md">
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Nhập Google Gemini API Key để mở khóa toàn bộ trí thông minh đàm thoại tiếng Nhật (Gemini 1.5 Flash), nói chuyện tự do mọi chủ đề. Khóa được lưu trực tiếp trên trình duyệt của bạn.
              </p>

              <div className="space-y-2">
                <label htmlFor="nq-ai-keys" className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>API Key (Hỗ trợ Bể nhiều Key & Đa nền tảng):</span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{t("senseiAiKeyAutoRotate")}</span>
                </label>
                <textarea
                  id="nq-ai-keys"
                  rows={3}
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  placeholder="Dán 1 hoặc nhiều Gemini Key (AIzaSy...), Groq Key (gsk_...), OpenRouter Key (sk-or-)... Mỗi key 1 dòng hoặc cách nhau bằng dấu phẩy"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-sumi-950 dark:text-white sm:text-xs"
                />
                <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                  <strong>Mẹo:</strong> Bạn có thể tạo 2-3 Google Gemini key từ các tài khoản Google khác nhau và dán vào đây để hệ thống tự luân phiên, không bao giờ lo bị nghẽn!
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="nq-ai-model" className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Chọn Mô hình AI (Gemini 3 / Groq):</span>
                  <span className="text-[10px] font-normal text-amber-600">{t("senseiAiKeyAutoModel")}</span>
                </label>
                <select
                  id="nq-ai-model"
                  value={tempModelInput}
                  onChange={(e) => setTempModelInput(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-sumi-950 dark:text-slate-200 sm:text-xs"
                >
                  <option value="gemini-3.6-flash">⚡ Gemini 3.6 Flash (Chính thức từ Google - Khuyên dùng)</option>
                  <option value="gemini-3.6-flash-preview">🧪 Gemini 3.6 Flash Preview</option>
                  <option value="gemini-3.8-flash">🚀 Gemini 3.8 Flash (Tốc độ cao)</option>
                  <option value="gemini-3.6-pro">🌟 Gemini 3.6 Pro (Chuyên sâu cao cấp)</option>
                </select>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-sumi-950 dark:text-slate-300">
                <div className="flex items-center gap-1 font-bold">
                  <Icon name="bulb" className="h-3.5 w-3.5 text-amber-500" />
                  <span>Nơi lấy API Key miễn phí không giới hạn:</span>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px]">
                  <li>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-red-600 underline hover:opacity-80 dark:text-red-400"
                    >
                      Google AI Studio (Gemini 3.6 Flash miễn phí) ↗
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-red-600 underline hover:opacity-80 dark:text-red-400"
                    >
                      Groq Cloud (gsk_... 14,400 lượt/ngày cực nhanh) ↗
                    </a>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-1">
                {apiKey ? (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("nihon_gemini_key");
                      setApiKey("");
                      setTempKeyInput("");
                      setIsKeyModalOpen(false);
                    }}
                    className="text-xs font-bold text-rose-500 hover:underline"
                  >
                    Xóa Key đã lưu
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">{t("senseiAiKeyNotConfigured")}</span>
                )}

                <div className="flex items-center gap-2">
                  <Button onClick={closeKeyModal} variant="ghost" size="sm" className="text-xs">
                    Đóng
                  </Button>
                  <Button onClick={handleSaveApiKey} variant="brand" size="sm" className="text-xs font-black">
                    Lưu Key
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}