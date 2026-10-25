"use client";

import React from "react";
import Image from "next/image";
import { useNativeLanguage, getLocalizedQuote } from "@/components/LanguageContext";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import { BrushUnderline, Icon } from "@/components/DashboardArt";
import { useSeason } from "@/components/SeasonContext";
import { AnimeMascot } from "@/components/mascots/AnimeMascot";

interface DashboardHeroProps {
  displayName: string;
  isBeginner: boolean;
  learningGoal?: string;
  focusSkill?: string;
  quote: {
    kanji: string;
    romaji: string;
    meaning: string;
  };
  initialIntro: string;
  initialSkillIntro?: string;
}

export function DashboardHero({
  displayName,
  isBeginner,
  learningGoal,
  focusSkill,
  quote,
  initialIntro,
  initialSkillIntro,
}: DashboardHeroProps) {
  const { nativeLanguage, t } = useNativeLanguage();

  // Resolve localized intro
  let intro = initialIntro;
  if (nativeLanguage !== "vi") {
    if (isBeginner) {
      intro = t("introBeginner");
    } else if (learningGoal === "TRAVEL") {
      intro = t("introTravel");
    } else if (learningGoal === "CONVERSATION") {
      intro = t("introConversation");
    } else {
      intro = t("introGeneral");
    }
  }

  // Resolve localized skill intro
  let skillIntro = initialSkillIntro || "";
  if (nativeLanguage !== "vi") {
    if (focusSkill === "LISTENING") skillIntro = t("focusListening");
    else if (focusSkill === "SPEAKING") skillIntro = t("focusSpeaking");
    else if (focusSkill === "READING") skillIntro = t("focusReading");
    else if (focusSkill === "WRITING") skillIntro = t("focusWriting");
  }

  const localizedQuoteMeaning = getLocalizedQuote(quote.kanji, quote.meaning, nativeLanguage);
  const { config: seasonConfig } = useSeason();

  return (
    <section className="nqd-hero" aria-labelledby="dashboard-title">
      <div className="nqd-hero-copy">
        <div className="flex items-center gap-2 mb-1">
          <span className="nqd-greet">こんにちは、</span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold border"
            style={{
              borderColor: `${seasonConfig.colorHex}40`,
              backgroundColor: `${seasonConfig.colorHex}15`,
              color: seasonConfig.colorHex,
            }}
          >
            <span>{seasonConfig.emoji}</span>
            <span>{seasonConfig.nameVi}</span>
          </span>
        </div>
        <h1 id="dashboard-title" className="nqd-name">
          {displayName}!
          <BrushUnderline />
        </h1>
        <p suppressHydrationWarning>
          {intro}
          {skillIntro ? ` ${skillIntro}` : ""}
        </p>
      </div>

      <div className="nqd-hero-scene" aria-hidden="true">
        <Image
          src={BASE64_IMAGES.fujiDash}
          unoptimized
          alt=""
          fill
          priority
          sizes="(max-width: 1100px) 100vw, 800px"
        />
      </div>

      <div className="nqd-stamp-wrap" aria-hidden="true">
        <div className="nqd-stamp">
          <span>一歩ずつ</span>
          <span>夢に近づく</span>
        </div>
        <span className="nqd-stamp-flower">
          <Icon name="sakura" size={26} />
        </span>
      </div>

      {/* 3D Anime Mascot Figurine */}
      <div className="absolute right-6 bottom-3 z-10 hidden xl:block">
        <AnimeMascot kind="shiba" mood="cheer" size={72} speech="がんばって!" />
      </div>

      <aside className="nqd-card nqd-hero-quote" aria-label={t("dailyQuoteTitle") || "Câu nói truyền cảm hứng hôm nay"}>
        <b>{quote.kanji}</b>
        <em>{quote.romaji}</em>
        <p suppressHydrationWarning>{localizedQuoteMeaning}</p>
        <span className="dash" aria-hidden="true" />
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </aside>
    </section>
  );
}

