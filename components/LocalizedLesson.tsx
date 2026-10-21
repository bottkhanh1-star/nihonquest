"use client";

import React from "react";
import { useNativeLanguage } from "@/components/LanguageContext";
import {
  getLocalizedLessonTitle,
  getLocalizedLessonDesc,
  getLocalizedRoadmapLabel,
  getLocalizedUnitTitle,
  getLocalizedUnitDesc,
  getLocalizedTrackTitle,
  getLocalizedShortTrackLabel,
  getLocalizedGenkiReference,
  getLocalizedPathName,
  getLocalizedPathTagline,
  getLocalizedDailyMinutes,
} from "@/lib/lessonLocalization";

export { getLocalizedTrackTitle, getLocalizedShortTrackLabel, getLocalizedGenkiReference };
import {
  getLocalizedMissionTitle,
  getLocalizedJourneyDescription,
  getLocalizedJourneyName,
} from "@/lib/metaLocalization";

export function LocalizedLessonTitle({
  slug,
  fallback,
  className,
}: {
  slug?: string | null;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  const text = getLocalizedLessonTitle(slug, nativeLanguage, fallback);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function LocalizedLessonDesc({
  slug,
  fallback,
  className,
}: {
  slug?: string | null;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  const text = getLocalizedLessonDesc(slug, nativeLanguage, fallback);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function LocalizedRoadmapTag({
  tagKey,
  fallback,
  className,
}: {
  tagKey: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedRoadmapLabel(tagKey, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedUnitTitle({
  level,
  unitNumber,
  fallback,
  className,
}: {
  level: string;
  unitNumber: number;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedUnitTitle(level, unitNumber, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedUnitDesc({
  level,
  unitNumber,
  fallback,
  className,
}: {
  level: string;
  unitNumber: number;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedUnitDesc(level, unitNumber, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedTrackTitle({
  trackId,
  fallback,
  className,
}: {
  trackId?: string | null;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedTrackTitle(trackId, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedShortTrackLabel({
  label,
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedShortTrackLabel(label, nativeLanguage)}
    </span>
  );
}

export function LocalizedGenkiRef({
  refString,
  className,
}: {
  refString?: string | null;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedGenkiReference(refString, nativeLanguage)}
    </span>
  );
}

export function LocalizedPathName({
  goal,
  style,
  fallback,
  className,
}: {
  goal: string;
  style: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedPathName(goal, style, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedPathTagline({
  goal,
  style,
  level,
  skill,
  fallback,
  className,
}: {
  goal: string;
  style: string;
  level: string;
  skill: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedPathTagline(goal, style, level, skill, nativeLanguage, fallback)}
    </span>
  );
}

export function LocalizedDailyMinutes({
  minutes,
  className,
}: {
  minutes: number;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedDailyMinutes(minutes, nativeLanguage)}
    </span>
  );
}

export function LocalizedMissionTitle({
  missionKey,
  fallback,
  className,
}: {
  missionKey: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  const text = getLocalizedMissionTitle(missionKey, nativeLanguage, fallback);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function LocalizedJourneyDesc({
  slug,
  fallback,
  className,
}: {
  slug: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  const text = getLocalizedJourneyDescription(slug, nativeLanguage, fallback);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function LocalizedJourneyName({
  slug,
  fallback,
  className,
}: {
  slug: string;
  fallback: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  const text = getLocalizedJourneyName(slug, nativeLanguage, fallback);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function getLocalizedChapterLabel(label: string, lang: string): string {
  if (!label) return "";
  if (lang === "vi") return label;

  const introMatch = label.match(/Nhập môn\s*#?(\d+)/i);
  if (introMatch) {
    const num = introMatch[1];
    if (lang === "zh-CN") return `入门 #${num}`;
    if (lang === "zh-TW") return `入門 #${num}`;
    if (lang === "ko") return `입문 #${num}`;
    if (lang === "ja") return `入門 #${num}`;
    return `Intro #${num}`;
  }

  const lessonMatch = label.match(/Bài\s*(\d+)(\s*\(第\d+課\))?/i);
  if (lessonMatch) {
    const num = lessonMatch[1];
    if (lang === "zh-CN") return `第 ${num} 课 (第${num}課)`;
    if (lang === "zh-TW") return `第 ${num} 課 (第${num}課)`;
    if (lang === "ko") return `제 ${num} 과 (第${num}課)`;
    if (lang === "ja") return `第 ${num} 課`;
    return `Lesson ${num} (第${num}課)`;
  }

  const partMatch = label.match(/Part\s*(\d+)(\s*\(第\d+課\))?/i);
  if (partMatch) {
    const num = partMatch[1];
    if (lang === "zh-CN") return `第 ${num} 部分 (第${num}課)`;
    if (lang === "zh-TW") return `第 ${num} 部分 (第${num}課)`;
    if (lang === "ko") return `파트 ${num} (第${num}課)`;
    return `Part ${num} (第${num}課)`;
  }

  return label;
}

export function LocalizedChapterLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedChapterLabel(label, nativeLanguage)}
    </span>
  );
}

export function getLocalizedProvenanceLabel(label: string, provenance: string, lang: string): string {
  if (lang === "vi") return label;

  if (provenance === "APP_AUTHORED" || label.includes("Chuẩn ngữ âm Gojūon")) {
    if (lang === "zh-CN") return "假名基础 • 五十音图标准语音";
    if (lang === "zh-TW") return "假名基礎 • 五十音圖標準語音";
    if (lang === "ko") return "기초 음성 • 오십음도 표준";
    if (lang === "ja") return "五十音図標準";
    return "Foundations • Standard Gojūon Phonetics (五十音図)";
  }

  if (provenance === "TEXTBOOK_VERIFIED") {
    if (lang === "zh-CN") return `权威教材核验${label.includes("FPT") ? " • FPT课程标准" : ""}`;
    if (lang === "zh-TW") return `權威教材核驗${label.includes("FPT") ? " • FPT課程標準" : ""}`;
    if (lang === "ko") return `표준 교재 대조 검증`;
    return `Verified Textbook • ${label.replace(/^TEXTBOOK_VERIFIED\s*•?\s*/i, "").replace("Giáo trình", "Curriculum").replace("Bài", "Lesson")}`;
  }

  if (provenance === "SUPPLEMENTARY_EXPANSION") {
    if (lang === "zh-CN") return "技能补充专题";
    if (lang === "zh-TW") return "技能補充專題";
    if (lang === "ko") return "실전 보충 특강";
    return "Supplementary Skills Module";
  }

  return label;
}

export function LocalizedProvenance({
  label,
  provenance = "APP_AUTHORED",
  className,
}: {
  label: string;
  provenance?: string;
  className?: string;
}) {
  const { nativeLanguage } = useNativeLanguage();
  return (
    <span className={className} suppressHydrationWarning>
      {getLocalizedProvenanceLabel(label, provenance, nativeLanguage)}
    </span>
  );
}


