import { describe, expect, it } from "vitest";
import {
  findVocabEnglishMeaning,
  getPrecompiledVocabMeaning,
  CORE_VOCAB_MAP,
} from "./vocabLocalization";

describe("vocabLocalization engine", () => {
  it("resolves English meanings for high-frequency curated words", () => {
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "en")).toBe("Good morning (polite)");
    expect(getPrecompiledVocabMeaning("ありがとう", undefined, "en")).toBe("Thank you");
    expect(getPrecompiledVocabMeaning("猫", "ねこ", "en")?.toLowerCase()).toBe("cat");
  });

  it("resolves Chinese (Simplified & Traditional) and other locales for curated vocabulary", () => {
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "zh-CN")).toBe("早上好（礼貌）");
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "zh-TW")).toBe("早上好（禮貌）");
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "ko")).toBe("좋은 아침입니다 (존댓말)");
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "es")).toBe("Buenos días (formal)");
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "fr")).toBe("Bonjour (matin, poli)");
  });

  it("finds English meaning offline for standard JLPT vocabulary and Jouyou Kanji", () => {
    // JLPT vocabulary from openjlpt
    const meetEn = findVocabEnglishMeaning("会う", "あう");
    expect(meetEn).toBeTruthy();
    expect(meetEn?.toLowerCase()).toContain("meet");

    const blueEn = findVocabEnglishMeaning("青い", "あおい");
    expect(blueEn).toBeTruthy();
    expect(blueEn?.toLowerCase()).toContain("blue");

    // Jouyou Kanji
    const kanjiStudy = findVocabEnglishMeaning("学");
    expect(kanjiStudy).toBeTruthy();
    expect(kanjiStudy?.toLowerCase()).toContain("learn");

    const kanjiSun = findVocabEnglishMeaning("日");
    expect(kanjiSun).toBeTruthy();
    expect(kanjiSun?.toLowerCase()).toContain("day");
  });

  it("returns null for Vietnamese locale so DB meaning is used directly", () => {
    expect(getPrecompiledVocabMeaning("会う", "あう", "vi")).toBeNull();
    expect(getPrecompiledVocabMeaning("おはようございます", undefined, "vi")).toBeNull();
  });
});
