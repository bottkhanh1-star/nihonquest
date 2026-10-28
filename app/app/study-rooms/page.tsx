"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { GroupCallModal, type GroupRoomData } from "@/components/social/GroupCallModal";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";

const LEVEL_TABS = ["ALL", "N5", "N4", "N3", "N2", "N1"] as const;

export default function StudyRoomsPage() {
  const { playClick, showToast } = useSoundAndTheme();

  const [rooms, setRooms] = useState<GroupRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [activeRoom, setActiveRoom] = useState<GroupRoomData | null>(null);

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomLevel, setNewRoomLevel] = useState("N5");
  const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
  const [newRoomPin, setNewRoomPin] = useState("");
  const [creating, setCreating] = useState(false);

  // Join by code state
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);

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

  // Join an existing room
  const handleJoinRoom = async (roomCode: string, pinRequired = false) => {
    playClick();
    let pinCode: string | null = null;
    if (pinRequired) {
      pinCode = prompt("Phòng này yêu cầu mã PIN để vào. Nhập mã PIN:");
      if (!pinCode) return;
    }

    try {
      const res = await fetch(`/api/study-rooms/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", pinCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Không thể vào phòng học");
        return;
      }

      setActiveRoom(data.room);
    } catch {
      alert("Lỗi khi kết nối phòng học");
    }
  };

  // Join by custom code input
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setJoiningCode(true);
    await handleJoinRoom(code);
    setJoiningCode(false);
  };

  // Create new room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Join immediately
      await handleJoinRoom(data.room.code);
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
              🎙️ WebRTC Mesh Call • 2–6 Người
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Phòng Học Kaiwa Nhóm
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Luyện nói tiếng Nhật cùng bạn bè, chia sẻ màn hình làm đề JLPT, xem bảng từ vựng và
              trao đổi ghi chú trực tiếp hoàn toàn miễn phí.
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
                  {joiningCode ? "Đang vào..." : "Vào phòng"}
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
                Hãy là người đầu tiên tạo phòng luyện nói Kaiwa để mời bạn bè cùng vào học nhé!
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
                const memberCount = room.participants.length;
                const isFull = memberCount >= room.maxMembers;

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

                      {/* Participant Avatars */}
                      <div className="mt-4 flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 mr-1">Thành viên:</span>
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
                        <span className="text-xs font-bold text-slate-300 ml-2">
                          {memberCount}/{room.maxMembers}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đang hoạt động
                      </span>

                      <button
                        type="button"
                        disabled={isFull}
                        onClick={() => handleJoinRoom(room.code, room.isPrivate)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs active:scale-95 ${
                          isFull
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        {isFull ? "Đã đầy" : "Tham gia phòng →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#161d24] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">➕ Tạo Phòng Học Kaiwa Mới</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4 text-xs">
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

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 font-bold text-slate-400 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-red-600 px-5 py-2 font-extrabold text-white hover:bg-red-700 active:scale-95 disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Tạo & Vào phòng ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Call Modal Overlay */}
      {activeRoom && (
        <GroupCallModal
          roomCode={activeRoom.code}
          initialRoom={activeRoom}
          onLeave={() => {
            setActiveRoom(null);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
}

