"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserAvatar } from "@/components/UserAvatar";
import { playNihonQuestChime } from "@/lib/nihonChime";

export interface GroupRoomData {
  id: string;
  code: string;
  name: string;
  levelTag: string;
  hostId: string;
  isPrivate: boolean;
  maxMembers: number;
  host?: {
    id: string;
    name?: string | null;
    image?: string | null;
    profile?: { displayName: string | null; avatar: string | null } | null;
  } | null;
  participants: {
    id: string;
    userId: string;
    peerId: string;
    isAudioMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    user?: {
      id: string;
      name?: string | null;
      image?: string | null;
      profile?: { displayName: string | null; avatar: string | null } | null;
    } | null;
  }[];
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function GroupCallModal({
  roomCode,
  initialRoom,
  initialMuted = false,
  initialVideoOff = false,
  onLeave,
}: {
  roomCode: string;
  initialRoom: GroupRoomData;
  initialMuted?: boolean;
  initialVideoOff?: boolean;
  onLeave: () => void;
}) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id || "";
  const currentUserName = session?.user?.name || "Bạn học";

  const [room, setRoom] = useState<GroupRoomData>(initialRoom);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isVideoOff, setIsVideoOff] = useState(initialVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // References
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; stream: MediaStream }>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const lastSignalTimeRef = useRef<number>(Date.now() - 5000);
  const isDestroyedRef = useRef(false);

  // 1. Initialize Local Media Stream
  useEffect(() => {
    isDestroyedRef.current = false;

    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        });
        if (isDestroyedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = !initialMuted;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = !initialVideoOff;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Could not get both video/audio, attempting audio only:", err);
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (isDestroyedRef.current) {
            audioOnly.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = audioOnly;
          setIsVideoOff(true);
        } catch (audioErr) {
          console.error("Audio access failed:", audioErr);
        }
      }
    }

    setupLocalMedia();

    return () => {
      isDestroyedRef.current = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      peersRef.current.forEach(({ pc }) => pc.close());
      peersRef.current.clear();
    };
  }, []);

  // 2. WebRTC Helper: Create or retrieve peer connection for a remote user
  const getOrCreatePeer = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(remoteUserId);
      if (existing) return existing.pc;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const remoteStream = new MediaStream();
      peersRef.current.set(remoteUserId, { pc, stream: remoteStream });

      // Add local tracks to new peer
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle receiving remote tracks
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
        const videoEl = remoteVideoRefs.current.get(remoteUserId);
        if (videoEl && videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          fetch(`/api/study-rooms/${roomCode}/signals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toUserId: remoteUserId,
              type: "candidate",
              payload: JSON.stringify(event.candidate),
            }),
          }).catch(() => {});
        }
      };

      return pc;
    },
    [roomCode]
  );

  // 3. Polling loop for Room state & WebRTC signals
  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function poll() {
      if (isDestroyedRef.current) return;

      try {
        // A. Ping room & sync status
        await fetch(`/api/study-rooms/${roomCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ping",
            isAudioMuted: isMuted,
            isVideoOff,
            isScreenSharing,
          }),
        }).catch(() => {});

        // B. Fetch updated room info
        const roomRes = await fetch(`/api/study-rooms/${roomCode}`).catch(() => null);
        if (roomRes && roomRes.ok) {
          const roomData = await roomRes.json();
          if (roomData.room) {
            setRoom(roomData.room);

            // Connect to peers who have joined and don't have a peer connection yet
            const otherParticipants = roomData.room.participants.filter(
              (p: { userId: string }) => p.userId !== currentUserId
            );

            for (const participant of otherParticipants) {
              const remoteId = participant.userId;
              // Deterministic offerer: user with higher ID string creates the offer
              if (currentUserId > remoteId && !peersRef.current.has(remoteId)) {
                const pc = getOrCreatePeer(remoteId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                await fetch(`/api/study-rooms/${roomCode}/signals`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    toUserId: remoteId,
                    type: "offer",
                    payload: JSON.stringify(offer),
                  }),
                }).catch(() => {});
              }
            }
          }
        }

        // C. Fetch incoming WebRTC signals
        const signalsRes = await fetch(
          `/api/study-rooms/${roomCode}/signals?since=${lastSignalTimeRef.current}`
        ).catch(() => null);

        if (signalsRes && signalsRes.ok) {
          const { signals } = await signalsRes.json();
          if (Array.isArray(signals) && signals.length > 0) {
            lastSignalTimeRef.current = Date.now();

            for (const signal of signals) {
              const fromUserId = signal.fromUserId;
              const type = signal.type;
              let payloadData: Record<string, unknown> | null = null;
              try {
                payloadData = JSON.parse(signal.payload);
              } catch {
                payloadData = null;
              }

              if (type === "chat" && payloadData) {
                const chatItem: ChatMessage = {
                  id: signal.id,
                  senderId: fromUserId,
                  senderName: String(payloadData.senderName || "Bạn học"),
                  text: String(payloadData.text || ""),
                  time: new Date(signal.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                };
                setChatMessages((prev) => {
                  if (prev.some((m) => m.id === chatItem.id)) return prev;
                  playNihonQuestChime("sakura");
                  return [...prev, chatItem];
                });
                continue;
              }

              const pc = getOrCreatePeer(fromUserId);

              if (type === "offer" && payloadData) {
                await pc.setRemoteDescription(new RTCSessionDescription(payloadData as unknown as RTCSessionDescriptionInit));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await fetch(`/api/study-rooms/${roomCode}/signals`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    toUserId: fromUserId,
                    type: "answer",
                    payload: JSON.stringify(answer),
                  }),
                }).catch(() => {});
              } else if (type === "answer" && payloadData) {
                if (pc.signalingState !== "stable") {
                  await pc.setRemoteDescription(new RTCSessionDescription(payloadData as unknown as RTCSessionDescriptionInit));
                }
              } else if (type === "candidate" && payloadData) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(payloadData as unknown as RTCIceCandidateInit));
                } catch (candidateErr) {
                  console.warn("Error adding ICE candidate:", candidateErr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Polling study room error:", err);
      }
    }

    poll();
    timer = setInterval(poll, 2500);

    return () => clearInterval(timer);
  }, [roomCode, currentUserId, getOrCreatePeer, isMuted, isVideoOff, isScreenSharing]);

  // 4. Toggle Microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // 5. Toggle Video Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 6. Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera video track
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        if (camTrack && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && camTrack) {
            sender.replaceTrack(camTrack).catch(() => {});
          }
        });
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender && screenTrack) {
            sender.replaceTrack(screenTrack).catch(() => {});
          }
        });

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    }
  };

  // 7. Send In-room Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    await fetch(`/api/study-rooms/${roomCode}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId: "ALL",
        type: "chat",
        payload: { text, senderName: currentUserName },
      }),
    }).catch(() => {});
  };

  // 8. Copy Room Code & Invite Link
  const [copiedLink, setCopiedLink] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://nihonquest.netlify.app";
    const inviteUrl = `${origin}/app/study-rooms?room=${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 9. Leave Room
  const handleLeaveRoom = async () => {
    await fetch(`/api/study-rooms/${roomCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    }).catch(() => {});

    onLeave();
  };

  const otherMembers = room.participants.filter((p) => p.userId !== currentUserId);
  const totalCount = 1 + otherMembers.length;

  // Grid layout class based on member count
  const gridClass =
    totalCount === 1
      ? "grid-cols-1"
      : totalCount === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : totalCount <= 4
      ? "grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f1419] text-white">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#161d24] px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600/20 text-red-500 text-sm">
            🎙️
          </span>
          <div>
            <h2 className="text-sm font-extrabold tracking-wide text-white">{room.name}</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full bg-slate-800 px-2 py-0.5 font-bold text-amber-400">
                {room.levelTag}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {totalCount}/{room.maxMembers} người đang tham gia
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Invite Link */}
          <button
            type="button"
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            title="Sao chép link phòng học gửi bạn bè (click là vào ngay)"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">{copiedLink ? "✓ Đã chép link" : "Sao chép Link mời"}</span>
            <span className="sm:hidden">{copiedLink ? "✓ Đã chép" : "Link"}</span>
          </button>

          {/* Room Code Pill & Copy */}
          <button
            type="button"
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            title="Bấm để sao chép mã phòng chia sẻ cho bạn bè"
          >
            <span>Mã:</span>
            <span className="font-mono text-amber-400">{roomCode}</span>
            <span className="text-[10px] text-slate-400">{copiedCode ? "✓" : "📋"}</span>
          </button>

          {/* Toggle Chat Drawer Button */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              isChatOpen
                ? "border-red-500 bg-red-600 text-white"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
            title="Khung chat tiếng Nhật"
          >
            💬
          </button>
        </div>
      </header>

      {/* Main Body: Video Grid + Optional Chat Panel */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Video Tiles Grid */}
        <div className={`grid flex-1 gap-3 p-3 sm:p-4 overflow-y-auto ${gridClass}`}>
          {/* 1. Local Video Tile */}
          <div className="relative flex min-h-[200px] sm:min-h-[240px] items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-800 bg-[#161d24]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${isVideoOff && !isScreenSharing ? "hidden" : ""}`}
            />
            {isVideoOff && !isScreenSharing && (
              <div className="flex flex-col items-center gap-2">
                <UserAvatar name={currentUserName} sizeClass="h-16 w-16 text-xl" />
                <span className="text-xs text-slate-400">Camera đang tắt</span>
              </div>
            )}
            {/* Status Overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold backdrop-blur-md">
              <span>{currentUserName} (Bạn)</span>
              {isMuted && <span className="text-red-400">🔇</span>}
              {isScreenSharing && <span className="text-amber-400">🖥️ Đang share</span>}
            </div>
          </div>

          {/* 2. Remote Members Video Tiles */}
          {otherMembers.map((member) => {
            const displayName =
              member.user?.profile?.displayName || member.user?.name || "Bạn học";
            return (
              <div
                key={member.userId}
                className="relative flex min-h-[200px] sm:min-h-[240px] items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-800 bg-[#161d24]"
              >
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(member.userId, el);
                      const peerData = peersRef.current.get(member.userId);
                      if (peerData && el.srcObject !== peerData.stream) {
                        el.srcObject = peerData.stream;
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className={`h-full w-full object-cover ${member.isVideoOff ? "hidden" : ""}`}
                />
                {member.isVideoOff && (
                  <div className="flex flex-col items-center gap-2">
                    <UserAvatar
                      src={member.user?.profile?.avatar || member.user?.image}
                      name={displayName}
                      sizeClass="h-16 w-16 text-xl"
                    />
                    <span className="text-xs text-slate-400">Camera đang tắt</span>
                  </div>
                )}
                {/* Status Overlay */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold backdrop-blur-md">
                  <span>{displayName}</span>
                  {member.isAudioMuted && <span className="text-red-400">🔇</span>}
                  {member.isScreenSharing && <span className="text-amber-400">🖥️ Share</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* In-Call Live Chat Drawer */}
        {isChatOpen && (
          <aside className="w-80 shrink-0 border-l border-slate-800 bg-[#161d24] flex flex-col">
            <div className="flex h-10 items-center justify-between border-b border-slate-800 px-3 text-xs font-bold text-slate-300">
              <span>💬 Chat nhóm & Ghi chú Kanji</span>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-2 p-3 overflow-y-auto text-xs">
              {chatMessages.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-[11px]">
                  Chưa có tin nhắn nào. Gửi Kanji hoặc câu Kaiwa để cùng trao đổi!
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2 max-w-[90%] ${
                      msg.senderId === currentUserId
                        ? "ml-auto bg-red-600 text-white"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-75 mb-0.5">
                      {msg.senderName} • {msg.time}
                    </div>
                    <div className="break-words leading-relaxed">{msg.text}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChat} className="p-2 border-t border-slate-800 flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập tin nhắn / Kanji..."
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 active:scale-95"
              >
                Gửi
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Bottom Control Bar */}
      <footer className="flex h-16 shrink-0 items-center justify-center gap-3 border-t border-slate-800 bg-[#161d24] px-4">
        {/* Toggle Mic */}
        <button
          type="button"
          onClick={toggleMute}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-base transition shadow-md active:scale-95 ${
            isMuted ? "bg-red-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
          title={isMuted ? "Bật Mic" : "Tắt Mic"}
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-base transition shadow-md active:scale-95 ${
            isVideoOff ? "bg-red-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
          title={isVideoOff ? "Bật Camera" : "Tắt Camera"}
        >
          {isVideoOff ? "📷⃠" : "📹"}
        </button>

        {/* Share Screen */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-base transition shadow-md active:scale-95 ${
            isScreenSharing ? "bg-amber-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
          title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình học tập"}
        >
          🖥️
        </button>

        {/* Leave Room (Red Button) */}
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg transition hover:bg-red-700 active:scale-95"
        >
          <span>🚪</span>
          <span>Rời phòng</span>
        </button>
      </footer>
    </div>
  );
}

