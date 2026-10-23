import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { generateNaturalJapaneseResponse, getLanguageName } from "@/lib/naturalSenseiEngine";
import { getUserProgress } from "@/lib/progress-service";
import { getUserLearningMistakes, formatMistakesForAiPrompt } from "@/lib/learningMistakes";
import { rateLimitAsync, rateLimited } from "@/lib/rateLimit";
import type { NativeLanguage } from "@/lib/languages";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

const VALID_KEY_PATTERN =
  /^(gsk_[A-Za-z0-9_-]{16,128}|sk-or-[A-Za-z0-9_.-]{16,128}|sk-[A-Za-z0-9_.-]{16,128}|xai-[A-Za-z0-9_-]{16,128}|AIza[A-Za-z0-9_-]{20,80}|AQ\.[A-Za-z0-9_.-]{16,128})$/;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const convId = searchParams.get("conversationId");

  if (convId) {
    const conv = await prisma.aiConversation.findFirst({
      where: { id: convId, userId: uid },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 200 } },
    });
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...conv, messages: [...conv.messages].reverse() });
  }

  const conversations = await prisma.aiConversation.findMany({
    where: { userId: uid },
    include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  let fallbackMessage = "Xin chào";
  let fallbackScenario = "general_kaiwa";
  let fallbackLang: NativeLanguage = "en";
  let fallbackProgress: Parameters<typeof generateNaturalJapaneseResponse>[0]["userProgress"] = null;
  let fallbackMistakes: Parameters<typeof generateNaturalJapaneseResponse>[0]["mistakes"] = null;

  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const uid = (session?.user as { id?: string; name?: string } | undefined)?.id;
    const userName = (session?.user as { name?: string } | undefined)?.name?.trim() || "";

    const body = await req.json().catch(() => ({}));
    const {
      message,
      conversationId,
      apiKey,
      scenarioId,
      history: clientHistory,
      nativeLanguage: clientLang,
      userProgress: clientProgress,
      screenContext,
    } = body as {
      message?: string;
      conversationId?: string;
      apiKey?: string;
      scenarioId?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      nativeLanguage?: NativeLanguage;
      screenContext?: {
        pageType?: string;
        pageTitle?: string;
        item?: {
          term: string;
          reading?: string;
          meaning?: string;
          type?: string;
          examples?: Array<{ ja: string; vi?: string }>;
          isFlipped?: boolean;
          extraPrompt?: string;
        } | null;
        quiz?: {
          question: string;
          options?: string[];
          userAnswer?: string;
          correctAnswer?: string;
          isCorrect?: boolean;
          explanation?: string;
        } | null;
        recentMistakes?: Array<{
          term: string;
          reading?: string;
          meaning?: string;
          wrongAnswer?: string;
          correctAnswer?: string;
          type?: string;
        }>;
        userMemories?: string[];
      };
      userProgress?: {
        userLevel?: string;
        level?: number;
        totalXP?: number;
        currentStreak?: number;
        completedLessonsCount?: number;
        totalLessonsInLevel?: number;
        dueReviewCount?: number;
        accuracyPercent?: number;
        stats?: {
          completedLessonsCount?: number;
          totalLessonsInLevel?: number;
          dueReviewCount?: number;
          reviewAccuracy?: number | null;
        };
      };
    };

    const cookieLang = req.cookies.get("nq_native_language")?.value;
    const langCandidate = clientLang || cookieLang;
    const isSupportedLang = langCandidate && SUPPORTED_LANGUAGES.some((l) => l.code === langCandidate);
    const nativeLanguage: NativeLanguage = isSupportedLang ? (langCandidate as NativeLanguage) : "en";

    if (message) fallbackMessage = message;
    if (scenarioId) fallbackScenario = scenarioId;
    fallbackLang = nativeLanguage;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ error: "Message quá dài (tối đa 4000 ký tự)." }, { status: 400 });
    }

    const [dbProgress, userMistakes] = await Promise.all([
      uid ? getUserProgress(uid).catch(() => null) : Promise.resolve(null),
      uid ? getUserLearningMistakes(uid).catch(() => null) : Promise.resolve(null),
    ]);

    const effectiveProgress = dbProgress
      ? {
          userLevel: dbProgress.learningLevel,
          level: dbProgress.level,
          totalXP: dbProgress.totalXP,
          currentStreak: dbProgress.currentStreak,
          completedLessonsCount: dbProgress.stats?.completedLessonsCount,
          totalLessonsInLevel: dbProgress.stats?.totalLessonsInLevel,
          dueReviewCount: dbProgress.stats?.dueReviewCount,
          accuracyPercent: dbProgress.stats?.reviewAccuracy ?? 100,
          stats: dbProgress.stats,
        }
      : clientProgress && typeof clientProgress === "object"
        ? {
            userLevel: clientProgress.userLevel || "N5",
            level: clientProgress.level || 1,
            totalXP: clientProgress.totalXP ?? 0,
            currentStreak: clientProgress.currentStreak ?? 0,
            completedLessonsCount:
              clientProgress.completedLessonsCount ?? clientProgress.stats?.completedLessonsCount ?? 0,
            totalLessonsInLevel:
              clientProgress.totalLessonsInLevel ?? clientProgress.stats?.totalLessonsInLevel ?? 50,
            dueReviewCount:
              clientProgress.dueReviewCount ?? clientProgress.stats?.dueReviewCount ?? 0,
            accuracyPercent:
              clientProgress.accuracyPercent ?? clientProgress.stats?.reviewAccuracy ?? 100,
            stats: clientProgress.stats,
          }
        : null;

    fallbackProgress = effectiveProgress;
    fallbackMistakes = userMistakes;

    let convId: string = conversationId || (uid ? "conv-" : "guest-") + Date.now();
    if (uid) {
      const limit = await rateLimitAsync(`ai-chat:${uid}`, 30, 60_000).catch(() => ({ ok: true as const, remaining: 30 }));
      if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

      try {
        let conv = conversationId
          ? await prisma.aiConversation.findFirst({ where: { id: conversationId, userId: uid } })
          : null;

        if (!conv) {
          conv = await prisma.aiConversation.create({
            data: {
              userId: uid,
              title: message.slice(0, 60),
              provider: "NATURAL_KAIWA_ENGINE",
              model: "aoi-sensei-n3",
            },
          });
        }
        convId = conv.id;

        await prisma.aiMessage.create({
          data: { conversationId: conv.id, role: "user", content: message.trim() },
        });
      } catch (dbErr) {
        console.warn("[AI Chat DB Warning - Continuing with AI response]:", dbErr);
      }
    } else {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "guest";
      const limit = await rateLimitAsync(`ai-chat:guest:${ip}`, 50, 60_000).catch(() => ({ ok: true as const, remaining: 50 }));
      if (!limit.ok) return rateLimited(limit.retryAfterSeconds);
    }

    let aiResponse = "";
    let activeProvider = "NATURAL_KAIWA_ENGINE";
    let activeModel = "aoi-sensei-n3";

    // Only accept client-supplied API keys when explicitly enabled or in dev/test,
    // and never mix unvalidated strings into server key pools.
    const allowClientKeys =
      process.env.ALLOW_CLIENT_AI_KEYS === "true" || process.env.NODE_ENV !== "production";

    const rawKeySources = [
      process.env.GEMINI_API_KEY,
      process.env.GROQ_API_KEY,
      process.env.OPENROUTER_API_KEY,
      process.env.GROK_API_KEY,
      process.env.XAI_API_KEY,
      ...(allowClientKeys
        ? [req.headers.get("x-gemini-key"), req.headers.get("x-groq-key"), apiKey, req.headers.get("x-grok-key")]
        : []),
    ]
      .filter(Boolean)
      .join("\n");

    const getKeyPriority = (k: string): number => {
      if (k.startsWith("AIza") || k.startsWith("AQ.")) return 1; // 1. Gemini
      if (k.startsWith("gsk_")) return 2;                       // 2. Groq
      if (k.startsWith("sk-or-")) return 3;                     // 3. OpenRouter
      if (k.startsWith("xai-")) return 4;                       // 4. xAI Grok
      return 5;
    };

    // Sort strictly by priority: Gemini (1) -> Groq (2) -> OpenRouter (3) -> Grok (4)
    const keyList = Array.from(
      new Set(
        rawKeySources
          .split(/[\s,;\n]+/)
          .map((k) => k.trim().replace(/^["']|["']$/g, ""))
          .filter((k) => VALID_KEY_PATTERN.test(k)),
      ),
    )
      .sort((a, b) => getKeyPriority(a) - getKeyPriority(b))
      .slice(0, 6);

    if (keyList.length > 0) {
    try {
      const dbHistory = uid && !convId.startsWith("guest-")
        ? await prisma.aiMessage
            .findMany({
              where: { conversationId: convId },
              orderBy: { createdAt: "desc" },
              take: 20,
            })
            .catch(() => [])
        : [];
      dbHistory.reverse();

      const trustedClientHistory = Array.isArray(clientHistory)
        ? clientHistory
            .slice(-20)
            .filter((m) => typeof m?.content === "string" && m.content.length <= 4000)
        : [];

      const history: { role: string; content: string }[] =
        trustedClientHistory.length > 0
          ? [...trustedClientHistory, { role: "user", content: message.trim() }]
          : [
              ...dbHistory.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: message.trim() },
            ];

      const nativeLangName = getLanguageName(nativeLanguage);
      const mistakesSnippet = userMistakes
        ? formatMistakesForAiPrompt(userMistakes, nativeLangName)
        : "";

      const progressLevel = effectiveProgress?.userLevel || "N5";
      const progressTier = effectiveProgress?.level || 1;
      const progressXP = effectiveProgress?.totalXP ?? 0;
      const progressStreak = effectiveProgress?.currentStreak ?? 0;
      const progressDone =
        effectiveProgress?.stats?.completedLessonsCount ??
        effectiveProgress?.completedLessonsCount ??
        0;
      const progressTotal =
        effectiveProgress?.stats?.totalLessonsInLevel ??
        effectiveProgress?.totalLessonsInLevel ??
        50;
      const progressDue =
        effectiveProgress?.stats?.dueReviewCount ??
        effectiveProgress?.dueReviewCount ??
        0;
      const progressAccuracy =
        effectiveProgress?.stats?.reviewAccuracy ??
        effectiveProgress?.accuracyPercent ??
        100;

      const studentNameText = userName ? `- Tên học viên: ${userName}\n` : "";
      const progressSnippet = effectiveProgress
        ? `\nTHÔNG TIN HỒ SƠ & TIẾN TRÌNH HỌC TẬP THỰC TẾ CỦA HỌC VIÊN:
${studentNameText}- Trình độ JLPT hiện tại: ${progressLevel} (Cấp độ Level ${progressTier})
- Tổng tích lũy XP: ${progressXP} XP
- Chuỗi Streak học tập: ${progressStreak} ngày liên tiếp
- Bài học đã hoàn thành: ${progressDone}/${progressTotal} bài học
- Thẻ từ vựng SRS cần ôn tập hôm nay: ${progressDue} thẻ
- Tỷ lệ làm bài chính xác: ${progressAccuracy}%
- Ngôn ngữ mẹ đẻ (Native Language) của học viên: ${nativeLangName} (${nativeLanguage}).`
        : `\n${studentNameText}Ngôn ngữ mẹ đẻ của học viên: ${nativeLangName} (${nativeLanguage}).`;

      const baseInstruction =
        scenarioId === "business_horenso"
          ? `Bạn là Tanaka Senpai (hoặc Aoi Sensei) tại công ty Nhật Bản. Hãy trò chuyện trực tiếp bằng tiếng Nhật lịch sự công sở N3 (Keigo/Desu/Masu). Luôn trả lời ngắn gọn (2-3 câu), kèm dịch nghĩa bằng ${nativeLangName} bên dưới.`
          : scenarioId === "casual_friends"
            ? `Bạn là Aoi-chan, bạn thân người Nhật. Hãy trò chuyện như bạn bè thật sự bằng tiếng Nhật thể ngắn (タメ口) trong 2-3 câu ngắn, dùng thán từ tự nhiên (マジで？, そうなんだ, やばい, めっちゃ). Kèm dịch nghĩa bằng ${nativeLangName} bên dưới.`
            : scenarioId === "travel_restaurant"
              ? `Bạn là nhân viên nhà hàng / hướng dẫn viên du lịch Nhật Bản. Hãy đối thoại nhã nhặn, tự nhiên trong 2-3 câu ngắn kèm dịch nghĩa bằng ${nativeLangName}.`
              : `Bạn là AI Sensei (Aoi Sensei 🌸 / Ren Sensei 🦊) tại Nihon Quest - gia sư tiếng Nhật siêu ngắn gọn, súc tích và đúng trọng tâm.`;

      
      // Construct Screen-Aware Context Snippet
      let screenSnippet = "";
      if (screenContext) {
        const parts: string[] = [];
        if (screenContext.pageTitle || screenContext.pageType) {
          parts.push(`- Màn hình hiện tại: ${screenContext.pageTitle || screenContext.pageType} (Mục: ${screenContext.pageType || 'học tập'})`);
        }
        if (screenContext.item?.term) {
          parts.push(`- Nội dung/Thẻ đang hiển thị ngay trước mắt:
  • Từ/Mục: "${screenContext.item.term}" ${screenContext.item.reading ? `(${screenContext.item.reading})` : ''}
  • Loại kiến thức: ${screenContext.item.type || 'Từ vựng/Kanji'}
  • Ý nghĩa: ${screenContext.item.meaning || 'Chưa mở'}
  • Trạng thái: ${screenContext.item.isFlipped ? 'Đã lật xem đáp án' : 'Đang trong lúc suy nghĩ (chưa lật thẻ)'}
  ${screenContext.item.examples && screenContext.item.examples.length > 0 ? `• Câu ví dụ: ${screenContext.item.examples.map(e => `${e.ja} (${e.vi || ''})`).join(' | ')}` : ''}
  ${screenContext.item.extraPrompt ? `• Ghi chú: ${screenContext.item.extraPrompt}` : ''}`);
        }
        if (screenContext.quiz?.question) {
          parts.push(`- Câu hỏi bài tập trắc nghiệm đang giải:
  • Câu hỏi: "${screenContext.quiz.question}"
  ${screenContext.quiz.options ? `• Các lựa chọn: ${screenContext.quiz.options.join(' / ')}` : ''}
  ${screenContext.quiz.userAnswer ? `• Học viên chọn: "${screenContext.quiz.userAnswer}"` : ''}
  ${screenContext.quiz.correctAnswer ? `• Đáp án đúng: "${screenContext.quiz.correctAnswer}"` : ''}
  ${screenContext.quiz.isCorrect !== undefined ? `• Kết quả: ${screenContext.quiz.isCorrect ? 'ĐÚNG ✓' : 'SAI ✗'}` : ''}
  ${screenContext.quiz.explanation ? `• Giải thích: ${screenContext.quiz.explanation}` : ''}`);
        }
        if (parts.length > 0) {
          screenSnippet = `\nNGỮ CẢNH MÀN HÌNH THỜI GIAN THỰC (REAL-TIME SCREEN CONTEXT):
${parts.join('\n')}
=> ĐẶC BIỆT LƯU Ý: Nếu học viên hỏi "đây là từ gì?", "câu này nghĩa là gì?", "sao câu này em chọn sai?", "giảng lại kiến thức này", "cho mẹo nhớ", bạn PHẢI TRẢ LỜI TRỰC TIẾP VỀ NỘI DUNG MÀN HÌNH Ở TRÊN MÀ KHÔNG HỎI LẠI!\n`;
        }
      }

      // Construct Session Recent Mistakes Snippet
      let sessionMistakesSnippet = "";
      if (screenContext?.recentMistakes && screenContext.recentMistakes.length > 0) {
        const list = screenContext.recentMistakes.slice(0, 5).map((m, idx) =>
          `  ${idx + 1}. "${m.term}" ${m.reading ? `(${m.reading})` : ''}: ${m.wrongAnswer || 'chưa nhớ'}`
        ).join('\n');
        sessionMistakesSnippet = `\nCÁC LỖI SAI VỪA MẮC PHẢI TRONG PHIÊN NÀY (VỪA XẢY RA):
${list}
=> Khi học viên hỏi "tôi vừa sai cái gì?", hãy phân tích ngay các mục này!\n`;
      }

      // Construct Long-term User Memory Snippet
      let memorySnippet = "";
      if (screenContext?.userMemories && screenContext.userMemories.length > 0) {
        const memList = screenContext.userMemories.map(m => `  • ${m}`).join('\n');
        memorySnippet = `\nKÝ ỨC DÀI HẠN & THÔNG TIN HỌC VIÊN ĐÃ CHIA SẺ TRƯỚC ĐÂY:
${memList}
=> Hãy ứng dụng các thông tin trên (tên xưng hô, sở thích, mục tiêu JLPT) để cá nhân hoá câu trả lời!\n`;
      }

      const systemPrompt = `${baseInstruction}${screenSnippet}${progressSnippet}${mistakesSnippet}${sessionMistakesSnippet}${memorySnippet}
CRITICAL PEDAGOGICAL & LANGUAGE DIRECTIVE:
1. STRICT CONCISENESS & COMPLETENESS (NGẮN GỌN, ĐẦY ĐỦ, ĐÚNG TRỌNG TÂM):
   - Phản hồi ĐẦY ĐỦ Ý nhưng NGẮN GỌN, súc tích (khoảng 3 đến 5 gạch đầu dòng ngắn).
   - TUYỆT ĐỐI KHÔNG DỪNG CỤT LỦN, KHÔNG BỎ DỞ CÂU GIỮA CHỪNG. Luôn hoàn thành trọn vẹn câu trả lời.
   - TUYỆT ĐỐI KHÔNG DÀI DÒNG LAN MAN, không giải thích quá hàn lâm hay viết thành bài văn dài gây mỏi mắt cho người học.
   - BỎ TOÀN BỘ các câu mở đầu chào hỏi sáo rỗng. Đi thẳng vào nội dung cốt lõi ngay từ dòng đầu tiên.
   - Khi giải thích ngữ pháp hoặc câu tiếng Nhật:
     • Dòng 1: Cấu trúc & ý nghĩa tổng quan của câu (ngắn gọn trong 1 câu).
     • Dòng 2-4: Phân tích nhanh các thành phần chính (Chủ ngữ, Trợ từ, Vị ngữ/Đuôi câu).
     • Dòng cuối: 1 câu ví dụ tương tự ngắn kèm dịch nghĩa bằng ${nativeLangName}.
   - Tránh văn phong thuyết giảng sách giáo khoa, hãy nói chuyện tự nhiên, gần gũi, súc tích như gia sư nhắn tin trực tiếp với học viên.
2. NATIVE-LANGUAGE-FIRST RULE:
   - The learner's native mother tongue is: ${nativeLangName} (${nativeLanguage}).
   - You MUST explain grammar, provide meanings, analyze mistakes, give feedback, and formulate hints EXCLUSIVELY in ${nativeLangName}.
   - If the learner's language is Chinese (简体中文 / 繁體中文), you MUST write all explanations and translations in Chinese, NEVER in Vietnamese or English.
   - If the learner's language is Vietnamese, write all explanations and translations in Vietnamese.
   - Japanese MUST be preserved for the target learning content: Japanese dialogue lines, Kanji, Hiragana, Katakana, and examples.
3. PROGRESS-AWARE TUTORING:
   - Có thể xưng hô thân mật ${userName ? `"${userName}-san"` : ""} khi nhận xét hoặc động viên, nhưng KHÔNG để lời chào chiếm chỗ câu giải thích.
   - When asked what to study today or about progress, give a quick, punchy 2-line recommendation based on their metrics (JLPT ${progressLevel}, ${progressStreak}-day streak, ${progressDue} due SRS cards).
   - When asked about mistakes, state the exact reason in 1 sentence and give 1 quick fix.
4. KAWAII & ENCOURAGING PERSONA:
   - Friendly, warm, encouraging (Kawaii Sensei) with appropriate emoji 🌸✨🎌, but always keeping answers SHORT and PUNCHY.`;

      let aiSuccess = false;

      for (const currentKey of keyList) {
        if (aiSuccess) break;

        if (currentKey.startsWith("xai-")) {
          const grokMessages = [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          ];

          const grokModels = ["grok-2-latest", "grok-beta"];

          for (const grModel of grokModels) {
            if (aiSuccess) break;
            try {
              const grRes = await fetch("https://api.x.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${currentKey}`,
                },
                body: JSON.stringify({
                  model: grModel,
                  messages: grokMessages,
                  temperature: 0.7,
                  max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(8000),
              });

              if (grRes.ok) {
                const grData = await grRes.json();
                const textResult = grData?.choices?.[0]?.message?.content;
                if (textResult && textResult.trim().length > 0) {
                  aiResponse = textResult.trim();
                  aiSuccess = true;
                  activeProvider = "XAI_GROK";
                  activeModel = grModel;
                  if (uid && !convId.startsWith("guest-")) {
                    await prisma.aiConversation
                      .update({
                        where: { id: convId },
                        data: { provider: "XAI_GROK", model: grModel },
                      })
                      .catch(() => {});
                  }
                  break;
                }
              }
            } catch {
              // Fall through to next model
            }
          }
        } else if (currentKey.startsWith("gsk_")) {
          const groqMessages = [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          ];

          const groqModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];

          for (const gModel of groqModels) {
            if (aiSuccess) break;
            try {
              const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${currentKey}`,
                },
                body: JSON.stringify({
                  model: gModel,
                  messages: groqMessages,
                  temperature: 0.7,
                  max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(8000),
              });

              if (groqRes.ok) {
                const groqData = await groqRes.json();
                const textResult = groqData?.choices?.[0]?.message?.content;
                if (textResult && textResult.trim().length > 0) {
                  aiResponse = textResult.trim();
                  aiSuccess = true;
                  activeProvider = "GROQ";
                  activeModel = gModel;
                  if (uid && !convId.startsWith("guest-")) {
                    await prisma.aiConversation
                      .update({
                        where: { id: convId },
                        data: { provider: "GROQ", model: gModel },
                      })
                      .catch(() => {});
                  }
                  break;
                }
              }
            } catch {
              // Fall through to next model/provider
            }
          }
        } else if (currentKey.startsWith("sk-or-")) {
          const orModels = [
            "deepseek/deepseek-chat",
            "meta-llama/llama-3.3-70b-instruct:free",
            "google/gemini-2.0-flash-exp:free",
            "qwen/qwen-2.5-72b-instruct:free",
          ];

          const orMessages = [
            { role: "system", content: systemPrompt },
            ...history.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          ];

          for (const orModel of orModels) {
            if (aiSuccess) break;
            try {
              const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${currentKey}`,
                },
                body: JSON.stringify({
                  model: orModel,
                  messages: orMessages,
                  temperature: 0.7,
                  max_tokens: 1000,
                }),
                signal: AbortSignal.timeout(8000),
              });

              if (orRes.ok) {
                const orData = await orRes.json();
                const textResult = orData?.choices?.[0]?.message?.content;
                if (textResult && textResult.trim().length > 0) {
                  aiResponse = textResult.trim();
                  aiSuccess = true;
                  activeProvider = "OPENROUTER";
                  activeModel = orModel;
                  if (uid && !convId.startsWith("guest-")) {
                    await prisma.aiConversation
                      .update({
                        where: { id: convId },
                        data: { provider: "OPENROUTER", model: orModel },
                      })
                      .catch(() => {});
                  }
                  break;
                }
              }
            } catch {
              // Fall through to next model
            }
          }
        } else {
          // Google Gemini Direct generateContent (~1.5s latency, official & stable)
          const geminiContents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
          for (const m of history) {
            const role = m.role === "assistant" ? "model" : "user";
            if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
              geminiContents[geminiContents.length - 1].parts[0].text += `\n${m.content}`;
            } else {
              geminiContents.push({ role, parts: [{ text: m.content }] });
            }
          }

          while (geminiContents.length > 0 && geminiContents[0].role !== "user") {
            geminiContents.shift();
          }

          if (geminiContents.length === 0) {
            geminiContents.push({ role: "user", parts: [{ text: message }] });
          }

          const payload = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 0 } },
          };

          const requestedModel =
            typeof (body as { model?: unknown }).model === "string"
              ? (body as { model: string }).model.trim()
              : "";
          const isValidGeminiModel = /^gemini-[a-zA-Z0-9.-]+$/.test(requestedModel);
          const clientModel = isValidGeminiModel ? requestedModel : undefined;

          const modelsToTry = Array.from(
            new Set([clientModel, "gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean) as string[]),
          );

          for (const modelName of modelsToTry) {
            if (aiSuccess) break;
            try {
              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                  signal: AbortSignal.timeout(8000),
                },
              );

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const textResult = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textResult && textResult.trim().length > 0) {
                  aiResponse = textResult.trim();
                  aiSuccess = true;
                  activeProvider = "GOOGLE_GEMINI";
                  activeModel = modelName;
                  if (uid && !convId.startsWith("guest-")) {
                    await prisma.aiConversation
                      .update({
                        where: { id: convId },
                        data: { provider: "GOOGLE_GEMINI", model: modelName },
                      })
                      .catch(() => {});
                  }
                  break;
                }
              }
            } catch {
              // Fall through to next model or next provider
            }
          }
        }
      }

      if (!aiSuccess) {
        aiResponse = generateNaturalJapaneseResponse({
          scenarioId,
          userMessage: message,
          userProgress: effectiveProgress,
          mistakes: userMistakes,
          nativeLanguage,
        });
      }
    } catch (err) {
      console.error("[AI Chat Route Error]:", (err as Error)?.message || err);
      aiResponse = generateNaturalJapaneseResponse({
        scenarioId,
        userMessage: message,
        userProgress: effectiveProgress,
        mistakes: userMistakes,
        nativeLanguage,
      });
    }
  } else {
    aiResponse = generateNaturalJapaneseResponse({
      scenarioId,
      userMessage: message,
      userProgress: effectiveProgress,
      mistakes: userMistakes,
      nativeLanguage,
    });
  }

    let savedMsgId = "msg-" + Date.now();
    if (uid && !convId.startsWith("guest-")) {
      try {
        const aiMsg = await prisma.aiMessage.create({
          data: { conversationId: convId, role: "assistant", content: aiResponse },
        });
        savedMsgId = aiMsg.id;

        await prisma.aiConversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });
      } catch (dbSaveErr) {
        console.warn("[AI Chat DB Save Warning]:", dbSaveErr);
      }
    }

    return NextResponse.json({
      conversationId: convId,
      message: {
        id: savedMsgId,
        role: "assistant",
        content: aiResponse,
        createdAt: new Date().toISOString(),
      },
      provider: activeProvider,
      model: activeModel,
      isGuest: !uid,
      aiDisclaimer: "Phản hồi được tạo bởi AI hỗ trợ luyện hội thoại — hãy đối chiếu với bài học chuẩn khi ôn thi JLPT.",
    });
  } catch (globalErr) {
    console.error("[AI Chat Global Fallback]:", globalErr);
    const fallbackText = generateNaturalJapaneseResponse({
      scenarioId: fallbackScenario,
      userMessage: fallbackMessage,
      userProgress: fallbackProgress,
      mistakes: fallbackMistakes,
      nativeLanguage: fallbackLang,
    });
    return NextResponse.json({
      conversationId: "fallback-" + Date.now(),
      message: {
        id: "msg-" + Date.now(),
        role: "assistant",
        content: fallbackText,
        createdAt: new Date().toISOString(),
      },
      provider: "NATURAL_KAIWA_ENGINE",
      model: "fallback-rescue",
      aiDisclaimer: "Phản hồi dự phòng từ trợ lý AI Kawaii Sensei.",
    });
  }
}
