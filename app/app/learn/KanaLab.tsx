"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { KanaWriter } from "@/components/KanaWriter";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { notifyProgressUpdated } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getLocalizedRowLabel } from "@/lib/lessonLocalization";

export interface KanaRow {
  id: string;
  character: string;
  script: string;
  romaji: string;
  ipa: string | null;
  row: string;
  column: string | null;
  kind: string;
}

type TabId = "HIRAGANA" | "KATAKANA" | "DAKUTEN" | "COMBO";

const GOJUON_ROW_ORDER = ["a", "ka", "sa", "ta", "na", "ha", "ma", "ya", "ra", "wa", "n"];
const DAKUTEN_ROW_ORDER = ["ga", "za", "da", "ba", "pa"];
const COMBO_ROW_ORDER = ["kya", "sha", "cha", "nya", "hya", "mya", "rya", "gya", "ja", "bya", "pya"];

const ROW_LABELS: Record<string, string> = {
  a: "Hàng A (あ・ア)", ka: "Hàng Ka (か・カ)", sa: "Hàng Sa (さ・サ)", ta: "Hàng Ta (た・タ)", na: "Hàng Na (な・ナ)",
  ha: "Hàng Ha (は・ハ)", ma: "Hàng Ma (ま・マ)", ya: "Hàng Ya (や・ヤ)", ra: "Hàng Ra (ら・ラ)", wa: "Hàng Wa (わ・ワ)",
  n: "Âm mũi N (ん・ン)", ga: "Hàng Ga (が・ガ)", za: "Hàng Za (ざ・ザ)", da: "Hàng Da (だ・ダ)", ba: "Hàng Ba (ば・バ)",
  pa: "Hàng Pa (ぱ・パ)", kya: "Hàng Kya (きゃ)", sha: "Hàng Sha (しゃ)", cha: "Hàng Cha (ちゃ)", nya: "Hàng Nya (にゃ)",
  hya: "Hàng Hya (ひゃ)", mya: "Hàng Mya (みゃ)", rya: "Hàng Rya (りゃ)", gya: "Hàng Gya (ぎゃ)", ja: "Hàng Ja (じゃ)",
  bya: "Hàng Bya (びゃ)", pya: "Hàng Pya (ぴゃ)",
};

const VOWEL_COLUMNS = ["a", "i", "u", "e", "o"];
const COMBO_COLUMNS = ["a", "u", "o"];

const TABS: { id: TabId; labelKey?: string; fallback: string }[] = [
  { id: "HIRAGANA", fallback: "Hiragana" },
  { id: "KATAKANA", fallback: "Katakana" },
  { id: "DAKUTEN", labelKey: "tabDakutenLabel", fallback: "Biến âm" },
  { id: "COMBO", labelKey: "tabComboLabel", fallback: "Âm ghép Yōon" },
];

const inTab = (k: KanaRow, tab: TabId, subScript?: "HIRAGANA" | "KATAKANA") => {
  if (tab === "COMBO") return k.kind === "COMBO" && (!subScript || k.script === subScript);
  if (tab === "DAKUTEN") return (k.kind === "DAKUTEN" || k.kind === "HANDAKUTEN") && (!subScript || k.script === subScript);
  return k.script === tab && k.kind === "BASIC";
};

