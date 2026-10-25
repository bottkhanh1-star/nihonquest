"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { WebRTCCallModal, ActiveCallState } from "./WebRTCCallModal";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation } from "@/lib/socialI18n";

interface IncomingCallData {
  id: string;
  caller: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  callType: "AUDIO" | "VIDEO";
}

interface CallContextType {
  activeCall: ActiveCallState | null;
  incomingCall: IncomingCallData | null;
  startCall: (
    targetUserId: string,
    targetUserName: string,
    targetUserAvatar?: string | null,
    callType?: "AUDIO" | "VIDEO"
  ) => Promise<void>;
  endCall: (callId?: string) => Promise<void>;
  unreadMessagesCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function GlobalCallProvider({ children }: { children: React.ReactNode }) {
  const { nativeLanguage } = useNativeLanguage();
  const s = getSocialTranslation(nativeLanguage);

  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const handleStatusChange = useCallback((status: ActiveCallState["status"]) => {
    setActiveCall((prev) => (prev ? { ...prev, status } : null));
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setUnreadMessagesCount(data.totalUnread || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll for incoming calls and unread messages periodically
  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function pollCalls() {
      try {
        const res = await fetch("/api/calls");
        if (res.ok) {
          const data = await res.json();
          if (data.incomingCall) {
            setIncomingCall({
              id: data.incomingCall.id,
              caller: {
                id: data.incomingCall.caller.id,
                name: data.incomingCall.caller.profile?.displayName || data.incomingCall.caller.name || "Bạn học",
                avatar: data.incomingCall.caller.profile?.avatar || data.incomingCall.caller.image,
              },
              callType: data.incomingCall.callType,
            });
          } else {
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
    }, 4000);

    return () => clearInterval(timer);
  }, [refreshUnreadCount]);

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
        startCall,
        endCall,
        unreadMessagesCount,
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

