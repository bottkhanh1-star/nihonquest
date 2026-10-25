"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";
import { useNativeLanguage } from "@/components/LanguageContext";
import { type EnrichedLeaderboardUser, type DirectRivalInfo } from "@/lib/rivalBots";

const RANK_ICONS = ["🥇", "🥈", "🥉"];
const TIER_COLORS = [
  { min: 0, max: 100, name: "Beginner", color: "from-slate-400 to-slate-600", badge: "⭐" },
  { min: 100, max: 500, name: "Learner", color: "from-amber-400 to-amber-600", badge: "🎌" },
  { min: 500, max: 1500, name: "Traveler", color: "from-emerald-400 to-emerald-600", badge: "🗾" },
  { min: 1500, max: 5000, name: "Samurai", color: "from-fuji-400 to-fuji-700", badge: "⚔️" },
  { min: 5000, max: Infinity, name: "Grandmaster", color: "from-sakura-400 to-rose-600", badge: "👑" },
];

function getTier(xp: number, t: (k: any) => string) {
  const match = TIER_COLORS.findLast((t) => xp >= t.min) ?? TIER_COLORS[0];
  let localizedName = match.name;
  if (match.min === 0) localizedName = t("lbTierBeginner") || match.name;
  else if (match.min === 100) localizedName = t("lbTierLearner") || match.name;
  else if (match.min === 500) localizedName = t("lbTierTraveler") || match.name;
  else if (match.min === 1500) localizedName = t("lbTierSamurai") || match.name;
  else if (match.min === 5000) localizedName = t("lbTierMaster") || match.name;
  return { ...match, name: localizedName };
}

