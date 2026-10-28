"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupCallModal, type GroupRoomData } from "@/components/social/GroupCallModal";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";

const LEVEL_TABS = ["ALL", "N5", "N4", "N3", "N2", "N1"] as const;

function StudyRoomsInner() {
  const { playClick, showToast } = useSoundAndTheme();
  const searchParams = useSearchParams();
  const urlRoomCode =
    searchParams.get("room") ||
    searchParams.get("roomCode") ||
    searchParams.get("roomcode") ||
    searchParams.get("code");

  const [rooms, setRooms] = useState<GroupRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [activeRoom, setActiveRoom] = useState<GroupRoomData | null>(null);

  // Pre-join Lobby State
  const [lobbyRoom, setLobbyRoom] = useState<GroupRoomData | null>(null);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewVideoOff, setPreviewVideoOff] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0); // 0-100%
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomLevel, setNewRoomLevel] = useState("N5");
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [newRoomPin, setNewRoomPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdRoomNotice, setCreatedRoomNotice] = useState<GroupRoomData | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [hasAutoLoadedUrlRoom, setHasAutoLoadedUrlRoom] = useState(false);

  // Join by code state
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);

  const getRoomInviteUrl = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://nihonquest.netlify.app";
    return `${origin}/app/study-rooms?room=${encodeURIComponent(code)}`;
  };

  const copyRoomInviteUrl = (code: string) => {
    const url = getRoomInviteUrl(code);
    navigator.clipboard.writeText(url);
    setCopiedLinkId(code);
    setTimeout(() => setCopiedLinkId(null), 2000);
    showToast({
      title: "Đã sao chép link mời! 🔗",
      description: "Gửi link này cho bạn bè. Bạn bè bấm vào link sẽ được vào phòng ngay.",
      type: "info",
    });
  };

  const copyRoomCodeOnly = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(code);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Fetch active rooms (rooms stay alive for 3 days)
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/study-rooms?level=${selectedLevel}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedLevel]);

  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 4000);
    return () => clearInterval(timer);
  }, [fetchRooms]);

  // Auto-lookup and open pre-join lobby when visiting with ?room=CODE or ?roomCode=CODE
  useEffect(() => {
    if (!urlRoomCode || hasAutoLoadedUrlRoom) return;
    setHasAutoLoadedUrlRoom(true);

    const cleanCode = urlRoomCode.trim().toUpperCase();
    fetch(`/api/study-rooms/${cleanCode}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) {
          openLobbyForRoom(data.room);
          showToast({
            title: "🔗 Đã nhận liên kết phòng học!",
            description: `Vui lòng kiểm tra camera & micro trước khi vào "${data.room.name}"`,
            type: "info",
          });
        } else {
          showToast({
            title: "Phòng học không tồn tại",
            description: data.error || "Mã phòng không hợp lệ hoặc phòng đã hết hạn sau 3 ngày.",
            type: "error",
          });
        }
      })
      .catch(() => {});
  }, [urlRoomCode, hasAutoLoadedUrlRoom, showToast]);

  // Setup device preview when lobby room is active
  useEffect(() => {
    if (!lobbyRoom) return;

    let localStream: MediaStream | null = null;

    async function initPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        localStream = stream;
        previewStreamRef.current = stream;

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }

        // Setup live audio meter
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVolume = () => {
            if (!audioContextRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioVolume(Math.min(Math.round((avg / 128) * 100), 100));
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };

          updateVolume();
        } catch {
          // ignore audio context limitations
        }
      } catch (err) {
        console.warn("Could not acquire video for preview, trying audio only:", err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStream = audioStream;
          previewStreamRef.current = audioStream;
          setPreviewVideoOff(true);
        } catch (audioErr) {
          console.error("Audio preview failed:", audioErr);
        }
      }
    }

    initPreview();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [lobbyRoom]);

  // Toggle preview mic
  const togglePreviewMic = () => {
    if (previewStreamRef.current) {
      const audioTrack = previewStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setPreviewMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle preview camera
  const togglePreviewVideo = () => {
    if (previewStreamRef.current) {
      const videoTrack = previewStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setPreviewVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Click on a room card -> opens Lobby preview first
  const openLobbyForRoom = (room: GroupRoomData) => {
    playClick();
    setPreviewMuted(false);
    setPreviewVideoOff(false);
    setLobbyRoom(room);
  };

  // Confirm Join from Lobby into full GroupCallModal
  const confirmJoinFromLobby = async () => {
    if (!lobbyRoom) return;
    playClick();

    let pinCode: string | null = null;
    if (lobbyRoom.isPrivate) {
      pinCode = prompt("Phòng này yêu cầu mã PIN để vào. Nhập mã PIN:");
      if (!pinCode) return;
    }

    try {
      const res = await fetch(`/api/study-rooms/${lobbyRoom.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          pinCode,
          isAudioMuted: previewMuted,
          isVideoOff: previewVideoOff,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể vào phòng học");
        return;
      }

      // Stop lobby preview stream before switching to call modal
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }

      const joinedRoom = data.room || lobbyRoom;
      setLobbyRoom(null);
      setActiveRoom(joinedRoom);
    } catch {
      alert("Lỗi khi kết nối phòng học");
    }
  };

  // Cancel Lobby
  const cancelLobby = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    setLobbyRoom(null);
  };

  // Join by custom code input
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setJoiningCode(true);

    try {
      const res = await fetch(`/api/study-rooms/${code}`);
      const data = await res.json();
      if (!res.ok || !data.room) {
        alert(data.error || "Không tìm thấy phòng học với mã này");
        setJoiningCode(false);
        return;
      }
      openLobbyForRoom(data.room);
    } catch {
      alert("Lỗi khi tra cứu mã phòng");
    } finally {
      setJoiningCode(false);
    }
  };

  // Create Room: Mode = "immediate" (vào ngay) or "later" (tạo trước dùng sau)
  const handleCreateRoom = async (mode: "immediate" | "later") => {
    setCreating(true);
    try {
      const res = await fetch("/api/study-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName || `Phòng học Kaiwa ${newRoomLevel}`,
          levelTag: newRoomLevel,
          isPrivate: newRoomIsPrivate,
          pinCode: newRoomIsPrivate ? newRoomPin : null,
          maxMembers: 6,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể tạo phòng");
        setCreating(false);
        return;
      }

      setShowCreateModal(false);
      setNewRoomName("");
      setNewRoomPin("");
      fetchRooms();

      if (mode === "immediate") {
        openLobbyForRoom(data.room);
      } else {
        setCreatedRoomNotice(data.room);
      }
    } catch {
      alert("Lỗi khi tạo phòng");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#f8f6f1]">
      <AppNav />

      {/* Main Content Area */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/40 via-sumi-900 to-[#161d24] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 border border-red-500/30 mb-3">
              🎙️ WebRTC Mesh Call • 2–6 Người • Hiệu lực 3 ngày
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Phòng Học Kaiwa Nhóm
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Tạo phòng học trống để sẵn, lưu lại trong 3 ngày hoặc vào học ngay cùng bạn bè.
              Có phòng chờ kiểm tra mic/camera, chia sẻ màn hình làm đề JLPT và khung chat tiếng Nhật.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-red-700 active:scale-95"
              >
                <span>➕</span>
                <span>Tạo phòng học mới</span>
              </button>

              {/* Join By Code Form */}
              <form onSubmit={handleJoinByCode} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Nhập mã phòng (vd: KAIWA-N5-88)..."
                  className="rounded-2xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={joiningCode || !joinCodeInput.trim()}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
                >
                  {joiningCode ? "Đang tìm..." : "Kiểm tra & Vào"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Level Filter Tabs */}
        <div className="mt-8 flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {LEVEL_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedLevel(tab);
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  selectedLevel === tab
                    ? "bg-red-600 text-white shadow-md"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab === "ALL" ? "Tất cả trình độ" : tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchRooms}
            className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            <span>🔄</span> Làm mới
          </button>
        </div>

        {/* Rooms Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">
              Đang tải danh sách phòng học...
            </div>
          ) : rooms.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center">
              <span className="text-4xl">⛩️</span>
              <h3 className="mt-3 text-base font-bold text-white">Chưa có phòng học nào mở</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Bạn có thể tạo trước phòng học trống (lưu trong 3 ngày) để gửi mã cho bạn bè vào cùng lúc!
              </p>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setShowCreateModal(true);
                }}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Tạo phòng ngay
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => {
                const memberCount = (room.participants || []).length;
                const isFull = memberCount >= room.maxMembers;
                const isVacant = memberCount === 0;

                return (
                  <div
                    key={room.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#161d24] p-5 shadow-lg transition hover:border-slate-700 hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-extrabold text-red-400 border border-red-500/20">
                          {room.levelTag}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Mã: <b className="text-amber-400">{room.code}</b>
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-extrabold text-white line-clamp-1">
                        {room.name}
                      </h3>

                      {/* Host Info */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <UserAvatar
                          src={room.host?.profile?.avatar || room.host?.image}
                          name={room.host?.profile?.displayName || room.host?.name || "Bạn học"}
                          sizeClass="h-5 w-5 text-[10px]"
                        />
                        <span className="truncate">
                          Tạo bởi: {room.host?.profile?.displayName || room.host?.name || "Bạn học"}
                        </span>
                      </div>

                      {/* Participant Avatars & Room Status */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isVacant ? (
                            <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-400 font-medium">
                              Phòng đang trống (Sẵn sàng vào)
                            </span>
                          ) : (
                            <>
                              <div className="flex -space-x-2">
                                {(room.participants || []).slice(0, 4).map((p) => (
                                  <UserAvatar
                                    key={p.userId}
                                    src={p.user?.profile?.avatar || p.user?.image}
                                    name={p.user?.profile?.displayName || p.user?.name || "Bạn học"}
                                    sizeClass="h-7 w-7 text-xs ring-2 ring-[#161d24]"
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-bold text-slate-300 ml-1.5">
                                {memberCount}/{room.maxMembers}
                              </span>
                            </>
                          )}
                        </div>

                        <span className="text-[10px] text-amber-500/90 font-medium">
                          ⏳ Hiệu lực 3 ngày
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Hoạt động
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyRoomInviteUrl(room.code)}
                          className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                          title="Sao chép link mời phòng học"
                        >
                          {copiedLinkId === room.code ? "✓ Đã chép" : "🔗 Link"}
                        </button>
                        <button
                          type="button"
                          disabled={isFull}
                          onClick={() => openLobbyForRoom(room)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs active:scale-95 ${
                            isFull
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                        >
                          {isFull ? "Đã đầy" : "Kiểm tra & Vào phòng →"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Pre-Join Green Room / Device Check Lobby Modal */}
      {lobbyRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#161d24] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-white">🎙️ Phòng Chờ Tham Gia</h3>
                <p className="text-xs text-slate-400">Kiểm tra camera & micro trước khi vào phòng học</p>
              </div>
              <button
                type="button"
                onClick={cancelLobby}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Camera Preview Box */}
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-700 bg-black">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${previewVideoOff ? "hidden" : ""}`}
              />

              {previewVideoOff && (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <span className="text-4xl">📷⃠</span>
                  <span className="text-xs font-bold">Camera đang tắt</span>
                </div>
              )}

              {/* Status Pill Over Video */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      previewMuted ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  <span>{previewMuted ? "Mic tắt" : "Mic bật"}</span>
                </span>
                <span>•</span>
                <span>{previewVideoOff ? "Cam tắt" : "Cam bật"}</span>
              </div>
            </div>

            {/* Mic Audio Soundwave Meter */}
            <div className="mt-3 rounded-xl bg-slate-900/80 p-2.5 border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                <span>Âm lượng Micro:</span>
                <span className={previewMuted ? "text-red-400" : audioVolume > 10 ? "text-emerald-400" : "text-slate-400"}>
                  {previewMuted ? "Đang tắt" : audioVolume > 10 ? "Đang thu tiếng tốt" : "Nói để kiểm tra mic..."}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-75"
                  style={{ width: `${previewMuted ? 0 : audioVolume}%` }}
                />
              </div>
            </div>

            {/* Device Control Toggles */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={togglePreviewMic}
                className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-extrabold transition shadow-md ${
                  previewMuted
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <span>{previewMuted ? "🔇" : "🎙️"}</span>
                <span>{previewMuted ? "Bật Mic" : "Tắt Mic"}</span>
              </button>

              <button
                type="button"
                onClick={togglePreviewVideo}
                className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-extrabold transition shadow-md ${
                  previewVideoOff
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <span>{previewVideoOff ? "📷⃠" : "📹"}</span>
                <span>{previewVideoOff ? "Bật Camera" : "Tắt Camera"}</span>
              </button>
            </div>

            {/* Room Info & Join Actions */}
            <div className="mt-6 border-t border-slate-800 pt-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-white truncate max-w-[200px]">
                  {lobbyRoom.name}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Mã: <b className="text-amber-400">{lobbyRoom.code}</b></span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => copyRoomInviteUrl(lobbyRoom.code)}
                    className="text-xs font-bold text-red-400 hover:text-red-300 underline"
                  >
                    {copiedLinkId === lobbyRoom.code ? "✓ Đã chép link" : "🔗 Sao chép Link mời"}
                  </button>
                  <span>•</span>
                  <span>{(lobbyRoom.participants || []).length} người</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelLobby}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={confirmJoinFromLobby}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg transition hover:bg-red-700 active:scale-95"
                >
                  Tham gia phòng ngay 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#161d24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">➕ Tạo Phòng Học Kaiwa Mới</h3>
                <p className="text-[11px] text-slate-400">Phòng sẽ tự động lưu và có hiệu lực trong 3 ngày</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên phòng học:</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ví dụ: Luyện Kaiwa đề thi N5, Phòng giao tiếp Shinjuku..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Trình độ tiếng Nhật:</label>
                <select
                  value={newRoomLevel}
                  onChange={(e) => setNewRoomLevel(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="ALL">Mọi trình độ (Tự do)</option>
                  <option value="N5">JLPT N5 (Sơ cấp 1)</option>
                  <option value="N4">JLPT N4 (Sơ cấp 2)</option>
                  <option value="N3">JLPT N3 (Trung cấp)</option>
                  <option value="N2">JLPT N2 (Trung cao cấp)</option>
                  <option value="N1">JLPT N1 (Cao cấp)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private-check"
                  checked={newRoomIsPrivate}
                  onChange={(e) => setNewRoomIsPrivate(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <label htmlFor="private-check" className="font-bold text-slate-300">
                  Phòng riêng tư (chỉ người có mã PIN mới vào được)
                </label>
              </div>

              {newRoomIsPrivate && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Mã PIN phòng:</label>
                  <input
                    type="text"
                    required
                    value={newRoomPin}
                    onChange={(e) => setNewRoomPin(e.target.value)}
                    placeholder="Nhập 4-6 số PIN..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 font-mono"
                  />
                </div>
              )}

              <div className="rounded-xl bg-slate-900/60 p-3 border border-slate-800 text-[11px] text-slate-300">
                💡 <b>Thời hạn phòng:</b> Phòng có hiệu lực <b>3 ngày</b> kể từ khi tạo. Bạn có thể tạo trước để lấy mã gửi bạn bè hoặc vào học ngay bây giờ.
              </div>

              {/* Action Choices */}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => handleCreateRoom("later")}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-bold text-slate-200 hover:bg-slate-700 transition"
                >
                  {creating ? "Đang tạo..." : "📋 Tạo trước (Dùng trong 3 ngày)"}
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => handleCreateRoom("immediate")}
                  className="rounded-xl bg-red-600 px-5 py-2.5 font-extrabold text-white hover:bg-red-700 active:scale-95 disabled:opacity-50 transition"
                >
                  {creating ? "Đang tạo..." : "🚀 Tạo & Vào phòng ngay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Created Room For Later Success Modal */}
      {createdRoomNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-[#161d24] p-6 text-center shadow-2xl">
            <span className="text-4xl">🎉</span>
            <h3 className="mt-3 text-base font-extrabold text-white">Đã Tạo Phòng Thành Công!</h3>
            <p className="mt-1 text-xs text-slate-300">
              Phòng đã được mở và sẽ được giữ trống trong <b>3 ngày</b> tới để bạn và bạn bè có thể vào học bất cứ lúc nào.
            </p>

            <div className="my-4 rounded-2xl bg-slate-900 p-3.5 border border-slate-800 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400">Mã phòng:</span>
                <span className="text-base font-black font-mono text-amber-400 tracking-wider">
                  {createdRoomNotice.code}
                </span>
              </div>

              <span className="text-[11px] font-bold text-slate-400 block mb-1">Link mời trực tiếp:</span>
              <div className="truncate rounded-xl bg-slate-950 p-2 text-[11px] font-mono text-slate-300 border border-slate-800 select-all">
                {getRoomInviteUrl(createdRoomNotice.code)}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => copyRoomInviteUrl(createdRoomNotice.code)}
                className="w-full rounded-xl bg-red-600 py-2.5 text-xs font-extrabold text-white hover:bg-red-700 shadow-md transition"
              >
                {copiedLinkId === createdRoomNotice.code ? "✓ Đã sao chép Link mời" : "🔗 Sao chép Link mời bạn bè"}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyRoomCodeOnly(createdRoomNotice.code)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                >
                  {copiedCodeId === createdRoomNotice.code ? "✓ Đã sao chép mã" : "📋 Sao chép mã"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = createdRoomNotice;
                    setCreatedRoomNotice(null);
                    openLobbyForRoom(target);
                  }}
                  className="flex-1 rounded-xl border border-emerald-600 bg-emerald-600/20 py-2.5 text-xs font-extrabold text-emerald-400 hover:bg-emerald-600/30 transition"
                >
                  Vào phòng ngay
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCreatedRoomNotice(null)}
              className="mt-3 text-xs text-slate-500 hover:text-slate-400"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}

      {/* Active Call Modal Overlay */}
      {activeRoom && (
        <GroupCallModal
          roomCode={activeRoom.code}
          initialRoom={activeRoom}
          initialMuted={previewMuted}
          initialVideoOff={previewVideoOff}
          onLeave={() => {
            setActiveRoom(null);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
}

export default function StudyRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f1419] flex items-center justify-center text-slate-400 text-sm font-bold">
          Đang tải danh sách phòng học...
        </div>
      }
    >
      <StudyRoomsInner />
    </Suspense>
  );
}
