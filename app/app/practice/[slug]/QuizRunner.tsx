"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { notifyProgressUpdated } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getLocalizedLessonTitle } from "@/lib/lessonLocalization";
import { LocalizedQuizText } from "@/lib/quizLocalization";
import { SpeakButton } from "./LessonSections";
import { IconArrowRight, IconCheck, IconClose, IconRefresh } from "./LessonIcons";

interface Option {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
}

interface Exercise {
  id: string;
  type: string;
  contentType?: string | null;
  question: string;
  prompt?: string | null;
  correctAnswer: string;
  options: Option[];
  points: number;
}

interface Lesson {
  id: string;
  slug?: string;
  title: string;
  description: string;
  level?: string;
  xpReward: number;
  exercises: Exercise[];
}

interface NextLesson {
  id: string;
  slug: string;
  title: string;
  level: string;
  xpReward: number;
}

const normalize = (value: string) => value.trim().toLowerCase();

/** Must stay in sync with PASS_THRESHOLD in app/api/lessons/complete/route.ts. */
const PASS_PERCENT = 60;

function exerciseKind(contentType?: string | null, t?: (k: string) => string) {
  if (contentType === "VOCAB") return t ? t("navVocab") : "Từ vựng";
  if (contentType === "GRAMMAR") return t ? t("navGrammar") : "Ngữ pháp";
  return t ? t("groupPractice") : "Luyện tập";
}

// Grammatical explanation helper for Japanese questions
function getGrammarExplanation(question: string, correctAnswer: string, prompt?: string | null, lang: string = "vi") {
  const isVi = lang === "vi";
  const isZh = lang === "zh-CN" || lang === "zh-TW";
  const isEn = !isVi && !isZh;

  if (prompt && prompt.trim().length > 5) {
    return {
      title: isZh ? "语法要点与语境解析" : isEn ? "Context & Grammar Explanation" : "Giải thích ngữ cảnh",
      breakdown: prompt,
      rule: isZh
        ? "牢记在此情境中使用的对应核心句型结构与语法。"
        : isEn
        ? "Remember the sentence pattern used in this context."
        : "Ghi nhớ cấu trúc mẫu câu tương ứng trong ngữ cảnh này.",
    };
  }

  // Detect grammatical patterns
  if (correctAnswer.includes("は") && (correctAnswer.includes("です") || correctAnswer.includes("ではありません"))) {
    return {
      title: isZh ? "名词与主题助词「は」(wa) 句型" : isEn ? "Noun & Topic Particle 「は」(wa)" : "Cấu trúc Danh từ & Trợ từ 「は」(wa)",
      breakdown: isZh
        ? "「は」作为主题助词提示句子主语/主题。「です」为礼貌体肯定句尾判定词。"
        : isEn
        ? "「は」 marks the topic of the sentence. 「です」 is the polite copula."
        : "「は」 đóng vai trò trợ từ chỉ chủ đề của câu. 「です」 là đuôi câu khẳng định lịch sự.",
      rule: isZh
        ? "A は B です (A是B) · A は B ではありません (A不是B)"
        : isEn
        ? "A は B です (A is B) · A は B ではありません (A is not B)"
        : "A は B です (A là B) · A は B ではありません (A không phải là B)",
    };
  }

  if (correctAnswer.includes("を") && correctAnswer.includes("ます")) {
    return {
      title: isZh ? "宾语助词「を」(o) 句型" : isEn ? "Object Particle 「を」(o)" : "Trợ từ Tân ngữ 「を」(o)",
      breakdown: isZh
        ? "「を」连接动作的对象（宾语）与动作本身（动词）。"
        : isEn
        ? "「を」 links the direct object to the transitive verb."
        : "「を」 kết nối giữa đối tượng tác động (tân ngữ) và hành động (động từ).",
      rule: isZh
        ? "名词 + を + 动词 (例：水を飲みます - 喝水)"
        : isEn
        ? "Noun + を + Verb (e.g. 水を飲みます - drink water)"
        : "Danh từ + を + Động từ (Ví dụ: 水を飲みます - Uống nước)",
    };
  }

  if (correctAnswer.includes("に") || correctAnswer.includes("へ")) {
    return {
      title: isZh ? "方向与时间助词「に / へ」" : isEn ? "Destination & Time Particles 「に / へ」" : "Trợ từ Điểm đến & Thời gian 「に / へ」",
      breakdown: isZh
        ? "「に / へ」表示移动方向目的地，或具体的动作发生时间点。"
        : isEn
        ? "「に / へ」 indicates direction/destination or specific point in time."
        : "「に / へ」 chỉ hướng chuyển động tới địa điểm, hoặc thời điểm cụ thể diễn ra hành động.",
      rule: isZh
        ? "地点 + に/へ + 行きます (去某地) · 时间点 + に + 动词"
        : isEn
        ? "Place + に/へ + 行きます (go somewhere) · Time + に + Verb"
        : "Địa điểm + に/へ + 行きます (Đi tới đâu) · Thời gian + に + Hành động",
    };
  }

  if (correctAnswer.includes("これ") || correctAnswer.includes("それ") || correctAnswer.includes("あれ")) {
    return {
      title: isZh ? "指示代词 Ko-So-A-Do 体系" : isEn ? "Demonstrative Pronouns Ko-So-A-Do" : "Đại từ chỉ định Ko-So-A-Do",
      breakdown: isZh
        ? "これ (靠近说话人) · それ (靠近听话人) · あれ (远距离指示)。"
        : isEn
        ? "これ (near speaker) · それ (near listener) · あれ (far from both)."
        : "これ (vật ở gần người nói) · それ (vật ở gần người nghe) · あれ (vật ở xa cả hai).",
      rule: "これ / それ / あれ + は + 名词 + です",
    };
  }

  return {
    title: isZh ? "正确答案解析" : isEn ? "Correct Answer Breakdown" : "Phân tích câu trả lời đúng",
    breakdown: isZh
      ? `正确答案为 "${correctAnswer}"。请注意问题与对话语境的契合度。`
      : isEn
      ? `The correct answer is "${correctAnswer}". Pay close attention to context matching.`
      : `Đáp án chính xác là "${correctAnswer}". Hãy chú ý sự phù hợp giữa câu hỏi và ngữ cảnh đối thoại.`,
    rule: isZh
      ? "温故知新，强化此句型和词汇的反应速度。"
      : isEn
      ? "Review this vocabulary and pattern to build reflexes."
      : "Ôn tập lại từ vựng và mẫu câu này để củng cố phản xạ.",
  };
}

