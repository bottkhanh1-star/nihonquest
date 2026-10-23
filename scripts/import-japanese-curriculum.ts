import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { HIRAGANA_BASIC } from "../prisma/seed-data/hiragana";
import { KATAKANA_BASIC } from "../prisma/seed-data/katakana";
import { DAKUTEN } from "../prisma/seed-data/dakuten";
import { ACHIEVEMENTS, DAILY_MISSIONS, JOURNEY_LOCATIONS } from "../prisma/seed-data/meta";
import { LESSONS as LESSONS_N5 } from "../prisma/seed-data/lessons";
import { SCENARIOS as SCENARIOS_N5 } from "../prisma/seed-data/scenarios";
import { KANJI_N5, VOCABULARY_N5 } from "../prisma/seed-data/kanji-vocab";
import { grammarData as GRAMMAR_N5 } from "../prisma/seed-data/grammar";
import { KANJI_N4, VOCABULARY_N4, GRAMMAR_N4, LESSONS_N4, SCENARIOS_N4 } from "../prisma/seed-data/n4-data";
import { KANJI_N3, VOCABULARY_N3, GRAMMAR_N3, LESSONS_N3, SCENARIOS_N3 } from "../prisma/seed-data/n3-data";
import { EXPANDED_KANJI, EXPANDED_VOCABULARY, EXPANDED_GRAMMAR, EXPANDED_SCENARIOS } from "../prisma/seed-data/expanded-curriculum";
import { evaluateUserAchievements, evaluateUserJourneyUnlocks } from "../lib/progress-service";

interface ImportStats {
  kana: { imported: number };
  meta: { journey: number; achievements: number; missions: number };
  kanji: { total: number; n5: number; n4: number; n3: number; skipped: number };
  vocab: { total: number; n5: number; n4: number; n3: number; skipped: number };
  grammar: { total: number; n5: number; n4: number; n3: number; skipped: number };
  lessons: { total: number; n5: number; n4: number; n3: number; exercises: number };
  lessonItems: { total: number };
  scenarios: { total: number; messages: number; choices: number };
}

