"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { Icon, IconButton } from "@/components/ui";
import { registerPushSubscription, sendServerTestPush } from "@/lib/push-client";

const DECLINED_STORAGE_KEY = "nq_push_permission_declined";
const INAPP_ENABLED_KEY = "nq_inapp_notifications_enabled";

interface NotificationItem {
  id: string;
  type: "streak" | "srs" | "mission" | "sensei" | "message" | "call";
  title: string;
  desc: string;
  actionUrl?: string;
  actionLabel?: string;
  time: string;
}

export function NotificationDropdown() {
  const { progress } = useUserProgress();
  const { nativeLanguage, t } = useNativeLanguage();
  const { playClick, showToast } = useSoundAndTheme();
  const { unreadMessagesCount, incomingCall } = useGlobalCall();

  const [isOpen, setIsOpen] = useState(false);
  const [showAutoPrompt, setShowAutoPrompt] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | "default">("default");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
      let timer = setTimeout(() => {
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
      setIsOpen(true);
    };
    window.addEventListener("nq:open-notifications", handleOpenEvent);
    return () => window.removeEventListener("nq:open-notifications", handleOpenEvent);
  }, []);

  const requestDevicePermission = useCallback(async () => {
    playClick();
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
              ? "Đã bật thông báo thiết bị! 🔔"
              : "Notifications Enabled! 🔔",
          description:
            nativeLanguage === "vi"
              ? "Bạn sẽ nhận được nhắc học, cảnh báo đứt chuỗi, tin nhắn và cuộc gọi ngay cả khi tắt web!"
              : "You will receive streak alerts, messages and calls even when the website is closed!",
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
    // Do NOT set DECLINED_STORAGE_KEY so it will ask again next time user enters the web!
    setShowAutoPrompt(false);
  }, [playClick]);

  const testDeviceNotification = useCallback(async () => {
    playClick();
    showToast({
      title:
        nativeLanguage === "vi"
          ? "Đang gửi chuông thử nghiệm... 🚀"
          : "Sending Test Push... 🚀",
      description:
        nativeLanguage === "vi"
          ? "Hệ thống đang phát thông báo đẩy tới thiết bị của bạn."
          : "Server is dispatching push to your device.",
      type: "info",
    });

    try {
      const res = await sendServerTestPush();
      if (!res.success && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Nihon Quest 🌸 — Lời nhắc học tập", {
          body:
            nativeLanguage === "vi"
              ? "Đã đến giờ ôn tập! Hãy duy trì chuỗi Streak và hoàn thành 10 phút tiếng Nhật hôm nay nhé! 🔥"
              : "Time to practice! Keep your streak alive and complete 10 mins of Japanese today! 🔥",
          icon: "/icon.png",
        });
      }
    } catch {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Nihon Quest 🌸 — Lời nhắc học tập", {
          body:
            nativeLanguage === "vi"
              ? "Đã đến giờ ôn tập! Hãy duy trì chuỗi Streak và hoàn thành 10 phút tiếng Nhật hôm nay nhé! 🔥"
              : "Time to practice! Keep your streak alive and complete 10 mins of Japanese today! 🔥",
          icon: "/icon.png",
        });
      }
    }
  }, [nativeLanguage, playClick, showToast]);

  // Build active dynamic notifications based on live user progress and global call context
  const notifications: NotificationItem[] = [];

  // 1. Live Incoming Call Alert (High Priority)
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
      actionLabel: nativeLanguage === "vi" ? "Nhấc máy ngay" : "Answer Call",
      time: "Vừa xong",
    });
  }

  // 2. Unread Messages Alert
  if (unreadMessagesCount > 0) {
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
      actionLabel: nativeLanguage === "vi" ? "Mở hộp thư chat" : "Open Chat",
      time: "Mới",
    });
  }

  const streak = progress?.currentStreak ?? 0;
  const dueCards = progress?.stats?.dueReviewCount ?? 0;
  const completedLessons = progress?.stats?.completedLessonsCount ?? 0;
  const totalLessons = progress?.stats?.totalLessonsInLevel ?? 50;

  // 3. SRS Due Notification
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

  // 4. Daily Streak Alert
  notifications.push({
    id: "notif-streak",
    type: "streak",
    title: t("notifStreakTitle").replace("{n}", String(streak)),
    desc: t("notifStreakDesc"),
    actionUrl: "/app/practice",
    actionLabel: t("notifStreakAction"),
    time: "Streak",
  });

  // 5. Curriculum Progress
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
      time: `JLPT ${progress?.learningLevel || "N5"}`,
    });
  }

  // 6. Kawaii Sensei Daily Tip
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
      {/* Always-visible Notification Bell Button on BOTH Mobile and Desktop */}
      <IconButton
        label={t("notifications") || "Thông báo"}
        className="relative h-9 w-9 sm:h-10 sm:w-10"
        onClick={() => {
          playClick();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white ring-2 ring-white dark:ring-sumi-900 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </IconButton>

      {/* AUTO-PROMPT BANNER ON PAGE ENTRY (Shown automatically every time user enters web unless granted or declined) */}
      {showAutoPrompt && !isOpen && devicePermission !== "granted" && (
        <div className="fixed inset-x-3 top-16 z-[9990] mx-auto max-w-md animate-slide-in-down rounded-2xl border-2 border-red-500/70 bg-white/98 p-3.5 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-20 sm:w-96 dark:border-red-500/50 dark:bg-sumi-900/98">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-xl shadow-xs dark:bg-red-950/60">
              🔔
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {nativeLanguage === "vi"
                  ? "Bật thông báo Nihon Quest?"
                  : "Enable Nihon Quest Notifications?"}
              </h4>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {nativeLanguage === "vi"
                  ? "Nhận ngay cuộc gọi đến, tin nhắn bạn bè và nhắc học giữ chuỗi Streak mỗi ngày (kể cả khi tắt web)."
                  : "Get instant alerts for incoming calls, messages, and daily streak reminders even when closed."}
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
          {/* Mobile backdrop for clean outside tap dismissal */}
          <div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label={t("notifications")}
            className="fixed left-3 right-3 top-16 z-50 mx-auto max-w-md sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:mx-0 sm:w-96 sm:max-w-none rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-sumi-900 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🔔</span>
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

            {/* Device Notification Permission Banner — ALWAYS displays actionable button on both Mobile & Desktop */}
            <div className="mb-2.5 p-2.5 rounded-xl border transition-all text-xs bg-slate-50 dark:bg-sumi-950/70 border-slate-200/80 dark:border-slate-800">
              {devicePermission === "granted" ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    <span>✓</span>
                    <span>
                      {nativeLanguage === "vi"
                        ? "Thông báo thiết bị: Đang bật"
                        : "Device notifications: Active"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={testDeviceNotification}
                    className="rounded-lg bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:border-red-300 hover:text-red-600 transition shadow-xs"
                  >
                    {nativeLanguage === "vi" ? "Test thử chuông 🔔" : "Test Bell 🔔"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    {devicePermission === "denied"
                      ? nativeLanguage === "vi"
                        ? "Thông báo đang tắt trên trình duyệt. Bấm để thử bật lại hoặc mở quyền ở thanh URL:"
                        : "Notifications blocked in browser. Tap to retry or enable in URL bar:"
                      : nativeLanguage === "vi"
                        ? "Nhận nhắc học, giữ chuỗi, tin nhắn & cuộc gọi (kể cả khi tắt web):"
                        : "Receive streak alerts, messages & calls (even when website is closed):"}
                  </div>
                  <button
                    type="button"
                    onClick={requestDevicePermission}
                    className="shrink-0 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 text-[11px] shadow-xs transition active:scale-95"
                  >
                    {nativeLanguage === "vi" ? "Bật ngay 🔔" : "Enable 🔔"}
                  </button>
                </div>
              )}
            </div>

            {/* Automated daily study reminder notice */}
            <div className="mb-2 p-2 rounded-xl bg-slate-50 dark:bg-sumi-950/40 border border-slate-200/50 dark:border-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>⏰</span>
              <span>
                {nativeLanguage === "vi"
                  ? "Hệ thống tự động đồng bộ nhắc học và thông báo hàng ngày."
                  : "Daily study reminders sync automatically across your devices."}
              </span>
            </div>

            {/* Notification List */}
            <div className="max-h-[55dvh] sm:max-h-72 overflow-y-auto space-y-2 pr-0.5">
              {notifications.map((item) => {
                const isRead = readIds.has(item.id);
                const isPriority = item.type === "call" || item.type === "message";
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border transition ${
                      isPriority
                        ? "bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 shadow-xs ring-1 ring-red-400/30"
                        : isRead
                          ? "bg-slate-50/60 dark:bg-sumi-950/40 border-slate-100 dark:border-slate-800/80 opacity-70"
                          : "bg-white dark:bg-sumi-800/90 border-slate-200/80 dark:border-slate-700 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h5
                        className={`font-bold text-xs leading-snug ${
                          isPriority
                            ? "text-red-700 dark:text-red-300"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {item.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {item.time}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.desc}
                    </p>

                    {item.actionUrl && (
                      <div className="mt-2 flex justify-end">
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
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {item.actionLabel}
                        </Link>
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
