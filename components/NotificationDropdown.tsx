"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { Icon, IconButton } from "@/components/ui";
import { registerPushSubscription, sendServerTestPush } from "@/lib/push-client";
import {
  NIHON_CHIME_STYLES,
  getPreferredChimeStyle,
  setPreferredChimeStyle,
  playNihonQuestChime,
} from "@/lib/nihonChime";

const DECLINED_STORAGE_KEY = "nq_push_permission_declined";
const INAPP_ENABLED_KEY = "nq_inapp_notifications_enabled";
const READ_NOTIF_STORAGE_KEY = "nq_notif_read_ids";
const DISMISSED_NOTIF_STORAGE_KEY = "nq_notif_dismissed_ids";

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
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD">("ALL");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | "default">("default");
  const [chimeStyle, setChimeStyle] = useState<"sakura" | "furin" | "matsuri">("sakura");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Load persisted read & dismissed notification IDs + preferred Nihon Quest chime style
  useEffect(() => {
    if (typeof window === "undefined") return;
    setChimeStyle(getPreferredChimeStyle());
    try {
      const savedRead = localStorage.getItem(READ_NOTIF_STORAGE_KEY);
      if (savedRead) {
        const parsed = JSON.parse(savedRead);
        if (Array.isArray(parsed)) setReadIds(new Set(parsed));
      }
      const savedDismissed = localStorage.getItem(DISMISSED_NOTIF_STORAGE_KEY);
      if (savedDismissed) {
        const parsed = JSON.parse(savedDismissed);
        if (Array.isArray(parsed)) setDismissedIds(new Set(parsed));
      }
    } catch {}
  }, []);

  const persistReadIds = useCallback((nextSet: Set<string>) => {
    setReadIds(nextSet);
    try {
      localStorage.setItem(READ_NOTIF_STORAGE_KEY, JSON.stringify(Array.from(nextSet)));
    } catch {}
  }, []);

  const persistDismissedIds = useCallback((nextSet: Set<string>) => {
    setDismissedIds(nextSet);
    try {
      localStorage.setItem(DISMISSED_NOTIF_STORAGE_KEY, JSON.stringify(Array.from(nextSet)));
    } catch {}
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

      // Permission is "default" and user has NOT declined
      const timer = setTimeout(() => {
        try {
          Notification.requestPermission()
            .then((perm) => {
              setDevicePermission(perm);
              if (perm === "granted") {
                setShowAutoPrompt(false);
                registerPushSubscription().catch(() => {});
              } else if (perm === "denied") {
                localStorage.setItem(DECLINED_STORAGE_KEY, "true");
                setShowAutoPrompt(false);
              } else {
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
      setIsOpen(true);
    };
    window.addEventListener("nq:open-notifications", handleOpenEvent);
    return () => window.removeEventListener("nq:open-notifications", handleOpenEvent);
  }, []);

  const requestDevicePermission = useCallback(async () => {
    playClick();
    if (typeof window === "undefined") return;

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
              ? "Đã bật thông báo hệ thống thiết bị! 🔔"
              : "Device System Notifications Enabled! 🔔",
          description:
            nativeLanguage === "vi"
              ? "Thông báo sẽ gửi trực tiếp về thanh thông báo điện thoại/máy tính kèm âm báo theo cài đặt máy ngay cả khi tắt web!"
              : "Notifications will be delivered directly to your device OS with system sound even when closed!",
          type: "info",
        });

        await sendServerTestPush();
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
  }, [nativeLanguage, playClick, showToast]);

  const handleDeclineAutoPrompt = useCallback(() => {
    playClick();
    try {
      localStorage.setItem(DECLINED_STORAGE_KEY, "true");
    } catch {}
    setShowAutoPrompt(false);
  }, [playClick]);

  const handleLaterAutoPrompt = useCallback(() => {
    playClick();
    setShowAutoPrompt(false);
  }, [playClick]);

  const handleSelectChimeStyle = useCallback(
    (style: "sakura" | "furin" | "matsuri") => {
      setChimeStyle(style);
      setPreferredChimeStyle(style);
      playNihonQuestChime(style);
    },
    []
  );

  const testDeviceNotification = useCallback(async () => {
    // Play our custom Nihon Quest chime immediately while dispatching the OS push banner!
    playNihonQuestChime(chimeStyle);
    showToast({
      title:
        nativeLanguage === "vi"
          ? "🎐 Đang bắn thông báo & Chuông Nihon Quest về máy..."
          : "🎐 Sending Push & Nihon Quest Chime to Device...",
      description:
        nativeLanguage === "vi"
          ? "Thanh thông báo điện thoại sẽ hiện lên kèm giai điệu Chuông Nihon Quest đặc trưng!"
          : "Your device notification bar will pop up with the custom Nihon Quest chime!",
      type: "info",
    });

    await sendServerTestPush();
  }, [chimeStyle, nativeLanguage, showToast]);

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
  const allNotifications: NotificationItem[] = [];

  // 1. Live Incoming Call Alert (Highest Priority)
  if (incomingCall) {
    allNotifications.push({
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
      allNotifications.push({
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
    allNotifications.push({
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
    allNotifications.push({
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
      allNotifications.push({
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
    allNotifications.push({
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
    allNotifications.push({
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
  allNotifications.push({
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
    allNotifications.push({
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
  allNotifications.push({
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
    allNotifications.push({
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
  allNotifications.push({
    id: "notif-sensei",
    type: "sensei",
    title: t("notifTipTitle"),
    desc: t("notifTipDesc"),
    actionUrl: "/app/sensei",
    actionLabel: t("notifTipAction"),
    time: "Sensei",
  });

  // Filter out dismissed notifications
  const activeNotifications = allNotifications.filter((n) => !dismissedIds.has(n.id));
  const unreadCount = activeNotifications.filter((n) => !readIds.has(n.id)).length;
  const readCount = activeNotifications.filter((n) => readIds.has(n.id)).length;
  const hasUrgent = activeNotifications.some((n) => n.isUrgent && !readIds.has(n.id));

  const displayedNotifications =
    filterTab === "UNREAD"
      ? activeNotifications.filter((n) => !readIds.has(n.id))
      : activeNotifications;

  // Dismiss on outside click / pointerdown / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | PointerEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside, true);
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleOutside, true);
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const handleMarkOneRead = (id: string) => {
    playClick();
    const next = new Set(readIds);
    next.add(id);
    persistReadIds(next);
  };

  const handleDeleteOne = (id: string) => {
    playClick();
    setDeletingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      const nextDismissed = new Set(dismissedIds);
      nextDismissed.add(id);
      persistDismissedIds(nextDismissed);
    }, 210);
  };

  const handleMarkAllRead = () => {
    playClick();
    const next = new Set(readIds);
    activeNotifications.forEach((n) => next.add(n.id));
    persistReadIds(next);
  };

  const handleDeleteAllRead = () => {
    playClick();
    const toRemove = activeNotifications.filter((n) => readIds.has(n.id)).map((n) => n.id);
    if (toRemove.length === 0) return;

    setDeletingIds((prev) => {
      const next = new Set(prev);
      toRemove.forEach((id) => next.add(id));
      return next;
    });

    setTimeout(() => {
      setDeletingIds(new Set());
      const nextDismissed = new Set(dismissedIds);
      toRemove.forEach((id) => nextDismissed.add(id));
      persistDismissedIds(nextDismissed);
    }, 210);
  };

  const handleClearAllNotifications = () => {
    playClick();
    const allIds = activeNotifications.map((n) => n.id);
    setDeletingIds(new Set(allIds));
    setTimeout(() => {
      setDeletingIds(new Set());
      const nextDismissed = new Set(dismissedIds);
      allIds.forEach((id) => nextDismissed.add(id));
      persistDismissedIds(nextDismissed);
    }, 210);
  };

  const handleRestoreNotifications = () => {
    playClick();
    persistDismissedIds(new Set());
    persistReadIds(new Set());
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button — Clean open/close without playing unwanted web audio */}
      <IconButton
        label={t("notifications") || "Thông báo"}
        className={`relative h-9 w-9 sm:h-10 sm:w-10 transition-all duration-200 hover:scale-105 active:scale-95 ${
          hasUrgent
            ? "border-red-300 bg-red-50/80 text-red-600 dark:border-red-800/80 dark:bg-red-950/40 dark:text-red-400"
            : ""
        }`}
        onClick={() => {
          playClick();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <Icon
          name="bell"
          className={`h-[18px] w-[18px] transition-transform duration-300 ${
            hasUrgent ? "animate-bell-ring" : isOpen ? "scale-110" : ""
          }`}
        />

        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-sumi-900 ${
              hasUrgent ? "animate-bounce" : "animate-pulse"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </IconButton>

      {/* AUTO-PROMPT BANNER ON PAGE ENTRY (100% Solid Opaque Background) */}
      {showAutoPrompt && !isOpen && devicePermission !== "granted" && (
        <div className="fixed inset-x-3 top-16 z-[9990] mx-auto max-w-md animate-spring-up rounded-2xl border-2 border-red-500 bg-white p-3.5 shadow-2xl sm:inset-x-auto sm:right-6 sm:top-20 sm:w-96 dark:border-red-500 dark:bg-sumi-900">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl shadow-xs dark:bg-red-950 animate-bell-ring">
              🔔
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {nativeLanguage === "vi"
                  ? "Bật thông báo hệ thống điện thoại?"
                  : "Enable Device System Notifications?"}
              </h4>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {nativeLanguage === "vi"
                  ? "Nhận thông báo có chuông & rung trực tiếp về điện thoại/máy tính khi có cuộc gọi, tin nhắn, kết bạn và nhắc bài học ngay cả khi không mở web."
                  : "Receive native OS notifications with sound & vibration for calls, messages, friend requests, and lessons even when closed."}
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
              <span>🔔</span>
              <span>{nativeLanguage === "vi" ? "Cho phép" : "Allow"}</span>
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <>
          {/* Full-screen click-outside backdrop rendered via Portal so clicking ANYWHERE outside closes the popup */}
          {typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-40 bg-black/25 dark:bg-black/50 animate-fade-in"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />,
              document.body
            )}
          <div
            role="menu"
            aria-label={t("notifications")}
            className="nq-dropdown-enter fixed left-3 right-3 top-16 z-[100] mx-auto max-w-md sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:mx-0 sm:w-[410px] sm:max-w-none rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] dark:border-slate-700 dark:bg-sumi-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🔔</span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {t("notifications")}
                </h4>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} {nativeLanguage === "vi" ? "mới" : "new"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-sumi-800 transition"
                    title={nativeLanguage === "vi" ? "Đánh dấu tất cả là đã đọc" : "Mark all as read"}
                  >
                    ✓ {nativeLanguage === "vi" ? "Đọc hết" : "Read all"}
                  </button>
                )}
                {readCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllRead}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 transition"
                    title={nativeLanguage === "vi" ? "Xóa tất cả thông báo đã đọc" : "Delete all read notifications"}
                  >
                    🗑️ {nativeLanguage === "vi" ? `Xóa đã đọc (${readCount})` : `Clear read (${readCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-sumi-800 dark:text-slate-300 dark:hover:bg-sumi-700 transition"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Device OS Notification & Custom Nihon Quest Chime Banner (Solid Opaque) */}
            <div className="mb-2.5 p-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-sumi-950 border-slate-200 dark:border-slate-800">
              {devicePermission === "granted" ? (
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px]">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        {nativeLanguage === "vi"
                          ? "Thông báo thiết bị & Chuông Nihon Quest: Bật"
                          : "Device Push & Nihon Quest Chime: Active"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={testDeviceNotification}
                    className="shrink-0 rounded-xl bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 text-[10px] font-extrabold transition shadow-xs active:scale-95"
                  >
                    {nativeLanguage === "vi" ? "Test về máy 📲" : "Test Push 📲"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] text-slate-700 dark:text-slate-200 font-medium leading-snug">
                    {devicePermission === "denied"
                      ? nativeLanguage === "vi"
                        ? "Quyền thông báo đang bị chặn. Bấm để bật lại:"
                        : "Notifications blocked in browser. Tap to retry:"
                      : nativeLanguage === "vi"
                        ? "Nhận thông báo đẩy kèm Chuông Nihon Quest riêng:"
                        : "Get OS push notifications with custom Nihon Quest chime:"}
                  </div>
                  <button
                    type="button"
                    onClick={requestDevicePermission}
                    className="shrink-0 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 text-[11px] shadow-xs transition active:scale-95"
                  >
                    {nativeLanguage === "vi" ? "Bật ngay 🔔" : "Enable 🔔"}
                  </button>
                </div>
              )}

              {/* Custom Nihon Quest Chime Selector for Incoming Push Alerts */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    🎐 {nativeLanguage === "vi" ? "Chuông riêng khi có thông báo tới:" : "Custom notification chime:"}
                  </span>
                  <a
                    href="/sounds/nihon-chime.wav"
                    download="nihon-quest-chime.wav"
                    className="text-[10px] font-extrabold text-red-600 dark:text-red-400 hover:underline"
                    title={
                      nativeLanguage === "vi"
                        ? "Tải file âm thanh chuông Nihon Quest (.wav) để cài làm chuông hệ thống điện thoại"
                        : "Download Nihon Quest chime (.wav) for phone OS notification settings"
                    }
                  >
                    ⬇ {nativeLanguage === "vi" ? "Tải file chuông (.wav)" : "Download (.wav)"}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {NIHON_CHIME_STYLES.map((sItem) => {
                    const active = chimeStyle === sItem.id;
                    return (
                      <button
                        key={sItem.id}
                        type="button"
                        onClick={() => handleSelectChimeStyle(sItem.id)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition text-center truncate border ${
                          active
                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                            : "bg-white dark:bg-sumi-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-300"
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
              </div>
            </div>

            {/* Filter Tabs + Clear All Bar */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-sumi-800 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setFilterTab("ALL");
                  }}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    filterTab === "ALL"
                      ? "bg-white dark:bg-sumi-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  {nativeLanguage === "vi"
                    ? `Tất cả (${activeNotifications.length})`
                    : `All (${activeNotifications.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setFilterTab("UNREAD");
                  }}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    filterTab === "UNREAD"
                      ? "bg-white dark:bg-sumi-900 text-red-600 dark:text-red-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  {nativeLanguage === "vi"
                    ? `Chưa đọc (${unreadCount})`
                    : `Unread (${unreadCount})`}
                </button>
              </div>

              {activeNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllNotifications}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                >
                  {nativeLanguage === "vi" ? "Xóa tất cả" : "Clear all"}
                </button>
              )}
            </div>

            {/* Notification List (Solid Opaque Cards) */}
            <div className="max-h-[55dvh] sm:max-h-80 overflow-y-auto space-y-2 pr-0.5">
              {displayedNotifications.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-sumi-950">
                  <div className="text-2xl mb-1.5">✨</div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {filterTab === "UNREAD"
                      ? nativeLanguage === "vi"
                        ? "Bạn đã đọc hết mọi thông báo!"
                        : "You're all caught up!"
                      : nativeLanguage === "vi"
                        ? "Danh sách thông báo đang trống"
                        : "No notifications"}
                  </p>
                  {dismissedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleRestoreNotifications}
                      className="mt-2.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-sumi-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-red-300 hover:text-red-600 transition shadow-xs"
                    >
                      <span>🔄</span>
                      <span>
                        {nativeLanguage === "vi"
                          ? "Khôi phục các nhắc nhở đã xóa"
                          : "Restore dismissed reminders"}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                displayedNotifications.map((item, idx) => {
                  const isRead = readIds.has(item.id);
                  const isDeleting = deletingIds.has(item.id);
                  const isPriority =
                    item.isUrgent ||
                    item.type === "call" ||
                    (item.type === "friend" && incomingFriendRequests.length > 0);
                  const isLesson = item.type === "lesson";

                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(idx * 35, 210)}ms` }}
                      className={`group relative p-2.5 rounded-xl border transition-all duration-200 ${
                        isDeleting
                          ? "translate-x-8 scale-95 opacity-0 pointer-events-none"
                          : "nq-notif-item-enter hover:-translate-y-0.5 hover:shadow-md"
                      } ${
                        isRead
                          ? "bg-slate-100 dark:bg-sumi-950 border-slate-200 dark:border-slate-800"
                          : isPriority
                            ? "bg-red-50 dark:bg-[#2a1217] border-red-200 dark:border-red-900 shadow-xs ring-1 ring-red-400/40"
                            : isLesson
                              ? "bg-amber-50 dark:bg-[#261d10] border-amber-200 dark:border-amber-900 shadow-xs"
                              : "bg-white dark:bg-sumi-800 border-slate-200 dark:border-slate-700 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!isRead && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                          )}
                          <h5
                            className={`font-bold text-xs leading-snug truncate ${
                              isRead
                                ? "text-slate-500 dark:text-slate-400"
                                : isPriority
                                  ? "text-red-700 dark:text-red-300"
                                  : isLesson
                                    ? "text-amber-900 dark:text-amber-300"
                                    : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {item.title}
                          </h5>
                        </div>

                        {/* Time badge + Mark Read + Delete buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-sumi-900">
                            {item.time}
                          </span>
                          {!isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkOneRead(item.id)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-400 transition"
                              title={nativeLanguage === "vi" ? "Đánh dấu đã đọc" : "Mark as read"}
                            >
                              ✓
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(item.id)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-slate-400 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:text-rose-400 transition"
                            title={nativeLanguage === "vi" ? "Xóa thông báo này" : "Delete notification"}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        {item.desc}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        {isRead ? (
                          <span className="text-[10px] font-semibold text-slate-400">
                            ✓ {nativeLanguage === "vi" ? "Đã đọc" : "Read"}
                          </span>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-2">
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
                                handleMarkOneRead(item.id);
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
