"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { IconButton } from "@/components/ui";
import { registerPushSubscription, sendServerTestPush } from "@/lib/push-client";
import {
  NIHON_CHIME_STYLES,
  getPreferredChimeStyle,
  setPreferredChimeStyle,
  playNihonQuestChime,
} from "@/lib/nihonChime";

const DECLINED_STORAGE_KEY = "nq_push_permission_declined";
const INAPP_ENABLED_KEY = "nq_inapp_notifications_enabled";

interface NotificationItem {
  id: string;
  type: "call" | "friend" | "message" | "lesson" | "srs" | "streak" | "mission" | "sensei";
  title: string;
  desc: string;
  actionUrl?: string;
  actionLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  time: string;
  isUrgent?: boolean;
}

export function NotificationDropdown() {
  const { progress } = useUserProgress();
  const { nativeLanguage, t } = useNativeLanguage();
  const { playClick, showToast } = useSoundAndTheme();
  const {
    unreadMessagesCount,
    unreadConversations,
    latestConversation,
    incomingFriendRequests,
    recentFriends,
    acceptFriendRequest,
    incomingCall,
  } = useGlobalCall();

  const [isOpen, setIsOpen] = useState(false);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | "default">("default");
  const [chimeStyle, setChimeStyle] = useState<"sakura" | "furin" | "matsuri">("sakura");
  const [isRingingAnim, setIsRingingAnim] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setChimeStyle(getPreferredChimeStyle());
  }, []);

  const triggerBellSwing = useCallback(() => {
    setIsRingingAnim(true);
    setTimeout(() => setIsRingingAnim(false), 900);
  }, []);

  // Check initial notification permission on mount, sync background push,
  // and ALWAYS auto-prompt on every visit unless already granted or explicitly denied!
  useEffect(() => {
    if (typeof window === "undefined") return;

    const userDeclined = localStorage.getItem(DECLINED_STORAGE_KEY) === "true";
    const inAppEnabled = localStorage.getItem(INAPP_ENABLED_KEY) === "true";

    if ("Notification" in window) {
      const currentPerm = Notification.permission;
      setDevicePermission(currentPerm);

      if (currentPerm === "granted") {
        if ("serviceWorker" in navigator) {
          registerPushSubscription().catch(() => {});
        }
        return;
      }

      if (currentPerm === "denied" || userDeclined) {
        return;
      }

      // Permission is "default" and user has NOT declined:
      // 1. Try requesting native permission automatically if browser allows it on load
      // 2. Always show the interactive prompt banner so mobile & desktop browsers can grant with 1 tap
      const timer = setTimeout(() => {
        try {
          Notification.requestPermission()
            .then((perm) => {
              setDevicePermission(perm);
              if (perm === "granted") {
                setShowAutoPrompt(false);
                playNihonQuestChime("sakura");
                registerPushSubscription().catch(() => {});
              } else if (perm === "denied") {
                localStorage.setItem(DECLINED_STORAGE_KEY, "true");
                setShowAutoPrompt(false);
              } else {
                // Still "default" (browser blocked auto-request without user gesture) -> show prompt UI
                setShowAutoPrompt(true);
              }
            })
            .catch(() => {
              setShowAutoPrompt(true);
            });
        } catch {
          setShowAutoPrompt(true);
        }
      }, 600);

      return () => clearTimeout(timer);
    } else {
      // Mobile browser where window.Notification is not directly on window (e.g. iOS Safari tab)
      if (inAppEnabled) {
        setDevicePermission("granted");
        return;
      }
      if (!userDeclined) {
        const timer = setTimeout(() => {
          setShowAutoPrompt(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Listen for custom event from Mobile Drawer / Quick Settings so tapping "Thông báo" anywhere opens this menu
  useEffect(() => {
    const handleOpenEvent = () => {
      playNihonQuestChime();
      triggerBellSwing();
      setIsOpen(true);
    };
    window.addEventListener("nq:open-notifications", handleOpenEvent);
    return () => window.removeEventListener("nq:open-notifications", handleOpenEvent);
  }, [triggerBellSwing]);

  const requestDevicePermission = useCallback(async () => {
    playNihonQuestChime("sakura");
    triggerBellSwing();
    if (typeof window === "undefined") return;

    // Clear any previous manual decline flag since user explicitly clicked Enable
    try {
      localStorage.removeItem(DECLINED_STORAGE_KEY);
    } catch {}

    try {
      const result = await registerPushSubscription();
      if (result.success) {
        setDevicePermission("granted");
        setShowAutoPrompt(false);
        showToast({
          title:
            nativeLanguage === "vi"
              ? "Đã bật chuông Nihon Quest! 🎐"
              : "Nihon Quest Bell Enabled! 🎐",
          description:
            nativeLanguage === "vi"
              ? "Bạn sẽ nhận được thông báo kết bạn, bài học, tin nhắn và cuộc gọi ngay cả khi tắt web!"
              : "You will receive friend requests, lessons, messages and calls even when closed!",
          type: "info",
        });

        if (!result.fallbackMode) {
          await sendServerTestPush();
        }
      } else {
        if ("Notification" in window && Notification.permission === "denied") {
          setDevicePermission("denied");
          localStorage.setItem(DECLINED_STORAGE_KEY, "true");
          setShowAutoPrompt(false);
          showToast({
            title: nativeLanguage === "vi" ? "Đã từ chối quyền thông báo" : "Permission Denied",
            description:
              nativeLanguage === "vi"
                ? "Bạn đã chặn thông báo trên trình duyệt. Hãy bấm vào biểu tượng ổ khóa trên thanh địa chỉ URL nếu muốn bật lại."
                : "Notifications were blocked. Use the address bar lock icon to re-enable.",
            type: "info",
          });
        } else if ("Notification" in window) {
          setDevicePermission(Notification.permission);
        }
      }
    } catch (err) {
      console.warn("Failed to request notification permission:", err);
    }
  }, [nativeLanguage, showToast, triggerBellSwing]);

  const handleDeclineAutoPrompt = useCallback(() => {
    playClick();
    try {
      localStorage.setItem(DECLINED_STORAGE_KEY, "true");
    } catch {}
    setShowAutoPrompt(false);
  }, [playClick]);

  const handleLaterAutoPrompt = useCallback(() => {
    playClick();
    // Do NOT set DECLINED_STORAGE_KEY so it will ask again next time user enters the web!
    setShowAutoPrompt(false);
  }, [playClick]);

  const handleSelectChimeStyle = useCallback(
    (style: "sakura" | "furin" | "matsuri") => {
      setChimeStyle(style);
      setPreferredChimeStyle(style);
      playNihonQuestChime(style);
      triggerBellSwing();
    },
    [triggerBellSwing]
  );

  const testDeviceNotification = useCallback(async () => {
    // Always play signature Nihon Quest chime immediately!
    playNihonQuestChime(chimeStyle);
    triggerBellSwing();

    showToast({
      title:
        nativeLanguage === "vi"
          ? "🎐 Đang ngân vang chuông Nihon Quest!"
          : "🎐 Playing Nihon Quest Chime!",
      description:
        nativeLanguage === "vi"
          ? "Giai điệu Koto & Chuông gió Fūrin đặc trưng cùng thông báo đẩy tới thiết bị."
          : "Signature Koto & Fūrin wind chime with device push notification.",
      type: "info",
    });

    try {
      const res = await sendServerTestPush();
      if (!res.success && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Nihon Quest 🎐 — Lời nhắc học tập", {
          body:
            nativeLanguage === "vi"
              ? "Đã đến giờ ôn tập! Hãy duy trì chuỗi Streak và hoàn thành bài học tiếng Nhật hôm nay nhé! 🌸"
              : "Time to practice! Keep your streak alive and complete your Japanese lesson today! 🌸",
          icon: "/icon.png",
        });
      }
    } catch {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Nihon Quest 🎐 — Lời nhắc học tập", {
          body:
            nativeLanguage === "vi"
              ? "Đã đến giờ ôn tập! Hãy duy trì chuỗi Streak và hoàn thành bài học tiếng Nhật hôm nay nhé! 🌸"
              : "Time to practice! Keep your streak alive and complete your Japanese lesson today! 🌸",
          icon: "/icon.png",
        });
      }
    }
  }, [chimeStyle, nativeLanguage, showToast, triggerBellSwing]);

  const handleQuickAcceptFriend = useCallback(
    async (friendshipId: string, friendName: string) => {
      setAcceptingId(friendshipId);
      const ok = await acceptFriendRequest(friendshipId);
      setAcceptingId(null);
      if (ok) {
        showToast({
          title:
            nativeLanguage === "vi"
              ? `🌸 Đã kết bạn với ${friendName}!`
              : `🌸 Connected with ${friendName}!`,
          description:
            nativeLanguage === "vi"
              ? "Hai bạn có thể nhắn tin và gọi video luyện tiếng Nhật ngay bây giờ."
              : "You can now chat and make video calls to practice Japanese together.",
          type: "success",
        });
      }
    },
    [acceptFriendRequest, nativeLanguage, showToast]
  );

  // Build active dynamic notifications based on live user progress, friends, messages, and lessons
  const notifications: NotificationItem[] = [];

  // 1. Live Incoming Call Alert (Highest Priority)
  if (incomingCall) {
    notifications.push({
      id: `notif-call-${incomingCall.id}`,
      type: "call",
      title:
        nativeLanguage === "vi"
          ? "📞 Cuộc gọi đang đổ chuông!"
          : "📞 Incoming Call Ringing!",
      desc:
        (incomingCall.caller.name || "Một học viên") +
        (nativeLanguage === "vi"
          ? " đang gọi điện cho bạn..."
          : " is calling you..."),
      actionUrl: "/app/messages",
      actionLabel: nativeLanguage === "vi" ? "Nhấc máy ngay →" : "Answer Call →",
      time: nativeLanguage === "vi" ? "Đang gọi" : "Live",
      isUrgent: true,
    });
  }

  // 2. Kết bạn mới (New Friend Requests & Accepted Friends)
  if (incomingFriendRequests.length > 0) {
    incomingFriendRequests.forEach((req) => {
      notifications.push({
        id: `notif-friend-req-${req.friendshipId}`,
        type: "friend",
        title:
          nativeLanguage === "vi"
            ? `🤝 Lời mời kết bạn mới từ ${req.name}`
            : `🤝 New friend request from ${req.name}`,
        desc:
          nativeLanguage === "vi"
            ? `Học viên cấp độ JLPT ${req.learningLevel || "N5"} muốn kết bạn và luyện hội thoại tiếng Nhật cùng bạn!`
            : `JLPT ${req.learningLevel || "N5"} learner wants to connect and practice Japanese with you!`,
        actionUrl: "/app/messages?tab=REQUESTS",
        actionLabel: nativeLanguage === "vi" ? "Xem lời mời →" : "View Request →",
        secondaryActionLabel:
          acceptingId === req.friendshipId
            ? nativeLanguage === "vi"
              ? "Đang đồng ý..."
              : "Accepting..."
            : nativeLanguage === "vi"
              ? "✓ Đồng ý ngay"
              : "✓ Accept Now",
        onSecondaryAction: () => handleQuickAcceptFriend(req.friendshipId, req.name),
        time: nativeLanguage === "vi" ? "Kết bạn mới" : "Friend Req",
        isUrgent: true,
      });
    });
  } else if (recentFriends.length > 0) {
    const latestFriend = recentFriends[0];
    notifications.push({
      id: `notif-friend-connected-${latestFriend.userId}`,
      type: "friend",
      title:
        nativeLanguage === "vi"
          ? `🤝 Bạn đồng hành: ${latestFriend.name}${recentFriends.length > 1 ? ` (+${recentFriends.length - 1})` : ""}`
          : `🤝 Study Partner: ${latestFriend.name}${recentFriends.length > 1 ? ` (+${recentFriends.length - 1})` : ""}`,
      desc:
        nativeLanguage === "vi"
          ? `Đã kết bạn thành công (JLPT ${latestFriend.learningLevel || "N5"}). Hãy nhắn tin hoặc gọi video luyện phản xạ Kaiwa nhé!`
          : `Connected (JLPT ${latestFriend.learningLevel || "N5"}). Start a chat or video call to practice Japanese!`,
      actionUrl: `/app/messages?friendId=${latestFriend.userId}`,
      actionLabel: nativeLanguage === "vi" ? "Nhắn tin / Gọi ngay →" : "Chat / Call →",
      time: nativeLanguage === "vi" ? "Bạn bè" : "Friends",
    });
  } else {
    notifications.push({
      id: "notif-friend-discover",
      type: "friend",
      title:
        nativeLanguage === "vi"
          ? "🤝 Kết bạn mới & Cộng đồng học viên"
          : "🤝 Find New Study Friends",
      desc:
        nativeLanguage === "vi"
          ? `Tìm bạn học cùng trình độ JLPT ${progress?.learningLevel || "N5"} để nhắn tin và gọi video luyện giao tiếp mỗi ngày.`
          : `Connect with JLPT ${progress?.learningLevel || "N5"} learners for daily chat and video speaking practice.`,
      actionUrl: "/app/messages?tab=FIND",
      actionLabel: nativeLanguage === "vi" ? "Tìm bạn mới →" : "Find Friends →",
      time: nativeLanguage === "vi" ? "Cộng đồng" : "Social",
    });
  }

  // 3. Tin nhắn (Unread Direct Messages + Latest Chat Preview)
  if (unreadConversations.length > 0) {
    unreadConversations.slice(0, 3).forEach((conv) => {
      const preview = conv.lastMessage?.content || "Tin nhắn mới";
      notifications.push({
        id: `notif-msg-${conv.friend.id}-${conv.lastMessage?.id || conv.unreadCount}`,
        type: "message",
        title:
          nativeLanguage === "vi"
            ? `💬 Tin nhắn mới từ ${conv.friend.name} (${conv.unreadCount})`
            : `💬 New message from ${conv.friend.name} (${conv.unreadCount})`,
        desc: `“${preview.length > 75 ? preview.slice(0, 72) + "..." : preview}”`,
        actionUrl: `/app/messages?friendId=${conv.friend.id}`,
        actionLabel: nativeLanguage === "vi" ? "Trả lời ngay →" : "Reply Now →",
        time: nativeLanguage === "vi" ? "Chưa đọc" : "Unread",
        isUrgent: true,
      });
    });
  } else if (latestConversation && latestConversation.lastMessage) {
    const preview = latestConversation.lastMessage.content;
    notifications.push({
      id: `notif-msg-latest-${latestConversation.friend.id}`,
      type: "message",
      title:
        nativeLanguage === "vi"
          ? `💬 Trò chuyện với ${latestConversation.friend.name}`
          : `💬 Chat with ${latestConversation.friend.name}`,
      desc:
        nativeLanguage === "vi"
          ? `Tin nhắn gần nhất: “${preview.length > 65 ? preview.slice(0, 62) + "..." : preview}”`
          : `Latest message: “${preview.length > 65 ? preview.slice(0, 62) + "..." : preview}”`,
      actionUrl: `/app/messages?friendId=${latestConversation.friend.id}`,
      actionLabel: nativeLanguage === "vi" ? "Mở cuộc trò chuyện →" : "Open Chat →",
      time: nativeLanguage === "vi" ? "Hộp thư" : "Inbox",
    });
  } else if (unreadMessagesCount > 0) {
    notifications.push({
      id: "notif-unread-messages",
      type: "message",
      title:
        nativeLanguage === "vi"
          ? `💬 ${unreadMessagesCount} tin nhắn mới chưa đọc`
          : `💬 ${unreadMessagesCount} unread message(s)`,
      desc:
        nativeLanguage === "vi"
          ? "Bạn có tin nhắn mới từ bạn bè trong Nihon Quest."
          : "You have new direct messages from your Japanese learning friends.",
      actionUrl: "/app/messages",
      actionLabel: nativeLanguage === "vi" ? "Mở hộp thư chat →" : "Open Chat →",
      time: nativeLanguage === "vi" ? "Mới" : "New",
      isUrgent: true,
    });
  }

  const streak = progress?.currentStreak ?? 0;
  const dueCards = progress?.stats?.dueReviewCount ?? 0;
  const completedLessons = progress?.stats?.completedLessonsCount ?? 0;
  const totalLessons = progress?.stats?.totalLessonsInLevel ?? 50;
  const learningLevel = progress?.learningLevel || "N5";
  const lessonPct = progress?.stats?.lessonProgressPercent ?? 0;
  const vocabLearned = progress?.stats?.vocabLearnedCount ?? 0;
  const grammarLearned = progress?.stats?.grammarLearnedCount ?? 0;
  const nextLessonNumber = Math.min(completedLessons + 1, totalLessons);

  // 4. Bài học hôm nay (Next Lesson & Curriculum Progress)
  notifications.push({
    id: `notif-lesson-${learningLevel}-${nextLessonNumber}`,
    type: "lesson",
    title:
      completedLessons < totalLessons
        ? nativeLanguage === "vi"
          ? `📖 Bài học tiếp theo: Bài ${nextLessonNumber} (JLPT ${learningLevel})`
          : `📖 Next Lesson: Lesson ${nextLessonNumber} (JLPT ${learningLevel})`
        : nativeLanguage === "vi"
          ? `🎓 Đã hoàn thành toàn bộ ${totalLessons} bài JLPT ${learningLevel}!`
          : `🎓 Completed all ${totalLessons} JLPT ${learningLevel} lessons!`,
    desc:
      nativeLanguage === "vi"
        ? `Tiến độ giáo trình: ${completedLessons}/${totalLessons} bài (${lessonPct}%) • Đã thuộc ${vocabLearned} từ vựng & ${grammarLearned} ngữ pháp.`
        : `Curriculum: ${completedLessons}/${totalLessons} lessons (${lessonPct}%) • ${vocabLearned} vocab & ${grammarLearned} grammar points mastered.`,
    actionUrl: "/app/lesson",
    actionLabel:
      nativeLanguage === "vi"
        ? `Học Bài ${nextLessonNumber} ngay →`
        : `Start Lesson ${nextLessonNumber} →`,
    time: `JLPT ${learningLevel}`,
  });

  // 5. SRS Due Notification
  if (dueCards > 0) {
    notifications.push({
      id: "notif-srs",
      type: "srs",
      title: t("notifSrsTitle").replace("{n}", String(dueCards)),
      desc: t("notifSrsDesc"),
      actionUrl: "/app/review",
      actionLabel: t("notifSrsAction"),
      time: "SRS",
    });
  }

  // 6. Daily Streak Alert
  notifications.push({
    id: "notif-streak",
    type: "streak",
    title: t("notifStreakTitle").replace("{n}", String(streak)),
    desc: t("notifStreakDesc"),
    actionUrl: "/app/practice",
    actionLabel: t("notifStreakAction"),
    time: "Streak",
  });

  // 7. Roadmap Milestone
  if (completedLessons < totalLessons) {
    notifications.push({
      id: "notif-mission",
      type: "mission",
      title: t("notifMilestoneTitle")
        .replace("{done}", String(completedLessons))
        .replace("{total}", String(totalLessons)),
      desc: t("notifMilestoneDesc").replace("{done}", String(completedLessons)),
      actionUrl: "/app/path",
      actionLabel: t("notifMilestoneAction"),
      time: nativeLanguage === "vi" ? "Lộ trình" : "Path",
    });
  }

  // 8. Kawaii Sensei Daily Tip
  notifications.push({
    id: "notif-sensei",
    type: "sensei",
    title: t("notifTipTitle"),
    desc: t("notifTipDesc"),
    actionUrl: "/app/sensei",
    actionLabel: t("notifTipAction"),
    time: "Sensei",
  });

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const hasUrgent = notifications.some((n) => n.isUrgent && !readIds.has(n.id));

  // Dismiss on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const handleMarkAllRead = () => {
    playClick();
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Signature Nihon Quest Fūrin / Suzu Bell Button on BOTH Mobile and Desktop */}
      <IconButton
        label={t("notifications") || "Thông báo"}
        className={`relative h-9 w-9 sm:h-10 sm:w-10 transition-transform ${
          hasUrgent
            ? "border-red-300 bg-red-50/80 text-red-600 dark:border-red-800/80 dark:bg-red-950/40 dark:text-red-400"
            : ""
        }`}
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) {
            playNihonQuestChime(chimeStyle);
            triggerBellSwing();
          } else {
            playClick();
          }
        }}
        aria-expanded={isOpen}
      >
        {/* Custom Japanese Fūrin Wind-Chime & Shrine Bell SVG */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-[19px] w-[19px] origin-top transition-transform duration-300 ${
            isRingingAnim || hasUrgent ? "animate-bounce" : ""
          }`}
           aria-hidden="true"
        >
          {/* Top Shrine Cord */}
          <path
            d="M12 2v2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Fūrin Dome Body */}
          <path
            d="M6.5 11.5C6.5 8.186 8.962 5.5 12 5.5s5.5 2.686 5.5 6v2.5c0 .828.56 1.5 1.25 1.5H5.25c.69 0 1.25-.672 1.25-1.5v-2.5Z"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          {/* Decorative Japanese Wave / Obi Band on Bell */}
          <path
            d="M7.2 11.5h9.6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />
          {/* Clapper + Tanzaku Paper Strip (Characteristic of Japanese Fūrin) */}
          <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
          <path
            d="M10.6 18.2h2.8l-.4 3.8h-2l-.4-3.8Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-sumi-900 ${
              hasUrgent ? "bg-red-600 animate-bounce" : "bg-red-600 animate-pulse"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </IconButton>

      {/* AUTO-PROMPT BANNER ON PAGE ENTRY (Shown automatically every time user enters web unless granted or declined) */}
      {showAutoPrompt && !isOpen && devicePermission !== "granted" && (
        <div className="fixed inset-x-3 top-16 z-[9990] mx-auto max-w-md animate-slide-in-down rounded-2xl border-2 border-red-500/70 bg-white/98 p-3.5 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-20 sm:w-96 dark:border-red-500/50 dark:bg-sumi-900/98">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl shadow-xs dark:bg-red-950/60">
              🎐
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {nativeLanguage === "vi"
                  ? "Bật chuông thông báo Nihon Quest?"
                  : "Enable Nihon Quest Bell Notifications?"}
              </h4>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {nativeLanguage === "vi"
                  ? "Nhận ngay cuộc gọi đến, lời mời kết bạn, tin nhắn và nhắc bài học mỗi ngày với tiếng chuông gió Nhật Bản đặc trưng."
                  : "Get instant alerts for calls, friend requests, messages, and daily lessons with our signature Japanese wind chime."}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDeclineAutoPrompt}
              className="rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-sumi-800 dark:hover:text-slate-200"
            >
              {nativeLanguage === "vi" ? "Từ chối" : "Decline"}
            </button>
            <button
              type="button"
              onClick={handleLaterAutoPrompt}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300"
            >
              {nativeLanguage === "vi" ? "Để sau" : "Later"}
            </button>
            <button
              type="button"
              onClick={requestDevicePermission}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-[11px] font-extrabold text-white shadow-md transition hover:bg-red-700 active:scale-95"
            >
              <span>🎐</span>
              <span>{nativeLanguage === "vi" ? "Cho phép" : "Allow"}</span>
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <>
          {/* Mobile backdrop for clean outside tap dismissal */}
          <div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label={t("notifications")}
            className="fixed left-3 right-3 top-16 z-50 mx-auto max-w-md sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:mx-0 sm:w-[400px] sm:max-w-none rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-sumi-900 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🎐</span>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                  {t("notifications")}
                </h4>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition font-medium"
                  >
                    {t("markAllAsRead")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-sumi-800 dark:text-slate-300"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Nihon Quest Signature Chime Selector & Device Permission Banner */}
            <div className="mb-2.5 p-2.5 rounded-xl border transition-all text-xs bg-gradient-to-br from-red-50/70 via-white to-amber-50/50 dark:from-sumi-950 dark:via-sumi-900 dark:to-red-950/30 border-red-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-slate-800 dark:text-slate-100">
                  <span>🎐</span>
                  <span>
                    {nativeLanguage === "vi"
                      ? "Giai điệu Chuông Nihon Quest:"
                      : "Nihon Quest Chime Melody:"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={testDeviceNotification}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 text-[10px] font-extrabold transition shadow-xs active:scale-95"
                >
                  {nativeLanguage === "vi" ? "Nghe thử chuông 🎐" : "Play Chime 🎐"}
                </button>
              </div>

              {/* 3 Japanese Chime Presets */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {NIHON_CHIME_STYLES.map((sItem) => {
                  const active = chimeStyle === sItem.id;
                  return (
                    <button
                      key={sItem.id}
                      type="button"
                      onClick={() => handleSelectChimeStyle(sItem.id)}
                      className={`rounded-lg px-2 py-1.5 text-[10px] font-bold transition text-center truncate border ${
                        active
                          ? "bg-red-600 text-white border-red-600 shadow-xs"
                          : "bg-white/90 dark:bg-sumi-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-300"
                      }`}
                    >
                      {sItem.emoji}{" "}
                      {sItem.id === "sakura"
                        ? "Sakura Koto"
                        : sItem.id === "furin"
                          ? "Edo Fūrin"
                          : "Kyoto Suzu"}
                    </button>
                  );
                })}
              </div>

              {/* Device Push Status Row */}
              {devicePermission === "granted" ? (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    <span>✓</span>
                    <span>
                      {nativeLanguage === "vi"
                        ? "Thông báo thiết bị: Đang bật"
                        : "Device notifications: Active"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {nativeLanguage === "vi" ? "Đồng bộ tự động" : "Auto-synced"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    {devicePermission === "denied"
                      ? nativeLanguage === "vi"
                        ? "Thông báo đang tắt trên trình duyệt. Bấm để bật lại:"
                        : "Notifications blocked in browser. Tap to retry:"
                      : nativeLanguage === "vi"
                        ? "Nhận chuông báo ngay cả khi tắt trình duyệt:"
                        : "Receive alerts even when browser is closed:"}
                  </div>
                  <button
                    type="button"
                    onClick={requestDevicePermission}
                    className="shrink-0 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold px-2.5 py-1 text-[10px] shadow-xs transition active:scale-95"
                  >
                    {nativeLanguage === "vi" ? "Bật ngay 🔔" : "Enable 🔔"}
                  </button>
                </div>
              )}
            </div>

            {/* Category Pills Overview */}
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-sumi-800 px-2 py-0.5 shrink-0">
                🤝 {nativeLanguage === "vi" ? "Kết bạn" : "Friends"} ({incomingFriendRequests.length})
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-sumi-800 px-2 py-0.5 shrink-0">
                💬 {nativeLanguage === "vi" ? "Tin nhắn" : "Messages"} ({unreadMessagesCount})
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-sumi-800 px-2 py-0.5 shrink-0">
                📖 {nativeLanguage === "vi" ? `Bài ${nextLessonNumber}` : `Lesson ${nextLessonNumber}`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-sumi-800 px-2 py-0.5 shrink-0">
                🔥 {streak}d Streak
              </span>
            </div>

            {/* Notification List */}
            <div className="max-h-[55dvh] sm:max-h-80 overflow-y-auto space-y-2 pr-0.5">
              {notifications.map((item) => {
                const isRead = readIds.has(item.id);
                const isPriority =
                  item.isUrgent ||
                  item.type === "call" ||
                  (item.type === "friend" && incomingFriendRequests.length > 0);
                const isLesson = item.type === "lesson";

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition ${
                      isPriority
                        ? "bg-red-50/75 dark:bg-red-950/35 border-red-200 dark:border-red-900/60 shadow-xs ring-1 ring-red-400/30"
                        : isLesson
                          ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50 shadow-xs"
                          : isRead
                            ? "bg-slate-50/60 dark:bg-sumi-950/40 border-slate-100 dark:border-slate-800/80 opacity-70"
                            : "bg-white dark:bg-sumi-800/90 border-slate-200/80 dark:border-slate-700 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <h5
                        className={`font-bold text-xs leading-snug ${
                          isPriority
                            ? "text-red-700 dark:text-red-300"
                            : isLesson
                              ? "text-amber-900 dark:text-amber-300"
                              : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {item.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 shrink-0 font-semibold px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-sumi-900/60">
                        {item.time}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.desc}
                    </p>

                    {(item.actionUrl || item.onSecondaryAction) && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {item.onSecondaryAction && item.secondaryActionLabel && (
                          <button
                            type="button"
                            onClick={item.onSecondaryAction}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-extrabold shadow-xs transition active:scale-95"
                          >
                            {item.secondaryActionLabel}
                          </button>
                        )}
                        {item.actionUrl && (
                          <Link
                            href={item.actionUrl}
                            onClick={() => {
                              playClick();
                              setIsOpen(false);
                              setReadIds((prev) => new Set(prev).add(item.id));
                            }}
                            className={`text-[11px] font-extrabold hover:underline inline-flex items-center gap-1 ${
                              isPriority
                                ? "text-red-700 dark:text-red-300"
                                : isLesson
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {item.actionLabel}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
