/**
 * Japanese Vocabulary & Kanji Dynamic Localization Engine
 *
 * Automatically translates Japanese words and sentences into the learner's
 * selected mother language (NativeLanguage) across all supported locales:
 * vi, en, zh-CN, zh-TW, ko, es, fr, de, id, th, ru, pt.
 */

import React, { useState, useEffect } from "react";
import type { NativeLanguage } from "@/components/LanguageContext";
import { useNativeLanguage } from "@/components/LanguageContext";

export interface VocabTranslationEntry {
  en?: string;
  "zh-CN"?: string;
  "zh-TW"?: string;
  ko?: string;
  es?: string;
  fr?: string;
  de?: string;
  id?: string;
  th?: string;
  ru?: string;
  pt?: string;
}

/**
 * Curated high-frequency Japanese vocabulary dictionary for instant (0ms) offline resolution.
 */
export const CORE_VOCAB_MAP: Record<string, VocabTranslationEntry> = {
  // Greetings & Expressions
  "おはようございます": {
    en: "Good morning (polite)",
    "zh-CN": "早上好（礼貌）",
    "zh-TW": "早上好（禮貌）",
    ko: "좋은 아침입니다 (존댓말)",
    es: "Buenos días (formal)",
    fr: "Bonjour (matin, poli)",
    de: "Guten Morgen (höflich)",
    id: "Selamat pagi (sopan)",
    th: "สวัสดีตอนเช้า (สุภาพ)",
    ru: "Доброе утро (вежливо)",
    pt: "Bom dia (formal)",
  },
  "こんにちは": {
    en: "Hello / Good afternoon",
    "zh-CN": "你好（白天）",
    "zh-TW": "你好（白天）",
    ko: "안녕하세요 (낮 인사)",
    es: "Hola / Buenas tardes",
    fr: "Bonjour",
    de: "Guten Tag / Hallo",
    id: "Halo / Selamat siang",
    th: "สวัสดี (กลางวัน)",
    ru: "Здравствуйте / Добрый день",
    pt: "Olá / Boa tarde",
  },
  "こんばんは": {
    en: "Good evening",
    "zh-CN": "晚上好",
    "zh-TW": "晚上好",
    ko: "안녕하세요 (저녁 인사)",
    es: "Buenas noches (saludo)",
    fr: "Bonsoir",
    de: "Guten Abend",
    id: "Selamat malam (sapaan)",
    th: "สวัสดีตอนเย็น",
    ru: "Добрый вечер",
    pt: "Boa noite (saudação)",
  },
  "おやすみなさい": {
    en: "Good night",
    "zh-CN": "晚安",
    "zh-TW": "晚安",
    ko: "안녕히 주무세요",
    es: "Buenas noches (despedida)",
    fr: "Bonne nuit",
    de: "Gute Nacht",
    id: "Selamat tidur / Selamat malam",
    th: "ราตรีสวัสดิ์",
    ru: "Спокойной ночи",
    pt: "Boa noite (despedida)",
  },
  "ありがとうございます": {
    en: "Thank you very much",
    "zh-CN": "非常感谢",
    "zh-TW": "非常感謝",
    ko: "대단히 감사합니다",
    es: "Muchas gracias",
    fr: "Merci beaucoup",
    de: "Vielen Dank",
    id: "Terima kasih banyak",
    th: "ขอบคุณมากครับ/ค่ะ",
    ru: "Большое спасибо",
    pt: "Muito obrigado(a)",
  },
  "すみません": {
    en: "Excuse me / I'm sorry",
    "zh-CN": "不好意思 / 对不起",
    "zh-TW": "不好意思 / 對不起",
    ko: "실례합니다 / 죄송합니다",
    es: "Disculpe / Lo siento",
    fr: "Excusez-moi / Pardon",
    de: "Entschuldigung",
    id: "Permisi / Maaf",
    th: "ขอโทษครับ/ค่ะ / ขอประทานโทษ",
    ru: "Извините / Прошу прощения",
    pt: "Com licença / Desculpe",
  },
  "さようなら": {
    en: "Goodbye",
    "zh-CN": "再见",
    "zh-TW": "再見",
    ko: "안녕히 가세요 / 안녕히 계세요",
    es: "Adiós",
    fr: "Au revoir",
    de: "Auf Wiedersehen",
    id: "Selamat tinggal",
    th: "ลาก่อน",
    ru: "До свидания",
    pt: "Adeus / Até logo",
  },
  "はい": {
    en: "Yes / Understood",
    "zh-CN": "是的 / 明白了",
    "zh-TW": "是的 / 明白了",
    ko: "네 / 예",
    es: "Sí",
    fr: "Oui",
    de: "Ja",
    id: "Ya",
    th: "ใช่ / ครับ / ค่ะ",
    ru: "Да",
    pt: "Sim",
  },
  "いいえ": {
    en: "No / Not at all",
    "zh-CN": "不是 / 不客气",
    "zh-TW": "不是 / 不客氣",
    ko: "아니요",
    es: "No",
    fr: "Non",
    de: "Nein",
    id: "Tidak / Bukan",
    th: "ไม่ใช่ / ไม่",
    ru: "Нет",
    pt: "Não",
  },
  // Core Pronouns & People
  "私": {
    en: "I / Me",
    "zh-CN": "我",
    "zh-TW": "我",
    ko: "나 / 저",
    es: "Yo",
    fr: "Je / Moi",
    de: "Ich",
    id: "Saya / Aku",
    th: "ฉัน / ผม",
    ru: "Я",
    pt: "Eu",
  },
  "あなた": {
    en: "You",
    "zh-CN": "你",
    "zh-TW": "你",
    ko: "당신 / 너",
    es: "Tú / Usted",
    fr: "Tu / Vous",
    de: "Du / Sie",
    id: "Anda / Kamu",
    th: "คุณ / เธอ",
    ru: "Вы / Ты",
    pt: "Você",
  },
  "彼": {
    en: "He / Him / Boyfriend",
    "zh-CN": "他 / 男朋友",
    "zh-TW": "他 / 男朋友",
    ko: "그 / 남자친구",
    es: "Él / Novio",
    fr: "Il / Lui",
    de: "Er / Freund",
    id: "Dia (laki-laki) / Pacar",
    th: "เขา / แฟนหนุ่ม",
    ru: "Он / Парень",
    pt: "Ele / Namorado",
  },
  "彼女": {
    en: "She / Her / Girlfriend",
    "zh-CN": "她 / 女朋友",
    "zh-TW": "她 / 女朋友",
    ko: "그녀 / 여자친구",
    es: "Ella / Novia",
    fr: "Elle / Petite amie",
    de: "Sie / Freundin",
    id: "Dia (perempuan) / Pacar",
    th: "เธอ / แฟนสาว",
    ru: "Она / Девушка",
    pt: "Ela / Namorada",
  },
  "先生": {
    en: "Teacher / Professor / Doctor",
    "zh-CN": "老师 / 医生",
    "zh-TW": "老師 / 醫生",
    ko: "선생님 / 교수님",
    es: "Profesor(a) / Maestro(a)",
    fr: "Professeur / Enseignant",
    de: "Lehrer(in)",
    id: "Guru / Dokter",
    th: "ครู / อาจารย์ / หมอ",
    ru: "Учитель / Преподаватель",
    pt: "Professor(a) / Mestre",
  },
  "学生": {
    en: "Student",
    "zh-CN": "学生",
    "zh-TW": "學生",
    ko: "학생",
    es: "Estudiante / Alumno(a)",
    fr: "Étudiant(e)",
    de: "Student / Schüler",
    id: "Siswa / Mahasiswa",
    th: "นักเรียน / นักศึกษา",
    ru: "Студент / Ученик",
    pt: "Estudante / Aluno(a)",
  },
  "人": {
    en: "Person / People",
    "zh-CN": "人",
    "zh-TW": "人",
    ko: "사람 / 인간",
    es: "Persona / Gente",
    fr: "Personne / Être humain",
    de: "Mensch / Person",
    id: "Orang",
    th: "คน / บุคคล",
    ru: "Человек / Люди",
    pt: "Pessoa / Gente",
  },
  "友だち": {
    en: "Friend",
    "zh-CN": "朋友",
    "zh-TW": "朋友",
    ko: "친구",
    es: "Amigo(a)",
    fr: "Ami(e)",
    de: "Freund(in)",
    id: "Teman / Sahabat",
    th: "เพื่อน",
    ru: "Друг",
    pt: "Amigo(a)",
  },
  "友達": {
    en: "Friend",
    "zh-CN": "朋友",
    "zh-TW": "朋友",
    ko: "친구",
    es: "Amigo(a)",
    fr: "Ami(e)",
    de: "Freund(in)",
    id: "Teman / Sahabat",
    th: "เพื่อน",
    ru: "Друг",
    pt: "Amigo(a)",
  },
  "家族": {
    en: "Family",
    "zh-CN": "家人 / 家族",
    "zh-TW": "家人 / 家族",
    ko: "가족",
    es: "Familia",
    fr: "Famille",
    de: "Familie",
    id: "Keluarga",
    th: "ครอบครัว",
    ru: "Семья",
    pt: "Família",
  },
  // Places & Objects
  "学校": {
    en: "School",
    "zh-CN": "学校",
    "zh-TW": "學校",
    ko: "학교",
    es: "Escuela / Colegio",
    fr: "École",
    de: "Schule",
    id: "Sekolah",
    th: "โรงเรียน",
    ru: "Школа",
    pt: "Escola",
  },
  "会社": {
    en: "Company / Office",
    "zh-CN": "公司",
    "zh-TW": "公司",
    ko: "회사",
    es: "Empresa / Compañía",
    fr: "Entreprise / Société",
    de: "Firma / Unternehmen",
    id: "Perusahaan / Kantor",
    th: "บริษัท",
    ru: "Компания / Фирма",
    pt: "Empresa / Companhia",
  },
  "家": {
    en: "House / Home",
    "zh-CN": "家 / 房屋",
    "zh-TW": "家 / 房屋",
    ko: "집 / 가정",
    es: "Casa / Hogar",
    fr: "Maison / Foyer",
    de: "Haus / Zuhause",
    id: "Rumah",
    th: "บ้าน",
    ru: "Дом",
    pt: "Casa / Lar",
  },
  "駅": {
    en: "Train station",
    "zh-CN": "车站 / 火车站",
    "zh-TW": "車站 / 火車站",
    ko: "역 (기차역/전철역)",
    es: "Estación de tren",
    fr: "Gare (train/métro)",
    de: "Bahnhof / Station",
    id: "Stasiun kereta",
    th: "สถานีรถไฟ",
    ru: "Станция / Вокзал",
    pt: "Estação de trem",
  },
  "病院": {
    en: "Hospital",
    "zh-CN": "医院",
    "zh-TW": "醫院",
    ko: "병원",
    es: "Hospital",
    fr: "Hôpital",
    de: "Krankenhaus",
    id: "Rumah sakit",
    th: "โรงพยาบาล",
    ru: "Больница",
    pt: "Hospital",
  },
  "本": {
    en: "Book",
    "zh-CN": "书 / 书籍",
    "zh-TW": "書 / 書籍",
    ko: "책",
    es: "Libro",
    fr: "Livre",
    de: "Buch",
    id: "Buku",
    th: "หนังสือ",
    ru: "Книга",
    pt: "Livro",
  },
  "水": {
    en: "Water",
    "zh-CN": "水",
    "zh-TW": "水",
    ko: "물",
    es: "Agua",
    fr: "Eau",
    de: "Wasser",
    id: "Air",
    th: "น้ำ",
    ru: "Вода",
    pt: "Água",
  },
  "お茶": {
    en: "Tea / Green tea",
    "zh-CN": "茶 / 绿茶",
    "zh-TW": "茶 / 綠茶",
    ko: "차 / 녹차",
    es: "Té verde",
    fr: "Thé / Thé vert",
    de: "Tee / Grüner Tee",
    id: "Teh",
    th: "ชา / ชาเขียว",
    ru: "Чай / Зеленый чай",
    pt: "Chá / Chá verde",
  },
  "ご飯": {
    en: "Cooked rice / Meal",
    "zh-CN": "米饭 / 饭菜",
    "zh-TW": "米飯 / 飯菜",
    ko: "밥 / 식사",
    es: "Arroz cocido / Comida",
    fr: "Riz cuit / Repas",
    de: "Reis / Mahlzeit",
    id: "Nasi / Makanan",
    th: "ข้าว / มื้ออาหาร",
    ru: "Рис / Еда",
    pt: "Arroz cozido / Refeição",
  },
  "車": {
    en: "Car / Automobile",
    "zh-CN": "车 / 汽车",
    "zh-TW": "車 / 汽車",
    ko: "차 / 자동차",
    es: "Coche / Auto",
    fr: "Voiture / Automobile",
    de: "Auto / Wagen",
    id: "Mobil",
    th: "รถ / รถยนต์",
    ru: "Машина / Автомобиль",
    pt: "Carro / Automóvel",
  },
  // Core Verbs
  "食べる": {
    en: "To eat",
    "zh-CN": "吃",
    "zh-TW": "吃",
    ko: "먹다",
    es: "Comer",
    fr: "Manger",
    de: "Essen",
    id: "Makan",
    th: "กิน / ทาน",
    ru: "Есть / Кушать",
    pt: "Comer",
  },
  "飲む": {
    en: "To drink",
    "zh-CN": "喝 / 饮",
    "zh-TW": "喝 / 飲",
    ko: "마시다",
    es: "Beber / Tomar",
    fr: "Boire",
    de: "Trinken",
    id: "Minum",
    th: "ดื่ม",
    ru: "Пить",
    pt: "Beber",
  },
  "行く": {
    en: "To go",
    "zh-CN": "去 / 前往",
    "zh-TW": "去 / 前往",
    ko: "가다",
    es: "Ir",
    fr: "Aller",
    de: "Gehen / Fahren",
    id: "Pergi",
    th: "ไป",
    ru: "Идти / Ехать",
    pt: "Ir",
  },
  "来る": {
    en: "To come",
    "zh-CN": "来",
    "zh-TW": "來",
    ko: "오다",
    es: "Venir",
    fr: "Venir",
    de: "Kommen",
    id: "Datang",
    th: "มา",
    ru: "Приходить / Приезжать",
    pt: "Vir",
  },
  "見る": {
    en: "To see / To watch / To look",
    "zh-CN": "看 / 观看",
    "zh-TW": "看 / 觀看",
    ko: "보다",
    es: "Ver / Mirar",
    fr: "Voir / Regarder",
    de: "Sehen / Schauen",
    id: "Melihat / Menonton",
    th: "ดู / มอง / เห็น",
    ru: "Смотреть / Видеть",
    pt: "Ver / Olhar",
  },
  "聞く": {
    en: "To hear / To listen / To ask",
    "zh-CN": "听 / 询问",
    "zh-TW": "聽 / 詢問",
    ko: "듣다 / 묻다",
    es: "Escuchar / Oír / Preguntar",
    fr: "Écouter / Entendre / Demander",
    de: "Hören / Fragen",
    id: "Mendengar / Bertanya",
    th: "ฟัง / ถาม",
    ru: "Слушать / Слышать / Спрашивать",
    pt: "Ouvir / Escutar / Perguntar",
  },
  "話す": {
    en: "To speak / To talk",
    "zh-CN": "说 / 谈话",
    "zh-TW": "說 / 談話",
    ko: "말하다 / 이야기하다",
    es: "Hablar / Conversar",
    fr: "Parler",
    de: "Sprechen / Reden",
    id: "Berbicara",
    th: "พูด / สนทนา",
    ru: "Говорить / Разговаривать",
    pt: "Falar / Conversar",
  },
  "読む": {
    en: "To read",
    "zh-CN": "读 / 阅读",
    "zh-TW": "讀 / 閱讀",
    ko: "읽다",
    es: "Leer",
    fr: "Lire",
    de: "Lesen",
    id: "Membaca",
    th: "อ่าน",
    ru: "Читать",
    pt: "Ler",
  },
  "書く": {
    en: "To write",
    "zh-CN": "写 / 书写",
    "zh-TW": "寫 / 書寫",
    ko: "쓰다 / 적다",
    es: "Escribir",
    fr: "Écrire",
    de: "Schreiben",
    id: "Menulis",
    th: "เขียน",
    ru: "Писать",
    pt: "Escrever",
  },
  "買う": {
    en: "To buy",
    "zh-CN": "买 / 购买",
    "zh-TW": "買 / 購買",
    ko: "사다 / 구매하다",
    es: "Comprar",
    fr: "Acheter",
    de: "Kaufen",
    id: "Membeli",
    th: "ซื้อ",
    ru: "Покупать",
    pt: "Comprar",
  },
  "勉強する": {
    en: "To study",
    "zh-CN": "学习",
    "zh-TW": "學習",
    ko: "공부하다",
    es: "Estudiar",
    fr: "Étudier",
    de: "Lernen / Studieren",
    id: "Belajar",
    th: "เรียน / ศึกษา",
    ru: "Учиться / Заниматься",
    pt: "Estudar",
  },
};

