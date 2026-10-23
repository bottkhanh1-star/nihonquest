"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, EmptyState, Icon, Modal, type IconName } from "@/components/ui";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { notifyProgressUpdated } from "@/components/UserProgressContext";
import { getReviewFrontPrompt, type EnrichedReviewItem } from "@/lib/review/resolveReviewItem";
import { updateSrs } from "@/lib/srs";
import { useNativeLanguage } from "@/components/LanguageContext";
import { LocalizedVocabMeaning, prefetchVocabTranslations, findVocabEnglishMeaning } from "@/lib/vocabLocalization";
import { LocalizedGrammarText } from "@/lib/grammarLocalization";
import { useAiScreenContext } from "@/components/ai-sensei/AiScreenContext";

type Grade = "AGAIN" | "HARD" | "GOOD" | "EASY";

/**
 * Interval labels describe the SRS algorithm in lib/srs.ts, they are not
 * decoration. Localized dynamically into learner's native language.
 */
function describeInterval(
  grade: Grade,
  ease: number,
  interval = 0,
  repetitions = 0,
  t?: (key: string, params?: Record<string, any>) => string
): string {
  const next = updateSrs({ ease, interval, repetitions }, grade);
  if (next.dueInDays <= 0) return t ? t("srsDueImmediately") : "Ôn lại ngay";
  if (next.dueInDays < 1) return t ? t("srsDueIn1Day") : "Trong 1 ngày nữa";
  if (next.dueInDays < 7) {
    const days = Math.round(next.dueInDays);
    return t ? t("srsDueInDays", { days }) : `~${days} ngày nữa`;
  }
  if (next.dueInDays < 30) {
    const weeks = Math.round(next.dueInDays / 7);
    return t ? t("srsDueInWeeks", { weeks }) : `~${weeks} tuần nữa`;
  }
  const months = Math.round(next.dueInDays / 30);
  return t ? t("srsDueInMonths", { months }) : `~${months} tháng nữa`;
}

const GRADES: readonly {
  grade: Grade;
  key: string;
  label: string;
  labelKey: string;
  tone: "again" | "hard" | "good" | "easy";
  icon: IconName;
}[] = [
  { grade: "AGAIN", key: "1", label: "Again", labelKey: "srsGradeAgain", tone: "again", icon: "refresh" },
  { grade: "HARD", key: "2", label: "Hard", labelKey: "srsGradeHard", tone: "hard", icon: "bars" },
  { grade: "GOOD", key: "3", label: "Good", labelKey: "srsGradeGood", tone: "good", icon: "minusCircle" },
  { grade: "EASY", key: "4", label: "Easy", labelKey: "srsGradeEasy", tone: "easy", icon: "sparkle" },
];

const RATES = [0.6, 0.75, 0.85, 1, 1.2];

// Cỡ chữ thích ứng theo độ dài nội dung mặt thẻ
const termSize = (text: string) => {
  const len = text ? text.trim().length : 0;
  if (len <= 2) return "xl";
  if (len <= 8) return "lg";
  if (len <= 20) return "md";
  if (len <= 45) return "sm";
  return "xs";
};

// ======================== Nút phát âm dùng lại ở cột "Hàng đợi" ========================
export function SpeakButton({ text, className = "rv-icon-btn", size = 16 }: { text: string; className?: string; size?: number }) {
  const { speak, stopSpeaking, speakingText } = useSoundAndTheme();
  const isPlaying = speakingText === text;
  return (
    <button
      type="button"
      className={`${className} ${isPlaying ? "text-red-500 animate-pulse ring-1 ring-red-400" : ""}`}
      aria-label={isPlaying ? `Dừng phát âm: ${text}` : `Phát âm: ${text}`}
      title={isPlaying ? "Dừng phát âm" : "Phát âm tiếng Nhật"}
      onClick={(e) => {
        e.stopPropagation();
        if (isPlaying) {
          stopSpeaking();
        } else {
          speak(text);
        }
      }}
    >
      {isPlaying ? <span className="text-xs">⏹️</span> : <Icon name="speaker" size={size} />}
    </button>
  );
}

