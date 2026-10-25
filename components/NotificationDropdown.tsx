"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUserProgress } from "@/components/UserProgressContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { Icon, IconButton } from "@/components/ui";

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
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | "unsupported">("default");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Check initial notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDevicePermission(Notification.permission);
    } else {
      setDevicePermission("unsupported");
    }
  }, []);

  const requestDevicePermission = useCallback(async () => {
    playClick();
    if (typeof window === "undefined" || !("Notification" in window)) {
      showToast({
        title: nativeLanguage === "vi" ? "Trình duyệt không hỗ trợ" : "Unsupported Browser",
        description: nativeLanguage === "vi" ? "Trình duyệt này không hỗ trợ Web Notification." : "This browser does not support notifications.",
        type: "info",
      });
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setDevicePermission(perm);
      if (perm === "granted") {
        new Notification("Nihon Quest 🌸", {
          body: nativeLanguage === "vi" 
            ? "Đã bật thông báo thiết bị thành công! Bạn sẽ nhận được nhắc nhở học tập và tin nhắn." 
            : "Device notifications enabled! You will receive daily study reminders and messages.",
          icon: "/icon.png",
        });
        showToast({
          title: nativeLanguage === "vi" ? "Đã bật thông báo thiết bị! 🔔" : "Notifications Enabled! 🔔",
          description: nativeLanguage === "vi" ? "Hệ thống sẽ gửi thông báo trực tiếp tới màn hình thiết bị của bạn." : "System will now send direct notifications to your device.",
          type: "info",
        });
      } else if (perm === "denied") {
        showToast({
          title: nativeLanguage === "vi" ? "Chưa cấp quyền" : "Permission Denied",
          description: nativeLanguage === "vi" ? "Bạn đã từ chối quyền. Hãy mở cài đặt trình duyệt để cho phép." : "Notification permission was blocked in browser settings.",
          type: "info",
        });
      }
    } catch (err) {
      console.warn("Failed to request notification permission:", err);
    }
  }, [nativeLanguage, playClick, showToast]);

  const testDeviceNotification = useCallback(() => {
    playClick();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Nihon Quest 🌸 — Lời nhắc học tập", {
        body: nativeLanguage === "vi" 
          ? "Đã đến giờ ôn tập! Hãy duy trì chuỗi Streak và hoàn thành 10 phút tiếng Nhật hôm nay nhé! 🔥" 
          : "Time to practice! Keep your streak alive and complete 10 mins of Japanese today! 🔥",
        icon: "/icon.png",
      });
      showToast({
        title: nativeLanguage === "vi" ? "Đã gửi thông báo thử nghiệm! 🚀" : "Test Notification Sent! 🚀",
        description: nativeLanguage === "vi" ? "Kiểm tra thanh thông báo hệ điều hành / thiết bị của bạn." : "Check your operating system notification banner.",
        type: "info",
      });
    }
  }, [nativeLanguage, playClick, showToast]);

  // Build active dynamic notifications based on live user progress and global call context
  const notifications: NotificationItem[] = [];

  // 1. Live Incoming Call Alert (High Priority)
  if (incomingCall) {
    notifications.push({
      id: `notif-call-${incomingCall.id}`,
      type: "call",
      title: nativeLanguage === "vi" ? "📞 Cuộc gọi đang đổ chuông!" : "📞 Incoming Call Ringing!",
      desc: (incomingCall.caller.profile?.displayName || incomingCall.caller.name || "Một học viên") + 
            (nativeLanguage === "vi" ? " đang gọi điện cho bạn..." : " is calling you..."),
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
      title: nativeLanguage === "vi" ? `💬 ${unreadMessagesCount} tin nhắn mới chưa đọc` : `💬 ${unreadMessagesCount} unread message(s)`,
      desc: nativeLanguage === "vi" ? "Bạn có tin nhắn mới từ bạn bè trong Nihon Quest." : "You have new direct messages from your Japanese learning friends.",
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
      title: t("notifMilestoneTitle").replace("{done}", String(completedLessons)).replace("{total}", String(totalLessons)),
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

  // Dismiss on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleMarkAllRead = () => {
    playClick();
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <IconButton
        label={t("notifications")}
        className="relative h-10 w-10 sm:h-10 sm:w-10 max-[420px]:hidden"
        onClick={() => {
          playClick();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-sumi-900 animate-pulse" />
        )}
      </IconButton>

      {isOpen && (
        <div
          role="menu"
          aria-label={t("notifications")}
          className="absolute right-0 top-12 z-50 w-[min(390px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-sumi-900 animate-in fade-in slide-in-from-top-2 duration-150"
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

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition font-medium"
              >
                {t("markAllAsRead")}
              </button>
            )}
          </div>

          {/* Device Notification Permission Banner */}
          <div className="mb-2.5 p-2.5 rounded-xl border transition-all text-xs bg-slate-50 dark:bg-sumi-950/70 border-slate-200/80 dark:border-slate-800">
            {devicePermission === "granted" ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                  <span>✓</span>
                  <span>{nativeLanguage === "vi" ? "Thông báo thiết bị: Đang bật" : "Device notifications: Active"}</span>
                </div>
                <button
                  type="button"
                  onClick={testDeviceNotification}
                  className="rounded-lg bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:border-red-300 hover:text-red-600 transition shadow-xs"
                >
                  {nativeLanguage === "vi" ? "Test thử chuông" : "Test Bell"}
                </button>
              </div>
            ) : devicePermission === "denied" ? (
              <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <span>⚠️</span>
                <span>
                  {nativeLanguage === "vi" 
                    ? "Thông báo thiết bị đang bị chặn. Hãy bấm icon ổ khóa trên URL để bật lại." 
                    : "Notifications blocked. Enable via browser address bar permissions."}
                </span>
              </div>
            ) : devicePermission === "unsupported" ? (
              <div className="text-[11px] text-slate-400">
                {nativeLanguage === "vi" ? "Trình duyệt không hỗ trợ thông báo thiết bị." : "Device notifications not supported."}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {nativeLanguage === "vi" ? "Nhận thông báo bài học & tin nhắn về máy tính / điện thoại:" : "Get study reminders & messages on this device:"}
                </div>
                <button
                  type="button"
                  onClick={requestDevicePermission}
                  className="shrink-0 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold px-2.5 py-1 text-[11px] shadow-xs transition active:scale-95"
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
          <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
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
                    <h5 className={`font-bold text-xs leading-snug ${isPriority ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-slate-100"}`}>
                      {item.title}
                    </h5>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">{item.time}</span>
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
                          isPriority ? "text-red-700 dark:text-red-300" : "text-red-600 dark:text-red-400"
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
      )}
    </div>
  );
}