import jlptVocabEnRaw from "@/lib/jlpt-vocab-en.json";
import { JOUYOU_KANJI_LIST } from "@/lib/jouyou-kanji-data";

const jlptVocabEn = jlptVocabEnRaw as Record<string, string>;

const kanjiEnglishMap = new Map<string, string>();
for (const k of JOUYOU_KANJI_LIST) {
  if (k.character && k.meaningEn) {
    kanjiEnglishMap.set(k.character, k.meaningEn);
  }
}

/**
 * Finds offline English meaning for a vocabulary word or kanji character.
 */
export function findVocabEnglishMeaning(japanese: string, kana?: string): string | null {
  const cleanJa = (japanese || "").trim();
  if (cleanJa && jlptVocabEn[cleanJa]) {
    return jlptVocabEn[cleanJa];
  }
  if (kana) {
    const cleanKana = kana.trim();
    if (cleanKana && jlptVocabEn[cleanKana]) {
      return jlptVocabEn[cleanKana];
    }
  }
  if (cleanJa && kanjiEnglishMap.has(cleanJa)) {
    return kanjiEnglishMap.get(cleanJa)!;
  }
  return null;
}

/**
 * Checks the pre-compiled dictionary first.
 */
export function getPrecompiledVocabMeaning(
  japanese: string,
  kana: string | undefined,
  lang: NativeLanguage
): string | null {
  if (lang === "vi") return null;

  const keyCandidates = [japanese, kana].filter(Boolean) as string[];
  for (const k of keyCandidates) {
    const entry = CORE_VOCAB_MAP[k];
    if (entry && entry[lang]) {
      return entry[lang]!;
    }
  }

  if (lang === "en") {
    const en = findVocabEnglishMeaning(japanese, kana);
    if (en) return en;
  }

  // Fallback to English from curated table if available
  for (const k of keyCandidates) {
    const entry = CORE_VOCAB_MAP[k];
    if (entry && entry.en) {
      return entry.en;
    }
  }
  return null;
}