// ======================== Nút + hộp thoại "Cài đặt ôn tập" ========================
export function ReviewSettingsButton() {
  const [open, setOpen] = useState(false);
  const { t, nativeLanguage } = useNativeLanguage();
  const {
    soundEnabled,
    setSoundEnabled,
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    setSpeechVoiceURI,
    availableVoices,
    speak,
    playClick,
  } = useSoundAndTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="rv-chip-btn"
        onClick={() => {
          playClick();
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        <Icon name="settings" size={17} />
        {t("srsSettingsTitle")}
      </button>

      {open &&
        createPortal(
          <div className="rv-page">
            <Modal isOpen={open} onClose={() => setOpen(false)} title={t("srsSettingsTitle")} maxWidth="md">
              <div className="rv-set">
                <div className="rv-set-row">
                  <span>{t("srsSoundEffects")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={soundEnabled}
                    aria-label={t("srsSoundEffects")}
                    className="rv-switch"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  />
                </div>

                <div>
                  <h4>{t("srsSpeechRate")}</h4>
                  <div className="rv-set-chips">
                    {RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        aria-pressed={Math.abs(rate - speechRate) < 0.001}
                        onClick={() => {
                          setSpeechRate(rate);
                          speak("ありがとう", rate);
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4>{t("srsSpeechVoice")}</h4>
                  <select value={speechVoiceURI} onChange={(e) => setSpeechVoiceURI(e.target.value)}>
                    <option value="">{t("srsDefaultVoice")}</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <h4>{t("srsShortcuts")}</h4>
                  <p>{t("srsShortcutsDesc")}</p>
                </div>

                <div>
                  <h4>{t("srsHowItWorks")}</h4>
                  <p>{t("srsHowItWorksDesc")}</p>
                </div>
              </div>
            </Modal>
          </div>,
          document.body
        )}
    </>
  );
}

// ======================== Phiên ôn tập ========================
function formatSubtitle(subtitle: string, contentType: string, t: (k: string) => string): string {
  if (contentType === "KANJI") return t("vocabTabKanji") || "Kanji";
  if (contentType === "GRAMMAR") return t("navGrammar") || "Grammar";
  if (contentType === "EXERCISE") return t("practiceQuestion") || "Exercise";
  if (contentType === "KANA") return subtitle;
  if (contentType === "VOCAB") {
    const parts = subtitle.split("·");
    const pos = parts[1]?.trim() || "";
    const posKey = pos ? `pos${pos.charAt(0).toUpperCase() + pos.slice(1)}` : "";
    const posLabel = posKey ? t(posKey) : pos;
    return `${t("navVocab")}${posLabel ? ` · ${posLabel}` : ""}`;
  }
  return subtitle;
}

export function QueueItemSubtitle({ subtitle, contentType }: { subtitle: string; contentType: string }) {
  const { t } = useNativeLanguage();
  return <small className="jp-text">{formatSubtitle(subtitle, contentType, t)}</small>;
}

export function ReviewClient({ initial, backgrounds = [] }: { initial: EnrichedReviewItem[]; backgrounds?: string[] }) {
  const router = useRouter();
  const { playClick, playCorrect, playIncorrect, playFanfare, showToast } = useSoundAndTheme();
  const { t, nativeLanguage } = useNativeLanguage();

  const [items, setItems] = useState<EnrichedReviewItem[]>(initial);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionTotal] = useState(initial.length);
  const [done, setDone] = useState(0);
  const { setScreenItem, recordSessionMistake } = useAiScreenContext();
  const currentItem = items[currentIndex];

  // Sync current review item into global AI Sensei context for instant screen-awareness
  useEffect(() => {
    if (currentItem) {
      setScreenItem(
        {
          term: currentItem.title,
          reading: currentItem.reading,
          meaning: currentItem.extra || currentItem.subtitle,
          type: currentItem.contentType as any,
          isFlipped,
        },
        `Ôn tập SRS · ${currentItem.title}`
      );
    } else {
      setScreenItem(null);
    }
  }, [currentItem, isFlipped, setScreenItem]);

  // Batch prefetch translations for all cards in the queue whenever items or language change
  useEffect(() => {
    if (nativeLanguage === "vi" || !items.length) return;
    const toPrefetch = items.map((item) => ({
      japanese: item.title,
      kana: item.reading,
      fallback: item.extra || item.subtitle,
    }));
    prefetchVocabTranslations(toPrefetch, nativeLanguage);
  }, [items, nativeLanguage]);

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!currentItem || submitting) return;
      setSubmitting(true);
      playClick();

      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewItemId: currentItem.id, grade }),
        });

        if (!res.ok) {
          showToast({ title: t("errorText"), type: "error" });
          setSubmitting(false);
          return;
        }

        if (grade === "AGAIN") playIncorrect();
        else playCorrect();
        setIsFlipped(false);

        // Record weak memory / mistake to AI Sensei context
        if (grade === "AGAIN" || grade === "HARD") {
          recordSessionMistake({
            term: currentItem.title,
            reading: currentItem.reading,
            meaning: currentItem.extra || currentItem.subtitle,
            type: currentItem.contentType,
            wrongAnswer: grade === "AGAIN" ? "Quên (Bấm Again)" : "Khó nhớ (Bấm Hard)",
          });
        }

        if (grade === "AGAIN") {
          // Move the card to the back of the session queue.
          // The next card in sequence is now shifted into currentIndex.
          const requeued = [...items];
          const [card] = requeued.splice(currentIndex, 1);
          requeued.push(card);
          setItems(requeued);
          setCurrentIndex((idx) => (idx >= requeued.length ? 0 : idx));
        } else {
          const nextItems = items.filter((_, idx) => idx !== currentIndex);
          setItems(nextItems);
          setDone((d) => d + 1);

          if (nextItems.length === 0) {
            playFanfare();
            // Ask the server for the bonus and report what it actually granted
            // instead of promising a fixed amount it might refuse.
            const dayKey = new Intl.DateTimeFormat("en-CA").format(new Date());
            let xpAwarded = 0;
            try {
              const bonusRes = await fetch("/api/activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "REVIEW_COMPLETE", dayKey }),
              });
              if (bonusRes.ok) {
                const data = (await bonusRes.json()) as { xpAwarded?: number };
                xpAwarded = data.xpAwarded ?? 0;
              }
            } catch {
              xpAwarded = 0;
            }

            showToast({
              title:
                xpAwarded > 0
                  ? `${t("srsSessionComplete")} +${xpAwarded} XP`
                  : t("srsSessionComplete"),
              description: t("srsSessionCompleteDesc"),
              type: "achievement",
            });
            notifyProgressUpdated();
            router.refresh();
          } else {
            setCurrentIndex((prev) => (prev >= nextItems.length ? 0 : prev));
          }
        }
      } catch {
        showToast({ title: t("errorText"), type: "error" });
      }
      setSubmitting(false);
    },
    [currentItem, submitting, items, currentIndex, playClick, playCorrect, playIncorrect, playFanfare, showToast, router, t]
  );

  // Xem thẻ trước / sau mà không chấm điểm (không đổi lịch SRS)
  const goStep = useCallback(
    (dir: 1 | -1) => {
      const n = items.length;
      if (n < 2) return;
      setCurrentIndex((i) => (i + dir + n) % n);
      setIsFlipped(false);
    },
    [items.length]
  );

  // Phím tắt: Space lật thẻ, ←/→ đổi thẻ, 1–4 chấm điểm (sau khi lật)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (document.querySelector('[aria-modal="true"]')) return; // đang mở hộp thoại / menu
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        goStep(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if ((e.key === " " || e.code === "Space") && !submitting) {
        e.preventDefault();
        if (!e.repeat) setIsFlipped((f) => !f);
        return;
      }
      if (isFlipped && !submitting) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) handleGrade(g.grade);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFlipped, submitting, handleGrade, goStep]);

  if (!items.length || !currentItem) {
    return (
      <div className="rv-empty">
        <EmptyState
          icon="🧠✨"
          title={t("srsEmptyTitle")}
          body={t("srsEmptyBody")}
          action={
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/app/practice">
                <Button variant="torii" size="md" className="font-bold">
                  {t("continueLesson")}
                </Button>
              </Link>
              <Link href="/app">
                <Button variant="secondary" size="md" className="font-bold">
                  Dashboard
                </Button>
              </Link>
            </div>
          }
        />

        <Card className="p-4 border-dashed border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-sumi-900/50 space-y-2">
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Icon name="bulb" size={15} /> {t("srsMechanismTitle")}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t("srsMechanismDesc")}
          </p>
        </Card>
      </div>
    );
  }

  const isJapaneseText =
    currentItem.contentType === "KANA" || currentItem.contentType === "VOCAB" || currentItem.contentType === "KANJI";
  const jlptLabel = currentItem.contentType === "KANA" ? "KANA" : `JLPT ${currentItem.level || "N5"}`;
  const position = Math.min(done + 1, sessionTotal);
  const frontPrompt = getReviewFrontPrompt(currentItem);
  const frontSize = termSize(frontPrompt);
  const rawBackSize = termSize(currentItem.title);
  const backSize = rawBackSize === "xl" || rawBackSize === "lg" ? "md" : rawBackSize;
  const showReading = Boolean(currentItem.reading) && currentItem.reading !== currentItem.title;
  const isLongReading = (currentItem.reading || "").length > 16 || currentItem.contentType === "GRAMMAR";
  const romaji = currentItem.romaji;
  const showRomaji = Boolean(romaji) && romaji !== currentItem.reading && romaji !== currentItem.title;
  const meaning = currentItem.extra || currentItem.subtitle;
  const tip =
    currentItem.contentType === "KANA"
      ? (nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? `大声朗读“${frontPrompt}”三遍，并在纸上书写一次——视听写结合能让笔顺记忆更深刻。` : nativeLanguage === "en" ? `Read "${frontPrompt}" out loud three times and write it once — multi-sensory practice locks stroke memory in.` : `Đọc to “${frontPrompt}” ba lần rồi viết ra giấy một lần — vừa nghe vừa viết giúp bạn nhớ nét chữ lâu hơn.`)
      : (nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW" ? `尝试将“${frontPrompt}”与你经历过的真实生活场景或具象画面联系起来，生动的联想能让记忆更牢固！` : nativeLanguage === "en" ? `Associate "${frontPrompt}" with a concrete real-life image or situation — visual associations anchor long-term recall!` : `Hãy liên tưởng “${frontPrompt}” với một hình ảnh hoặc tình huống thật bạn từng gặp. Hình ảnh cụ thể sẽ giúp bạn nhớ lâu hơn!`);

  const flip = () => setIsFlipped((f) => !f);

  // Mỗi thẻ một phong cảnh, xoay vòng qua các ảnh trong public/images/SRS_card/back/
  const bg = backgrounds.length ? backgrounds[(done + currentIndex) % backgrounds.length] : null;
  const flashStyle = bg ? ({ "--rv-card-img": `url("${bg}")` } as CSSProperties) : undefined;

  const renderFace = (back: boolean) => (
    <div className={`rv-face ${back ? "is-back" : ""}`} aria-hidden={back ? !isFlipped : isFlipped}>
      <div className="rv-face-top">
        <span className="rv-count">
          {position} / {sessionTotal}
        </span>
        <span className="rv-jlpt">{jlptLabel}</span>
      </div>
      <div className="rv-face-main">
        <div className="rv-paper">
          <div className="rv-paper-body">
            <span className={`rv-type-tag ${back ? "is-answer" : ""}`}>
              {back
                ? `${t("srsAnswer")} · ${formatSubtitle(currentItem.subtitle, currentItem.contentType, t)}`
                : formatSubtitle(currentItem.subtitle, currentItem.contentType, t)}
            </span>
            {back ? (
              <>
                {/* 1. Phát âm / Romaji + Kana reading */}
                <div className="rv-pronunciation-block">
                  {(currentItem.displayRomaji || romaji) && (
                    <p className="rv-romaji">{currentItem.displayRomaji || romaji}</p>
                  )}
                  {showReading && (
                    <p className={`rv-reading jp-text ${isLongReading ? "is-long" : ""}`}>{currentItem.reading}</p>
                  )}
                </div>

                {/* 2. Chữ viết tiếng Nhật */}
                <p className={`rv-term-text rv-fs-${backSize} jp-text`}>
                  {currentItem.japaneseWithReading || currentItem.title}
                </p>

                {/* 3. Nghĩa đa ngôn ngữ & Hán Việt tách biệt */}
                {meaning && (
                  <p className="rv-meaning">
                    {currentItem.contentType === "GRAMMAR" ? (
                      <LocalizedGrammarText
                        key={`${currentItem.id}-${nativeLanguage}`}
                        text={meaning}
                        keyContext={currentItem.title}
                      />
                    ) : (
                      <LocalizedVocabMeaning
                        key={`${currentItem.id}-${nativeLanguage}`}
                        japanese={currentItem.title}
                        kana={currentItem.reading}
                        fallback={meaning}
                        englishMeaning={findVocabEnglishMeaning(currentItem.title, currentItem.reading) || undefined}
                      />
                    )}
                  </p>
                )}
                {currentItem.hanVietNote && nativeLanguage === "vi" && (
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                    Hán Việt: {currentItem.hanVietNote}
                  </p>
                )}
              </>
            ) : (
              <p className={`rv-term-text rv-fs-${frontSize} jp-text`}>{frontPrompt}</p>
            )}
          </div>
          <div className="rv-paper-bottom">
            {isJapaneseText ? (
              <SpeakButton text={back ? (currentItem.reading || currentItem.title) : frontPrompt} className="rv-speak" size={20} />
            ) : (
              <span />
            )}
            {back ? (
              <div className="rv-paper-foot">
                <span>{t("srsReinforced")}: {currentItem.repetitions} {t("srsTimes")}</span>
                <span>{t("srsCurrentInterval")}: {currentItem.interval} {t("srsDays")}</span>
              </div>
            ) : (
              <span className="rv-flip-prompt">{t("srsTapToFlip")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rv-session">
      <div
        className="rv-flash"
        style={flashStyle}
        tabIndex={0}
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) {
            e.preventDefault();
            flip();
          }
        }}
      >
        <div className={`rv-flash-inner ${isFlipped ? "is-flipped" : ""}`}>
          {renderFace(false)}
          {renderFace(true)}
        </div>

        {items.length > 1 && (
          <>
            <button
              type="button"
              className="rv-nav is-prev"
              aria-label={t("srsPrevCard")}
              onClick={(e) => {
                e.stopPropagation();
                playClick();
                goStep(-1);
              }}
            >
              <Icon name="arrowRight" size={22} />
            </button>
            <button
              type="button"
              className="rv-nav is-next"
              aria-label={t("srsNextCard")}
              onClick={(e) => {
                e.stopPropagation();
                playClick();
                goStep(1);
              }}
            >
              <Icon name="arrowRight" size={22} />
            </button>
          </>
        )}
      </div>

      <div className="rv-hint">
        <Icon name="tap" size={18} />
        <span>{isFlipped ? t("srsTapToFlipBack") : t("srsTapToSeeMeaning")}</span>
        <kbd>Space</kbd>
      </div>

      <div className="rv-grades" role="group" aria-label={t("srsGradeAria")}>
        {GRADES.map((g) => (
          <button
            key={g.grade}
            type="button"
            className="rv-grade"
            data-tone={g.tone}
            // Grading an unseen card corrupts the schedule. The keyboard path
            // already checked this; the mouse path did not.
            disabled={submitting || !isFlipped}
            aria-keyshortcuts={g.key}
            onClick={() => handleGrade(g.grade)}
          >
            <Icon name={g.icon} size={26} strokeWidth={2.1} />
            <b>{t(g.labelKey) || g.label}</b>
            <small>{describeInterval(g.grade, currentItem.ease, currentItem.interval, currentItem.repetitions, t)}</small>
          </button>
        ))}
      </div>

      <div className="rv-tip">
        <Icon name="bulb" size={24} className="rv-tip-icon" />
        <div>
          <b>{t("srsMemoryTip")}</b>
          <small>{tip}</small>
        </div>
        <Link href="/app/vocabulary">
          <Icon name="image" size={16} />
          {t("srsViewExamples")}
          <Icon name="external" size={15} />
        </Link>
      </div>
    </div>
  );
}