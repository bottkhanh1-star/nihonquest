"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage, SUPPORTED_LANGUAGES, type NativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import { FormattedSenseiMessage } from "./markdownHelper";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultItem>>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getLocalizedGreeting(
  lang: NativeLanguage,
  level: string,
  streak: number,
  dueCards: number
): string {
  switch (lang) {
    case "en":
      return `Konnichiwa! I'm Aoi Sensei, your personal Japanese learning assistant 🌸\n\nI see you are on **JLPT ${level}** with a **${streak}-day streak** 🔥\n${
        dueCards > 0
          ? `⏰ You have **${dueCards} SRS flashcards** ready for review today!`
          : "✨ Great job! No pending SRS cards today."
      }\n\nAsk me anything! I can give daily study guidance, diagnose and fix your mistakes, or practice voice conversation! 🎙️`;
    case "zh-CN":
      return `Konnichiwa！我是 Aoi Sensei，你在 Nihon Quest 的专属日语学习导师 🌸\n\n我看到你目前正在学习 **JLPT ${level}**，已保持 **${streak} 天连续打卡** 🔥\n${
        dueCards > 0
          ? `⏰ 今天有 **${dueCards} 张 SRS 复习卡片** 到期需要复习！`
          : "✨ 太棒了！今天没有积压的复习卡片。"
      }\n\n你可以随时向我提问学习规划、分析错题与弱点，或者点击麦克风 🎙️ 一起练习日语实战会话！`;
    case "zh-TW":
      return `Konnichiwa！我是 Aoi Sensei，你在 Nihon Quest 的專屬日語學習導師 🌸\n\n我看到你目前正在學習 **JLPT ${level}**，已保持 **${streak} 天連續打卡** 🔥\n${
        dueCards > 0
          ? `⏰ 今天有 **${dueCards} 張 SRS 複習卡片** 到期需要複習！`
          : "✨ 太棒了！今天沒有積壓的複習卡片。"
      }\n\n你可以隨時向我提問學習規劃、分析錯題與弱點，或者點擊麥克風 🎙️ 一起練習日語實戰會話！`;
    case "ko":
      return `Konnichiwa! Aoi Sensei입니다 🌸 Nihon Quest에서 여러분의 맞춤형 일본어 학습을 도와드릴게요.\n\n현재 **JLPT ${level}**, 연속 **${streak}일 스트릭** 유지 중이시네요 🔥\n${
        dueCards > 0
          ? `⏰ 오늘 복습 대기 중인 **SRS 단어 카드가 ${dueCards}장** 있습니다!`
          : "✨ 훌륭해요! 오늘 밀린 복습 카드가 없습니다."
      }\n\n오늘의 공부 계획, 틀린 문제 교정, 또는 마이크 🎙️를 눌러 일본어 회화를 연습해 보세요!`;
    case "es":
      return `¡Konnichiwa! Soy Aoi Sensei, tu asistente personal de aprendizaje en Nihon Quest 🌸\n\nVeo que estás en **JLPT ${level}** con una racha de **${streak} días** 🔥\n${
        dueCards > 0
          ? `⏰ ¡Tienes **${dueCards} tarjetas SRS** pendientes de repaso hoy!`
          : "✨ ¡Genial! No tienes tarjetas pendientes hoy."
      }\n\n¡Pregúntame sobre tu plan de estudio, pide ayuda con tus errores o pulsa el micrófono 🎙️ para practicar conversación!`;
    case "fr":
      return `Konnichiwa ! Je suis Aoi Sensei, votre assistante personnelle de japonais 🌸\n\nVous êtes actuellement au niveau **JLPT ${level}** avec une série de **${streak} jours** 🔥\n${
        dueCards > 0
          ? `⏰ Vous avez **${dueCards} cartes SRS** à réviser aujourd'hui !`
          : "✨ Bravo ! Aucune carte en attente aujourd'hui."
      }\n\nPosez-moi des questions sur vos leçons, vos erreurs ou activez le micro 🎙️ pour vous entraîner à l'oral !`;
    case "de":
      return `Konnichiwa! Ich bin Aoi Sensei, deine persönliche Japanisch-Lernassistentin 🌸\n\nDu lernst aktuell für **JLPT ${level}** mit einer Serie von **${streak} Tagen** 🔥\n${
        dueCards > 0
          ? `⏰ Du hast heute **${dueCards} SRS-Karten** zur Wiederholung fällig!`
          : "✨ Großartig! Heute sind keine Karten offen."
      }\n\nFrag mich nach deinem Lernplan, Fehlern oder nutze das Mikrofon 🎙️ für japanische Konversation!`;
    case "id":
      return `Konnichiwa! Saya Aoi Sensei, asisten belajar bahasa Jepang Anda 🌸\n\nSaya melihat Anda belajar di **JLPT ${level}** dengan runtutan **${streak} hari** 🔥\n${
        dueCards > 0
          ? `⏰ Ada **${dueCards} kartu SRS** yang perlu diulas hari ini!`
          : "✨ Luar biasa! Tidak ada kartu tertunda hari ini."
      }\n\nTanyakan apa saja tentang rencana belajar, analisis kesalahan, atau tekan mikrofon 🎙️ untuk latihan percakapan!`;
    case "th":
      return `Konnichiwa! ฉันคือ Aoi Sensei ผู้ช่วยส่วนตัวสำหรับการเรียนภาษาญี่ปุ่นของคุณ 🌸\n\nคุณกำลังเรียนระดับ **JLPT ${level}** และรักษาสถิติต่อเนื่อง **${streak} วัน** 🔥\n${
        dueCards > 0
          ? `⏰ มีการ์ดคำศัพท์ SRS **${dueCards} ใบ** ที่ต้องทบทวนวันนี้!`
          : "✨ ยอดเยี่ยมมาก! วันนี้ไม่มีการ์ดค้างทบทวน"
      }\n\nสอบถามแผนการเรียน ช่วยวิเคราะห์ข้อผิดพลาด หรือกดไมค์ 🎙️ เพื่อฝึกสนทนาได้เลย!`;
    case "ru":
      return `Konnichiwa! Я Aoi Sensei, ваш персональный помощник по японскому языку 🌸\n\nВы изучаете **JLPT ${level}** с серией в **${streak} дней** 🔥\n${
        dueCards > 0
          ? `⏰ Сегодня вас ждут **${dueCards} карточек SRS** для повторения!`
          : "✨ Отлично! На сегодня нет отложенных карточек."
      }\n\nСпросите меня о плане занятий, разборе ошибок или нажмите микрофон 🎙️ для практики разговора!`;
    case "pt":
      return `Konnichiwa! Eu sou a Aoi Sensei, sua assistente pessoal de japonês 🌸\n\nVejo que você está no **JLPT ${level}** com uma sequência de **${streak} dias** 🔥\n${
        dueCards > 0
          ? `⏰ Você tem **${dueCards} cartões SRS** para revisar hoje!`
          : "✨ Excelente! Sem cartões pendentes hoje."
      }\n\nPergunte sobre seu plano de estudo, tire dúvidas sobre erros ou aperte o microfone 🎙️ para praticar!`;
    default:
      return `Konnichiwa! Sensei chào bạn nhé 🌸 Mình là trợ lý học tập cá nhân của bạn tại Nihon Quest.\n\nSensei thấy bạn đang học **JLPT ${level}**, duy trì chuỗi **${streak} ngày Streak** 🔥\n${
        dueCards > 0
          ? `⏰ Hiện đang có **${dueCards} thẻ từ vựng SRS** đến hạn ôn tập hôm nay đấy!`
          : "✨ Tuyệt vời! Bạn không còn thẻ SRS nào bị nợ hôm nay."
      }\n\nBạn có thể hỏi Sensei về kế hoạch học hôm nay, nhờ Sensei phân tích & khắc phục lỗi sai, hoặc bấm biểu tượng mic 🎙️ để luyện nói chuyện nhé!`;
  }
}

