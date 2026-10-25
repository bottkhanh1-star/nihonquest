"use client";

import React, { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation } from "@/lib/socialI18n";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

function playTone(freq: number, type: OscillatorType, durationMs: number) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // AudioContext blocked until user interaction
  }
}

export interface ActiveCallState {
  callId: string;
  isCaller: boolean;
  targetUser: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  callType: "AUDIO" | "VIDEO";
  status: "RINGING" | "CONNECTING" | "CONNECTED" | "ENDED";
}

interface WebRTCCallModalProps {
  activeCall: ActiveCallState | null;
  incomingCall: {
    id: string;
    caller: {
      id: string;
      name: string;
      avatar?: string | null;
    };
    callType: "AUDIO" | "VIDEO";
  } | null;
  onAcceptIncoming: (callId: string, callType: "AUDIO" | "VIDEO") => void;
  onDeclineIncoming: (callId: string) => void;
  onEndCall: (callId: string) => void;
  onStatusChange?: (status: ActiveCallState["status"]) => void;
}

export function WebRTCCallModal({
  activeCall,
  incomingCall,
  onAcceptIncoming,
  onDeclineIncoming,
  onEndCall,
  onStatusChange,
}: WebRTCCallModalProps) {
  const { nativeLanguage } = useNativeLanguage();
  const s = getSocialTranslation(nativeLanguage);

  // Audio & Video DOM refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // WebRTC core refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const processedIceCandidatesRef = useRef<Set<string>>(new Set());
  const iceBatchQueueRef = useRef<any[]>([]);
  const iceBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHandledOfferRef = useRef<string | null>(null);
  const lastHandledAnswerRef = useRef<string | null>(null);
  const currentCallTypeRef = useRef<"AUDIO" | "VIDEO">(activeCall?.callType || "AUDIO");
  const hasRenegotiatedVideoRef = useRef(false);
  const isEndingRef = useRef(false);

  // Stable callback refs to prevent unnecessary useEffect tear-downs
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;
  const sRef = useRef(s);
  sRef.current = s;

  const [currentCallType, setCurrentCallType] = useState<"AUDIO" | "VIDEO">(activeCall?.callType || "AUDIO");
  currentCallTypeRef.current = currentCallType;
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset session flags whenever a new call session starts
  useEffect(() => {
    hasRenegotiatedVideoRef.current = false;
    isEndingRef.current = false;
    lastHandledOfferRef.current = null;
    lastHandledAnswerRef.current = null;
  }, [activeCall?.callId]);

  // Keep currentCallType synced when activeCall changes
  useEffect(() => {
    if (activeCall?.callType) {
      setCurrentCallType(activeCall.callType);
      currentCallTypeRef.current = activeCall.callType;
    }
  }, [activeCall?.callId, activeCall?.callType]);

  // 1. Incoming Call Ringtone
  useEffect(() => {
    if (!incomingCall || activeCall) return;
    const ring = () => {
      playTone(523.25, "sine", 350);
      setTimeout(() => playTone(659.25, "sine", 400), 180);
    };
    ring();
    const interval = setInterval(ring, 2400);
    return () => clearInterval(interval);
  }, [incomingCall, activeCall]);

  // 2. Outgoing Call Telephone Ringtone
  useEffect(() => {
    if (!activeCall?.isCaller || activeCall?.status !== "RINGING") return;
    const dialTone = () => {
      playTone(425, "sine", 1000);
    };
    dialTone();
    const interval = setInterval(dialTone, 3500);
    return () => clearInterval(interval);
  }, [activeCall?.isCaller, activeCall?.status]);

  // 3. Call Duration Timer & Connected Chime
  useEffect(() => {
    if (activeCall?.status !== "CONNECTED") {
      setCallDuration(0);
      return;
    }
    // Connected Chime
    playTone(440, "triangle", 150);
    setTimeout(() => playTone(880, "triangle", 300), 160);

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 4. Flush queued ICE candidates in batches
  const flushIceCandidates = (callId: string) => {
    if (iceBatchTimerRef.current) {
      clearTimeout(iceBatchTimerRef.current);
      iceBatchTimerRef.current = null;
    }
    const batch = [...iceBatchQueueRef.current];
    iceBatchQueueRef.current = [];
    if (batch.length === 0) return;

    fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ice-batch",
        callId,
        candidates: batch,
      }),
    }).catch((err) => console.warn("[WebRTC] Error flushing ICE batch:", err));
  };

  // 5. Initialize WebRTC Media & PeerConnection
  // Strictly depend on activeCall?.callId to NEVER reset peer connection on re-render!
  useEffect(() => {
    const callId = activeCall?.callId;
    if (!callId) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      remoteStreamRef.current = null;
      processedIceCandidatesRef.current.clear();
      setHasRemoteAudio(false);
      setHasRemoteVideo(false);
      return;
    }

    const currentCallId = callId;
    const currentCall = activeCall;
    let isCancelled = false;

    async function initMediaAndPeer() {
      try {
        setConnectionStatus(currentCall.isCaller ? sRef.current.callingRinging : sRef.current.callingConnecting);

        const isVideo = currentCall.callType === "VIDEO";
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: isVideo
              ? {
                  width: { ideal: 1280, max: 1280, min: 480 },
                  height: { ideal: 720, max: 720, min: 360 },
                  frameRate: { ideal: 24, max: 30 },
                  facingMode: "user",
                }
              : false,
          });
        } catch (mediaErr) {
          // Graceful fallback to audio if camera is busy or unavailable on desktop
          if (isVideo) {
            console.warn("[WebRTC] Video device failed, falling back to audio:", mediaErr);
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false,
            });
          } else {
            throw mediaErr;
          }
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        // Attach local preview (must be muted to avoid self-echo!)
        if (localVideoRef.current && isVideo) {
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = stream;
        }

        // Initialize PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Setup remote stream listener
        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;

        pc.ontrack = (event) => {
          console.log("[WebRTC] ontrack received:", event.track.kind);
          const incomingStream = event.streams && event.streams[0] ? event.streams[0] : remoteStream;
          if (!incomingStream.getTracks().includes(event.track)) {
            incomingStream.addTrack(event.track);
          }
          remoteStreamRef.current = incomingStream;

          if (event.track.kind === "audio") {
            setHasRemoteAudio(true);
            if (remoteAudioRef.current) {
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              remoteAudioRef.current.srcObject = incomingStream;
              remoteAudioRef.current.play().catch((e) => console.warn("[WebRTC] Remote audio autoplay error:", e));
            }
          }

          if (event.track.kind === "video") {
            setHasRemoteVideo(true);
            setCurrentCallType("VIDEO");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = incomingStream;
              remoteVideoRef.current.play().catch((e) => console.warn("[WebRTC] Remote video autoplay error:", e));
            }
          }
        };

        // Queue local ICE candidates and flush in batches
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const raw = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            iceBatchQueueRef.current.push(raw);

            if (!iceBatchTimerRef.current) {
              iceBatchTimerRef.current = setTimeout(() => {
                flushIceCandidates(currentCallId);
              }, 250);
            }
          }
        };

        // Track connection state
        pc.onconnectionstatechange = () => {
          console.log("[WebRTC] Connection state change:", pc.connectionState);
          if (isCancelled) return;

          if (pc.connectionState === "connected") {
            setConnectionStatus(sRef.current.callingConnected);
            onStatusChangeRef.current?.("CONNECTED");

            // Explicitly ensure both audio & video elements are unmuted and playing
            if (remoteAudioRef.current && remoteStreamRef.current) {
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              remoteAudioRef.current.srcObject = remoteStreamRef.current;
              remoteAudioRef.current.play().catch(() => {});
            }
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
          } else if (
            pc.connectionState === "disconnected" ||
            pc.connectionState === "failed" ||
            pc.connectionState === "closed"
          ) {
            // When the remote peer hangs up or disconnects, show graceful Ended UI and close
            if (!isEndingRef.current) {
              isEndingRef.current = true;
              setConnectionStatus(sRef.current.callingEnded);
              playTone(330, "triangle", 300);
              setTimeout(() => {
                onEndCallRef.current?.(currentCallId);
              }, 1200);
            }
          }
        };

        // If Caller: create and dispatch offer SDP with pre-negotiated video capability
        if (currentCall.isCaller) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          await fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "offer",
              callId: currentCallId,
              offerSdp: JSON.stringify(offer),
            }),
          });
          console.log("[WebRTC] Caller created and saved offer SDP");
        }
      } catch (err: unknown) {
        console.error("[WebRTC] InitMedia error:", err);
        setConnectionStatus(sRef.current.callPermissionError);
      }
    }

    initMediaAndPeer();

    return () => {
      isCancelled = true;
      flushIceCandidates(currentCallId);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [activeCall?.callId]);

  // 6. Signaling Loop (Polls server for offer / answer / remote ICE candidates)
  useEffect(() => {
    const callId = activeCall?.callId;
    const isCaller = activeCall?.isCaller;
    if (!callId || activeCall?.status === "ENDED") return;

    let isCancelled = false;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls?callId=${callId}`);
        if (!res.ok || isCancelled) return;

        const data = await res.json();
        const call = data.call;
        if (!call || isCancelled) return;

        if (call.status === "ENDED" || call.status === "REJECTED") {
          if (!isEndingRef.current) {
            isEndingRef.current = true;
            setConnectionStatus(sRef.current.callingEnded);
            playTone(330, "triangle", 300);
            setTimeout(() => {
              onEndCallRef.current?.(callId);
            }, 1000);
          }
          return;
        }

        const pc = peerConnectionRef.current;
        if (!pc || pc.connectionState === "disconnected" || pc.connectionState === "failed") return;

        // Upgrade callType if call session upgraded to VIDEO (renegotiate exactly ONCE)
        if (call.callType === "VIDEO" && currentCallTypeRef.current !== "VIDEO") {
          setCurrentCallType("VIDEO");
          currentCallTypeRef.current = "VIDEO";
          // If Caller sees the session upgraded to VIDEO, ensure a renegotiated offer is dispatched ONCE
          if (isCaller && pc.signalingState === "stable" && !hasRenegotiatedVideoRef.current) {
            hasRenegotiatedVideoRef.current = true;
            try {
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await pc.setLocalDescription(offer);
              await fetch("/api/calls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "offer",
                  callId,
                  offerSdp: JSON.stringify(offer),
                }),
              });
            } catch (renegErr) {
              console.warn("[WebRTC] Renegotiation offer error:", renegErr);
            }
          }
        }

        // CASE A: CALLER receives ANSWER SDP from receiver
        if (isCaller && call.answerSdp && call.answerSdp !== lastHandledAnswerRef.current) {
          console.log("[WebRTC] Caller setting remote answer SDP");
          lastHandledAnswerRef.current = call.answerSdp;
          const answer = JSON.parse(call.answerSdp);
          if (pc.signalingState !== "stable" || !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
          setConnectionStatus(sRef.current.callingConnected);
          onStatusChangeRef.current?.("CONNECTED");

          // Play remote audio immediately
          if (remoteAudioRef.current && remoteStreamRef.current) {
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            remoteAudioRef.current.play().catch(() => {});
          }
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            remoteVideoRef.current.play().catch(() => {});
          }
        }

        // CASE B: RECEIVER receives OFFER SDP from caller (initial or upgrade offer)
        if (!isCaller && call.offerSdp && call.offerSdp !== lastHandledOfferRef.current) {
          console.log("[WebRTC] Receiver setting remote offer SDP & answering");
          lastHandledOfferRef.current = call.offerSdp;
          const offer = JSON.parse(call.offerSdp);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);

            await fetch("/api/calls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "answer",
                callId,
                answerSdp: JSON.stringify(answer),
              }),
            });
            setConnectionStatus(sRef.current.callingConnected);
            onStatusChangeRef.current?.("CONNECTED");
          } catch (ansErr) {
            console.warn("[WebRTC] Receiver set offer / answer error:", ansErr);
          }
        }

        // Apply remote ICE candidates
        if (pc.remoteDescription) {
          const remoteCandidatesRaw = isCaller ? call.receiverIce : call.callerIce;
          const remoteCandidates: any[] = JSON.parse(remoteCandidatesRaw || "[]");

          for (const cand of remoteCandidates) {
            if (!cand) continue;
            const candKey =
              typeof cand === "string"
                ? cand
                : `${cand.candidate || ""}|${cand.sdpMid || ""}|${cand.sdpMLineIndex ?? ""}`;

            if (!processedIceCandidatesRef.current.has(candKey)) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
                processedIceCandidatesRef.current.add(candKey);
              } catch (e) {
                console.warn("[WebRTC] Error adding remote candidate (will retry):", e);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[WebRTC] Signaling poll error:", err);
      }
    }, 800); // 800ms fast polling

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeCall?.callId, activeCall?.isCaller, activeCall?.callType, activeCall?.status]);

  // Toggle microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setMicMuted(!t.enabled);
      });
    }
  };

  // Messenger-style Dynamic Camera Toggle: Works in both Audio and Video calls!
  const handleToggleCamera = async () => {
    const callId = activeCall?.callId;
    if (!callId) return;

    try {
      const existingVideoTrack = localStreamRef.current?.getVideoTracks()[0];

      if (!existingVideoTrack) {
        // Camera is not yet running: acquire video stream from device
        let videoStream: MediaStream;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1280, min: 480 },
              height: { ideal: 720, max: 720, min: 360 },
              frameRate: { ideal: 24, max: 30 },
              facingMode,
            },
          });
        } catch (camErr) {
          console.warn("[WebRTC] Camera access failed:", camErr);
          alert(sRef.current.callPermissionError);
          return;
        }

        const newVideoTrack = videoStream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        if (localStreamRef.current) {
          localStreamRef.current.addTrack(newVideoTrack);
        } else {
          localStreamRef.current = videoStream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = peerConnectionRef.current;
        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          } else {
            pc.addTrack(newVideoTrack, localStreamRef.current);
          }

          if (activeCall.isCaller) {
            hasRenegotiatedVideoRef.current = true;
            // Caller initiates renegotiation offer directly
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);

            await fetch("/api/calls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "upgrade-call",
                callId,
                offerSdp: JSON.stringify(offer),
              }),
            });
          } else {
            // Receiver marks session as VIDEO so caller knows to renegotiate
            await fetch("/api/calls", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "upgrade-call",
                callId,
              }),
            });
          }
        }

        setCurrentCallType("VIDEO");
        setCameraOff(false);
      } else {
        // Track exists: toggle enabled
        const nextState = !existingVideoTrack.enabled;
        existingVideoTrack.enabled = nextState;
        setCameraOff(!nextState);
      }
    } catch (err) {
      console.error("[WebRTC] Error toggling camera:", err);
      alert(sRef.current.callPermissionError);
    }
  };

  // Continuous stream sync: ensures video elements never lose binding on re-renders
  useEffect(() => {
    const videoEl = localVideoRef.current;
    const stream = localStreamRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.muted = true;
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {});
    }
  }, [currentCallType, cameraOff]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {});
    }
  }, [currentCallType, hasRemoteVideo]);

  // Flip camera between front & back on mobile/tablets
  const flipCamera = async () => {
    if (!localStreamRef.current) return;
    const nextMode = facingMode === "user" ? "environment" : "user";
    try {
      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (currentVideoTrack) {
        currentVideoTrack.stop();
        localStreamRef.current.removeTrack(currentVideoTrack);
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (newVideoTrack) {
        localStreamRef.current.addTrack(newVideoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        const pc = peerConnectionRef.current;
        if (pc) {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack);
          }
        }
      }
      setFacingMode(nextMode);
    } catch (e) {
      console.warn("Flip camera error:", e);
    }
  };

  // Fullscreen toggle for desktop
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <>
      {/* 0. DEDICATED REMOTE AUDIO ELEMENT (Never hidden with display:none to prevent Chromium/WebKit power suspend) */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0.01,
          pointerEvents: "none",
        }}
        onPlay={() => console.log("[WebRTC] Remote audio playback successfully playing!")}
      />

      {/* 1. INCOMING CALL BANNER / MODAL */}
      {incomingCall && !activeCall && (
        <div className="fixed inset-x-3 top-4 z-[9999] mx-auto max-w-md animate-slide-in-down rounded-3xl border-2 border-emerald-500/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:w-96 dark:border-emerald-500/40 dark:bg-sumi-900/95">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <UserAvatar
                src={incomingCall.caller.avatar}
                name={incomingCall.caller.name}
                sizeClass="h-12 w-12 text-base"
                className="ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-sumi-900"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white shadow">
                {incomingCall.callType === "VIDEO" ? "📹" : "📞"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {incomingCall.caller.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                {incomingCall.callType === "VIDEO" ? s.incomingVideoCall : s.incomingVoiceCall}...
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-end gap-2.5">
            <button
              onClick={() => onDeclineIncoming(incomingCall.id)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 active:scale-95 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              {s.declineCall}
            </button>
            <button
              onClick={() => onAcceptIncoming(incomingCall.id, incomingCall.callType)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 active:scale-95 animate-pulse"
            >
              <span>{incomingCall.callType === "VIDEO" ? "📹" : "📞"}</span>
              <span>{s.acceptCall}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE CALL DIALOG - LAPTOP & MOBILE OPTIMIZED */}
      {activeCall && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-md sm:p-6 lg:p-10">
          <div
            ref={modalContainerRef}
            className={`relative flex flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-sumi-950 shadow-2xl transition-all duration-300 animate-spring-up ${
              isFullscreen
                ? "h-screen w-screen max-w-none rounded-none"
                : "h-full max-h-[92dvh] sm:max-h-[82vh] w-full max-w-5xl"
            }`}
          >
            {/* Top Bar Header */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/50 to-transparent p-4 sm:px-6 text-white">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={activeCall.targetUser.avatar}
                  name={activeCall.targetUser.name}
                  sizeClass="h-10 w-10 text-sm"
                  className="ring-2 ring-white/30"
                />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{activeCall.targetUser.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{connectionStatus}</span>
                    {callDuration > 0 && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                        {formatDuration(callDuration)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right top badges & Fullscreen button */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                  <span>{currentCallType === "VIDEO" ? "📹" : "🎙️"}</span>
                  <span>{currentCallType === "VIDEO" ? s.callVideo : s.callVoice}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
                  title="Fullscreen"
                >
                  {isFullscreen ? "🗗" : "⛶"}
                </button>
              </div>
            </div>

            {/* Main Stage: Continuous Dual Video/Audio Experience (Zero unmounts = Zero lost streams) */}
            <div className="relative flex-1 bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-hidden flex items-center justify-center">
              {/* VIDEO STAGE: Always persistently rendered in DOM */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
                  currentCallType === "VIDEO"
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                {/* Remote Video Stream (Main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain sm:object-cover bg-black"
                />

                {/* Fallback avatar if remote video track hasn't rendered yet */}
                {!hasRemoteVideo && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/80 backdrop-blur-sm bg-slate-950/70">
                    <div className="relative mb-5">
                      <div className="absolute -inset-4 animate-ping rounded-full bg-emerald-500/20" />
                      <UserAvatar
                        src={activeCall.targetUser.avatar}
                        name={activeCall.targetUser.name}
                        sizeClass="h-24 w-24 text-3xl sm:h-28 sm:w-28 sm:text-4xl"
                        className="relative ring-4 ring-white/20 shadow-2xl"
                      />
                    </div>
                    <p className="text-base font-bold text-white">{activeCall.targetUser.name}</p>
                    <p className="mt-1 text-xs text-slate-300 flex items-center justify-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{connectionStatus}</span>
                    </p>
                  </div>
                )}

                {/* Local Video Picture-in-Picture (PiP) */}
                <div className="absolute bottom-24 right-4 sm:bottom-24 sm:right-6 h-36 w-24 sm:h-44 sm:w-32 overflow-hidden rounded-2xl border-2 border-white/20 bg-black/80 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-400/60">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover transition-opacity duration-300 ${
                      cameraOff ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  {cameraOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-xs text-white/70 bg-sumi-900/90">
                      <span className="text-xl">📷</span>
                      <span className="mt-1 text-[10px] font-semibold text-amber-400">{s.cameraOff}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AUDIO CALL STAGE - Elegant Modern Voice Experience with smooth cross-fade */}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-500 ease-in-out ${
                  currentCallType === "AUDIO"
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <div className="relative mb-8 flex items-center justify-center">
                  {/* Concentric glowing animated wave ripples */}
                  <div className="absolute h-48 w-48 sm:h-56 sm:w-56 animate-ping rounded-full bg-red-600/10" />
                  <div className="absolute h-36 w-36 sm:h-44 sm:w-44 animate-pulse rounded-full bg-red-600/20" />
                  <UserAvatar
                    src={activeCall.targetUser.avatar}
                    name={activeCall.targetUser.name}
                    sizeClass="h-28 w-28 text-3xl sm:h-36 sm:w-36 sm:text-4xl"
                    className="relative shadow-2xl ring-4 ring-white/20 transition-transform duration-300 hover:scale-105"
                  />
                </div>

                <h2 className="text-xl font-black text-white sm:text-2xl tracking-tight">{activeCall.targetUser.name}</h2>
                <p className="mt-2 font-mono text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{callDuration > 0 ? formatDuration(callDuration) : connectionStatus}</span>
                </p>

                {/* Dynamic Multi-frequency Equalizer Wave Bars */}
                <div className="mt-5 flex items-center gap-1.5 h-6">
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-4" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-6 delay-75" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-3 delay-150" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-5 delay-100" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-2 delay-200" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-6 delay-300" />
                  <span className="w-1.5 rounded-full bg-emerald-400 animate-pulse h-4 delay-75" />
                </div>

                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur-md">
                  <span>🎙️ HD Audio • 48kHz Stereo</span>
                </span>
              </div>

              {/* Call Ended Graceful Animation Overlay */}
              {isEndingRef.current && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center backdrop-blur-md animate-spring-up">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600/20 text-3xl ring-4 ring-red-500/30 animate-pulse">
                    📞
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-white tracking-wide">
                    {s.callingEnded}
                  </h3>
                  {callDuration > 0 && (
                    <p className="mt-2 font-mono text-sm font-semibold text-emerald-400">
                      {formatDuration(callDuration)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Controls Dock - Messenger Style (Camera toggle always available) */}
            <div className="z-20 flex items-center justify-center gap-3.5 sm:gap-6 bg-sumi-900/95 px-4 py-4 backdrop-blur-xl sm:py-5 border-t border-white/5">
              {/* Mic Toggle */}
              <button
                type="button"
                onClick={toggleMic}
                className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-base transition active:scale-95 ${
                  micMuted
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={micMuted ? s.unmuteMic : s.muteMic}
              >
                {micMuted ? "🔇" : "🎙️"}
              </button>

              {/* Camera Toggle Button: Messenger style - available during audio call as well! */}
              <button
                type="button"
                onClick={handleToggleCamera}
                className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-base transition active:scale-95 ${
                  currentCallType === "VIDEO" && !cameraOff
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={currentCallType === "VIDEO" && !cameraOff ? s.cameraOff : s.cameraOn}
              >
                {currentCallType === "VIDEO" && !cameraOff ? "📹" : "📷"}
              </button>

              {/* Flip camera between front & back (when camera is on) */}
              {currentCallType === "VIDEO" && !cameraOff && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/10 text-base text-white transition hover:bg-white/20 active:scale-95 sm:hidden"
                  title={s.flipCamera}
                >
                  🔄
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => onEndCall(activeCall.callId)}
                className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-red-600 text-lg text-white shadow-xl transition hover:bg-red-700 active:scale-90"
                title={s.endCall}
              >
                📞
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