export function LeaderboardClient({
  currentUserId,
  weeklyUsers,
  allTimeUsers,
  directRival,
}: {
  currentUserId: string;
  weeklyUsers: EnrichedLeaderboardUser[];
  allTimeUsers: EnrichedLeaderboardUser[];
  directRival: DirectRivalInfo | null;
}) {
  const [tab, setTab] = useState<"WEEKLY" | "ALL_TIME">("WEEKLY");
  const { t } = useNativeLanguage();

  const users = tab === "WEEKLY" ? weeklyUsers : allTimeUsers;
  const currentUser = users.find((u) => u.id === currentUserId);
  const currentUserRank = users.findIndex((u) => u.id === currentUserId) + 1;

  // Localized rival challenge message
  const getLocalizedRivalMessage = () => {
    if (!directRival) return "";
    const botRank = currentUserRank - directRival.rankDiff;
    const botName = directRival.bot.displayName || directRival.bot.name || "AI Rival";
    if (directRival.xpDiff > 0) {
      return t("lbRivalAhead", { bot: botName, rank: botRank, xp: directRival.xpDiff }) || directRival.message;
    } else if (directRival.xpDiff === 0) {
      return t("lbRivalTied", { bot: botName }) || directRival.message;
    } else {
      return t("lbRivalBehind", { bot: botName, rank: botRank, xp: Math.abs(directRival.xpDiff) }) || directRival.message;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-sumi-900 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto shadow-inner">
        <button
          onClick={() => setTab("WEEKLY")}
          className={`flex-1 min-h-11 py-2.5 rounded-xl text-xs font-black transition-all ${
            tab === "WEEKLY"
              ? "bg-white dark:bg-sumi-800 text-sakura-600 dark:text-sakura-400 shadow-sm"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          {t("lbTabWeekly") || "🔥 Weekly League"}
        </button>
        <button
          onClick={() => setTab("ALL_TIME")}
          className={`flex-1 min-h-11 py-2.5 rounded-xl text-xs font-black transition-all ${
            tab === "ALL_TIME"
              ? "bg-white dark:bg-sumi-800 text-sakura-600 dark:text-sakura-400 shadow-sm"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          {t("lbTabAllTime") || "👑 All-Time"}
        </button>
      </div>

      {/* Direct Rival Challenge Banner (Only on Weekly League) */}
      {tab === "WEEKLY" && directRival && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-indigo-950/40 border-2 border-rose-300/80 dark:border-rose-900/80 p-4 sm:p-5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-2xl text-white shadow-md shadow-rose-500/30 shrink-0">
                {directRival.bot.avatar || "⚔️"}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-xs shrink-0">
                    {t("lbDirectRival") || "⚔️ DIRECT RIVAL"}
                  </span>
                 
                 
                </div>
                <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                  {getLocalizedRivalMessage()}
                </h4>
                {directRival.bot.quote && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic truncate">
                    &ldquo;{directRival.bot.quote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
              <Link href="/app/practice">
                <Button variant="sakura" size="sm" className="font-black shadow-md shadow-sakura-500/25 min-h-10 sm:min-h-9 px-4">
                  {t("lbOutpaceBtn") || "Study to overtake 🚀"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Current User Position Banner */}
      {currentUser && (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 dark:from-slate-900 dark:to-slate-950 border-2 border-red-200 dark:border-red-900/50 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="relative shrink-0">
              <UserAvatar
                src={currentUser.avatar}
                name={currentUser.displayName || currentUser.name}
                fallbackText={getTier(currentUser.xp, t).badge}
                sizeClass="w-11 h-11 sm:w-12 sm:h-12 text-xl sm:text-2xl rounded-2xl"
                className={`bg-gradient-to-br ${getTier(currentUser.xp, t).color} shadow-lg rounded-2xl`}
                imgClassName="rounded-2xl shadow-lg ring-2 ring-white dark:ring-sumi-800"
              />
              <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                #{currentUserRank}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                {t("lbYourPosition") || "Your standing"}{" "}
                {tab === "WEEKLY" ? (t("lbThisWeek") || "this week") : (t("lbAllTime") || "all-time")}
              </p>
              <p className="font-black text-slate-900 dark:text-white text-sm sm:text-base truncate">
                {currentUser.displayName || currentUser.name || (t("lbYou") || "You")}{" "}
                <span className="text-red-600 dark:text-red-400">#{currentUserRank}</span>
              </p>
              <div className="flex items-center gap-2.5 sm:gap-3 mt-0.5 text-xs text-slate-500 flex-wrap font-semibold">
                <span>⚡ {currentUser.xp.toLocaleString("en-US")} XP</span>
                <span>🎯 Lv.{currentUser.level}</span>
                <span>🔥 {currentUser.currentStreak} {t("lbDaysUnit") || "days"}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Leaderboard Table List */}
      <div className="space-y-2.5">
        {users.map((user, idx) => {
          const rank = idx + 1;
          const isMe = user.id === currentUserId;
          const tier = getTier(user.xp, t);
          const displayName = user.displayName || user.name || (t("lbDefaultLearner") || "Learner");

          return (
            <Card
              key={user.id}
              className={`p-3 sm:p-3.5 transition-all ${
                isMe
                  ? "border-2 border-sakura-400 dark:border-sakura-800 bg-sakura-50/60 dark:bg-sakura-950/30 shadow-sm scale-[1.01]"
                  : rank <= 3
                  ? "border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10"
                  : "border border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Rank number or medal */}
                <div className="w-7 sm:w-8 text-center shrink-0">
                  {rank <= 3 ? (
                    <span className="text-lg sm:text-xl">{RANK_ICONS[rank - 1]}</span>
                  ) : (
                    <span className="text-xs sm:text-sm font-black text-slate-400">#{rank}</span>
                  )}
                </div>

                {/* Avatar / Badge */}
                <UserAvatar
                  src={user.avatar}
                  name={displayName}
                  fallbackText={tier.badge}
                  sizeClass="w-9 h-9 sm:w-10 sm:h-10 text-base sm:text-lg rounded-2xl"
                  className={`bg-gradient-to-br ${tier.color} shadow-sm rounded-2xl`}
                  imgClassName="rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className={`font-black text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px] ${isMe ? "text-sakura-600 dark:text-sakura-400" : "text-slate-900 dark:text-white"}`}>
                      {displayName}
                      {isMe && ` ${t("lbYou") || "(You)"}`}
                    </span>
                    <Badge variant={rank <= 3 ? "amber" : "slate"} className="text-[9px] sm:text-[10px] shrink-0 py-0 px-1.5 sm:px-2">
                      {tier.name}
                    </Badge>
                  
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium flex-wrap">
                    <span>🎯 Lv.{user.level}</span>
                    <span>🔥 {user.currentStreak}{t("lbDaysUnit") || "d"}</span>
                    {user.quote && (
                      <span className="hidden md:inline text-slate-400 truncate max-w-[160px]">
                        · &ldquo;{user.quote}&rdquo;
                      </span>
                    )}
                  </div>
                </div>

                {/* XP earned */}
                <div className="text-right shrink-0">
                  <div className="font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                    ⚡ {user.xp.toLocaleString("en-US")}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                    {tab === "WEEKLY" ? (t("lbWeeklyXp") || "Weekly XP") : "XP"}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {users.length === 0 && (
          <Card className="p-8 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
            <p className="text-4xl mb-2">🏆</p>
            <p className="font-black text-slate-700 dark:text-slate-200">
              {t("lbEmptyTitle") || "No activity yet this week!"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {t("lbEmptyDesc") || "Complete a lesson or review to take the top spot on the leaderboard! 🌸"}
            </p>
          </Card>
        )}

        {users.some((u) => u.isBot) && (
          <p className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-sumi-900/60 dark:text-slate-400">
            {t("lbBotDisclaimer") ||
              "💡 Accounts marked with 🤖 AI Rival are simulated characters to keep up a competitive practice pace — not real users."}
          </p>
        )}
      </div>
    </div>
  );
}
