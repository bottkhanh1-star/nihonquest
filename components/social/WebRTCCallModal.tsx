"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation } from "@/lib/socialI18n";
import { playNihonQuestChime } from "@/lib/nihonChime";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelay",
      credential: "openrelay",
    },
  ],
  iceCandidatePoolSize: 10,
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

function getVideoTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
  return pc.getTransceivers().find(
    (t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video"
  );
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
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const processedIceCandidatesRef = useRef<Set<string>>(new Set());
  const iceBatchQueueRef = useRef<any[]>([]);
  const iceBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHandledOfferRef = useRef<string | null>(null);
  const lastHandledAnswerRef = useRef<string | null>(null);
  const isNegotiatingRef = useRef(false);
  const isEndingRef = useRef(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const remoteMetaReceivedRef = useRef(false);

  // Stable callback refs to prevent unnecessary useEffect tear-downs
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;
  const sRef = useRef(s);
  sRef.current = s;
  const isCallerRef = useRef(activeCall?.isCaller);
  isCallerRef.current = activeCall?.isCaller;
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  // Strictly independent Local vs Remote media states
  // Local camera state ONLY reflects whether THIS user's camera is actively capturing & enabled
  const [isLocalCameraOn, setIsLocalCameraOn] = useState(false);
  const isLocalCameraOnRef = useRef(false);
  isLocalCameraOnRef.current = isLocalCameraOn;

  // Remote camera state reflects whether the OTHER user's camera is actively transmitting
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(false);
  const isRemoteCameraOnRef = useRef(false);
  isRemoteCameraOnRef.current = isRemoteCameraOn;

  const [isRemoteMicMuted, setIsRemoteMicMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  micMutedRef.current = micMuted;

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoFit, setVideoFit] = useState<"contain" | "cover">("contain");
  const [swappedView, setSwappedView] = useState(false);

  // Ensure remote audio and video elements are playing with correct configurations
  const ensureMediaPlaying = useCallback(() => {
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.play().catch((e) => console.warn("[WebRTC] Audio play error:", e));
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      // Remote video MUST be muted so modern browsers never block autoplay!
      remoteVideoRef.current.muted = true;
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch((e) => console.warn("[WebRTC] Video play error:", e));
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.muted = true;
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, []);

  // Unlock media on user interaction
  const unlockMedia = useCallback(() => {
    ensureMediaPlaying();
  }, [ensureMediaPlaying]);

  // Send media state over DataChannel and HTTP API so the remote peer always knows our exact camera/mic state
  const broadcastMediaState = useCallback(
    (callId: string, videoOn: boolean, audioOn: boolean, offerSdp?: string) => {
      const dc = dataChannelRef.current;
      if (dc && dc.readyState === "open") {
        try {
          dc.send(
            JSON.stringify({
              type: "MEDIA_STATE",
              video: videoOn,
              audio: audioOn,
            })
          );
        } catch {
          // ignore
        }
      }

      fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "media-state",
          callId,
          videoOn,
          audioOn,
          ...(offerSdp ? { offerSdp } : {}),
        }),
      }).catch(() => {});
    },
    []
  );

  // Graceful termination handler with sound
  const terminateCallWithSound = useCallback((callIdToTerminate?: string) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (ringingTimerRef.current) {
      clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = null;
    }

    setConnectionStatus(sRef.current.callingEnded);
    playTone(330, "triangle", 300);
    const targetId = callIdToTerminate || activeCallRef.current?.callId;
    setTimeout(() => {
      if (targetId) {
        onEndCallRef.current?.(targetId);
      }
    }, 1200);
  }, []);

  // Reset session flags whenever a new call session starts
  useEffect(() => {
    isEndingRef.current = false;
    isNegotiatingRef.current = false;
    remoteMetaReceivedRef.current = false;
    lastHandledOfferRef.current = null;
    lastHandledAnswerRef.current = null;
    setIsLocalCameraOn(false);
    isLocalCameraOnRef.current = false;
    setIsRemoteCameraOn(false);
    isRemoteCameraOnRef.current = false;
    setIsRemoteMicMuted(false);
    setMicMuted(false);
    micMutedRef.current = false;
    setSwappedView(false);
    setVideoFit("contain");

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (ringingTimerRef.current) {
      clearTimeout(ringingTimerRef.current);
      ringingTimerRef.current = null;
    }
  }, [activeCall?.callId]);

  // Ringing timeout: if outgoing call rings for > 45s without answer, terminate
  useEffect(() => {
    const isCaller = activeCall?.isCaller;
    const isRinging = activeCall?.status === "RINGING";
    const callId = activeCall?.callId;

    if (isCaller && isRinging && callId) {
      ringingTimerRef.current = setTimeout(() => {
        console.warn("[WebRTC] Call ringing timed out after 45s");
        terminateCallWithSound(callId);
      }, 45000);

      return () => {
        if (ringingTimerRef.current) {
          clearTimeout(ringingTimerRef.current);
          ringingTimerRef.current = null;
        }
      };
    } else {
      if (ringingTimerRef.current) {
        clearTimeout(ringingTimerRef.current);
        ringingTimerRef.current = null;
      }
    }
  }, [activeCall?.isCaller, activeCall?.status, activeCall?.callId, terminateCallWithSound]);

  // 1. Incoming Call Ringtone (Signature Nihon Quest Koto & Fūrin Melody)
  useEffect(() => {
    if (!incomingCall || activeCall) return;
    const ring = () => {
      playNihonQuestChime("call");
    };
    ring();
    const interval = setInterval(ring, 2600);
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
    playNihonQuestChime("connect");

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
  const flushIceCandidates = useCallback((callId: string) => {
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
        videoOn: isLocalCameraOnRef.current,
        audioOn: !micMutedRef.current,
      }),
    }).catch((err) => console.warn("[WebRTC] Error flushing ICE batch:", err));
  }, []);

  // Configure peer-to-peer DataChannel for instant (<10ms) camera/mic state sync & SDP renegotiation
  const setupDataChannel = useCallback(
    (dc: RTCDataChannel, callId: string) => {
      dataChannelRef.current = dc;

      dc.onopen = () => {
        try {
          dc.send(
            JSON.stringify({
              type: "MEDIA_STATE",
              video: isLocalCameraOnRef.current,
              audio: !micMutedRef.current,
            })
          );
        } catch {
          // ignore
        }
      };

      dc.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || typeof msg !== "object") return;

          if (msg.type === "MEDIA_STATE") {
            remoteMetaReceivedRef.current = true;
            if (typeof msg.video === "boolean") {
              setIsRemoteCameraOn(msg.video);
              isRemoteCameraOnRef.current = msg.video;
              if (msg.video) {
                ensureMediaPlaying();
              }
            }
            if (typeof msg.audio === "boolean") {
              setIsRemoteMicMuted(!msg.audio);
            }
          } else if (msg.type === "SDP_OFFER" && msg.sdp) {
            const pc = peerConnectionRef.current;
            if (!pc || pc.connectionState === "closed") return;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const videoTransceiver = getVideoTransceiver(pc);
              if (videoTransceiver) {
                const localVid = localStreamRef.current
                  ?.getVideoTracks()
                  .find((t) => t.readyState === "live" && t.enabled);
                if (localVid && isLocalCameraOnRef.current) {
                  await videoTransceiver.sender.replaceTrack(localVid);
                }
                videoTransceiver.direction = "sendrecv";
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (dc.readyState === "open") {
                dc.send(JSON.stringify({ type: "SDP_ANSWER", sdp: answer }));
              }
              ensureMediaPlaying();
            } catch (err) {
              console.warn("[WebRTC] DataChannel SDP_OFFER error:", err);
            }
          } else if (msg.type === "SDP_ANSWER" && msg.sdp) {
            const pc = peerConnectionRef.current;
            if (!pc || pc.connectionState === "closed") return;
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              ensureMediaPlaying();
            }
          }
        } catch (err) {
          console.warn("[WebRTC] DataChannel message error:", err);
        }
      };
    },
    [ensureMediaPlaying]
  );

  // 5. Initialize WebRTC Media & PeerConnection
  // Strictly depend on activeCall?.callId to NEVER reset peer connection on re-render!
  useEffect(() => {
    const callId = activeCall?.callId;
    if (!callId) {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      if (dataChannelRef.current) {
        try {
          dataChannelRef.current.close();
        } catch {}
        dataChannelRef.current = null;
      }
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
      setIsLocalCameraOn(false);
      setIsRemoteCameraOn(false);
      return;
    }

    const currentCallId = callId;
    const currentCall = activeCall;
    let isCancelled = false;

    async function initMediaAndPeer() {
      try {
        setConnectionStatus(
          currentCall.isCaller ? sRef.current.callingRinging : sRef.current.callingConnecting
        );

        const wantsVideo = currentCall.callType === "VIDEO";
        let stream: MediaStream;
        let acquiredVideo = false;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: wantsVideo
              ? {
                  width: { ideal: 1280, max: 1280, min: 480 },
                  height: { ideal: 720, max: 720, min: 360 },
                  frameRate: { ideal: 24, max: 30 },
                  facingMode: "user",
                }
              : false,
          });
          acquiredVideo = stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);
        } catch (mediaErr) {
          // Graceful fallback to audio if camera is busy or unavailable on desktop/mobile
          if (wantsVideo) {
            console.warn("[WebRTC] Video device failed, falling back to audio:", mediaErr);
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false,
            });
            acquiredVideo = false;
          } else {
            throw mediaErr;
          }
        }

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setIsLocalCameraOn(acquiredVideo);
        isLocalCameraOnRef.current = acquiredVideo;

        // Attach local preview (must be muted to avoid self-echo!)
        if (localVideoRef.current) {
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = stream;
          if (acquiredVideo) {
            localVideoRef.current.play().catch(() => {});
          }
        }

        // Initialize PeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Create pre-negotiated DataChannel (id: 0) on both peers for instant state sync
        try {
          const dc = pc.createDataChannel("call-control", { negotiated: true, id: 0 });
          setupDataChannel(dc, currentCallId);
        } catch (dcErr) {
          console.warn("[WebRTC] Negotiated DataChannel creation warning:", dcErr);
        }

        // Add local audio tracks
        stream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Pre-allocate bidirectional sendrecv video transceiver on BOTH Audio and Video calls!
        // This guarantees either peer can turn their camera ON/OFF at any time without direction mismatch.
        const localVideoTrack = stream.getVideoTracks()[0];
        if (localVideoTrack && acquiredVideo) {
          const sender = pc.addTrack(localVideoTrack, stream);
          const vt = pc.getTransceivers().find((t) => t.sender === sender);
          if (vt) vt.direction = "sendrecv";
        } else {
          pc.addTransceiver("video", { direction: "sendrecv", streams: [stream] });
        }

        // Setup persistent remote stream listener
        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;

        pc.ontrack = (event) => {
          console.log("[WebRTC] ontrack received:", event.track.kind, event.track.id);
          const currentRemote = remoteStreamRef.current || remoteStream;
          const existingSameKind = currentRemote
            .getTracks()
            .filter((t) => t.kind === event.track.kind && t.id !== event.track.id);
          existingSameKind.forEach((oldTrack) => currentRemote.removeTrack(oldTrack));

          if (!currentRemote.getTracks().some((t) => t.id === event.track.id)) {
            currentRemote.addTrack(event.track);
          }
          remoteStreamRef.current = currentRemote;

          if (event.track.kind === "audio") {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              remoteAudioRef.current.srcObject = currentRemote;
              remoteAudioRef.current
                .play()
                .catch((e) => console.warn("[WebRTC] Remote audio autoplay error:", e));
            }
          }

          if (event.track.kind === "video") {
            // Attach stream to remoteVideoRef, but DO NOT blindly set isRemoteCameraOn = true
            // or change local camera state! Wait for actual unmute / video frames / peer MEDIA_STATE.
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = true;
              remoteVideoRef.current.srcObject = currentRemote;
              remoteVideoRef.current
                .play()
                .catch((e) => console.warn("[WebRTC] Remote video autoplay error:", e));
            }

            event.track.onunmute = () => {
              if (!remoteMetaReceivedRef.current) {
                setIsRemoteCameraOn(true);
                isRemoteCameraOnRef.current = true;
              }
              ensureMediaPlaying();
            };

            event.track.onmute = () => {
              if (!remoteMetaReceivedRef.current) {
                setIsRemoteCameraOn(false);
                isRemoteCameraOnRef.current = false;
              }
            };

            event.track.onended = () => {
              setIsRemoteCameraOn(false);
              isRemoteCameraOnRef.current = false;
            };
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

        // Track connection state with 10s reconnection grace period
        pc.onconnectionstatechange = () => {
          console.log("[WebRTC] Connection state change:", pc.connectionState);
          if (isCancelled) return;

          if (pc.connectionState === "connected") {
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
            setConnectionStatus(sRef.current.callingConnected);
            onStatusChangeRef.current?.("CONNECTED");
            ensureMediaPlaying();
            broadcastMediaState(
              currentCallId,
              isLocalCameraOnRef.current,
              !micMutedRef.current
            );
          } else if (pc.connectionState === "disconnected") {
            setConnectionStatus(sRef.current.callingConnecting);
            if (!disconnectTimerRef.current) {
              disconnectTimerRef.current = setTimeout(() => {
                const currentPc = peerConnectionRef.current;
                if (
                  currentPc &&
                  (currentPc.connectionState === "disconnected" ||
                    currentPc.connectionState === "failed") &&
                  !isEndingRef.current
                ) {
                  console.warn("[WebRTC] Disconnected for 10s grace period. Ending call.");
                  terminateCallWithSound(currentCallId);
                }
              }, 10000);
            }
          } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
            if (!isEndingRef.current) {
              terminateCallWithSound(currentCallId);
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[WebRTC] ICE state change:", pc.iceConnectionState);
          if (isCancelled) return;
          if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
            setConnectionStatus(sRef.current.callingConnected);
            ensureMediaPlaying();
          }
        };

        // Sync initial media state to server
        broadcastMediaState(currentCallId, acquiredVideo, true);

        // If Caller: create and dispatch initial offer SDP
        if (currentCall.isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const offerPayload = JSON.stringify({
            type: offer.type,
            sdp: offer.sdp,
            senderRole: "CALLER",
            rev: Date.now(),
          });
          lastHandledOfferRef.current = offerPayload;

          await fetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "offer",
              callId: currentCallId,
              offerSdp: offerPayload,
            }),
          });
          console.log("[WebRTC] Caller created and saved initial offer SDP");
        }
      } catch (err: unknown) {
        console.error("[WebRTC] InitMedia error:", err);
        setConnectionStatus(sRef.current.callPermissionError);
      }
    }

    initMediaAndPeer();

    return () => {
      isCancelled = true;
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      flushIceCandidates(currentCallId);
      if (dataChannelRef.current) {
        try {
          dataChannelRef.current.close();
        } catch {}
        dataChannelRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [
    activeCall?.callId,
    ensureMediaPlaying,
    terminateCallWithSound,
    flushIceCandidates,
    setupDataChannel,
    broadcastMediaState,
  ]);

  // 6. Periodic DataChannel heartbeat + Signaling Loop (Polls server for offer / answer / remote ICE / remote media state)
  useEffect(() => {
    const callId = activeCall?.callId;
    if (!callId || activeCall?.status === "ENDED") return;

    let isCancelled = false;

    const interval = setInterval(async () => {
      try {
        // Send lightweight DataChannel heartbeat if open
        const dc = dataChannelRef.current;
        if (dc && dc.readyState === "open") {
          try {
            dc.send(
              JSON.stringify({
                type: "MEDIA_STATE",
                video: isLocalCameraOnRef.current,
                audio: !micMutedRef.current,
              })
            );
          } catch {}
        }

        const res = await fetch(`/api/calls?callId=${callId}`);
        if (!res.ok || isCancelled) return;

        const data = await res.json();
        const call = data.call;
        if (!call || isCancelled) return;

        if (call.status === "ENDED" || call.status === "REJECTED") {
          if (!isEndingRef.current) {
            terminateCallWithSound(callId);
          }
          return;
        }

        const pc = peerConnectionRef.current;
        if (!pc || pc.connectionState === "closed") return;

        const isCaller = isCallerRef.current;
        const myRole = isCaller ? "CALLER" : "RECEIVER";

        // 1. Handle incoming OFFER from the other peer (initial offer from Caller OR renegotiation offer from either peer)
        if (call.offerSdp && call.offerSdp !== lastHandledOfferRef.current) {
          let parsedOffer: any = null;
          try {
            parsedOffer = JSON.parse(call.offerSdp);
          } catch {}

          const offerSenderRole = parsedOffer?.senderRole || "CALLER";
          if (parsedOffer && offerSenderRole !== myRole && !isNegotiatingRef.current) {
            isNegotiatingRef.current = true;
            lastHandledOfferRef.current = call.offerSdp;
            try {
              console.log("[WebRTC] Applying remote offer SDP from", offerSenderRole);
              await pc.setRemoteDescription(
                new RTCSessionDescription({
                  type: parsedOffer.type || "offer",
                  sdp: parsedOffer.sdp,
                })
              );

              // Ensure our video transceiver is set to sendrecv and has our local video track if active
              const videoTransceiver = getVideoTransceiver(pc);
              if (videoTransceiver) {
                const localVid = localStreamRef.current
                  ?.getVideoTracks()
                  .find((t) => t.readyState === "live" && t.enabled);
                if (localVid && isLocalCameraOnRef.current) {
                  await videoTransceiver.sender.replaceTrack(localVid);
                }
                videoTransceiver.direction = "sendrecv";
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              const answerPayload = JSON.stringify({
                type: answer.type,
                sdp: answer.sdp,
                senderRole: myRole,
                rev: Date.now(),
              });
              lastHandledAnswerRef.current = answerPayload;

              await fetch("/api/calls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "answer",
                  callId,
                  answerSdp: answerPayload,
                }),
              });

              setConnectionStatus(sRef.current.callingConnected);
              onStatusChangeRef.current?.("CONNECTED");
              ensureMediaPlaying();
            } catch (ansErr) {
              console.warn("[WebRTC] Error handling remote offer:", ansErr);
            } finally {
              isNegotiatingRef.current = false;
            }
          }
        }

        // 2. Handle incoming ANSWER from the other peer
        if (call.answerSdp && call.answerSdp !== lastHandledAnswerRef.current) {
          let parsedAnswer: any = null;
          try {
            parsedAnswer = JSON.parse(call.answerSdp);
          } catch {}

          const answerSenderRole = parsedAnswer?.senderRole || "RECEIVER";
          if (parsedAnswer && answerSenderRole !== myRole) {
            lastHandledAnswerRef.current = call.answerSdp;
            try {
              if (pc.signalingState === "have-local-offer" || !pc.currentRemoteDescription) {
                console.log("[WebRTC] Applying remote answer SDP from", answerSenderRole);
                await pc.setRemoteDescription(
                  new RTCSessionDescription({
                    type: parsedAnswer.type || "answer",
                    sdp: parsedAnswer.sdp,
                  })
                );
              }
              setConnectionStatus(sRef.current.callingConnected);
              onStatusChangeRef.current?.("CONNECTED");
              ensureMediaPlaying();
            } catch (setAnsErr) {
              console.warn("[WebRTC] Error setting remote answer:", setAnsErr);
            }
          }
        }

        // 3. Apply remote ICE candidates AND read remote peer's __meta camera/mic state
        const remoteCandidatesRaw = isCaller ? call.receiverIce : call.callerIce;
        const remoteCandidates: any[] = JSON.parse(remoteCandidatesRaw || "[]");

        for (const item of remoteCandidates) {
          if (!item) continue;
          if (item.__meta === true) {
            remoteMetaReceivedRef.current = true;
            if (typeof item.videoOn === "boolean" && item.videoOn !== isRemoteCameraOnRef.current) {
              setIsRemoteCameraOn(item.videoOn);
              isRemoteCameraOnRef.current = item.videoOn;
              if (item.videoOn) {
                ensureMediaPlaying();
              }
            }
            if (typeof item.audioOn === "boolean") {
              setIsRemoteMicMuted(!item.audioOn);
            }
            continue;
          }

          if (pc.remoteDescription) {
            const candKey =
              typeof item === "string"
                ? item
                : `${item.candidate || ""}|${item.sdpMid || ""}|${item.sdpMLineIndex ?? ""}`;

            if (!processedIceCandidatesRef.current.has(candKey)) {
              processedIceCandidatesRef.current.add(candKey);
              if (typeof item === "object" && (!item.candidate || item.candidate.trim() === "")) {
                continue;
              }
              try {
                await pc.addIceCandidate(new RTCIceCandidate(item));
              } catch (e) {
                console.warn("[WebRTC] Error adding remote candidate:", e);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[WebRTC] Signaling poll error:", err);
      }
    }, 800);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeCall?.callId, activeCall?.status, terminateCallWithSound, ensureMediaPlaying]);

  // Toggle microphone (Strictly local mic state + broadcasts to remote peer)
  const toggleMic = () => {
    const callId = activeCall?.callId;
    if (localStreamRef.current) {
      let nextMuted = !micMuted;
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
      setMicMuted(nextMuted);
      micMutedRef.current = nextMuted;
      if (callId) {
        broadcastMediaState(callId, isLocalCameraOnRef.current, !nextMuted);
      }
    }
  };

  // Dynamic Camera Toggle: Works in both Audio and Video calls for BOTH Caller and Receiver
  // Strictly controls ONLY this user's local camera (`isLocalCameraOn`)!
  const handleToggleCamera = async () => {
    const callId = activeCall?.callId;
    if (!callId) return;

    const pc = peerConnectionRef.current;
    const myRole = activeCall.isCaller ? "CALLER" : "RECEIVER";

    try {
      if (!isLocalCameraOn) {
        // Turn MY camera ON
        let videoTrack = localStreamRef.current
          ?.getVideoTracks()
          .find((t) => t.readyState === "live");

        if (!videoTrack) {
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

          videoTrack = videoStream.getVideoTracks()[0];
          if (!videoTrack) return;

          if (localStreamRef.current) {
            // Remove any ended video tracks first
            localStreamRef.current
              .getVideoTracks()
              .filter((t) => t.id !== videoTrack!.id)
              .forEach((t) => {
                t.stop();
                localStreamRef.current?.removeTrack(t);
              });
            localStreamRef.current.addTrack(videoTrack);
          } else {
            localStreamRef.current = videoStream;
          }
        }

        videoTrack.enabled = true;

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }

        let offerPayload: string | undefined;

        if (pc) {
          const videoTransceiver = getVideoTransceiver(pc);
          if (videoTransceiver) {
            await videoTransceiver.sender.replaceTrack(videoTrack);
            videoTransceiver.direction = "sendrecv";
          } else if (localStreamRef.current) {
            pc.addTrack(videoTrack, localStreamRef.current);
          }

          // Create renegotiation offer if signaling is stable so all browsers sync SSRC/codec immediately
          if (pc.signalingState === "stable") {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              const dc = dataChannelRef.current;
              if (dc && dc.readyState === "open") {
                dc.send(JSON.stringify({ type: "SDP_OFFER", sdp: offer }));
              }

              offerPayload = JSON.stringify({
                type: offer.type,
                sdp: offer.sdp,
                senderRole: myRole,
                rev: Date.now(),
              });
              lastHandledOfferRef.current = offerPayload;
            } catch (renegErr) {
              console.warn("[WebRTC] Renegotiation offer warning:", renegErr);
            }
          }
        }

        setIsLocalCameraOn(true);
        isLocalCameraOnRef.current = true;

        // Broadcast that OUR camera is now ON
        broadcastMediaState(callId, true, !micMutedRef.current, offerPayload);
      } else {
        // Turn MY camera OFF
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        if (pc) {
          const videoTransceiver = getVideoTransceiver(pc);
          if (videoTransceiver) {
            await videoTransceiver.sender.replaceTrack(null).catch(() => {});
          }
        }

        setIsLocalCameraOn(false);
        isLocalCameraOnRef.current = false;

        // Broadcast that OUR camera is now OFF
        broadcastMediaState(callId, false, !micMutedRef.current);
      }
    } catch (err) {
      console.error("[WebRTC] Error toggling camera:", err);
      alert(sRef.current.callPermissionError);
    }
  };

  // Continuous stream sync: ensures video & audio elements never lose binding on re-renders
  useEffect(() => {
    const videoEl = localVideoRef.current;
    const stream = localStreamRef.current;
    if (videoEl && stream) {
      videoEl.muted = true;
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      if (isLocalCameraOn) {
        videoEl.play().catch(() => {});
      }
    }
  }, [isLocalCameraOn, swappedView]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (videoEl && stream) {
      videoEl.muted = true;
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {});
    }

    const audioEl = remoteAudioRef.current;
    if (audioEl && stream) {
      audioEl.muted = false;
      audioEl.volume = 1.0;
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.play().catch(() => {});
    }
  }, [isRemoteCameraOn, isLocalCameraOn, swappedView]);

  // Flip camera between front & back on mobile/tablets
  const flipCamera = async () => {
    if (!localStreamRef.current || !isLocalCameraOn) return;
    const nextMode = facingMode === "user" ? "environment" : "user";
    try {
      const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (currentVideoTrack) {
        currentVideoTrack.stop();
        localStreamRef.current.removeTrack(currentVideoTrack);
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1280, min: 480 },
          height: { ideal: 720, max: 720, min: 360 },
          facingMode: nextMode,
        },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (newVideoTrack) {
        localStreamRef.current.addTrack(newVideoTrack);
        if (localVideoRef.current) {
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = peerConnectionRef.current;
        if (pc) {
          const videoTransceiver = getVideoTransceiver(pc);
          if (videoTransceiver) {
            await videoTransceiver.sender.replaceTrack(newVideoTrack);
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
      modalContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const showVideoStage = isLocalCameraOn || isRemoteCameraOn;

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
              className="inline-flex items-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 active:scale-95 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              {s.declineCall}
            </button>
            <button
              onClick={() => {
                unlockMedia();
                onAcceptIncoming(incomingCall.id, incomingCall.callType);
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 active:scale-95 animate-pulse"
            >
              <span>{incomingCall.callType === "VIDEO" ? "📹" : "📞"}</span>
              <span>{s.acceptCall}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE CALL DIALOG - LAPTOP & MOBILE OPTIMIZED */}
      {activeCall && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/90 p-0 backdrop-blur-md sm:p-4 lg:p-6">
          <div
            ref={modalContainerRef}
            onClick={unlockMedia}
            onTouchStart={unlockMedia}
            className={`relative flex flex-col overflow-hidden bg-sumi-950 shadow-2xl transition-all duration-300 animate-spring-up ${
              isFullscreen
                ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
                : "h-[100dvh] w-full rounded-none border-0 sm:h-[86vh] sm:max-h-[820px] sm:max-w-4xl lg:max-w-5xl sm:rounded-3xl sm:border sm:border-slate-700/70"
            }`}
          >
            {/* Top Bar Header (Structured flex bar so it never overlaps video faces on laptop or mobile) */}
            <div
              className="z-20 flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 py-3 text-white backdrop-blur-md sm:px-6"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  src={activeCall.targetUser.avatar}
                  name={activeCall.targetUser.name}
                  sizeClass="h-10 w-10 text-sm"
                  className="ring-2 ring-white/25 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold sm:text-base">
                      {activeCall.targetUser.name}
                    </h3>
                    {isRemoteMicMuted && (
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30"
                        title="Đối phương đang tắt mic"
                      >
                        🔇 Mic tắt
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate">{connectionStatus}</span>
                    {callDuration > 0 && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                        {formatDuration(callDuration)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right top controls: Fit/Cover toggle, Mode badge & Fullscreen button */}
              <div className="flex shrink-0 items-center gap-2">
                {showVideoStage && (
                  <button
                    type="button"
                    onClick={() => setVideoFit((prev) => (prev === "contain" ? "cover" : "contain"))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/20 active:scale-95"
                    title={
                      videoFit === "contain"
                        ? "Đang hiển thị vừa khung hình (không bị cắt). Nhấn để lấp đầy"
                        : "Đang lấp đầy khung hình. Nhấn để thu vừa khung hình"
                    }
                  >
                    <span>{videoFit === "contain" ? "🖼️" : "🔍"}</span>
                    <span className="hidden xs:inline sm:inline">
                      {videoFit === "contain"
                        ? nativeLanguage === "vi"
                          ? "Vừa khung"
                          : "Fit"
                        : nativeLanguage === "vi"
                          ? "Lấp đầy"
                          : "Fill"}
                    </span>
                  </button>
                )}

                <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                  <span>{showVideoStage ? "📹" : "🎙️"}</span>
                  <span>{showVideoStage ? s.callVideo : s.callVoice}</span>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
                  title="Toàn màn hình (Fullscreen)"
                >
                  {isFullscreen ? "🗗" : "⛶"}
                </button>
              </div>
            </div>

            {/* Main Stage: Continuous Dual Video/Audio Experience (Zero unmounts = Zero lost streams) */}
            <div className="relative flex-1 bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-hidden flex items-center justify-center">
              {/* VIDEO STAGE: Always persistently rendered in DOM */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
                  showVideoStage
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                {/* MAIN VIDEO CONTAINER (Shows Remote Video by default, or Local Video if user tapped PiP to swap) */}
                <div className="relative h-full w-full flex items-center justify-center bg-slate-950 overflow-hidden">
                  {/* Remote Video Element — Properly centered with object-contain by default so laptop/mobile never crops the caller's face */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      if (el.videoWidth > 0 && !remoteMetaReceivedRef.current) {
                        setIsRemoteCameraOn(true);
                        isRemoteCameraOnRef.current = true;
                      }
                    }}
                    onResize={(e) => {
                      const el = e.currentTarget;
                      if (el.videoWidth > 0 && !remoteMetaReceivedRef.current) {
                        setIsRemoteCameraOn(true);
                        isRemoteCameraOnRef.current = true;
                      }
                    }}
                    className={`transition-all duration-300 ${
                      swappedView && isLocalCameraOn && isRemoteCameraOn
                        ? "absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 h-36 w-28 sm:h-32 sm:w-52 rounded-2xl border-2 border-white/25 bg-black shadow-2xl object-cover cursor-pointer"
                        : `h-full w-full ${
                            videoFit === "contain" ? "object-contain" : "object-cover"
                          } bg-slate-950 ${isRemoteCameraOn ? "opacity-100" : "opacity-0"}`
                    }`}
                    onClick={() => {
                      if (swappedView && isLocalCameraOn && isRemoteCameraOn) {
                        setSwappedView(false);
                      }
                    }}
                  />

                  {/* Fallback Avatar Card in Main Stage when remote user's camera is OFF */}
                  {!isRemoteCameraOn && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/95">
                      <div className="relative mb-4">
                        <div className="absolute -inset-4 animate-ping rounded-full bg-emerald-500/15" />
                        <UserAvatar
                          src={activeCall.targetUser.avatar}
                          name={activeCall.targetUser.name}
                          sizeClass="h-24 w-24 text-3xl sm:h-28 sm:w-28 sm:text-4xl"
                          className="relative ring-4 ring-white/20 shadow-2xl"
                        />
                      </div>
                      <p className="text-base sm:text-lg font-bold text-white">
                        {activeCall.targetUser.name}
                      </p>
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-300 flex items-center justify-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                          {activeCall.status === "CONNECTED"
                            ? nativeLanguage === "vi"
                              ? "Camera đối phương đang tắt"
                              : "Remote camera is off"
                            : connectionStatus}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Remote caller name pill on bottom-left when remote video is active */}
                  {isRemoteCameraOn && !swappedView && (
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 inline-flex items-center gap-2 rounded-xl bg-black/65 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md border border-white/10">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{activeCall.targetUser.name}</span>
                      {isRemoteMicMuted && <span className="text-amber-400">🔇</span>}
                    </div>
                  )}

                  {/* LOCAL VIDEO PiP (Picture-in-Picture)
                      - Responsive aspect ratio: Portrait on Mobile (w-28 h-40), Landscape 16:9 on Laptop (sm:w-52 sm:h-32)
                      - Strictly bound to `isLocalCameraOn` so remote user opening video NEVER corrupts local UI */}
                  <div
                    onClick={() => {
                      if (isLocalCameraOn && isRemoteCameraOn) {
                        setSwappedView((prev) => !prev);
                      }
                    }}
                    className={
                      swappedView && isLocalCameraOn && isRemoteCameraOn
                        ? "absolute inset-0 z-10 flex items-center justify-center bg-slate-950"
                        : `absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 transition-all duration-300 ${
                            isLocalCameraOn
                              ? "h-40 w-28 sm:h-32 sm:w-52 lg:h-36 lg:w-60 overflow-hidden rounded-2xl border-2 border-white/25 bg-black/90 shadow-2xl hover:border-emerald-400/70 cursor-pointer"
                              : "pointer-events-auto"
                          }`
                    }
                    title={
                      isLocalCameraOn && isRemoteCameraOn
                        ? nativeLanguage === "vi"
                          ? "Nhấn để đổi vị trí khung hình lớn / nhỏ"
                          : "Click to swap video views"
                        : undefined
                    }
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`${
                        swappedView && isLocalCameraOn && isRemoteCameraOn
                          ? `h-full w-full ${
                              videoFit === "contain" ? "object-contain" : "object-cover"
                            }`
                          : "h-full w-full object-cover"
                      } ${facingMode === "user" ? "scale-x-[-1]" : ""} ${
                        isLocalCameraOn ? "block opacity-100" : "hidden opacity-0"
                      }`}
                    />

                    {isLocalCameraOn ? (
                      <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                          {nativeLanguage === "vi" ? "Bạn" : "You"}
                          {micMuted ? " 🔇" : ""}
                        </span>
                        {isRemoteCameraOn && (
                          <span className="rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] text-white/80">
                            ⇄
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Compact, professional pill when our own camera is off while viewing remote video */
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCamera();
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-900/85 px-3.5 py-2 text-xs font-bold text-white/90 shadow-xl backdrop-blur-md transition hover:border-emerald-400/50 hover:bg-slate-800 active:scale-95"
                      >
                        <span>📷</span>
                        <span>
                          {nativeLanguage === "vi"
                            ? "Camera bạn đang tắt • Bật"
                            : "Your camera is off • Turn on"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* AUDIO CALL STAGE - Elegant Modern Voice Experience when both cameras are off */}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300 ease-in-out ${
                  !showVideoStage
                    ? "opacity-100 z-10 pointer-events-auto"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
              >
                <div className="relative mb-7 flex items-center justify-center">
                  {/* Concentric glowing animated wave ripples */}
                  <div className="absolute h-44 w-44 sm:h-56 sm:w-56 animate-ping rounded-full bg-red-600/10" />
                  <div className="absolute h-32 w-32 sm:h-44 sm:w-44 animate-pulse rounded-full bg-red-600/20" />
                  <UserAvatar
                    src={activeCall.targetUser.avatar}
                    name={activeCall.targetUser.name}
                    sizeClass="h-24 w-24 text-3xl sm:h-36 sm:w-36 sm:text-4xl"
                    className="relative shadow-2xl ring-4 ring-white/20 transition-transform duration-300 hover:scale-105"
                  />
                </div>

                <h2 className="text-xl font-black text-white sm:text-2xl tracking-tight">
                  {activeCall.targetUser.name}
                </h2>
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
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 p-6 text-center backdrop-blur-md animate-spring-up">
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

            {/* Bottom Controls Dock - Strictly bound to THIS user's own mic & camera state */}
            <div
              className="z-20 flex shrink-0 items-center justify-center gap-3 sm:gap-5 border-t border-white/10 bg-sumi-900/95 px-4 py-3.5 backdrop-blur-xl sm:py-4"
              style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
            >
              {/* Mic Toggle (Strictly local mic) */}
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={!micMuted}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-bold transition active:scale-95 min-w-[68px] sm:min-w-[84px] ${
                  micMuted
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                }`}
                title={micMuted ? s.unmuteMic : s.muteMic}
              >
                <span className="text-lg leading-none">{micMuted ? "🔇" : "🎙️"}</span>
                <span className="text-[10px] sm:text-[11px] leading-tight">
                  {micMuted
                    ? nativeLanguage === "vi"
                      ? "Bật mic"
                      : "Unmute"
                    : nativeLanguage === "vi"
                      ? "Tắt mic"
                      : "Mute"}
                </span>
              </button>

              {/* Camera Toggle Button (Strictly THIS user's `isLocalCameraOn` — NEVER changes when remote user opens camera!) */}
              <button
                type="button"
                onClick={handleToggleCamera}
                aria-pressed={isLocalCameraOn}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-bold transition active:scale-95 min-w-[76px] sm:min-w-[92px] ${
                  isLocalCameraOn
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/35"
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                }`}
                title={isLocalCameraOn ? s.cameraOff : s.cameraOn}
              >
                <span className="text-lg leading-none">{isLocalCameraOn ? "📹" : "📷"}</span>
                <span className="text-[10px] sm:text-[11px] leading-tight">
                  {isLocalCameraOn
                    ? nativeLanguage === "vi"
                      ? "Tắt video"
                      : "Stop Video"
                    : nativeLanguage === "vi"
                      ? "Mở video"
                      : "Start Video"}
                </span>
              </button>

              {/* Flip camera between front & back (Strictly shown ONLY when THIS user's camera is on) */}
              {isLocalCameraOn && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95 sm:hidden min-w-[68px]"
                  title={s.flipCamera}
                >
                  <span className="text-lg leading-none">🔄</span>
                  <span className="text-[10px] leading-tight">
                    {nativeLanguage === "vi" ? "Lật cam" : "Flip"}
                  </span>
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={() => onEndCall(activeCall.callId)}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-red-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-xl transition hover:bg-red-700 active:scale-95 min-w-[72px] sm:min-w-[88px]"
                title={s.endCall}
              >
                <span className="text-lg leading-none">📞</span>
                <span className="text-[10px] sm:text-[11px] leading-tight">
                  {nativeLanguage === "vi" ? "Kết thúc" : "End"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
