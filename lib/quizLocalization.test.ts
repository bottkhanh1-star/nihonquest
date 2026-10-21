import { describe, it, expect } from "vitest";
import {
  getPatternTranslation,
  getQuizOptionTranslation,
  QUIZ_OPTIONS_MAP,
} from "./quizLocalization";

describe("Quiz and Exercise Localization (lib/quizLocalization)", () => {
  it("translates common Kana recognition question patterns into English", () => {
    const q1 = "Chữ cái nào sau đây là chữ 'a' (あ)?";
    expect(getPatternTranslation(q1, "en")).toBe("Which of the following characters is 'a' (あ)?");

    const q2 = "Chữ 'い' được đọc là gì trong phiên âm Romaji?";
    expect(getPatternTranslation(q2, "en")).toBe("How is the character 'い' read in Romaji?");

    const q3 = "Chữ Hiragana tương ứng với âm 'u' là gì?";
    expect(getPatternTranslation(q3, "en")).toBe("Which Hiragana character corresponds to the sound 'u'?");

    const q4 = "Chữ cái nào là chữ 'o' (お)?";
    expect(getPatternTranslation(q4, "en")).toBe("Which character is 'o' (お)?");
  });

  it("translates question patterns into Chinese (zh-CN and zh-TW)", () => {
    const q1 = "Chữ cái nào sau đây là chữ 'a' (あ)?";
    expect(getPatternTranslation(q1, "zh-CN")).toBe("下列哪个字符是“a”（あ）？");
    expect(getPatternTranslation(q1, "zh-TW")).toBe("下列哪個字符是「a」（あ）？");

    const q2 = "Chữ 'い' được đọc là gì trong phiên âm Romaji?";
    expect(getPatternTranslation(q2, "zh-CN")).toBe("字符“い”在罗马字中怎么读？");
    expect(getPatternTranslation(q2, "zh-TW")).toBe("字符「い」在羅馬字中怎麼讀？");
  });

  it("translates question patterns into Korean", () => {
    const q1 = "Chữ cái nào sau đây là chữ 'a' (あ)?";
    expect(getPatternTranslation(q1, "ko")).toBe("다음 중 'a'(あ)에 해당하는 글자는 무엇인가요?");
  });

  it("translates word building questions", () => {
    const qWord1 = "Từ ghép 'あい' (ai) trong tiếng Nhật có nghĩa là gì?";
    expect(getPatternTranslation(qWord1, "en")).toBe("What does the word 'あい' (ai) mean in Japanese?");
    expect(getPatternTranslation(qWord1, "zh-CN")).toBe("日语词汇“あい”(ai) 是什么意思？");

    const qWord2 = "Từ 'いえ' (ie) có nghĩa là gì?";
    expect(getPatternTranslation(qWord2, "en")).toBe("What does the word 'いえ' (ie) mean?");
    expect(getPatternTranslation(qWord2, "zh-CN")).toBe("词汇“いえ”(ie) 是什么意思？");

    const qPos = "Từ 'うえ' (ue) có nghĩa là vị trí nào?";
    expect(getPatternTranslation(qPos, "en")).toBe("What position does the word 'うえ' (ue) refer to?");

    const qVerb = "Từ 'あう' (au) là động từ có nghĩa là gì?";
    expect(getPatternTranslation(qVerb, "en")).toBe("What does the verb 'あう' (au) mean?");
  });

  it("translates grammar and fill-in-the-blank question patterns", () => {
    const qParticle = "Điền trợ từ thích hợp vào chỗ trống: わたし___ 学生です。";
    expect(getPatternTranslation(qParticle, "en")).toBe("Fill in the appropriate particle in the blank: わたし___ 学生です。");
    expect(getPatternTranslation(qParticle, "zh-CN")).toBe("在空格中填入恰当的助词：わたし___ 学生です。");

    const qMeaning = "Chọn nghĩa đúng của từ '本':";
    expect(getPatternTranslation(qMeaning, "en")).toBe("Choose the correct meaning of '本':");

    const qRead = "Cách đọc Hiragana của từ '先生' là gì?";
    expect(getPatternTranslation(qRead, "en")).toBe("What is the Hiragana reading of '先生'?");
  });

  it("translates curated option values accurately across languages", () => {
    expect(getQuizOptionTranslation("Tình yêu", "en")).toBe("Love");
    expect(getQuizOptionTranslation("Tình yêu", "zh-CN")).toBe("爱 / 爱情");
    expect(getQuizOptionTranslation("Ngôi nhà", "en")).toBe("House / Home");
    expect(getQuizOptionTranslation("Ngôi nhà", "zh-CN")).toBe("房屋 / 家");
    expect(getQuizOptionTranslation("Màu xanh da trời / xanh lam", "en")).toBe("Blue / Sky blue");
    expect(getQuizOptionTranslation("Ở trên", "en")).toBe("Above / On top");
    expect(getQuizOptionTranslation("Tốt / Đẹp / Được", "en")).toBe("Good / Fine / Okay");
    expect(getQuizOptionTranslation("Gặp mặt", "en")).toBe("To meet");
  });

  it("leaves Vietnamese unmodified when target language is 'vi'", () => {
    const q = "Chữ cái nào sau đây là chữ 'a' (あ)?";
    expect(getPatternTranslation(q, "vi")).toBe(q);
    expect(getQuizOptionTranslation("Tình yêu", "vi")).toBe("Tình yêu");
  });
});