export function KanaLab({ kana, practiced }: { kana: KanaRow[]; practiced: string[] }) {
  const [activeTab, setActiveTab] = useState<TabId>("HIRAGANA");
  const [subScript, setSubScript] = useState<"HIRAGANA" | "KATAKANA">("HIRAGANA");
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [writingTarget, setWritingTarget] = useState<KanaRow | null>(null);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set(practiced));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { playClick, playCorrect, showToast, speak: globalSpeak } = useSoundAndTheme();
  const { t, nativeLanguage } = useNativeLanguage();

  const activeKanaList = useMemo(
    () => kana.filter((k) => inTab(k, activeTab, subScript)),
    [kana, activeTab, subScript]
  );
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, kana.filter((k) => inTab(k, t.id)).length])) as Record<TabId, number>,
    [kana]
  );

  const rowOrder = activeTab === "COMBO" ? COMBO_ROW_ORDER : activeTab === "DAKUTEN" ? DAKUTEN_ROW_ORDER : GOJUON_ROW_ORDER;
  const colOrder = activeTab === "COMBO" ? COMBO_COLUMNS : VOWEL_COLUMNS;

  const groupedRows = useMemo(
    () =>
      rowOrder.map((rowKey) => {
        const rowKana = activeKanaList.filter((k) => k.row === rowKey);
        const cells: (KanaRow | null)[] = colOrder.map((colKey) =>
          rowKey === "n" && colKey === "a" ? rowKana.find((k) => k.row === "n") || null : rowKana.find((k) => k.column === colKey) || null,
        );
        const baseLabel = ROW_LABELS[rowKey] || `Hàng ${rowKey.toUpperCase()}`;
        const label = getLocalizedRowLabel(rowKey, nativeLanguage, baseLabel);
        return { rowKey, label, cells };
      }),
    [activeKanaList, rowOrder, colOrder, nativeLanguage],
  );

  const speak = (character: string) => {
    try { globalSpeak(character, audioSpeed); } catch {}
  };

  const markPracticed = async (k: KanaRow) => {
    playClick();
    const key = `${k.script}:${k.character}`;
    if (pendingKey === key) return;
    setPendingKey(key);
    try {
      const res = await fetch("/api/kana/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: k.character, script: k.script }),
      });
      if (res.ok) {
        setDoneSet((prev) => new Set(prev).add(key));
        playCorrect();
        notifyProgressUpdated();
        showToast({
          title: `${t("markedRemembered")}: ${k.character} (${k.romaji})!`,
          description: t("quizSrsSavedNotice") || "Đã thêm vào hàng đợi ôn tập Spaced Repetition!",
          type: "xp",
        });
      } else {
        showToast({ title: t("errorText"), description: `Server error ${res.status}`, type: "error" });
      }
    } catch {
      showToast({ title: t("errorText"), description: "Connection error", type: "error" });
    } finally {
      setPendingKey(null);
    }
  };

  const total = activeKanaList.length;
  const learned = activeKanaList.filter((k) => doneSet.has(`${k.script}:${k.character}`)).length;
  const pct = total ? (learned / total) * 100 : 0;
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="kl">
      <div className="kl-banner">
        <div className="kl-banner-copy">
          <span className="kl-flag">● Kana Lab · 五十音図</span>
          <h3>{t("gojuonTitle")}</h3>
          <p>
            {t("gojuonDesc")}
          </p>
          <a href="#kl-table" className="kl-banner-btn">{t("startPracticingBtn")}</a>
        </div>
        <div className="kl-progress" role="img" aria-label={`${t("currentProgress")} ${learned} / ${total}`}>
          <small>{t("currentProgress")}</small>
          <div className="kl-progress-row">
            <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
              <circle cx="42" cy="42" r={R} className="kl-ring-bg" />
              <circle cx="42" cy="42" r={R} className="kl-ring" strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 42 42)" />
            </svg>
            <b>{learned} / {total}</b>
          </div>
        </div>
      </div>

      <div id="kl-table" className="kl-bar">
        <div className="kl-tabs" role="tablist" aria-label="Chọn bảng kana">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tabItem.id}
              className={activeTab === tabItem.id ? "is-active" : ""}
              onClick={() => { playClick(); setActiveTab(tabItem.id); }}
            >
              {tabItem.labelKey ? (t(tabItem.labelKey) || tabItem.fallback) : tabItem.fallback} <span>({counts[tabItem.id]})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === "DAKUTEN" || activeTab === "COMBO") && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold dark:border-slate-700 dark:bg-sumi-900" role="group" aria-label="Chọn bảng chữ biến âm / âm ghép">
              <button
                type="button"
                onClick={() => { playClick(); setSubScript("HIRAGANA"); }}
                className={`rounded-lg px-3 py-1.5 transition ${subScript === "HIRAGANA" ? "bg-white text-red-600 shadow-xs dark:bg-sumi-800 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}
              >
                あ Hiragana
              </button>
              <button
                type="button"
                onClick={() => { playClick(); setSubScript("KATAKANA"); }}
                className={`rounded-lg px-3 py-1.5 transition ${subScript === "KATAKANA" ? "bg-white text-red-600 shadow-xs dark:bg-sumi-800 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}
              >
                ア Katakana
              </button>
            </div>
          )}
          <button
            type="button"
            className={`kl-speed ${audioSpeed === 0.75 ? "is-slow" : ""}`}
            aria-pressed={audioSpeed === 0.75}
            onClick={() => { playClick(); setAudioSpeed(audioSpeed === 1.0 ? 0.75 : 1.0); }}
          >
            {audioSpeed === 0.75 ? t("slowSpeed") : t("normalSpeed")}
          </button>
        </div>
      </div>

      <div className="kl-rows">
        {groupedRows.map((row) => (
          <section key={row.rowKey} className="kl-row">
            <h4><i aria-hidden="true" />{row.label}</h4>
            <div className="kl-cards" data-cols={colOrder.length}>
              {row.cells.map((k, i) => {
                if (!k) return <div key={`e${i}`} className="kl-empty" aria-hidden="true">—</div>;
                const key = `${k.script}:${k.character}`;
                const isDone = doneSet.has(key);
                const long = Array.from(k.character).length > 1;
                return (
                  <div key={k.id} className={`kl-card ${isDone ? "is-done" : ""}`}>
                    <span className="kl-badge">{isDone ? t("masteredBadge") : t("statusNotStarted")}</span>
                    <div className={`kl-glyph jp-text ${long ? "is-combo" : ""}`}>{k.character}</div>
                    <div className="kl-romaji">{k.romaji}</div>
                    <div className="kl-btns">
                      <button type="button" onClick={() => speak(k.character)} aria-label={`${t("listenPronunciation")} ${k.romaji}`}>🔊 {t("listenAction")}</button>
                      <button type="button" className="is-primary" onClick={() => { playClick(); setWritingTarget(k); }} aria-label={`${t("practiceWritingKana")} ${k.romaji}`}>✍ {t("writeAction")}</button>
                    </div>
                    <button type="button" className="kl-mark" onClick={() => markPracticed(k)} disabled={pendingKey === key} aria-pressed={isDone}>
                      {isDone ? t("markedRemembered") : t("markRemembered")}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {writingTarget && (
        <Modal isOpen onClose={() => setWritingTarget(null)} title={`${t("practiceWritingKana")} — ${writingTarget.character}`} maxWidth="2xl" closeOnBackdrop={false}>
          <KanaWriter
            key={writingTarget.id}
            character={writingTarget.character}
            romaji={writingTarget.romaji}
            script={writingTarget.script}
            onPass={() => setDoneSet((prev) => new Set(prev).add(`${writingTarget.script}:${writingTarget.character}`))}
            onClose={() => setWritingTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