export async function importJapaneseCurriculum(): Promise<ImportStats> {
  console.log("===============================================================");
  console.log("🌸 NIHON QUEST JAPANESE CURRICULUM IMPORT PIPELINE 🌸");
  console.log("Primary Sources: Dekiru Nihongo & Minna no Nihongo Textbooks");
  console.log("JLPT Levels: N5 → N4 → N3");
  console.log("===============================================================\n");

  const stats: ImportStats = {
    kana: { imported: 0 },
    meta: { journey: 0, achievements: 0, missions: 0 },
    kanji: { total: 0, n5: 0, n4: 0, n3: 0, skipped: 0 },
    vocab: { total: 0, n5: 0, n4: 0, n3: 0, skipped: 0 },
    grammar: { total: 0, n5: 0, n4: 0, n3: 0, skipped: 0 },
    lessons: { total: 0, n5: 0, n4: 0, n3: 0, exercises: 0 },
    lessonItems: { total: 0 },
    scenarios: { total: 0, messages: 0, choices: 0 },
  };

  // 1. KANA (Hiragana, Katakana, Dakuten)
  console.log("Importing Kana systems...");
  for (const k of HIRAGANA_BASIC) {
    await prisma.kana.upsert({
      where: { character_script: { character: k.character, script: "HIRAGANA" } },
      update: { romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
      create: { character: k.character, script: "HIRAGANA", romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
    });
    stats.kana.imported += 1;
  }
  for (const k of KATAKANA_BASIC) {
    await prisma.kana.upsert({
      where: { character_script: { character: k.character, script: "KATAKANA" } },
      update: { romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
      create: { character: k.character, script: "KATAKANA", romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
    });
    stats.kana.imported += 1;
  }
  for (const k of DAKUTEN) {
    await prisma.kana.upsert({
      where: { character_script: { character: k.character, script: k.script } },
      update: { romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
      create: { character: k.character, script: k.script, romaji: k.romaji, ipa: k.ipa, row: k.row, column: k.column, kind: k.kind },
    });
    stats.kana.imported += 1;
  }
  console.log(`  ✓ Kana imported: ${stats.kana.imported} characters.`);

  // 2. META (Journey Locations, Achievements, Daily Missions)
  console.log("\nImporting Meta Progression structures...");
  for (const j of JOURNEY_LOCATIONS) {
    await prisma.journeyLocation.upsert({ where: { slug: j.slug }, update: j, create: j });
    stats.meta.journey += 1;
  }
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: a.key }, update: a, create: a });
    stats.meta.achievements += 1;
  }
  for (const m of DAILY_MISSIONS) {
    await prisma.dailyMission.upsert({ where: { key: m.key }, update: m, create: m });
    stats.meta.missions += 1;
  }
  console.log(`  ✓ Journey locations: ${stats.meta.journey}, Achievements: ${stats.meta.achievements}, Missions: ${stats.meta.missions}.`);

  // 3. KANJI (N5 + N4 + N3 + Expanded)
  console.log("\nImporting Kanji with deduplication & readings...");
  const ALL_KANJI = [...KANJI_N5, ...KANJI_N4, ...KANJI_N3, ...EXPANDED_KANJI];
  const seenKanjiChars = new Set<string>();

  for (const k of ALL_KANJI) {
    if (seenKanjiChars.has(k.character)) {
      stats.kanji.skipped += 1;
      continue;
    }
    seenKanjiChars.add(k.character);

    const kanji = await prisma.kanji.upsert({
      where: { character: k.character },
      update: { meaning: k.meaning, strokeCount: k.strokeCount, jlptLevel: k.jlptLevel },
      create: { character: k.character, meaning: k.meaning, strokeCount: k.strokeCount, jlptLevel: k.jlptLevel },
    });
    await prisma.kanjiReading.deleteMany({ where: { kanjiId: kanji.id } });
    for (const r of k.readings) {
      await prisma.kanjiReading.create({
        data: { kanjiId: kanji.id, reading: r.reading, type: r.type },
      });
    }

    stats.kanji.total += 1;
    if (k.jlptLevel === "N5") stats.kanji.n5 += 1;
    else if (k.jlptLevel === "N4") stats.kanji.n4 += 1;
    else if (k.jlptLevel === "N3") stats.kanji.n3 += 1;
  }
  console.log(`  ✓ Kanji imported: ${stats.kanji.total} (N5: ${stats.kanji.n5}, N4: ${stats.kanji.n4}, N3: ${stats.kanji.n3}, skipped: ${stats.kanji.skipped}).`);

  // 4. VOCABULARY (N5 + N4 + N3 + Expanded)
  console.log("\nImporting Vocabulary with examples and deduplication...");
  const ALL_VOCABULARY = [...VOCABULARY_N5, ...VOCABULARY_N4, ...VOCABULARY_N3, ...EXPANDED_VOCABULARY];
  const seenVocabKeys = new Set<string>();
  const vocabMapByLevel = new Map<string, Array<{ id: string; word: string; tags: string }>>();

  for (const v of ALL_VOCABULARY) {
    const key = `${v.word}_${v.jlptLevel}`.toLowerCase();
    if (seenVocabKeys.has(key)) {
      stats.vocab.skipped += 1;
      continue;
    }
    seenVocabKeys.add(key);

    let vocabId: string;
    try {
      const created = await prisma.vocabulary.create({
        data: {
          word: v.word,
          kana: v.kana,
          kanji: v.kanji,
          romaji: v.romaji,
          meaning: v.meaning,
          partOfSpeech: v.partOfSpeech,
          jlptLevel: v.jlptLevel,
          tags: v.tags ?? "",
          examples: v.exampleJapanese
            ? {
                create: [
                  {
                    japanese: v.exampleJapanese,
                    romaji: v.exampleRomaji,
                    meaning: v.exampleMeaning ?? "",
                  },
                ],
              }
            : undefined,
        },
      });
      vocabId = created.id;
    } catch {
      const existing = await prisma.vocabulary.findFirst({
        where: { word: v.word, jlptLevel: v.jlptLevel },
        select: { id: true },
      });
      vocabId = existing?.id || "fallback";
    }

    if (!vocabMapByLevel.has(v.jlptLevel)) {
      vocabMapByLevel.set(v.jlptLevel, []);
    }
    vocabMapByLevel.get(v.jlptLevel)!.push({ id: vocabId, word: v.word, tags: v.tags ?? "" });

    stats.vocab.total += 1;
    if (v.jlptLevel === "N5") stats.vocab.n5 += 1;
    else if (v.jlptLevel === "N4") stats.vocab.n4 += 1;
    else if (v.jlptLevel === "N3") stats.vocab.n3 += 1;
  }
  console.log(`  ✓ Vocabulary imported: ${stats.vocab.total} (N5: ${stats.vocab.n5}, N4: ${stats.vocab.n4}, N3: ${stats.vocab.n3}, skipped: ${stats.vocab.skipped}).`);

  // 5. GRAMMAR (N5 + N4 + N3 + Expanded)
  console.log("\nImporting Grammar points with structures & authentic examples...");
  const ALL_GRAMMAR = [...GRAMMAR_N5, ...GRAMMAR_N4, ...GRAMMAR_N3, ...EXPANDED_GRAMMAR];
  const seenGrammarTitles = new Set<string>();
  const grammarMapByLevel = new Map<string, Array<{ id: string; title: string }>>();

  for (const g of ALL_GRAMMAR) {
    const normalizedTitle = g.title.trim().toLowerCase();
    if (seenGrammarTitles.has(normalizedTitle)) {
      stats.grammar.skipped += 1;
      continue;
    }
    seenGrammarTitles.add(normalizedTitle);

    const existing = await prisma.grammar.findFirst({ where: { title: g.title } });
    const grammar = existing
      ? await prisma.grammar.update({
          where: { id: existing.id },
          data: { level: g.level, meaning: g.meaning, structure: g.structure, commonMistakes: g.commonMistakes },
        })
      : await prisma.grammar.create({
          data: { title: g.title, level: g.level, meaning: g.meaning, structure: g.structure, commonMistakes: g.commonMistakes },
        });

    await prisma.grammarExample.deleteMany({ where: { grammarId: grammar.id } });
    for (const ex of g.examples ?? []) {
      await prisma.grammarExample.create({
        data: { grammarId: grammar.id, japanese: ex.japanese, romaji: ex.romaji, meaning: ex.meaning },
      });
    }

    if (!grammarMapByLevel.has(g.level)) {
      grammarMapByLevel.set(g.level, []);
    }
    grammarMapByLevel.get(g.level)!.push({ id: grammar.id, title: g.title });

    stats.grammar.total += 1;
    if (g.level === "N5") stats.grammar.n5 += 1;
    else if (g.level === "N4") stats.grammar.n4 += 1;
    else if (g.level === "N3") stats.grammar.n3 += 1;
  }
  console.log(`  ✓ Grammar points imported: ${stats.grammar.total} (N5: ${stats.grammar.n5}, N4: ${stats.grammar.n4}, N3: ${stats.grammar.n3}, skipped: ${stats.grammar.skipped}).`);

  // 6. LESSONS & EXERCISES & LESSON ITEMS (N5 + N4 + N3)
  console.log("\nImporting Lessons and establishing LessonItem associations...");
  const ALL_LESSONS = [...LESSONS_N5, ...LESSONS_N4, ...LESSONS_N3];
  const validLessonSlugs = ALL_LESSONS.map((l) => l.slug);

  const obsoleteLessons = await prisma.lesson.findMany({
    where: { slug: { notIn: validLessonSlugs } },
    select: { id: true },
  });
  if (obsoleteLessons.length > 0) {
    const obsoleteIds = obsoleteLessons.map((l) => l.id);
    await prisma.exercise.deleteMany({ where: { lessonId: { in: obsoleteIds } } });
    await prisma.userLessonProgress.deleteMany({ where: { lessonId: { in: obsoleteIds } } });
    await prisma.lessonItem.deleteMany({ where: { lessonId: { in: obsoleteIds } } });
    await prisma.lesson.deleteMany({ where: { id: { in: obsoleteIds } } });
  }

  for (const l of ALL_LESSONS) {
    const lesson = await prisma.lesson.upsert({
      where: { slug: l.slug },
      update: { title: l.title, description: l.description, level: l.level, order: l.order, xpReward: l.xpReward, isPublished: true },
      create: { slug: l.slug, title: l.title, description: l.description, level: l.level, order: l.order, xpReward: l.xpReward, isPublished: true },
    });

    stats.lessons.total += 1;
    if (l.level === "N5") stats.lessons.n5 += 1;
    else if (l.level === "N4") stats.lessons.n4 += 1;
    else if (l.level === "N3") stats.lessons.n3 += 1;

    // Associate LessonItems (connecting Vocabulary and Grammar to this Lesson)
    await prisma.lessonItem.deleteMany({ where: { lessonId: lesson.id } });
    const levelVocab = vocabMapByLevel.get(l.level) || [];
    const levelGrammar = grammarMapByLevel.get(l.level) || [];

    // Slice representative vocab and grammar for this lesson based on order
    const vocabPerLesson = 6;
    const grammarPerLesson = 2;
    const vocabStart = (l.order * vocabPerLesson) % (levelVocab.length || 1);
    const assignedVocabs = levelVocab.slice(vocabStart, vocabStart + vocabPerLesson);
    if (assignedVocabs.length < vocabPerLesson && levelVocab.length > 0) {
      assignedVocabs.push(...levelVocab.slice(0, vocabPerLesson - assignedVocabs.length));
    }

    const grammarStart = (l.order * grammarPerLesson) % (levelGrammar.length || 1);
    const assignedGrammars = levelGrammar.slice(grammarStart, grammarStart + grammarPerLesson);
    if (assignedGrammars.length < grammarPerLesson && levelGrammar.length > 0) {
      assignedGrammars.push(...levelGrammar.slice(0, grammarPerLesson - assignedGrammars.length));
    }

    let itemOrder = 0;
    for (const v of assignedVocabs) {
      await prisma.lessonItem.create({
        data: {
          lessonId: lesson.id,
          order: itemOrder++,
          contentType: "VOCAB",
          contentId: v.id,
          instruction: `Học từ vựng: ${v.word}`,
        },
      });
      stats.lessonItems.total += 1;
    }
    for (const g of assignedGrammars) {
      await prisma.lessonItem.create({
        data: {
          lessonId: lesson.id,
          order: itemOrder++,
          contentType: "GRAMMAR",
          contentId: g.id,
          instruction: `Học ngữ pháp: ${g.title}`,
        },
      });
      stats.lessonItems.total += 1;
    }

    // Exercises
    await prisma.exercise.deleteMany({ where: { lessonId: lesson.id } });
    for (let idx = 0; idx < l.exercises.length; idx += 1) {
      const ex = l.exercises[idx] as {
        type: string;
        question: string;
        correctAnswer: string;
        points: number;
        order?: number;
        contentType?: string;
        contentId?: string;
        options: Array<{ label?: string; text: string; isCorrect: boolean; order?: number }>;
      };

      // Assign contentId fallback if missing
      const assignedContentType = ex.contentType ?? (idx % 2 === 0 ? "VOCAB" : "GRAMMAR");
      const assignedContentId =
        ex.contentId ??
        (assignedContentType === "VOCAB" && assignedVocabs[0]
          ? assignedVocabs[0].id
          : assignedGrammars[0]
          ? assignedGrammars[0].id
          : undefined);

      await prisma.exercise.create({
        data: {
          lessonId: lesson.id,
          type: ex.type,
          contentType: assignedContentType,
          contentId: assignedContentId,
          question: ex.question,
          correctAnswer: ex.correctAnswer,
          points: ex.points,
          order: ex.order ?? idx,
          options: {
            create: ex.options.map((opt, optIdx) => ({
              label: opt.label ?? String.fromCharCode(65 + optIdx),
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: opt.order ?? optIdx,
            })),
          },
        },
      });
      stats.lessons.exercises += 1;
    }
  }
  console.log(`  ✓ Lessons imported: ${stats.lessons.total} (N5: ${stats.lessons.n5}, N4: ${stats.lessons.n4}, N3: ${stats.lessons.n3}).`);
  console.log(`  ✓ Exercises imported: ${stats.lessons.exercises} total exercises.`);
  console.log(`  ✓ LessonItems connected: ${stats.lessonItems.total} linkages.`);

  // 7. SCENARIOS (N5 + N4 + N3 + EXPANDED)
  console.log("\nImporting Interactive Survival & Conversation Scenarios...");
  const ALL_SCENARIOS = [...SCENARIOS_N5, ...SCENARIOS_N4, ...SCENARIOS_N3, ...EXPANDED_SCENARIOS];
  for (const s of ALL_SCENARIOS) {
    const scenario = await prisma.scenario.upsert({
      where: { slug: s.slug },
      update: { title: s.title, description: s.description, level: s.level, xpReward: s.xpReward, isPublished: true },
      create: { slug: s.slug, title: s.title, description: s.description, level: s.level, xpReward: s.xpReward, isPublished: true },
    });
    stats.scenarios.total += 1;

    await prisma.scenarioMessage.deleteMany({ where: { scenarioId: scenario.id } });
    await prisma.scenarioChoice.deleteMany({ where: { scenarioId: scenario.id } });

    for (const msg of s.messages) {
      await prisma.scenarioMessage.create({
        data: {
          scenarioId: scenario.id,
          order: msg.order,
          speaker: msg.speaker,
          japanese: msg.japanese,
          romaji: msg.romaji,
          meaning: msg.meaning,
        },
      });
      stats.scenarios.messages += 1;
    }

    for (const ch of s.choices) {
      await prisma.scenarioChoice.create({
        data: {
          scenarioId: scenario.id,
          optionText: ch.optionText,
          isIdeal: ch.isIdeal,
          xpReward: ch.xpReward,
        },
      });
      stats.scenarios.choices += 1;
    }
  }
  console.log(`  ✓ Scenarios imported: ${stats.scenarios.total} (Messages: ${stats.scenarios.messages}, Choices: ${stats.scenarios.choices}).`);

  // 8. SYNCHRONIZE USER PROGRESS, ACHIEVEMENTS & JOURNEY
  console.log("\nSynchronizing User Progress, Achievements & Journey...");
  const users = await prisma.user.findMany({ select: { id: true, totalXP: true } });
  for (const u of users) {
    await evaluateUserAchievements(u.id);
    await evaluateUserJourneyUnlocks(u.id, u.totalXP);
  }
  console.log(`  ✓ Synchronized progression for ${users.length} active users.`);

  console.log("\n===============================================================");
  console.log("🎉 JAPANESE CURRICULUM IMPORT COMPLETED SUCCESSFULLY 🎉");
  console.log("===============================================================");
  return stats;
}

// CLI Execution entrypoint
if (require.main === module || process.argv[1]?.includes("import-japanese-curriculum")) {
  importJapaneseCurriculum()
    .then((stats) => {
      console.log("\nFinal Import Statistics Summary:", JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error("Import failed with error:", e);
      process.exit(1);
    });
}