// Client-side translation memory cache
export const clientCache = new Map<string, string>();

/**
 * Batch pre-translates multiple vocabulary/kanji items ahead of time
 * to populate clientCache and avoid runtime translation lag during review.
 */
export async function prefetchVocabTranslations(
  items: Array<{ japanese: string; kana?: string; fallback?: string }>,
  targetLang: NativeLanguage
): Promise<void> {
  if (targetLang === "vi" || !items || items.length === 0) return;

  const needed: string[] = [];
  for (const item of items) {
    const text = (item.japanese || "").trim();
    if (!text) continue;

    // Check precompiled dictionary
    const direct = getPrecompiledVocabMeaning(text, item.kana, targetLang);
    if (direct) continue;

    const cacheKey = `${targetLang}:${text}`;
    if (clientCache.has(cacheKey)) continue;

    try {
      const lsKey = `nq_tr_${cacheKey}`;
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        clientCache.set(cacheKey, saved);
        continue;
      }
    } catch {}

    needed.push(text);
  }

  if (needed.length === 0) return;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: needed,
        targetLang,
        sourceLang: "ja",
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.translations && typeof data.translations === "object") {
      for (const [orig, tr] of Object.entries(data.translations as Record<string, string>)) {
        if (tr && typeof tr === "string") {
          const cacheKey = `${targetLang}:${orig}`;
          clientCache.set(cacheKey, tr);
          try {
            localStorage.setItem(`nq_tr_${cacheKey}`, tr);
          } catch {}
        }
      }
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Resolves localized vocabulary meaning.
 * If Vietnamese, returns fallback (raw DB meaning).
 * If another language, returns curated dictionary or fetches dynamic translation.
 */
export function useVocabTranslation(
  japanese: string,
  kana?: string,
  fallbackMeaning: string = "",
  englishMeaning?: string
): string {
  const { nativeLanguage } = useNativeLanguage();

  const resolveImmediate = (): string => {
    if (nativeLanguage === "vi") return fallbackMeaning;
    if (nativeLanguage === "en" && englishMeaning) return englishMeaning;
    const direct = getPrecompiledVocabMeaning(japanese, kana, nativeLanguage);
    if (direct) return direct;
    const cacheKey = `${nativeLanguage}:${japanese}`;
    if (clientCache.has(cacheKey)) return clientCache.get(cacheKey)!;
    try {
      const lsKey = `nq_tr_${cacheKey}`;
      const saved = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
      if (saved) {
        clientCache.set(cacheKey, saved);
        return saved;
      }
    } catch {}
    return englishMeaning || findVocabEnglishMeaning(japanese, kana) || fallbackMeaning;
  };

  const [meaning, setMeaning] = useState<string>(resolveImmediate);

  useEffect(() => {
    if (nativeLanguage === "vi") {
      setMeaning(fallbackMeaning);
      return;
    }

    const resolvedEn = englishMeaning || findVocabEnglishMeaning(japanese, kana);
    if (nativeLanguage === "en" && resolvedEn) {
      setMeaning(resolvedEn);
      return;
    }

    const direct = getPrecompiledVocabMeaning(japanese, kana, nativeLanguage);
    if (direct) {
      setMeaning(direct);
      return;
    }

    const cacheKey = `${nativeLanguage}:${japanese}`;
    if (clientCache.has(cacheKey)) {
      setMeaning(clientCache.get(cacheKey)!);
      return;
    }

    let isSubscribed = true;

    // Check localStorage cache first
    try {
      const lsKey = `nq_tr_${cacheKey}`;
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        clientCache.set(cacheKey, saved);
        setMeaning(saved);
        return;
      }
    } catch {
      // Ignore
    }

    // Call translation endpoint
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: japanese,
        targetLang: nativeLanguage,
        sourceLang: "ja",
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!isSubscribed) return;
        const resText = data.translation;
        if (resText && typeof resText === "string") {
          clientCache.set(cacheKey, resText);
          try {
            localStorage.setItem(`nq_tr_${cacheKey}`, resText);
          } catch {}
          setMeaning(resText);
        }
      })
      .catch(() => {
        // Fallback gracefully to english or original meaning
        if (isSubscribed) {
          setMeaning(resolvedEn || fallbackMeaning);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [japanese, kana, nativeLanguage, fallbackMeaning, englishMeaning]);

  return meaning;
}

/**
 * React Component for localized vocabulary / kanji meaning.
 */
export function LocalizedVocabMeaning({
  japanese,
  kana,
  fallback,
  englishMeaning,
  className,
}: {
  japanese: string;
  kana?: string;
  fallback: string;
  englishMeaning?: string;
  className?: string;
}) {
  const text = useVocabTranslation(japanese, kana, fallback, englishMeaning);
  return React.createElement("span", { className }, text);
}
