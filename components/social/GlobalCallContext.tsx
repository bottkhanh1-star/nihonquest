"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { WebRTCCallModal, ActiveCallState } from "./WebRTCCallModal";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation } from "@/lib/socialI18n";
import { showSystemDeviceNotification } from "@/lib/push-client";
import { playNihonQuestChime } from "@/lib/nihonChime";

interface IncomingCallData {
  id: string;
  caller: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  callType: "AUDIO" | "VIDEO";
}

export interface UnreadConversationSummary {
  friend: {
    id: string;
    name: string;
    avatar?: string | null;
    learningLevel?: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
}

export interface IncomingFriendRequestSummary {
  friendshipId: string;
  userId: string;
  name: string;
  avatar?: string | null;
  learningLevel?: string | null;
  updatedAt?: string;
}

export interface MissedCallSummary {
  id: string;
  caller: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  callType: "AUDIO" | "VIDEO";
  createdAt: string;
}

interface CallContextType {
  activeCall: ActiveCallState | null;
  incomingCall: IncomingCallData | null;
  recentMissedCalls: MissedCallSummary[];
  startCall: (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string | null,
    callType?: "AUDIO" | "VIDEO"
  ) => Promise<void>;
  endCall: (callId?: string) => Promise<void>;
  unreadMessagesCount: number;
  unreadConversations: UnreadConversationSummary[];
  latestConversation: UnreadConversationSummary | null;
  incomingFriendRequests: IncomingFriendRequestSummary[];
  recentFriends: IncomingFriendRequestSummary[];
  acceptFriendRequest: (friendshipId: string) => Promise<boolean>;
  refreshUnreadCount: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function GlobalCallProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);
  const { nativeLanguage } = useNativeLanguage();
  const s = getSocialTranslation(nativeLanguage);

  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [recentMissedCalls, setRecentMissedCalls] = useState<MissedCallSummary[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [unreadConversations, setUnreadConversations] = useState<UnreadConversationSummary[]>([]);
  const [latestConversation, setLatestConversation] = useState<UnreadConversationSummary | null>(null);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<IncomingFriendRequestSummary[]>([]);
  const [recentFriends, setRecentFriends] = useState<IncomingFriendRequestSummary[]>([]);

  const prevUnreadRef = useRef<number | null>(null);
  const prevFriendReqCountRef = useRef<number | null>(null);
  const lastRungCallIdRef = useRef<string | null>(null);

  const handleStatusChange = useCallback((status: ActiveCallState["status"]) => {
    setActiveCall((prev) => (prev ? { ...prev, status } : null));
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [msgRes, friendsRes] = await Promise.all([
        fetch("/api/messages").catch(() => null),
        fetch("/api/friends").catch(() => null),
      ]);

      if (msgRes && msgRes.ok) {
        const data = await msgRes.json();
        const totalUnread = Number(data.totalUnread || 0);
        const convs: UnreadConversationSummary[] = Array.isArray(data.conversations)
          ? data.conversations
          : [];
        const unreadList = convs.filter((c) => c.unreadCount > 0);

        // If a new unread message arrived, play Nihon Quest chime & show OS notification if backgrounded
        if (prevUnreadRef.current !== null && totalUnread > prevUnreadRef.current) {
          if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            const newest = unreadList[0];
            showSystemDeviceNotification({
              title: newest
                ? `💬 Tin nhắn từ ${newest.friend.name}`
                : "💬 Tin nhắn mới trên Nihon Quest",
              body: newest?.lastMessage?.content || "Bạn có tin nhắn mới chưa đọc.",
              url: newest ? `/app/messages?friendId=${newest.friend.id}` : "/app/messages",
              tag: `msg-${newest?.friend.id || Date.now()}`,
            }).catch(() => {});
          } else {
            playNihonQuestChime();
          }
        }
        prevUnreadRef.current = totalUnread;

        setUnreadMessagesCount(totalUnread);
        setUnreadConversations(unreadList);
        setLatestConversation(convs.find((c) => c.lastMessage !== null) || convs[0] || null);
      }

      if (friendsRes && friendsRes.ok) {
        const fData = await friendsRes.json();
        const reqs: IncomingFriendRequestSummary[] = Array.isArray(fData.incomingRequests)
          ? fData.incomingRequests
          : [];
        const accepted: IncomingFriendRequestSummary[] = Array.isArray(fData.friends)
          ? fData.friends.slice(0, 3)
          : [];

        if (prevFriendReqCountRef.current !== null && reqs.length > prevFriendReqCountRef.current) {
          if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            const newestReq = reqs[0];
            showSystemDeviceNotification({
              title: "🤝 Lời mời kết bạn mới!",
              body: newestReq
                ? `${newestReq.name} muốn kết bạn trên Nihon Quest!`
                : "Bạn có lời mời kết bạn mới trên Nihon Quest!",
              url: "/app/messages?tab=REQUESTS",
              tag: `friend-req-${newestReq?.userId || Date.now()}`,
            }).catch(() => {});
          } else {
            playNihonQuestChime("furin");
          }
        }
        prevFriendReqCountRef.current = reqs.length;

        setIncomingFriendRequests(reqs);
        setRecentFriends(accepted);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  const acceptFriendRequest = useCallback(
    async (friendshipId: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", friendshipId }),
        });
        if (res.ok) {
          await refreshUnreadCount();
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    },
    [refreshUnreadCount]
  );

  // Listen for Service Worker Web Push messages so any push arriving from the server
  // immediately plays our custom Nihon Quest chime (even when tab is in the background!)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NIHON_PUSH_RECEIVED") {
        playNihonQuestChime();
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleSwMessage);
  }, []);

  // Poll for incoming calls, unread messages, and friend requests periodically
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: NodeJS.Timeout;

    async function pollCalls() {
      try {
        const res = await fetch("/api/calls");
        if (res.ok) {
          const data = await res.json();

          if (Array.isArray(data.recentMissedCalls)) {
            setRecentMissedCalls(
              data.recentMissedCalls.map((c: any) => ({
                id: c.id,
                caller: {
                  id: c.caller?.id,
                  name: c.caller?.profile?.displayName || c.caller?.name || "Bạn học",
                  avatar: c.caller?.profile?.avatar || c.caller?.image,
                },
                callType: c.callType,
                createdAt: c.createdAt,
              }))
            );
          }

          if (data.incomingCall) {
            const callerName =
              data.incomingCall.caller.profile?.displayName ||
              data.incomingCall.caller.name ||
              "Bạn học";

            if (lastRungCallIdRef.current !== data.incomingCall.id) {
              lastRungCallIdRef.current = data.incomingCall.id;

              // Vibrate device on incoming call
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                  navigator.vibrate([400, 250, 400, 250, 600]);
                } catch {}
              }

              // Show system OS notification for incoming call
              showSystemDeviceNotification({
                title: `📞 Cuộc gọi đến từ ${callerName}!`,
                body: `Đang gọi ${data.incomingCall.callType === "VIDEO" ? "video" : "thoại"} cho bạn. Bấm để trả lời ngay!`,
                url: `/app/messages?friendId=${data.incomingCall.caller.id}&callId=${data.incomingCall.id}`,
                tag: `incoming-call-${data.incomingCall.id}`,
              }).catch(() => {});
            }

            setIncomingCall({
              id: data.incomingCall.id,
              caller: {
                id: data.incomingCall.caller.id,
                name: callerName,
                avatar:
                  data.incomingCall.caller.profile?.avatar ||
                  data.incomingCall.caller.image,
              },
              callType: data.incomingCall.callType,
            });
          } else {
            lastRungCallIdRef.current = null;
            setIncomingCall(null);
          }
        }
      } catch {
        // user might be offline or logged out
      }
    }

    pollCalls();
    refreshUnreadCount();

    timer = setInterval(() => {
      pollCalls();
      refreshUnreadCount();
    }, 4500);

    return () => clearInterval(timer);
  }, [isAuthenticated, refreshUnreadCount]);

  // Start outgoing call
  const startCall = async (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string | null,
    callType: "AUDIO" | "VIDEO" = "AUDIO"
  ) => {
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          receiverId: targetUserId,
          callType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || s.callFriendRequired);
        return;
      }

      const data = await res.json();
      setActiveCall({
        callId: data.call.id,
        isCaller: true,
        targetUser: {
          id: targetUserId,
          name: targetUserName,
          avatar: targetUserAvatar,
        },
        callType,
        status: "RINGING",
      });
    } catch (e) {
      console.error("Start call error:", e);
      alert(s.callFriendRequired);
    }
  };

  // Accept incoming call
  const handleAcceptIncoming = async (callId: string, callType: "AUDIO" | "VIDEO") => {
    if (!incomingCall) return;

    setActiveCall({
      callId,
      isCaller: false,
      targetUser: {
        id: incomingCall.caller.id,
        name: incomingCall.caller.name,
        avatar: incomingCall.caller.avatar,
      },
      callType,
      status: "CONNECTING",
    });

    setIncomingCall(null);
  };

  // Decline incoming call
  const handleDeclineIncoming = async (callId: string) => {
    try {
      await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", callId }),
      });
    } catch {
      // ignore
    }
    setIncomingCall(null);
  };

  // End active call
  const endCall = async (callId?: string) => {
    const id = callId || activeCall?.callId;
    if (id) {
      try {
        await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", callId: id }),
        });
      } catch {
        // ignore
      }
    }
    setActiveCall(null);
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        recentMissedCalls,
        startCall,
        endCall,
        unreadMessagesCount,
        unreadConversations,
        latestConversation,
        incomingFriendRequests,
        recentFriends,
        acceptFriendRequest,
        refreshUnreadCount,
      }}
    >
      {children}
      <WebRTCCallModal
        activeCall={activeCall}
        incomingCall={incomingCall}
        onAcceptIncoming={handleAcceptIncoming}
        onDeclineIncoming={handleDeclineIncoming}
        onEndCall={endCall}
        onStatusChange={handleStatusChange}
      />
    </CallContext.Provider>
  );
}

export function useGlobalCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useGlobalCall must be used within a GlobalCallProvider");
  }
  return context;
}