export function KawaiiSenseiBubble() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { progress } = useUserProgress();
  const { nativeLanguage, setNativeLanguage, langInfo, t } = useNativeLanguage();
  const { playClick, speak, stopSpeaking, speakingText, showToast, hasJapaneseVoice } = useSoundAndTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [character, setCharacter] = useState<"aoi" | "ren">("aoi");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Chat Voice State (STT & TTS)
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceInputLang, setVoiceInputLang] = useState<"ja" | "native">("ja");
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Draggable window state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    startPointerX: number;
    startPointerY: number;
    startLeft: number;
    startTop: number;
    width: number;
    height: number;
  } | null>(null);

  // Keep window within viewport bounds when window resizes
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !windowRef.current) return null;
        const rect = windowRef.current.getBoundingClientRect();
        const pad = 8;
        const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
        const maxY = Math.max(pad, window.innerHeight - rect.height - pad);
        return {
          x: Math.min(Math.max(prev.x, pad), maxX),
          y: Math.min(Math.max(prev.y, pad), maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;
    // Don't drag if clicking buttons, links, or inputs
    if ((e.target as HTMLElement).closest("button, a, input, select, [role='button']")) return;

    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();

    dragStartRef.current = {
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startPointerX;
    const deltaY = e.clientY - dragStartRef.current.startPointerY;

    const newLeft = dragStartRef.current.startLeft + deltaX;
    const newTop = dragStartRef.current.startTop + deltaY;

    const pad = 8;
    const minX = pad;
    const maxX = Math.max(pad, window.innerWidth - dragStartRef.current.width - pad);
    const minY = pad;
    const maxY = Math.max(pad, window.innerHeight - dragStartRef.current.height - pad);

    const clampedX = Math.min(Math.max(newLeft, minX), maxX);
    const clampedY = Math.min(Math.max(newTop, minY), maxY);

    setPosition({ x: clampedX, y: clampedY });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

    // Draggable round bubble state (optimized for touchpads, mouse & mobile touch)
  const [bubblePosition, setBubblePosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const bubbleRef = useRef<HTMLElement | null>(null);
  const bubbleDragRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    width: number;
    height: number;
    hasMoved: boolean;
    currentX: number;
    currentY: number;
    rafId: number;
  } | null>(null);

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    bubbleDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
      hasMoved: false,
      currentX: rect.left,
      currentY: rect.top,
      rafId: 0,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = bubbleDragRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    // 4px movement threshold ensures quick taps on laptop touchpads don't trigger accidental drag
    if (!drag.hasMoved && Math.hypot(deltaX, deltaY) > 4) {
      drag.hasMoved = true;
      setIsDraggingBubble(true);
    }

    if (drag.hasMoved) {
      const pad = 12;
      const minX = pad;
      const maxX = Math.max(pad, window.innerWidth - drag.width - pad);
      const minY = pad;
      const maxY = Math.max(pad, window.innerHeight - drag.height - pad);

      drag.currentX = Math.min(Math.max(drag.startLeft + deltaX, minX), maxX);
      drag.currentY = Math.min(Math.max(drag.startTop + deltaY, minY), maxY);

      // Direct inline DOM update for 120fps stutter-free dragging on laptop touchpads
      if (bubbleRef.current) {
        bubbleRef.current.style.left = `${drag.currentX}px`;
        bubbleRef.current.style.top = `${drag.currentY}px`;
        bubbleRef.current.style.bottom = "auto";
        bubbleRef.current.style.right = "auto";
      }

      // Schedule React state sync via requestAnimationFrame
      if (!drag.rafId) {
        drag.rafId = requestAnimationFrame(() => {
          if (bubbleDragRef.current) {
            setBubblePosition({ x: bubbleDragRef.current.currentX, y: bubbleDragRef.current.currentY });
            bubbleDragRef.current.rafId = 0;
          }
        });
      }
    }
  };

  const handleBubblePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = bubbleDragRef.current;
    if (!drag) return;
    if (drag.rafId) cancelAnimationFrame(drag.rafId);
    const wasMoved = drag.hasMoved;
    const finalX = drag.currentX;
    const finalY = drag.currentY;
    setIsDraggingBubble(false);
    bubbleDragRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (wasMoved) {
      // Commit final position to React state
      setBubblePosition({ x: finalX, y: finalY });
    } else {
      // Clean click / tap on laptop touchpad
      playClick();
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      if (!nextOpen) {
        stopSpeaking();
      }
    }
  };

  // Compute smart initial positioning for chat popup relative to bubble position
  const getPopupWindowPosition = () => {
    if (position) {
      return {
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: "auto",
        right: "auto",
      };
    }
    if (bubblePosition && typeof window !== "undefined") {
      const pad = 12;
      const popupWidth = Math.min(410, window.innerWidth * 0.92);
      const popupHeight = Math.min(580, window.innerHeight * 0.82);

      let targetX = bubblePosition.x - (popupWidth - 64);
      let targetY = bubblePosition.y - popupHeight - 12;

      if (targetY < pad) {
        targetY = bubblePosition.y + 70;
      }

      const clampedX = Math.min(Math.max(targetX, pad), window.innerWidth - popupWidth - pad);
      const clampedY = Math.min(Math.max(targetY, pad), window.innerHeight - popupHeight - pad);

      return {
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        bottom: "auto",
        right: "auto",
      };
    }
    return undefined;
  };

const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Auto-scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Load autoSpeak preference
  useEffect(() => {
    try {
      const savedAutoSpeak = localStorage.getItem("nq_sensei_autospeak");
      if (savedAutoSpeak !== null) {
        setAutoSpeak(savedAutoSpeak === "true");
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleAutoSpeak = () => {
    const nextVal = !autoSpeak;
    setAutoSpeak(nextVal);
    if (!nextVal) {
      stopSpeaking();
    }
    playClick();
    try {
      localStorage.setItem("nq_sensei_autospeak", String(nextVal));
    } catch {
      // Ignore
    }
    showToast({
      title: nextVal ? t("autoSpeechToastOn") : t("autoSpeechToastOff"),
      type: "info",
    });
  };

  // Initial greeting tailored to user progress & mistakes
  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === "welcome-1")) {
      const streak = progress?.currentStreak ?? 0;
      const dueCards = progress?.stats?.dueReviewCount ?? 0;
      const level = progress?.learningLevel || "N5";

      const greetingContent = getLocalizedGreeting(nativeLanguage, level, streak, dueCards);

      setMessages([
        {
          id: "welcome-1",
          role: "assistant",
          content: greetingContent,
          timestamp: new Date(),
        },
      ]);
    }
  }, [progress, nativeLanguage, messages.length]);

  // Voice Input (Speech-to-Text / STT)
  const startListening = () => {
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
    const SpeechRec = win
      ? (win.SpeechRecognition as (new () => SpeechRecognitionInstance) | undefined) ||
        (win.webkitSpeechRecognition as (new () => SpeechRecognitionInstance) | undefined)
      : undefined;

    if (!SpeechRec) {
      showToast({
        title: "Trình duyệt không hỗ trợ nhận diện giọng nói",
        description: "Vui lòng sử dụng Google Chrome hoặc Edge để dùng voice chat.",
        type: "error",
      });
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRec();
      recognition.lang = voiceInputLang === "ja" ? "ja-JP" : (langInfo.speechLang || "vi-VN");
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((res) => res[0]?.transcript || "")
          .join("");
        setInput(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      playClick();
    } catch {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    playClick();
    setInput("");
    setHasInteracted(true);
    if (isListening) stopListening();

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          scenarioId: "assistant_guide",
          nativeLanguage,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
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

      if (!res.ok) {
        throw new Error("Không thể kết nối tới Sensei");
      }

      const data = await res.json();
      const assistantText =
        data?.message?.content || data?.response || "Sensei đang bận một chút, bạn thử lại sau nhé!";

      setMessages((prev) => [
        ...prev,
        {
          id: "a-" + Date.now(),
          role: "assistant",
          content: assistantText,
          timestamp: new Date(),
        },
      ]);

      // If auto-speech is enabled, speak out Japanese response
      if (autoSpeak) {
        const jaPart = assistantText.split("\n\n*")[0] || assistantText;
        speak(jaPart);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: t("senseiError"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionKey: string) => {
    let prompt = "";
    if (actionKey === "recommend") {
      prompt = t("todayStudyTip");
    } else if (actionKey === "mistakes") {
      prompt =
        nativeLanguage === "en"
          ? "Sensei, what are my recent mistakes and weak points? Please help me fix them!"
          : nativeLanguage === "zh-CN"
          ? "Sensei，我最近有哪些错题和薄弱知识点？请帮我分析并针对性辅导！"
          : nativeLanguage === "zh-TW"
          ? "Sensei，我最近有哪些錯題和薄弱知識點？請幫我分析並針對性輔導！"
          : nativeLanguage === "ko"
          ? "Sensei, 최근 제가 틀린 문제와 취약점은 무엇인가요? 분석하고 교정해 주세요!"
          : "Sensei ơi, em gần đây hay làm sai những chỗ nào? Hãy phân tích lỗi sai và hướng dẫn em cách khắc phục với!";
    } else if (actionKey === "srs") {
      prompt = t("checkSrsCards");
    } else if (actionKey === "grammar") {
      prompt = t("explainGrammar");
    } else if (actionKey === "conversation") {
      prompt = t("practiceSpeaking");
    }
    handleSendMessage(prompt);
  };

  const currentPortrait =
    character === "aoi" ? BASE64_IMAGES.aoiPortrait : BASE64_IMAGES.renPortrait;

  const isExcluded =
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname === "/app/sensei" ||
    !pathname.startsWith("/app");

  const shouldShow =
    mounted &&
    status === "authenticated" &&
    Boolean(session?.user) &&
    !isExcluded;

  if (!shouldShow) return null;

  return (
    <>
      {/* ================= FLOATING CIRCULAR BUBBLE BUTTON ================= */}
      <aside
          ref={bubbleRef}
          aria-label="Kawaii Sensei Assistant"
          style={
            bubblePosition
              ? {
                  left: `${bubblePosition.x}px`,
                  top: `${bubblePosition.y}px`,
                  bottom: "auto",
                  right: "auto",
                  touchAction: "none",
                }
              : {
                  touchAction: "none",
                }
          }
          className={`fixed z-40 select-none flex flex-col items-end gap-2 will-change-transform ${
            !bubblePosition ? "bottom-20 right-4 sm:bottom-6 sm:right-6" : ""
          } ${isDraggingBubble ? "cursor-grabbing transition-none select-none" : "cursor-grab transition-transform duration-150"}`}
        >
          {/* Unread / Attention mini pill */}
          {!isOpen && !hasInteracted && (progress?.stats?.dueReviewCount ?? 0) > 0 && (
            <div className="bg-gradient-to-r from-red-600 to-rose-500 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-lg border border-white/20 animate-bounce flex items-center gap-1.5 pointer-events-none">
              <span>🌸</span>
              <span>{progress?.stats?.dueReviewCount} {t("srsDueTag")}</span>
            </div>
          )}

          <button
            type="button"
            onPointerDown={handleBubblePointerDown}
            onPointerMove={handleBubblePointerMove}
            onPointerUp={handleBubblePointerUp}
            onPointerCancel={handleBubblePointerUp}
            onDoubleClick={() => setBubblePosition(null)}
            aria-label="Mở trợ lý AI Kawaii Sensei (Kéo để di chuyển, nhấp đúp để đặt lại vị trí)"
            title="Kéo để di chuyển bong bóng quanh màn hình • Nhấp đúp để đặt lại góc dưới"
            className={`group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-[0_8px_30px_rgba(225,29,72,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-400/50 ${
              isOpen
                ? "bg-slate-900 border-2 border-red-500 rotate-90"
                : "bg-gradient-to-br from-rose-500 via-red-600 to-amber-500 border-2 border-white/80"
            }`}
          >
            {isOpen ? (
              <span className="text-white text-xl font-bold">✕</span>
            ) : (
              <>
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border border-white/60">
                  <Image
                    src={currentPortrait}
                    alt="Kawaii Sensei"
                    fill
                    className="object-cover object-top group-hover:scale-110 transition duration-300"
                    sizes="64px"
                    priority
                  />
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                {/* Voice speech pulse */}
                {speakingText && (
                  <span className="absolute -inset-1 rounded-full border-2 border-red-400 animate-ping opacity-75" />
                )}
              </>
            )}
          </button>
        </aside>

      {/* ================= CHAT POPUP WINDOW ================= */}
      {isOpen && (
        <div
          ref={windowRef}
          role="dialog"
          aria-label="Trợ lý AI Kawaii Sensei"
          style={getPopupWindowPosition()}
          className={`fixed z-50 w-[92vw] sm:w-[410px] h-[580px] max-h-[82vh] bg-white dark:bg-sumi-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-rose-200 dark:border-sumi-700 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
            !position && !bubblePosition ? "bottom-24 right-4 sm:bottom-24 sm:right-6" : ""
          }`}
        >
          {/* Header (Draggable handle with pointer capture) */}
          <div
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={handleHeaderPointerUp}
            onPointerCancel={handleHeaderPointerUp}
            onDoubleClick={() => { setPosition(null); setBubblePosition(null); }}
            title="Kéo thanh tiêu đề để di chuyển • Nhấp đúp để đặt lại vị trí góc dưới"
            className={`relative bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 p-3.5 text-white flex items-center justify-between shrink-0 shadow-md select-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ touchAction: "none" }}
          >
            <div className="flex items-center gap-2">
              {/* Drag Handle Grip Icon */}
              <span
                className="text-white/60 hover:text-white text-sm font-mono cursor-grab active:cursor-grabbing px-0.5"
                title="Kéo để di chuyển cửa sổ"
              >
                ⠿
              </span>
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-white/20 shrink-0">
                <Image
                  src={currentPortrait}
                  alt={character === "aoi" ? "Aoi Sensei" : "Ren Sensei"}
                  fill
                  className="object-cover object-top"
                  sizes="40px"
                />
                {speakingText && (
                  <span className="absolute inset-0 bg-red-500/20 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-black text-sm tracking-tight leading-tight">
                  <span>{character === "aoi" ? "Aoi Sensei 🌸" : "Ren Sensei 🦊"}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/25 text-white font-bold uppercase">
                    AI Tutor
                  </span>
                  {!hasJapaneseVoice && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/30 text-white font-medium"
                      title="Thiết bị chưa có giọng Nhật offline. Đang dùng Cloud TTS trực tuyến."
                    >
                      Cloud TTS
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/85 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    JLPT {progress?.learningLevel || "N5"} • {progress?.currentStreak ?? 0}🔥
                  </span>
                </div>
              </div>
            </div>

            {/* Header Controls: Voice Toggle/Mute, Native Lang Picker, Reset Position & Close */}
            <div className="flex items-center gap-1">
              {/* Reset Dragged Position (only shown when moved) */}
              {(position || bubblePosition) && (
                <button
                  type="button"
                  onClick={() => { setPosition(null); setBubblePosition(null); }}
                  title="Đặt lại vị trí góc màn hình"
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition"
                >
                  📍
                </button>
              )}

              {/* Voice Speak / Immediate Mute Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (speakingText) {
                    stopSpeaking();
                  } else {
                    toggleAutoSpeak();
                  }
                }}
                title={
                  speakingText
                    ? "Đang phát âm thanh — Nhấn để tắt tiếng ngay lập tức"
                    : autoSpeak
                    ? "Tắt tự động đọc giọng nói"
                    : "Bật tự động đọc giọng nói của Sensei"
                }
                className={`p-1.5 rounded-full transition text-xs font-bold ${
                  speakingText
                    ? "bg-red-500 text-white animate-pulse shadow-md ring-2 ring-white/60"
                    : autoSpeak
                    ? "bg-white text-red-600 shadow-sm"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {speakingText ? "⏹️" : autoSpeak ? "🔊" : "🔇"}
              </button>

              {/* Native Language Picker Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="px-2 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1 transition"
                  title="Chọn ngôn ngữ mẹ đẻ giải thích"
                >
                  <span>{langInfo.flag}</span>
                  <span className="text-[11px]">{langInfo.short}</span>
                  <span className="text-[9px] opacity-75">▾</span>
                </button>

                {showLangMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-sumi-800 rounded-2xl shadow-xl border border-slate-200 dark:border-sumi-700 py-1.5 z-50 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400">
                      {t("explainLangLabel")} (12)
                    </div>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setNativeLanguage(l.code);
                          setShowLangMenu(false);
                          playClick();
                          showToast({
                            title: `${t("langSwitchedToast")}${l.nativeName} ${l.flag}`,
                            type: "info",
                          });
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition ${
                          nativeLanguage === l.code
                            ? "bg-red-50 dark:bg-sumi-700 font-bold text-red-600 dark:text-red-400"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-sumi-750"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{l.flag}</span>
                          <span>{l.nativeName}</span>
                        </span>
                        {nativeLanguage === l.code && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Character Switcher */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setCharacter(character === "aoi" ? "ren" : "aoi");
                }}
                title={t("switchTeacher")}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs transition"
              >
                🔄
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Guidance Toolbar */}
          <div className="bg-slate-50 dark:bg-sumi-950 px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickAction("recommend")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 font-bold transition active:scale-95 flex items-center gap-1"
            >
              <span>🧭</span>
              <span>{t("studyPlanQuick")}</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("mistakes")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200 font-bold transition active:scale-95 flex items-center gap-1"
            >
              <span>🔍</span>
              <span>{t("fixMistakes")}</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("srs")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 font-semibold transition active:scale-95"
            >
              🗂️ SRS ({progress?.stats?.dueReviewCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("grammar")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 font-semibold transition active:scale-95"
            >
              💡 {t("grammarQuick")}
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("conversation")}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 font-semibold transition active:scale-95"
            >
              🗣️ {t("voiceChatQuick")}
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-sm">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isUser && (
                    <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 border border-slate-200 dark:border-slate-700 bg-white">
                      <Image
                        src={currentPortrait}
                        alt="Sensei"
                        fill
                        className="object-cover object-top"
                        sizes="28px"
                      />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm text-[13px] leading-relaxed ${
                      isUser
                        ? "bg-red-600 text-white rounded-tr-none font-medium whitespace-pre-wrap"
                        : "bg-slate-100 dark:bg-sumi-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-700/60"
                    }`}
                  >
                    {isUser ? <div>{m.content}</div> : <FormattedSenseiMessage content={m.content} />}

                    {!isUser && (
                      <div className="mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                        {(() => {
                          const jaPart = m.content.split("\n\n*")[0] || m.content;
                          const isCurrentSpeaking =
                            speakingText !== null && (speakingText === jaPart || speakingText === m.content);
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (isCurrentSpeaking) {
                                  stopSpeaking();
                                } else {
                                  speak(jaPart);
                                }
                              }}
                              className={`font-bold flex items-center gap-1 transition px-2 py-0.5 rounded-full ${
                                isCurrentSpeaking
                                  ? "bg-red-500 text-white animate-pulse shadow-sm"
                                  : "hover:text-red-500 text-slate-500 dark:text-slate-400"
                              }`}
                              title={
                                isCurrentSpeaking
                                  ? "Đang phát âm thanh — Nhấn để tắt tiếng ngay"
                                  : t("listenToSensei") || "Nghe Sensei phát âm"
                              }
                            >
                              <span>{isCurrentSpeaking ? "⏹️" : "🔊"}</span>
                              <span>{isCurrentSpeaking ? "Dừng đọc" : t("listenAudio") || "Nghe đọc"}</span>
                            </button>
                          );
                        })()}
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                  <Image src={currentPortrait} alt="" fill className="object-cover" sizes="24px" />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-sumi-800 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse delay-75" />
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse delay-150" />
                  <span className="text-[11px] font-bold ml-1 text-slate-500">
                    {t("senseiThinking")}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Listening Wave Banner */}
          {isListening && (
            <div className="bg-rose-50 dark:bg-sumi-950 px-3 py-2 border-t border-rose-200 dark:border-rose-900/40 flex items-center justify-between text-xs text-rose-600 font-bold animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>
                  {t("senseiListening")} ({voiceInputLang === "ja" ? "日本語 🇯🇵" : `${langInfo.name} ${langInfo.flag}`})
                </span>
              </div>
              <button
                type="button"
                onClick={stopListening}
                className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold"
              >
                {t("senseiStopMic")}
              </button>
            </div>
          )}

          {/* Input Box with Voice Mic & Send */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-slate-50 dark:bg-sumi-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5"
          >
            {/* Mic Button (Voice Input) */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              title={isListening ? t("senseiStopMic") : t("voiceChatTitle")}
              className={`p-2 rounded-xl transition text-sm font-bold flex items-center justify-center shrink-0 ${
                isListening
                  ? "bg-red-600 text-white animate-pulse shadow-md"
                  : "bg-slate-200 dark:bg-sumi-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-sumi-700"
              }`}
            >
              🎙️
            </button>

            {/* Language toggle for Mic */}
            <button
              type="button"
              onClick={() => {
                setVoiceInputLang(voiceInputLang === "ja" ? "native" : "ja");
                playClick();
              }}
              title={`${t("micLangLabel")}: ${voiceInputLang === "ja" ? "日本語" : langInfo.name}`}
              className="text-[10px] font-black px-1.5 py-2 rounded-xl bg-slate-100 dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0"
            >
              {voiceInputLang === "ja" ? "🇯🇵 JA" : langInfo.short}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("senseiPlaceholder")}
              className="flex-1 bg-white dark:bg-sumi-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-red-400 transition"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-sm shadow-md transition active:scale-95 shrink-0"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
