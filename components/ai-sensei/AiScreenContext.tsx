"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

export interface ScreenLearningItem {
  term: string;
  reading?: string;
  meaning?: string;
  type?: "VOCAB" | "KANJI" | "GRAMMAR" | "EXERCISE" | "KANA";
  examples?: Array<{ ja: string; vi?: string; en?: string }>;
  isFlipped?: boolean;
  extraPrompt?: string;
}

export interface ScreenQuizContext {
  question: string;
  userAnswer?: string;
  correctAnswer?: string;
  options?: string[];
  isCorrect?: boolean;
  explanation?: string;
}

export interface SessionMistakeItem {
  id: string;
  term: string;
  reading?: string;
  meaning?: string;
  type?: string;
  wrongAnswer?: string;
  correctAnswer?: string;
  timestamp: number;
}

export interface AiScreenContextState {
  pageType: "review" | "practice" | "lesson" | "grammar" | "vocab" | "kana" | "dashboard" | "general";
  pageTitle: string;
  item?: ScreenLearningItem | null;
  quiz?: ScreenQuizContext | null;
  lessonMeta?: {
    slug?: string;
    chapter?: string;
    level?: string;
  } | null;
  recentMistakes: SessionMistakeItem[];
  userMemories: string[];
}

interface AiScreenContextValue {
  currentScreen: AiScreenContextState;
  setScreenItem: (item: ScreenLearningItem | null, pageTitle?: string) => void;
  setScreenQuiz: (quiz: ScreenQuizContext | null) => void;
  setLessonMeta: (meta: { slug?: string; chapter?: string; level?: string } | null) => void;
  recordSessionMistake: (mistake: Omit<SessionMistakeItem, "id" | "timestamp">) => void;
  addMemory: (fact: string) => void;
  removeMemory: (index: number) => void;
  clearSessionMistakes: () => void;
}

const AiScreenContext = createContext<AiScreenContextValue | null>(null);

const STORAGE_MEMORIES_KEY = "nq_sensei_user_memories";
const STORAGE_MISTAKES_KEY = "nq_sensei_session_mistakes";

export function AiScreenProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [item, setItem] = useState<ScreenLearningItem | null>(null);
  const [quiz, setQuiz] = useState<ScreenQuizContext | null>(null);
  const [customTitle, setCustomTitle] = useState<string>("");
  const [lessonMeta, setLessonMetaState] = useState<{ slug?: string; chapter?: string; level?: string } | null>(null);

  const [recentMistakes, setRecentMistakes] = useState<SessionMistakeItem[]>([]);
  const [userMemories, setUserMemories] = useState<string[]>([]);

  // Load saved memories & session mistakes from localStorage
  useEffect(() => {
    try {
      const savedMem = localStorage.getItem(STORAGE_MEMORIES_KEY);
      if (savedMem) {
        const parsed = JSON.parse(savedMem);
        if (Array.isArray(parsed)) setUserMemories(parsed);
      }
      const savedMis = sessionStorage.getItem(STORAGE_MISTAKES_KEY);
      if (savedMis) {
        const parsed = JSON.parse(savedMis);
        if (Array.isArray(parsed)) setRecentMistakes(parsed);
      }
    } catch {}
  }, []);

  // Deduce default pageType & pageTitle from current pathname
  const inferred = useMemo(() => {
    const p = pathname || "";
    if (p.includes("/review")) return { pageType: "review" as const, title: "Ôn tập SRS Flashcard" };
    if (p.includes("/practice/")) return { pageType: "practice" as const, title: "Luyện tập bài học" };
    if (p.includes("/learn")) return { pageType: "lesson" as const, title: "Lộ trình bài học" };
    if (p.includes("/grammar")) return { pageType: "grammar" as const, title: "Tra cứu & Học Ngữ pháp" };
    if (p.includes("/vocabulary")) return { pageType: "vocab" as const, title: "Từ vựng & Kanji Jouyou" };
    if (p.includes("/kana")) return { pageType: "kana" as const, title: "Bảng chữ cái Kana" };
    if (p.includes("/app")) return { pageType: "dashboard" as const, title: "Bảng điều khiển cá nhân" };
    return { pageType: "general" as const, title: "Nihon Quest" };
  }, [pathname]);

  // Reset page item on major path change
  useEffect(() => {
    setItem(null);
    setQuiz(null);
    setCustomTitle("");
  }, [pathname]);

  const setScreenItem = useCallback((newItem: ScreenLearningItem | null, title?: string) => {
    setItem(newItem);
    if (title) setCustomTitle(title);
  }, []);

  const setScreenQuiz = useCallback((newQuiz: ScreenQuizContext | null) => {
    setQuiz(newQuiz);
  }, []);

  const setLessonMeta = useCallback((meta: { slug?: string; chapter?: string; level?: string } | null) => {
    setLessonMetaState(meta);
  }, []);

  const recordSessionMistake = useCallback((mistake: Omit<SessionMistakeItem, "id" | "timestamp">) => {
    setRecentMistakes((prev) => {
      // Avoid duplicate spam of identical term within last few minutes
      const now = Date.now();
      const filtered = prev.filter((m) => m.term !== mistake.term || now - m.timestamp > 300_000);
      const updated = [
        { ...mistake, id: "mis-" + now + "-" + Math.random().toString(36).slice(2, 6), timestamp: now },
        ...filtered,
      ].slice(0, 15);

      try {
        sessionStorage.setItem(STORAGE_MISTAKES_KEY, JSON.stringify(updated));
      } catch {}

      return updated;
    });
  }, []);

  const clearSessionMistakes = useCallback(() => {
    setRecentMistakes([]);
    try {
      sessionStorage.removeItem(STORAGE_MISTAKES_KEY);
    } catch {}
  }, []);

  const addMemory = useCallback((fact: string) => {
    const clean = fact.trim();
    if (!clean) return;
    setUserMemories((prev) => {
      if (prev.includes(clean)) return prev;
      const updated = [clean, ...prev].slice(0, 30);
      try {
        localStorage.setItem(STORAGE_MEMORIES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const removeMemory = useCallback((index: number) => {
    setUserMemories((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem(STORAGE_MEMORIES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const currentScreen: AiScreenContextState = useMemo(
    () => ({
      pageType: inferred.pageType,
      pageTitle: customTitle || inferred.title,
      item,
      quiz,
      lessonMeta,
      recentMistakes,
      userMemories,
    }),
    [inferred, customTitle, item, quiz, lessonMeta, recentMistakes, userMemories]
  );

  const value = useMemo(
    () => ({
      currentScreen,
      setScreenItem,
      setScreenQuiz,
      setLessonMeta,
      recordSessionMistake,
      addMemory,
      removeMemory,
      clearSessionMistakes,
    }),
    [
      currentScreen,
      setScreenItem,
      setScreenQuiz,
      setLessonMeta,
      recordSessionMistake,
      addMemory,
      removeMemory,
      clearSessionMistakes,
    ]
  );

  return <AiScreenContext.Provider value={value}>{children}</AiScreenContext.Provider>;
}

export function useAiScreenContext(): AiScreenContextValue {
  const ctx = useContext(AiScreenContext);
  if (!ctx) {
    // Graceful fallback for components outside provider
    return {
      currentScreen: {
        pageType: "general",
        pageTitle: "Nihon Quest",
        recentMistakes: [],
        userMemories: [],
      },
      setScreenItem: () => {},
      setScreenQuiz: () => {},
      setLessonMeta: () => {},
      recordSessionMistake: () => {},
      addMemory: () => {},
      removeMemory: () => {},
      clearSessionMistakes: () => {},
    };
  }
  return ctx;
}

