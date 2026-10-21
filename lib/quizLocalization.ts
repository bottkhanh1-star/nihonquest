"use client";

import React, { useState, useEffect } from "react";
import type { NativeLanguage } from "@/components/LanguageContext";
import { useNativeLanguage } from "@/components/LanguageContext";

const VIETNAMESE_REGEX = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

const quizClientCache = new Map<string, string>();

/**
 * Curated dictionary for common option choices that appear in vocab/kana quizzes.
 */
export const QUIZ_OPTIONS_MAP: Record<string, Partial<Record<NativeLanguage, string>>> = {
  "Tình yêu": {
    en: "Love",
    "zh-CN": "爱 / 爱情",
    "zh-TW": "愛 / 愛情",
    ko: "사랑",
    es: "Amor",
    fr: "Amour",
    de: "Liebe",
    id: "Cinta",
    th: "ความรัก",
    ru: "Любовь",
    pt: "Amor",
  },
  "Bầu trời": {
    en: "Sky",
    "zh-CN": "天空",
    "zh-TW": "天空",
    ko: "하늘",
    es: "Cielo",
    fr: "Ciel",
    de: "Himmel",
    id: "Langit",
    th: "ท้องฟ้า",
    ru: "Небо",
    pt: "Céu",
  },
  "Ngôi nhà": {
    en: "House / Home",
    "zh-CN": "房屋 / 家",
    "zh-TW": "房屋 / 家",
    ko: "집",
    es: "Casa",
    fr: "Maison",
    de: "Haus",
    id: "Rumah",
    th: "บ้าน",
    ru: "Дом",
    pt: "Casa",
  },
  "Dòng sông": {
    en: "River",
    "zh-CN": "河流",
    "zh-TW": "河流",
    ko: "강",
    es: "Río",
    fr: "Rivière",
    de: "Fluss",
    id: "Sungai",
    th: "แม่น้ำ",
    ru: "Река",
    pt: "Rio",
  },
  "Con mèo": {
    en: "Cat",
    "zh-CN": "猫",
    "zh-TW": "貓",
    ko: "고양이",
    es: "Gato",
    fr: "Chat",
    de: "Katze",
    id: "Kucing",
    th: "แมว",
    ru: "Кот / Кошка",
    pt: "Gato",
  },
  "Cái cây": {
    en: "Tree",
    "zh-CN": "树木",
    "zh-TW": "樹木",
    ko: "나무",
    es: "Árbol",
    fr: "Arbre",
    de: "Baum",
    id: "Pohon",
    th: "ต้นไม้",
    ru: "Дерево",
    pt: "Árvore",
  },
  "Cuốn sách": {
    en: "Book",
    "zh-CN": "书本",
    "zh-TW": "書本",
    ko: "책",
    es: "Libro",
    fr: "Livre",
    de: "Buch",
    id: "Buku",
    th: "หนังสือ",
    ru: "Книга",
    pt: "Livro",
  },
  "Màu xanh da trời / xanh lam": {
    en: "Blue / Sky blue",
    "zh-CN": "蓝色 / 蔚蓝",
    "zh-TW": "藍色 / 蔚藍",
    ko: "파란색 / 푸른색",
    es: "Azul / Celeste",
    fr: "Bleu / Azur",
    de: "Blau / Himmelblau",
    id: "Biru / Biru langit",
    th: "สีฟ้า / สีน้ำเงิน",
    ru: "Синий / Голубой",
    pt: "Azul",
  },
  "Màu đỏ": {
    en: "Red",
    "zh-CN": "红色",
    "zh-TW": "紅色",
    ko: "빨간색",
    es: "Rojo",
    fr: "Rouge",
    de: "Rot",
    id: "Merah",
    th: "สีแดง",
    ru: "Красный",
    pt: "Vermelho",
  },
  "Màu trắng": {
    en: "White",
    "zh-CN": "白色",
    "zh-TW": "白色",
    ko: "하얀색",
    es: "Blanco",
    fr: "Blanc",
    de: "Weiß",
    id: "Putih",
    th: "สีขาว",
    ru: "Белый",
    pt: "Branco",
  },
  "Màu đen": {
    en: "Black",
    "zh-CN": "黑色",
    "zh-TW": "黑色",
    ko: "검은색",
    es: "Negro",
    fr: "Noir",
    de: "Schwarz",
    id: "Hitam",
    th: "สีดำ",
    ru: "Чёрный",
    pt: "Preto",
  },
  "Màu vàng": {
    en: "Yellow",
    "zh-CN": "黄色",
    "zh-TW": "黃色",
    ko: "노란색",
    es: "Amarillo",
    fr: "Jaune",
    de: "Gelb",
    id: "Kuning",
    th: "สีเหลือง",
    ru: "Жёлтый",
    pt: "Amarelo",
  },
  "Ở trên": {
    en: "Above / On top",
    "zh-CN": "上面 / 上方",
    "zh-TW": "上面 / 上方",
    ko: "위 / 상단",
    es: "Arriba / Encima",
    fr: "En haut / Au-dessus",
    de: "Oben",
    id: "Di atas",
    th: "ด้านบน",
    ru: "Вверху / Сверху",
    pt: "Em cima",
  },
  "Ở dưới": {
    en: "Below / Under",
    "zh-CN": "下面 / 下方",
    "zh-TW": "下面 / 下方",
    ko: "아래 / 하단",
    es: "Abajo / Debajo",
    fr: "En bas / En dessous",
    de: "Unten",
    id: "Di bawah",
    th: "ด้านล่าง",
    ru: "Внизу / Снизу",
    pt: "Embaixo",
  },
  "Bên trong": {
    en: "Inside",
    "zh-CN": "里面 / 内部",
    "zh-TW": "裡面 / 內部",
    ko: "안 / 내부",
    es: "Adentro / Interior",
    fr: "À l'intérieur",
    de: "Innen",
    id: "Di dalam",
    th: "ด้านใน",
    ru: "Внутри",
    pt: "Dentro",
  },
  "Bên ngoài": {
    en: "Outside",
    "zh-CN": "外面 / 外部",
    "zh-TW": "外面 / 外部",
    ko: "밖 / 외부",
    es: "Afuera / Exterior",
    fr: "À l'extérieur",
    de: "Außen",
    id: "Di luar",
    th: "ด้านนอก",
    ru: "Снаружи",
    pt: "Fora",
  },
  "Tốt / Đẹp / Được": {
    en: "Good / Fine / Okay",
    "zh-CN": "好 / 良好 / 可以",
    "zh-TW": "好 / 良好 / 可以",
    ko: "좋다 / 괜찮다",
    es: "Bueno / Bien",
    fr: "Bon / Bien",
    de: "Gut / Schön",
    id: "Bagus / Baik",
    th: "ดี / ได้",
    ru: "Хороший / Ладно",
    pt: "Bom / Legal",
  },
  "Xấu": {
    en: "Bad / Ugly",
    "zh-CN": "差 / 坏",
    "zh-TW": "差 / 壞",
    ko: "나쁘다",
    es: "Malo",
    fr: "Mauvais",
    de: "Schlecht",
    id: "Buruk",
    th: "แย่ / ไม่ดี",
    ru: "Плохой",
    pt: "Ruim",
  },
  "Nóng": {
    en: "Hot",
    "zh-CN": "热 / 炎热",
    "zh-TW": "熱 / 炎熱",
    ko: "더운 / 뜨거운",
    es: "Caliente / Caluroso",
    fr: "Chaud",
    de: "Heiß",
    id: "Panas",
    th: "ร้อน",
    ru: "Горячий / Жаркий",
    pt: "Quente",
  },
  "Lạnh": {
    en: "Cold",
    "zh-CN": "冷 / 寒冷",
    "zh-TW": "冷 / 寒冷",
    ko: "추운 / 차가운",
    es: "Frío",
    fr: "Froid",
    de: "Kalt",
    id: "Dingin",
    th: "หนาว / เย็น",
    ru: "Холодный",
    pt: "Frio",
  },
  "Gặp mặt": {
    en: "To meet",
    "zh-CN": "见面 / 相遇",
    "zh-TW": "見面 / 相遇",
    ko: "만나다",
    es: "Encontrarse / Reunirse",
    fr: "Rencontrer",
    de: "Treffen",
    id: "Bertemu",
    th: "พบ / เจอกัน",
    ru: "Встречать",
    pt: "Encontrar",
  },
  "Ăn uống": {
    en: "To eat / drink",
    "zh-CN": "饮食 / 吃喝",
    "zh-TW": "飲食 / 吃喝",
    ko: "먹고 마시다",
    es: "Comer / Beber",
    fr: "Manger / Boire",
    de: "Essen / Trinken",
    id: "Makan / Minum",
    th: "กิน / ดื่ม",
    ru: "Есть / Пить",
    pt: "Comer / Beber",
  },
  "Đi lại": {
    en: "To go / walk",
    "zh-CN": "走动 / 行走",
    "zh-TW": "走動 / 行走",
    ko: "이동하다 / 걷다",
    es: "Ir / Caminar",
    fr: "Aller / Marcher",
    de: "Gehen",
    id: "Berjalan",
    th: "เดินทาง / เดิน",
    ru: "Ходить",
    pt: "Ir / Andar",
  },
  "Ngủ nghỉ": {
    en: "To sleep / rest",
    "zh-CN": "睡觉 / 休息",
    "zh-TW": "睡覺 / 休息",
    ko: "자다 / 쉬다",
    es: "Dormir / Descansar",
    fr: "Dormir / Se reposer",
    de: "Schlafen / Ruhen",
    id: "Tidur / Istirahat",
    th: "นอน / พักผ่อน",
    ru: "Спать / Отдыхать",
    pt: "Dormir / Descansar",
  },
};

