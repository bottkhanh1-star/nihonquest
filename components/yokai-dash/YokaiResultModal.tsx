"use client";

import React, { useState } from "react";
import { YokaiGameResult } from "@/lib/yokai-dash/types";
import { Button } from "@/components/ui";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { localizeYokaiQuestion } from "@/lib/yokai-dash/yokaiLocalization";

interface YokaiResultModalProps {
  result: YokaiGameResult;
  earnedXP: number;
  newTotalXP?: number;
  newLevel?: number;
  leveledUp?: boolean;
  stamina: number;
  onPlayAgain: () => void;
  onBackToHub: () => void;
}

export function YokaiResultModal({
  result,
  earnedXP,
  newTotalXP,
  newLevel,
  leveledUp,
  stamina,
  onPlayAgain,
  onBackToHub,
}: YokaiResultModalProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "review">("summary");
  const { nativeLanguage, t } = useNativeLanguage();
  const { speak, stopSpeaking, speakingText } = useSoundAndTheme();

  const isEn = nativeLanguage === "en";
  const isZh = nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW";
  const isKo = nativeLanguage === "ko";

  const speakText = (text: string) => {
    if (!text) return;
    if (speakingText === text) {
      stopSpeaking();
    } else {
      speak(text, 0.85);
    }
  };

  const missedCount = result.answeredQuestions.filter((q) => !q.isCorrect).length;
  const total = result.answeredQuestions.length;
  const ratio = total > 0 ? result.correctCount / total : 0;
  const stars = total === 0 ? 0 : ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : ratio > 0 ? 1 : 0;

  const victoryTitle = isEn
    ? "Spirit Realm Conquered!"
    : isZh
    ? "成功征服灵界！"
    : isKo
    ? "영계 정복 달성!"
    : "Chinh phục cõi Linh Giới!";

  const defeatTitle = isEn
    ? "Journey Ended"
    : isZh
    ? "修道之行终了"
    : isKo
    ? "여정 종료"
    : "Kết thúc hành trình";

  const victoryDesc = isEn
    ? "Splendid! You broke through all knowledge gates."
    : isZh
    ? "太棒了！你已顺利穿过所有知识鸟居。"
    : isKo
    ? "훌륭합니다! 모든 지식의 문을 돌파했습니다."
    : "Tuyệt vời! Bạn đã vượt qua tất cả cổng tri thức.";

  const defeatDesc = isEn
    ? "All 3 hearts depleted. Review mistakes below and strive higher next run!"
    : isZh
    ? "3 颗生命红心已耗尽。复习下方错题，下局定能突破！"
    : isKo
    ? "하트 3개가 모두 소진되었습니다. 오답을 확인하고 다음 번에 도전하세요!"
    : "Đã hết 3 tim sinh mệnh. Ôn lại các câu sai để bứt phá lượt sau nhé.";

  const summaryTabLabel = isEn
    ? "📊 Summary & Rewards"
    : isZh
    ? "📊 总结与奖励"
    : isKo
    ? "📊 결과 및 보상"
    : "📊 Tổng Kết & Phần Thưởng";

  const reviewTabLabel = isEn
    ? "📖 Review Questions"
    : isZh
    ? "📖 错题解析与复习"
    : isKo
    ? "📖 문제 복습"
    : "📖 Ôn Tập Kiến Thức";

  const xpLabel = isEn
    ? "Experience Gained"
    : isZh
    ? "获得经验值"
    : isKo
    ? "획득한 경험치"
    : "Kinh Nghiệm Nhận Được";

  const practiceNote = isEn
    ? "(Practice mode consumes no stamina)"
    : isZh
    ? "（练习模式不消耗体力）"
    : isKo
    ? "(연습 모드는 스태미나를 소모하지 않습니다)"
    : "(Chế độ Luyện tập không tốn thể lực)";

  const levelUpLabel = isEn
    ? `🌟 LEVEL UP TO ${newLevel}!`
    : isZh
    ? `🌟 升至等级 ${newLevel}！`
    : isKo
    ? `🌟 레벨 ${newLevel} 달성!`
    : `🌟 LÊN CẤP ${newLevel}!`;

  const totalXpLabel = isEn
    ? "Total Account XP"
    : isZh
    ? "账号累计经验"
    : isKo
    ? "계정 누적 XP"
    : "Tổng XP Tài Khoản";

  const statScore = isEn ? "Score" : isZh ? "得分" : isKo ? "점수" : "Điểm số";
  const statDistance = isEn ? "Distance" : isZh ? "跑酷距离" : isKo ? "달린 거리" : "Quãng đường";
  const statCombo = isEn ? "Max Combo" : isZh ? "最大连击" : isKo ? "최대 콤보" : "Combo tối đa";
  const statAccuracy = isEn ? "Accuracy" : isZh ? "正确率" : isKo ? "정확도" : "Chính xác";

  const backHubBtn = isEn ? "🏛️ Back to Hub" : isZh ? "🏛️ 返回大厅" : isKo ? "🏛️ 로비로" : "🏛️ Về Sảnh";
  const playAgainBtn = isEn ? "🔁 Play Again" : isZh ? "🔁 再战一局" : isKo ? "🔁 다시 하기" : "🔁 Chơi lại";
  const outOfStamina = isEn ? "Out of Stamina" : isZh ? "体力耗尽" : isKo ? "스태미나 부족" : "Hết thể lực";

  return (
    <div className="fixed inset-0 z-[70] yk-ui flex items-center justify-center p-3 sm:p-4 bg-[#050310]/85 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="yk-frame relative w-full max-w-xl max-h-[92dvh] flex flex-col bg-[linear-gradient(145deg,#12102a,#0a0818_58%,#2a0f24)] border border-amber-300/40 rounded-[1.75rem] shadow-[0_30px_100px_-25px_rgba(0,0,0,0.9)] ring-1 ring-white/10 text-white overflow-hidden">
        <span className="yk-corner-bl" />
        <span className="yk-corner-br" />
        {/* Header Banner */}
        <div
          className={`p-4 sm:p-6 text-center border-b ${
            result.isVictory
              ? "bg-gradient-to-b from-amber-600/30 to-slate-900 border-amber-500/30"
              : "bg-gradient-to-b from-rose-900/30 to-slate-900 border-rose-500/30"
          }`}
        >
          <div className="flex items-end justify-center gap-2 mb-2" aria-label={`${stars} / 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`yk-pop leading-none ${i === 1 ? "text-5xl -translate-y-1" : "text-4xl"} ${
                  i < stars ? "drop-shadow-[0_0_14px_rgba(251,191,36,.9)]" : "grayscale opacity-25"
                }`}
                style={{ animationDelay: `${i * 140}ms` }}
              >
                ⭐
              </span>
            ))}
          </div>
          <h2 className="yk-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            {result.isVictory ? victoryTitle : defeatTitle}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {result.isVictory ? victoryDesc : defeatDesc}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/25">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${
              activeTab === "summary"
                ? "border-amber-400 text-amber-300 bg-white/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {summaryTabLabel}
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "review"
                ? "border-amber-400 text-amber-300 bg-white/5"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span>{reviewTabLabel}</span>
            {missedCount > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                {missedCount} {isEn ? "mistakes" : isZh ? "道错题" : isKo ? "오답" : "câu sai"}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {activeTab === "summary" ? (
            <div className="space-y-4">
              {/* XP & Level Badge */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[linear-gradient(110deg,rgba(245,158,11,0.16),rgba(244,63,94,0.12),rgba(168,85,247,0.12))] border border-amber-300/30 flex items-center justify-between shadow-inner">
                <div>
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    {xpLabel}
                  </div>
                  <div className="yk-display text-4xl font-extrabold text-amber-300 flex items-baseline gap-1 mt-0.5">
                    +{earnedXP} <span className="text-sm font-bold text-white/80">XP</span>
                  </div>
                  {result.isPractice && (
                    <div className="text-xs text-emerald-400 mt-1 font-medium">
                      {practiceNote}
                    </div>
                  )}
                </div>
                {leveledUp ? (
                  <div className="text-center bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs animate-bounce shadow-lg">
                    {levelUpLabel}
                  </div>
                ) : (
                  newTotalXP && (
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{totalXpLabel}</div>
                      <div className="text-base font-bold text-white">{newTotalXP.toLocaleString("en-US")} XP</div>
                    </div>
                  )
                )}
              </div>

              {/* Match Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.045] border border-white/10 text-center shadow-inner">
                  <div className="text-xs text-slate-400">{statScore}</div>
                  <div className="text-lg font-black text-white mt-0.5">{result.score.toLocaleString("en-US")}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.045] border border-white/10 text-center shadow-inner">
                  <div className="text-xs text-slate-400">{statDistance}</div>
                  <div className="text-lg font-black text-white mt-0.5">{result.distance}m</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.045] border border-white/10 text-center shadow-inner">
                  <div className="text-xs text-slate-400">{statCombo}</div>
                  <div className="text-lg font-black text-amber-400 mt-0.5">🔥 x{result.maxCombo}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.045] border border-white/10 text-center shadow-inner">
                  <div className="text-xs text-slate-400">{statAccuracy}</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {result.correctCount}/{result.answeredQuestions.length}
                  </div>
                </div>
              </div>

              {/* SRS Note */}
              {missedCount > 0 ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
                  <span className="text-xl">⛩️</span>
                  <div className="text-xs text-slate-300">
                    <b className="text-rose-300">
                      {missedCount}{" "}
                      {isEn
                        ? "incorrect answers added to Nihon Quest SRS review queue."
                        : isZh
                        ? "道错题已自动加入智能间隔重复（SRS）队列。"
                        : isKo
                        ? "개의 오답이 스마트 복습(SRS) 대기열에 추가되었습니다."
                        : "câu trả lời chưa đúng đã tự động được thêm vào hàng đợi Ôn tập thông minh (SRS)."}
                    </b>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                  <span className="text-xl">✨</span>
                  <div className="text-xs text-slate-300">
                    <b className="text-emerald-300">
                      {isEn
                        ? "Flawless Performance! All questions answered correctly."
                        : isZh
                        ? "身手不凡！本局所有问题全部答对。"
                        : isKo
                        ? "완벽합니다! 이번 런의 모든 질문을 맞혔습니다."
                        : "Thần thái phi phàm! Bạn đã trả lời đúng tất cả các câu hỏi trong lượt chạy này."}
                    </b>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Review Tab */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                {isEn
                  ? "Question details from your run. Tap 🔊 to listen to audio:"
                  : isZh
                  ? "本局题目解析与详情。点击 🔊 聆听纯正发音："
                  : isKo
                  ? "이번 런의 상세 질문 목록입니다. 🔊 아이콘을 눌러 발음을 들어보세요:"
                  : "Chi tiết các câu hỏi trong lượt chạy vừa rồi. Bấm biểu tượng 🔊 để nghe phát âm tiếng Nhật chuẩn:"}
              </p>
              {result.answeredQuestions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {isEn
                    ? "No questions answered before collision."
                    : isZh
                    ? "尚未抵达答题鸟居前即发生碰撞。"
                    : isKo
                    ? "충돌 전에 답변한 문제가 없습니다."
                    : "Chưa trả lời câu hỏi nào trước khi va chạm."}
                </div>
              ) : (
                result.answeredQuestions.map((item, idx) => {
                  const localizedQ = localizeYokaiQuestion(item.question, nativeLanguage);
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        item.isCorrect
                          ? "bg-emerald-950/20 border-emerald-500/30"
                          : "bg-rose-950/30 border-rose-500/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                item.isCorrect
                                  ? "bg-emerald-500/30 text-emerald-300"
                                  : "bg-rose-500/30 text-rose-300"
                              }`}
                            >
                              {item.isCorrect
                                ? isEn ? "✓ Correct" : isZh ? "✓ 正确" : isKo ? "✓ 정답" : "✓ Đúng"
                                : isEn ? "✕ Incorrect" : isZh ? "✕ 错误" : isKo ? "✕ 오답" : "✕ Chưa đúng"}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {localizedQ.category}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white">{localizedQ.prompt}</div>
                          {localizedQ.subPrompt && (
                            <div className="text-xs text-amber-200/80 mt-0.5">({localizedQ.subPrompt})</div>
                          )}
                        </div>

                        {localizedQ.audioText && (
                          <button
                            onClick={() => speakText(localizedQ.audioText!)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0 active:scale-95 transition-transform"
                            title={isEn ? "Play audio" : "Nghe phát âm"}
                          >
                            🔊
                          </button>
                        )}
                      </div>

                      <div className="mt-2 text-xs grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <div>
                          <span className="text-slate-400">
                            {isEn ? "Your pick: " : isZh ? "你的选择: " : isKo ? "선택한 답: " : "Bạn đã chọn: "}
                          </span>
                          <span className={item.isCorrect ? "text-emerald-300 font-bold" : "text-rose-400 font-bold"}>
                            {localizedQ.options[item.chosenLane]}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">
                            {isEn ? "Correct: " : isZh ? "正确答案: " : isKo ? "정답: " : "Đáp án đúng: "}
                          </span>
                          <span className="text-amber-300 font-bold">{localizedQ.correctAnswer}</span>
                        </div>
                      </div>

                      {localizedQ.explanation && (
                        <div className="mt-2 text-xs text-slate-300 bg-black/30 p-2 rounded-xl">
                          💡 {localizedQ.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/80 flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={onBackToHub} className="flex-1 rounded-2xl">
            {backHubBtn}
          </Button>
          <button
            onClick={onPlayAgain}
            disabled={!result.isPractice && stamina <= 0}
            className="yk-launch yk-display flex-1 py-2.5 rounded-2xl text-base font-extrabold text-white border-2 border-amber-300/80 bg-[linear-gradient(180deg,#fb4a6b,#e11d48_45%,#9f1239)] shadow-[0_12px_30px_-10px_rgba(225,29,72,.85)] active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {stamina <= 0 && !result.isPractice ? outOfStamina : playAgainBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