export function QuizRunner({
  lesson,
  nextLesson,
}: {
  lesson: Lesson;
  nextLesson: NextLesson | null;
}) {
  const router = useRouter();
  const { playClick, playCorrect, playIncorrect, playFanfare, showToast, speak } = useSoundAndTheme();
  const { t, nativeLanguage } = useNativeLanguage();

  // Hàng đợi câu hỏi (chỉ số vào lesson.exercises). "Hỏi khác" đẩy câu hiện tại xuống cuối hàng.
  const [queue, setQueue] = useState<number[]>(() => lesson.exercises.map((_, i) => i));
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [hasChecked, setHasChecked] = useState(false);
  const [answersLog, setAnswersLog] = useState<
    Array<{ exerciseId: string; question: string; answer: string; correctAnswer: string; isCorrect: boolean }>
  >([]);
  const [isFinished, setIsFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summaryData, setSummaryData] = useState<{ score: number; xpAwarded: number; passed: boolean } | null>(null);
  // Số câu của lượt làm hiện tại. Lượt "học lại câu sai" chỉ có một phần nên
  // không dùng được totalQuestions để tính tiến độ.
  const [attemptTotal, setAttemptTotal] = useState(lesson.exercises.length);

  const totalQuestions = lesson.exercises.length;
  const currentExercise: Exercise | undefined = lesson.exercises[queue[0]];
  const currentNumber = attemptTotal - queue.length + 1;

  const displayedOptions = useMemo(() => {
    if (!currentExercise?.options || currentExercise.options.length === 0) return [];
    const list = [...currentExercise.options];
    // Fisher-Yates random shuffle for fair distribution across A, B, C, D
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const labels = ["A", "B", "C", "D", "E", "F"];
    return list.map((opt, idx) => ({
      ...opt,
      displayLabel: labels[idx] ?? String.fromCharCode(65 + idx),
    }));
  }, [currentExercise]);

  // Báo cho thanh tiến độ bài học biết đã bắt đầu phần 4
  useEffect(() => {
    if (selectedAnswer || answersLog.length > 0) {
      window.dispatchEvent(new CustomEvent("nq:quiz-progress"));
    }
  }, [selectedAnswer, answersLog.length]);

  const handleSelectOption = useCallback(
    (text: string) => {
      if (hasChecked) return;
      playClick();
      setSelectedAnswer(text);
    },
    [hasChecked, playClick]
  );

  const handleCheckAnswer = useCallback(() => {
    if (!selectedAnswer || hasChecked || !currentExercise) return;

    const isCorrect = normalize(selectedAnswer) === normalize(currentExercise.correctAnswer);

    if (isCorrect) {
      playCorrect();
    } else {
      playIncorrect();
    }

    setHasChecked(true);
    // Giữ đúng một bản ghi cho mỗi câu: nếu không, lượt làm lại sẽ gửi trùng
    // exerciseId và API từ chối với "Incomplete submission".
    setAnswersLog((prev) => [
      ...prev.filter((a) => a.exerciseId !== currentExercise.id),
      {
        exerciseId: currentExercise.id,
        question: currentExercise.question,
        answer: selectedAnswer,
        correctAnswer: currentExercise.correctAnswer,
        isCorrect,
      },
    ]);
  }, [selectedAnswer, hasChecked, currentExercise, playCorrect, playIncorrect]);

  /**
   * Học lại. `onlyWrong` giữ lại các câu đã đúng và chỉ xếp lại câu sai, nên
   * answersLog vẫn phủ đủ toàn bộ bài khi submit.
   */
  const startRetry = useCallback(
    (onlyWrong: boolean) => {
      playClick();
      const correctIds = new Set(answersLog.filter((a) => a.isCorrect).map((a) => a.exerciseId));
      const retryPool = onlyWrong
        ? lesson.exercises.map((ex, i) => ({ ex, i })).filter(({ ex }) => !correctIds.has(ex.id)).map(({ i }) => i)
        : lesson.exercises.map((_, i) => i);

      // Trường hợp "học lại câu sai" nhưng không còn câu sai nào → làm lại toàn bộ.
      const pool = retryPool.length ? retryPool : lesson.exercises.map((_, i) => i);

      setQueue(pool);
      setAttemptTotal(pool.length);
      setAnswersLog(onlyWrong ? answersLog.filter((a) => a.isCorrect) : []);
      setSelectedAnswer("");
      setHasChecked(false);
      setIsFinished(false);
      setSummaryData(null);
    },
    [answersLog, lesson.exercises, playClick]
  );

  const handleSkip = useCallback(() => {
    if (hasChecked || queue.length < 2) return;
    playClick();
    setQueue((q) => [...q.slice(1), q[0]]);
    setSelectedAnswer("");
  }, [hasChecked, queue.length, playClick]);

  const finishLesson = useCallback(async () => {
    setSubmitting(true);
    const correctCount = answersLog.filter((a) => a.isCorrect).length;
    const localScore = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);

    try {
      const res = await fetch("/api/lessons/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          answers: answersLog.map((a) => ({
            exerciseId: a.exerciseId,
            answer: a.answer,
            timeSpent: 10,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      // Server mới là nguồn sự thật: nó mới quyết định đạt/không đạt và XP.
      const passed = typeof data.passed === "boolean" ? data.passed : localScore >= PASS_PERCENT;
      const score = typeof data.score === "number" ? data.score : localScore;
      const xpAwarded = typeof data.xpAwarded === "number" ? data.xpAwarded : 0;

      setIsFinished(true);
      setSummaryData({ score, xpAwarded, passed });
      if (passed) playFanfare();
      else playIncorrect();

      if (!res.ok) {
        showToast({
          title: "Chưa lưu được kết quả",
          description: data.error ?? "Vui lòng làm lại bài quiz.",
          type: "error",
        });
      } else {
        notifyProgressUpdated();
        if (!passed) {
          showToast({
            title: `Chưa đạt ${PASS_PERCENT}% — cần luyện lại`,
            description: `Đạt ${score}% điểm. Bài học chưa được tính XP.`,
            type: "info",
          });
        } else if (data.isPriorCompleted) {
          showToast({
            title: `Luyện tập lại hoàn tất: ${lesson.title}!`,
            description: `Đạt ${score}% điểm · Điểm cao nhất: ${data.bestScore ?? score}%!`,
            type: "info",
          });
        } else {
          showToast({
            title: `Hoàn thành bài học: ${lesson.title}!`,
            description: `Đạt ${score}% điểm · Nhận +${xpAwarded} XP!`,
            type: "xp",
          });
        }
      }
      router.refresh();
    } catch {
      setIsFinished(true);
      setSummaryData({ score: localScore, xpAwarded: 0, passed: false });
    }
    setSubmitting(false);
  }, [answersLog, lesson, totalQuestions, playFanfare, playIncorrect, showToast, router]);

  const handleNextQuestion = useCallback(async () => {
    playClick();
    if (queue.length > 1) {
      setQueue((q) => q.slice(1));
      setSelectedAnswer("");
      setHasChecked(false);
    } else {
      await finishLesson();
    }
  }, [queue.length, playClick, finishLesson]);

  // Desktop Keyboard Shortcuts (1, 2, 3, 4, Enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!isFinished && currentExercise) {
        if (!hasChecked) {
          if (displayedOptions.length > 0) {
            const keyNum = parseInt(e.key, 10);
            if (keyNum >= 1 && keyNum <= displayedOptions.length) {
              e.preventDefault();
              handleSelectOption(displayedOptions[keyNum - 1].text);
            }
          }
          if (e.key === "Enter" && selectedAnswer.trim()) {
            e.preventDefault();
            handleCheckAnswer();
          }
        } else if (e.key === "Enter" && !submitting) {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFinished, currentExercise, displayedOptions, hasChecked, selectedAnswer, submitting, handleSelectOption, handleCheckAnswer, handleNextQuestion]);

  // ==================== EMPTY ====================
  if (totalQuestions === 0 || !currentExercise) {
    if (!isFinished) {
      return (
        <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-sumi-800/60 dark:text-slate-400">
          {t("lessonNoDialogue") || "Bài học này chưa có câu hỏi luyện tập."}
        </p>
      );
    }
  }

  // ==================== LESSON COMPLETE ====================
  if (isFinished && summaryData) {
    const correctCount = answersLog.filter((a) => a.isCorrect).length;
    const wrongAnswers = answersLog.filter((a) => !a.isCorrect);
    const passed = summaryData.passed;
    const needed = Math.max(0, Math.ceil((PASS_PERCENT / 100) * totalQuestions) - correctCount);

    return (
      <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
        <div
          className={`rounded-2xl border p-5 ${
            passed
              ? "border-rose-200 bg-rose-50/50 dark:border-red-900/60 dark:bg-red-950/20"
              : "border-amber-300 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/25"
          }`}
        >
          <div className="mb-2 text-5xl">{passed ? "🎉" : "📖"}</div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">
            {passed ? t("quizPassedTitle") : t("quizFailedTitle")}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {passed ? (
              <>
                {t("quizPassedDesc")}{" "}
                <span className="font-bold text-slate-900 dark:text-white">
                  {getLocalizedLessonTitle(lesson.slug || lesson.id, nativeLanguage, lesson.title)}
                </span>
              </>
            ) : (
              t("quizFailedDesc", { passPercent: PASS_PERCENT, needed })
            )}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-sumi-800/80">
              <span className="text-[11px] font-bold text-slate-500">{t("quizCorrectStat")}</span>
              <p className="mt-0.5 text-lg font-black text-emerald-600">
                {correctCount} / {totalQuestions}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-sumi-800/80">
              <span className="text-[11px] font-bold text-slate-500">{t("quizAccuracyStat")}</span>
              <p className={`mt-0.5 text-lg font-black ${passed ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"}`}>
                {summaryData.score}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-700 dark:bg-sumi-800/80">
              <span className="text-[11px] font-bold text-slate-500">{t("quizXpStat")}</span>
              <p className="mt-0.5 text-lg font-black text-amber-500">+{summaryData.xpAwarded} XP</p>
            </div>
          </div>
        </div>

        {wrongAnswers.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-left dark:border-red-900 dark:bg-red-950/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                📚 {wrongAnswers.length} {t("vocabNeedPractice")}
              </span>
              <Link href="/app/review">
                <Button variant="torii" size="sm" className="px-3 py-1 text-xs">
                  {t("quizSrsReviewNow")}
                </Button>
              </Link>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t("quizSrsSavedNotice")}
            </p>
          </div>
        )}

        {/* Học lại — luôn có, kể cả khi đã đạt */}
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-sumi-900">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("quizRetryWrong")}</span>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            {wrongAnswers.length > 0 && (
              <Button
                variant="torii"
                size="md"
                onClick={() => startRetry(true)}
                className="flex-1 font-black"
              >
                <IconRefresh width={16} height={16} /> {t("quizRetryWrong")} ({wrongAnswers.length})
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              onClick={() => startRetry(false)}
              className="flex-1 font-bold"
            >
              <IconRefresh width={16} height={16} /> {t("quizRetryAll")}
            </Button>
          </div>
        </div>

        {passed ? (
          nextLesson ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-sumi-900">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t("nextLesson")}</span>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {getLocalizedLessonTitle(nextLesson.slug || nextLesson.id, nativeLanguage, nextLesson.title)}
              </h4>
              <Link href={`/app/practice/${nextLesson.slug}`} className="block pt-1">
                <Button variant="torii" size="md" className="w-full">
                  {t("quizNextLesson")} <IconArrowRight width={16} height={16} />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left dark:border-emerald-800 dark:bg-emerald-950/40">
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                🏆 {t("pathCompletedToday")} {lesson.level ?? ""}!
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {t("pathCompletedDesc")}
              </p>
              <div className="flex gap-2 pt-1">
                <Link href="/app/journey" className="flex-1">
                  <Button variant="gold" size="sm" className="w-full">{t("shinkansenJourney")} 🗾</Button>
                </Link>
                <Link href="/app/survival" className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">{t("navSurvival")} 🍜</Button>
                </Link>
              </div>
            </div>
          )
        ) : (
          /* Chưa đạt: không mở đường sang bài tiếp theo. */
          <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-800/70 dark:bg-amber-950/25">
            <span className="text-xs font-black text-amber-800 dark:text-amber-300">
              🔒 {t("nextLesson")} {t("moduleLocked")}
            </span>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {t("quizFailedDesc", { passPercent: PASS_PERCENT, needed: 1 })}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/app/practice" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">← {t("quizBackToPractice")}</Button>
          </Link>
          <Link href="/app" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">Dashboard ⛩️</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!currentExercise) return null;

  // ==================== ACTIVE QUIZ VIEW ====================
  const progressPercent = Math.round((currentNumber / Math.max(1, attemptTotal)) * 100);
  const liveCorrect = answersLog.filter((a) => a.isCorrect).length;
  const isCurrentCorrect = hasChecked && normalize(selectedAnswer) === normalize(currentExercise.correctAnswer);
  const explanation = hasChecked
    ? getGrammarExplanation(currentExercise.question, currentExercise.correctAnswer, currentExercise.prompt, nativeLanguage)
    : null;
  const canSkip = !hasChecked && queue.length > 1;

  return (
    <div className="space-y-4">
      {/* Tiến độ */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>
            {t("testQuestionIndex")} {currentNumber} / {attemptTotal}
          </span>
          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            ≥ {PASS_PERCENT}%
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-rose-100 dark:bg-sumi-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={attemptTotal}
          aria-valuenow={currentNumber}
          aria-label={`Tiến độ câu ${currentNumber}/${attemptTotal}`}
        >
          <div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        {/* Điểm tạm tính */}
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {liveCorrect}/{attemptTotal} · {PASS_PERCENT}%
        </p>
      </div>

      {/* Câu hỏi + đáp án */}
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-rose-50/30 p-4 dark:border-slate-800 dark:bg-sumi-900/50 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-xs font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <i className="h-3 w-0.5 rounded bg-red-500" aria-hidden />
            {exerciseKind(currentExercise.contentType, t)}
          </span>
          <SpeakButton onClick={() => speak(currentExercise.question)} label={t("listenQuestion") || "Nghe phát âm câu hỏi"} />
        </div>

        <h3 className="text-lg font-black leading-snug text-balance text-slate-900 dark:text-white sm:text-xl">
          <LocalizedQuizText text={currentExercise.question} />
        </h3>

        {displayedOptions.length > 0 ? (
          <div className="grid gap-2.5" role="group" aria-label={t("quizOptionsLabel") || "Các đáp án"}>
            {displayedOptions.map((opt, idx) => {
              const isSelected = selectedAnswer === opt.text;
              const isCorrectOption = normalize(opt.text) === normalize(currentExercise.correctAnswer);
              const isWrongPick = hasChecked && isSelected && !isCurrentCorrect;

              let box = "border-slate-200 bg-white hover:border-red-300 dark:border-slate-800 dark:bg-sumi-900 dark:hover:border-red-800";
              let letter = "bg-slate-100 text-slate-600 dark:bg-sumi-800 dark:text-slate-300";

              if (isSelected && !hasChecked) {
                box = "border-red-500 bg-red-50/60 ring-1 ring-red-400 dark:bg-red-950/30";
                letter = "bg-red-600 text-white";
              }
              if (hasChecked) {
                if (isCorrectOption) {
                  box = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/50";
                  letter = "bg-emerald-600 text-white";
                } else if (isWrongPick) {
                  box = "border-red-500 bg-red-50 ring-1 ring-red-500 dark:bg-red-950/50";
                  letter = "bg-red-600 text-white";
                } else {
                  box = "border-slate-200 bg-white opacity-50 dark:border-slate-800 dark:bg-sumi-900";
                }
              }

              return (
                <button
                  key={opt.id || idx}
                  type="button"
                  disabled={hasChecked}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectOption(opt.text)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${box}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${letter}`}>
                    {opt.displayLabel}
                  </span>
                  <span className="jp-text flex-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    <LocalizedQuizText text={opt.text} />
                  </span>
                  {isSelected && !hasChecked && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white">
                      <IconCheck width={14} height={14} strokeWidth={3} />
                    </span>
                  )}
                  {hasChecked && isCorrectOption && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
                      <IconCheck width={14} height={14} strokeWidth={3} />
                    </span>
                  )}
                  {isWrongPick && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white">
                      <IconClose width={13} height={13} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            disabled={hasChecked}
            value={selectedAnswer}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectedAnswer.trim() && !hasChecked) {
                e.preventDefault();
                handleCheckAnswer();
              }
            }}
            placeholder={t("quizEnterYourAnswer")}
            className="w-full rounded-xl border-2 border-slate-300 bg-white p-3.5 text-lg font-bold outline-none focus:border-red-500 dark:border-slate-700 dark:bg-sumi-900"
          />
        )}
      </div>

      {/* Phản hồi + giải thích */}
      {hasChecked && (
        <div
          role="status"
          className={`animate-in fade-in rounded-2xl border p-4 ${
            isCurrentCorrect
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-900 dark:border-emerald-800 dark:from-emerald-950/50 dark:to-sumi-900 dark:text-emerald-100"
              : "border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-900 dark:border-rose-900 dark:from-rose-950/50 dark:to-sumi-900 dark:text-rose-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${
                isCurrentCorrect ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {isCurrentCorrect ? <IconCheck width={20} height={20} strokeWidth={3} /> : <IconClose width={18} height={18} strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-black ${isCurrentCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                  {isCurrentCorrect ? t("quizCorrect") : t("quizIncorrect")}
                </p>
                {isCurrentCorrect && (
                  <span className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                    🔥 +{currentExercise.points} XP
                  </span>
                )}
              </div>
              {!isCurrentCorrect && (
                <p className="mt-0.5 text-sm">
                  {t("correctAnswerLabel") || "Đáp án đúng:"} <span className="jp-text font-black"><LocalizedQuizText text={currentExercise.correctAnswer} /></span>
                </p>
              )}
              {explanation && (
                <>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <LocalizedQuizText text={explanation.breakdown} />
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">💡 {explanation.rule}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hành động */}
      <div className={`grid gap-3 ${canSkip ? "grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]" : "grid-cols-1"}`}>
        {canSkip && (
          <Button variant="outline" size="lg" onClick={handleSkip} className="font-bold">
            <IconRefresh width={16} height={16} /> {t("quizSkip")}
          </Button>
        )}
        {!hasChecked ? (
          <Button
            variant="torii"
            size="lg"
            disabled={!selectedAnswer.trim()}
            onClick={handleCheckAnswer}
            className="font-black"
          >
            {t("quizCheck")}
          </Button>
        ) : (
          <Button variant="torii" size="lg" loading={submitting} onClick={handleNextQuestion} className="font-black">
            {queue.length > 1 ? (
              <>
                {t("quizContinue")} <IconArrowRight width={18} height={18} />
              </>
            ) : (
              t("testSubmitBtn")
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