/**
 * Match common question pattern templates.
 */
export function getPatternTranslation(text: string, lang: NativeLanguage): string | null {
  if (lang === "vi") return text;
  const isZh = lang === "zh-CN" || lang === "zh-TW";
  const isEn = !isZh && lang !== "ko";

  let m: RegExpMatchArray | null;

  // 1. "Chữ cái nào sau đây là chữ 'a' (あ)?"
  m = text.match(/Chữ cái nào sau đây là chữ\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\??/i);
  if (m) {
    if (lang === "zh-CN") return `下列哪个字符是“${m[1]}”（${m[2]}）？`;
    if (lang === "zh-TW") return `下列哪個字符是「${m[1]}」（${m[2]}）？`;
    if (lang === "ko") return `다음 중 '${m[1]}'(${m[2]})에 해당하는 글자는 무엇인가요?`;
    return `Which of the following characters is '${m[1]}' (${m[2]})?`;
  }

  // 2. "Chữ 'い' được đọc là gì trong phiên âm Romaji?" / "Chữ 'え' đọc là gì trong phiên âm Romaji?"
  m = text.match(/Chữ\s*['"‘“](.+?)['"’”]\s*(?:được)?\s*đọc là gì trong phiên âm Romaji\??/i);
  if (m) {
    if (lang === "zh-CN") return `字符“${m[1]}”在罗马字中怎么读？`;
    if (lang === "zh-TW") return `字符「${m[1]}」在羅馬字中怎麼讀？`;
    if (lang === "ko") return `글자 '${m[1]}'의 로마자 표기는 무엇인가요?`;
    return `How is the character '${m[1]}' read in Romaji?`;
  }

  // 3. "Chữ Hiragana tương ứng với âm 'u' là gì?"
  m = text.match(/Chữ Hiragana tương ứng với âm\s*['"‘“](.+?)['"’”]\s*là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `对应发音“${m[1]}”的平假名是什么？`;
    if (lang === "zh-TW") return `對應發音「${m[1]}」的平假名是什麼？`;
    if (lang === "ko") return `발음 '${m[1]}'에 해당하는 히라가나는 무엇인가요?`;
    return `Which Hiragana character corresponds to the sound '${m[1]}'?`;
  }

  // 4. "Chữ cái nào là chữ 'o' (お)?"
  m = text.match(/Chữ cái nào là chữ\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\??/i);
  if (m) {
    if (lang === "zh-CN") return `哪个字符是“${m[1]}”（${m[2]}）？`;
    if (lang === "zh-TW") return `哪個字符是「${m[1]}」（${m[2]}）？`;
    if (lang === "ko") return `어느 글자가 '${m[1]}'(${m[2]})인가요?`;
    return `Which character is '${m[1]}' (${m[2]})?`;
  }

  // 5. "Từ ghép 'あい' (ai) trong tiếng Nhật có nghĩa là gì?"
  m = text.match(/Từ ghép\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\s*trong tiếng Nhật có nghĩa là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `日语词汇“${m[1]}”(${m[2]}) 是什么意思？`;
    if (lang === "zh-TW") return `日語詞彙「${m[1]}」(${m[2]}) 是什麼意思？`;
    if (lang === "ko") return `일본어 단어 '${m[1]}'(${m[2]})은(는) 무슨 뜻인가요?`;
    return `What does the word '${m[1]}' (${m[2]}) mean in Japanese?`;
  }

  // 6. "Từ 'いえ' (ie) có nghĩa là gì?"
  m = text.match(/Từ\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\s*có nghĩa là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `词汇“${m[1]}”(${m[2]}) 是什么意思？`;
    if (lang === "zh-TW") return `詞彙「${m[1]}」(${m[2]}) 是什麼意思？`;
    if (lang === "ko") return `단어 '${m[1]}'(${m[2]})은(는) 무슨 뜻인가요?`;
    return `What does the word '${m[1]}' (${m[2]}) mean?`;
  }

  // 7. "Từ 'あお' (ao) có nghĩa là gì?"
  m = text.match(/Từ\s*['"‘“](.+?)['"’”]\s*có nghĩa là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `词汇“${m[1]}”是什么意思？`;
    if (lang === "zh-TW") return `詞彙「${m[1]}」是什麼意思？`;
    if (lang === "ko") return `단어 '${m[1]}'은(는) 무슨 뜻인가요?`;
    return `What does the word '${m[1]}' mean?`;
  }

  // 8. "Từ 'うえ' (ue) có nghĩa là vị trí nào?"
  m = text.match(/Từ\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\s*có nghĩa là vị trí nào\??/i);
  if (m) {
    if (lang === "zh-CN") return `词汇“${m[1]}”(${m[2]}) 表示哪个方位？`;
    if (lang === "zh-TW") return `詞彙「${m[1]}」(${m[2]}) 表示哪個方位？`;
    if (lang === "ko") return `단어 '${m[1]}'(${m[2]})은(는) 어떤 위치를 의미하나요?`;
    return `What position does the word '${m[1]}' (${m[2]}) refer to?`;
  }

  // 9. "Từ 'あう' (au) là động từ có nghĩa là gì?"
  m = text.match(/Từ\s*['"‘“](.+?)['"’”]\s*[\(（](.+?)[\)）]\s*là động từ có nghĩa là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `动词“${m[1]}”(${m[2]}) 是什么意思？`;
    if (lang === "zh-TW") return `動詞「${m[1]}」(${m[2]}) 是什麼意思？`;
    if (lang === "ko") return `동사 '${m[1]}'(${m[2]})은(는) 무슨 뜻인가요?`;
    return `What does the verb '${m[1]}' (${m[2]}) mean?`;
  }

  // 10. "Chữ Romaji 'oe' được viết bằng Hiragana là gì?"
  m = text.match(/Chữ Romaji\s*['"‘“](.+?)['"’”]\s*được viết bằng Hiragana là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `罗马字“${m[1]}”用平假名如何书写？`;
    if (lang === "zh-TW") return `羅馬字「${m[1]}」用平假名如何書寫？`;
    if (lang === "ko") return `로마자 '${m[1]}'을(를) 히라가나로 표기하면 무엇인가요?`;
    return `How is the Romaji '${m[1]}' written in Hiragana?`;
  }

  // 11. "Trong 5 nguyên âm, chữ nào có nét thắt vòng tròn giống chữ 'あ' nhưng cấu tạo tròn liền khối?"
  if (text.includes("Trong 5 nguyên âm") && text.includes("nét thắt vòng tròn")) {
    if (lang === "zh-CN") return "在5个元音中，哪个假名带有类似“あ”的圆弧轮廓但结构更连贯？";
    if (lang === "zh-TW") return "在5個元音中，哪個假名帶有類似「あ」的圓弧輪廓但結構更連貫？";
    if (lang === "ko") return "5개 모음 중 'あ'와 비슷하게 둥근 획이 있지만 둥글게 이어지는 글자는 무엇인가요?";
    return "Among the 5 vowels, which letter has a round looped stroke similar to 'あ' but with a continuous round form?";
  }

  // 12. "Chọn nghĩa đúng của từ '...'"
  m = text.match(/Chọn nghĩa đúng của từ\s*['"‘“](.+?)['"’”]:?/i);
  if (m) {
    if (lang === "zh-CN") return `选择“${m[1]}”的正确释义：`;
    if (lang === "zh-TW") return `選擇「${m[1]}」的正確釋義：`;
    if (lang === "ko") return `'${m[1]}'의 올바른 의미를 선택하세요:`;
    return `Choose the correct meaning of '${m[1]}':`;
  }

  // 13. "Cách đọc Hiragana của từ '...' là gì?"
  m = text.match(/Cách đọc Hiragana của từ\s*['"‘“](.+?)['"’”]\s*là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `词汇“${m[1]}”的平假名读音是什么？`;
    if (lang === "zh-TW") return `詞彙「${m[1]}」的平假名讀音是什麼？`;
    if (lang === "ko") return `'${m[1]}'의 히라가나 읽기는 무엇인가요?`;
    return `What is the Hiragana reading of '${m[1]}'?`;
  }

  // 14. "Điền trợ từ thích hợp vào chỗ trống"
  if (text.includes("Điền trợ từ thích hợp vào chỗ trống")) {
    const rest = text.replace(/Điền trợ từ thích hợp vào chỗ trống:?\s*/i, "");
    if (lang === "zh-CN") return `在空格中填入恰当的助词${rest ? `：${rest}` : ""}`;
    if (lang === "zh-TW") return `在空格中填入恰當的助詞${rest ? `：${rest}` : ""}`;
    if (lang === "ko") return `빈칸에 알맞은 조사를 고르세요${rest ? `: ${rest}` : ""}`;
    return `Fill in the appropriate particle in the blank${rest ? `: ${rest}` : ""}`;
  }

  // 15. "Chọn từ thích hợp điền vào chỗ trống"
  if (text.includes("Chọn từ thích hợp điền vào chỗ trống")) {
    const rest = text.replace(/Chọn từ thích hợp điền vào chỗ trống:?\s*/i, "");
    if (lang === "zh-CN") return `选择恰当的词填入空格${rest ? `：${rest}` : ""}`;
    if (lang === "zh-TW") return `選擇恰當的詞填入空格${rest ? `：${rest}` : ""}`;
    if (lang === "ko") return `빈칸에 알맞은 단어를 선택하세요${rest ? `: ${rest}` : ""}`;
    return `Choose the appropriate word for the blank${rest ? `: ${rest}` : ""}`;
  }

  // 16. "Ý nghĩa của mẫu câu '...' là gì?"
  m = text.match(/Ý nghĩa của mẫu câu\s*['"‘“](.+?)['"’”]\s*là gì\??/i);
  if (m) {
    if (lang === "zh-CN") return `句型“${m[1]}”的含义是什么？`;
    if (lang === "zh-TW") return `句型「${m[1]}」的含義是什麼？`;
    if (lang === "ko") return `문형 '${m[1]}'의 의미는 무엇인가요?`;
    return `What is the meaning of the pattern '${m[1]}'?`;
  }

  return null;
}

/**
 * Fast synchronous lookup for option or short phrase.
 */
export function getQuizOptionTranslation(text: string, lang: NativeLanguage): string | null {
  if (lang === "vi") return text;
  const direct = QUIZ_OPTIONS_MAP[text.trim()];
  if (direct) {
    return direct[lang] || direct.en || null;
  }
  return null;
}

/**
 * Hook to translate quiz questions and option texts dynamically.
 */
export function useQuizTextTranslation(text: string): string {
  const { nativeLanguage } = useNativeLanguage();
  const sourceText = text?.trim() || "";

  // 1. Vietnamese returns as-is
  if (nativeLanguage === "vi" || !sourceText) {
    return sourceText;
  }

  // 2. Check if text has Vietnamese characters. If purely Japanese/Romaji/Numbers, return unchanged
  if (!VIETNAMESE_REGEX.test(sourceText)) {
    return sourceText;
  }

  // 3. Check curated options dictionary
  const optionMatch = getQuizOptionTranslation(sourceText, nativeLanguage);
  if (optionMatch) return optionMatch;

  // 4. Check regex pattern templates
  const patternMatch = getPatternTranslation(sourceText, nativeLanguage);
  if (patternMatch) return patternMatch;

  // 5. Memory cache check
  const cacheKey = `${nativeLanguage}::${sourceText}`;
  if (quizClientCache.has(cacheKey)) {
    return quizClientCache.get(cacheKey)!;
  }

  // 6. LocalStorage check (browser-only)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`nq_qz_${cacheKey}`);
      if (stored) {
        quizClientCache.set(cacheKey, stored);
        return stored;
      }
    } catch {}
  }

  // 7. Dynamic translation hook state
  const [translated, setTranslated] = useState<string>(() => patternMatch || optionMatch || sourceText);

  useEffect(() => {
    let isSubscribed = true;

    // Fast check again in effect
    const opt = getQuizOptionTranslation(sourceText, nativeLanguage);
    if (opt) {
      setTranslated(opt);
      return;
    }

    const pat = getPatternTranslation(sourceText, nativeLanguage);
    if (pat) {
      setTranslated(pat);
      return;
    }

    if (quizClientCache.has(cacheKey)) {
      setTranslated(quizClientCache.get(cacheKey)!);
      return;
    }

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: sourceText,
        targetLang: nativeLanguage,
        sourceLang: "vi",
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!isSubscribed) return;
        const resText = data.translation;
        if (resText && typeof resText === "string") {
          quizClientCache.set(cacheKey, resText);
          try {
            localStorage.setItem(`nq_qz_${cacheKey}`, resText);
          } catch {}
          setTranslated(resText);
        }
      })
      .catch(() => {
        if (isSubscribed) setTranslated(sourceText);
      });

    return () => {
      isSubscribed = false;
    };
  }, [sourceText, nativeLanguage, cacheKey]);

  return translated;
}

/**
 * React Component for localized quiz text node.
 */
export function LocalizedQuizText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const result = useQuizTextTranslation(text);
  return React.createElement("span", { className }, result);
}
