"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserProgress } from "@/components/UserProgressContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation, QUICK_KAIWA_TEMPLATES } from "@/lib/socialI18n";

interface FriendUser {
  friendshipId: string;
  userId: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  learningLevel?: string;
  currentStreak?: number;
  totalXP?: number;
  status?: string;
}

interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachmentType?: string | null;
  attachmentData?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface SearchUserResult {
  id: string;
  name: string;
  avatar?: string | null;
  learningLevel?: string;
  currentStreak?: number;
  totalXP?: number;
  friendshipStatus: "NONE" | "PENDING" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED";
  friendshipId?: string;
}

function VoiceMessagePlayer({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((e) => console.warn("Audio playback error:", e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatSec = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`my-1 flex items-center gap-2.5 rounded-2xl px-3 py-2 min-w-[210px] sm:min-w-[260px] ${
        isMe
          ? "bg-red-700/60 text-white border border-red-500/30"
          : "bg-slate-100 text-slate-900 dark:bg-sumi-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700"
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-md transition active:scale-90 ${
          isMe
            ? "bg-white text-red-600 hover:bg-red-50"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
        title={isPlaying ? "Tạm dừng" : "Phát"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <div className="flex flex-1 flex-col justify-center">
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-red-500 bg-white/40 dark:bg-sumi-600"
        />
        <div className="mt-1 flex items-center justify-between font-mono text-[10px] opacity-80">
          <span>{formatSec(currentTime)}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {duration ? formatSec(duration) : "0:00"}
          </span>
        </div>
      </div>
    </div>
  );
}

function FileAttachmentBubble({
  data,
  isMe,
  downloadLabel,
}: {
  data: string;
  isMe: boolean;
  downloadLabel: string;
}) {
  let fileInfo: { name: string; size?: number; url: string; mime?: string } | null = null;
  try {
    fileInfo = JSON.parse(data);
  } catch {
    fileInfo = { name: "Tệp đính kèm", url: data };
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`my-1 flex items-center gap-3 rounded-2xl p-2.5 max-w-sm border ${
        isMe
          ? "bg-red-700/60 text-white border-red-500/40 shadow-xs"
          : "bg-slate-100 text-slate-800 dark:bg-sumi-800 dark:text-slate-100 border-slate-200/80 dark:border-slate-700 shadow-xs"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 dark:bg-white/10 text-xl shadow-inner">
        📄
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold leading-tight">{fileInfo?.name || "Tệp đính kèm"}</p>
        {fileInfo?.size && (
          <p className="mt-0.5 text-[10px] opacity-75 font-mono">{formatSize(fileInfo.size)}</p>
        )}
      </div>
      <a
        href={fileInfo?.url}
        download={fileInfo?.name || "download"}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex h-8 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold shadow-sm transition active:scale-95 ${
          isMe
            ? "bg-white text-red-600 hover:bg-red-50"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        <span>⬇</span>
        <span className="hidden sm:inline">{downloadLabel}</span>
      </a>
    </div>
  );
}

function MessagesAndFriendsContent() {
  const { nativeLanguage } = useNativeLanguage();
  const s = getSocialTranslation(nativeLanguage);
  const quickPhrases = QUICK_KAIWA_TEMPLATES[nativeLanguage] || QUICK_KAIWA_TEMPLATES.vi;

  const { progress } = useUserProgress();
  const { playClick, showToast } = useSoundAndTheme();
  const { startCall, refreshUnreadCount } = useGlobalCall();
  const searchParams = useSearchParams();
  const initialFriendId = searchParams.get("friendId");
  const initialTab = searchParams.get("tab");

  // Navigation tab for sidebar
  const [activeTab, setActiveTab] = useState<"CHATS" | "FRIENDS" | "REQUESTS" | "FIND">(() => {
    if (
      initialTab === "REQUESTS" ||
      initialTab === "FRIENDS" ||
      initialTab === "FIND" ||
      initialTab === "CHATS"
    ) {
      return initialTab;
    }
    return "CHATS";
  });

  useEffect(() => {
    if (
      initialTab === "REQUESTS" ||
      initialTab === "FRIENDS" ||
      initialTab === "FIND" ||
      initialTab === "CHATS"
    ) {
      setActiveTab(initialTab);
      if (initialTab !== "CHATS") {
        setSelectedFriend(null);
      }
    }
  }, [initialTab]);

  // Friends & Requests state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [suggestedLearners, setSuggestedLearners] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Active chat state
  const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // File Attachment state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    name: string;
    size: number;
    type: "IMAGE" | "FILE";
    dataUrl: string;
  } | null>(null);

  // Lightbox Modal state for full-res images
  const [activeImagePreview, setActiveImagePreview] = useState<string | null>(null);

  // Load friends list
  const loadFriendsData = async () => {
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        setIncomingRequests(data.incomingRequests || []);
        setOutgoingRequests(data.outgoingRequests || []);
        setSuggestedLearners(data.suggestedLearners || []);

        // If friendId in URL, select that friend automatically
        if (initialFriendId && !selectedFriend) {
          const match = data.friends?.find((f: FriendUser) => f.userId === initialFriendId);
          if (match) setSelectedFriend(match);
        }
      }
    } catch (e) {
      console.error("Load friends err:", e);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriendsData();
  }, [initialFriendId]);

  // Load messages for selected friend
  useEffect(() => {
    if (!selectedFriend) return;

    let isMounted = true;

    async function fetchThread() {
      try {
        setLoadingMessages(true);
        const res = await fetch(`/api/messages?friendId=${selectedFriend?.userId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setMessages(data.messages || []);
          refreshUnreadCount();
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }

    fetchThread();

    // Polling for new messages in current chat
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?friendId=${selectedFriend.userId}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedFriend?.userId, refreshUnreadCount]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Search users
  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const res = await fetch(`/api/friends?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.searchResults || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Friend actions
  const handleFriendAction = async (
    action: "request" | "accept" | "reject" | "cancel" | "unfriend",
    targetUserId?: string,
    friendshipId?: string
  ) => {
    try {
      playClick();
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetUserId, friendshipId }),
      });

      if (res.ok) {
        await loadFriendsData();
        if (action === "accept") {
          showToast({ title: s.accept, description: s.tabFriends, type: "success" });
        } else if (action === "request") {
          showToast({ title: s.requestSent, description: s.addFriend, type: "success" });
        } else if (action === "unfriend") {
          if (selectedFriend?.userId === targetUserId) {
            setSelectedFriend(null);
          }
          showToast({ title: s.unfriend, description: s.tabFriends, type: "info" });
        }
      }
    } catch {
      showToast({ title: "Error", description: "Network error", type: "error" });
    }
  };

  // 1. Voice Chat Recording Handlers
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast({ title: "Error", description: "Trình duyệt không hỗ trợ ghi âm", type: "error" });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Audio recording error:", err);
      showToast({ title: "Microphone Error", description: s.callPermissionError, type: "error" });
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }

    recorder.onstop = async () => {
      // Release mic hardware tracks
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      }

      if (!shouldSend) {
        audioChunksRef.current = [];
        setIsRecording(false);
        return;
      }

      const mime = recorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      audioChunksRef.current = [];
      setIsRecording(false);

      if (audioBlob.size < 400) {
        // Discard trivial audio tap (< 0.5s)
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        await sendAttachmentMessage("AUDIO", dataUrl, "🎤 " + s.voiceMessage);
      };
      reader.readAsDataURL(audioBlob);
    };

    recorder.stop();
  };

  // 2. File & Image Attachment Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      showToast({ title: "File too big", description: s.fileTooBig, type: "error" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPendingAttachment({
        file,
        name: file.name,
        size: file.size,
        type: isImage ? "IMAGE" : "FILE",
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  // Direct Attachment Message Dispatcher
  const sendAttachmentMessage = async (
    attachmentType: "AUDIO" | "IMAGE" | "FILE",
    attachmentData: string,
    placeholderText: string
  ) => {
    if (!selectedFriend) return;

    const tempMsg: MessageItem = {
      id: "temp-" + Date.now(),
      senderId: progress?.userId || "",
      receiverId: selectedFriend.userId,
      content: placeholderText,
      attachmentType,
      attachmentData,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    playClick();

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedFriend.userId,
          content: placeholderText,
          attachmentType,
          attachmentData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? data.message : m)));
      } else {
        showToast({ title: "Error", description: "Failed to send message", type: "error" });
      }
    } catch {
      showToast({ title: "Error", description: "Network error", type: "error" });
    }
  };

  // Send Direct Message (Text with optional Pending Attachment)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) return;
    if (!inputMessage.trim() && !pendingAttachment) return;

    const content = inputMessage.trim();
    const attachment = pendingAttachment;
    setInputMessage("");
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const finalAttachmentType = attachment ? attachment.type : undefined;
    let finalAttachmentData: string | undefined = undefined;
    if (attachment) {
      if (attachment.type === "IMAGE") {
        finalAttachmentData = attachment.dataUrl;
      } else {
        finalAttachmentData = JSON.stringify({
          name: attachment.name,
          size: attachment.size,
          url: attachment.dataUrl,
          mime: attachment.file.type,
        });
      }
    }

    const finalContent =
      content ||
      (attachment?.type === "IMAGE"
        ? "📷 " + attachment.name
        : "📎 " + (attachment?.name || "Tệp đính kèm"));

    // Optimistic message append
    const tempMsg: MessageItem = {
      id: "temp-" + Date.now(),
      senderId: progress?.userId || "",
      receiverId: selectedFriend.userId,
      content: finalContent,
      attachmentType: finalAttachmentType,
      attachmentData: finalAttachmentData,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    playClick();

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedFriend.userId,
          content: finalContent,
          attachmentType: finalAttachmentType,
          attachmentData: finalAttachmentData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? data.message : m)));
      } else {
        showToast({ title: "Error", description: "Failed to send message", type: "error" });
      }
    } catch {
      showToast({ title: "Error", description: "Network error", type: "error" });
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-sumi-950 dark:text-slate-100">
      <AppNav />

      {/* Main Responsive Chat Layout: accounts for mobile/tablet bottom bar (< xl) */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-2 pt-3 pb-[calc(66px+env(safe-area-inset-bottom))] sm:px-4 md:px-6 xl:pb-4">
        <div className="flex h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-sumi-900">
          {/* =========================================================================
              LEFT COLUMN: Friends, Requests & Search
              ========================================================================= */}
          <div
            className={`flex h-full w-full flex-col border-r border-slate-200/80 md:w-80 lg:w-96 dark:border-slate-800 ${
              selectedFriend ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Header Tabs */}
            <div className="border-b border-slate-100 p-3 pb-2 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {s.messagesTitle}
                </h2>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  {friends.length} {s.tabFriends}
                </span>
              </div>

              {/* Sub-tabs */}
              <div className="mt-3 flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-sumi-800">
                <button
                  onClick={() => {
                    playClick();
                    setActiveTab("CHATS");
                  }}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                    activeTab === "CHATS"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-sumi-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  {s.tabFriends} ({friends.length})
                </button>
                <button
                  onClick={() => {
                    playClick();
                    setActiveTab("REQUESTS");
                  }}
                  className={`relative flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                    activeTab === "REQUESTS"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-sumi-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  {s.tabRequests}
                  {incomingRequests.length > 0 && (
                    <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white">
                      {incomingRequests.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    playClick();
                    setActiveTab("FIND");
                  }}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                    activeTab === "FIND"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-sumi-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  🔍 {s.tabFind}
                </button>
              </div>
            </div>

            {/* Content List inside Left Column */}
            <div className="flex-1 overflow-y-auto p-2">
              {/* TAB 1: FRIENDS LIST */}
              {activeTab === "CHATS" && (
                <div className="space-y-1">
                  {loadingFriends ? (
                    <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
                  ) : friends.length === 0 ? (
                    <div className="p-8 text-center">
                      <span className="text-3xl">🤝</span>
                      <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {s.friendsListEmpty}
                      </p>
                      <button
                        onClick={() => setActiveTab("FIND")}
                        className="mt-3 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                      >
                        {s.tabFind}
                      </button>
                    </div>
                  ) : (
                    friends.map((friend) => {
                      const isSelected = selectedFriend?.userId === friend.userId;
                      return (
                        <div
                          key={friend.userId}
                          onClick={() => {
                            playClick();
                            setSelectedFriend(friend);
                          }}
                          className={`group flex cursor-pointer items-center justify-between rounded-2xl p-2.5 transition ${
                            isSelected
                              ? "bg-red-50 dark:bg-red-950/40"
                              : "hover:bg-slate-100 dark:hover:bg-sumi-800"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <UserAvatar
                              src={friend.avatar}
                              name={friend.name}
                              sizeClass="h-10 w-10 text-sm"
                            />
                            <div className="min-w-0">
                              <p
                                className={`truncate text-sm font-bold ${
                                  isSelected
                                    ? "text-red-700 dark:text-red-300"
                                    : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {friend.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                {friend.learningLevel && (
                                  <span className="font-extrabold text-red-600 dark:text-red-400">
                                    {friend.learningLevel}
                                  </span>
                                )}
                                {friend.currentStreak && friend.currentStreak > 0 ? (
                                  <span>🔥 {friend.currentStreak}d</span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Quick call buttons on hover */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startCall(friend.userId, friend.name, friend.avatar, "AUDIO");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs transition hover:bg-emerald-100 hover:text-emerald-700 dark:bg-sumi-800 dark:hover:bg-emerald-950"
                              title={s.callVoice}
                            >
                              📞
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startCall(friend.userId, friend.name, friend.avatar, "VIDEO");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs transition hover:bg-emerald-100 hover:text-emerald-700 dark:bg-sumi-800 dark:hover:bg-emerald-950"
                              title={s.callVideo}
                            >
                              📹
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: REQUESTS */}
              {activeTab === "REQUESTS" && (
                <div className="space-y-4">
                  {/* Incoming */}
                  <div>
                    <h3 className="px-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      {s.tabRequests} ({incomingRequests.length})
                    </h3>
                    {incomingRequests.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-slate-400">{s.requestsEmpty}</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {incomingRequests.map((req) => (
                          <div
                            key={req.friendshipId}
                            className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-sumi-800/50"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserAvatar src={req.avatar} name={req.name} sizeClass="h-9 w-9 text-xs" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                  {req.name}
                                </p>
                                <span className="text-[10px] text-red-600 dark:text-red-400">
                                  {s.levelBadge} {req.learningLevel || "N5"}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleFriendAction("reject", undefined, req.friendshipId)}
                                className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              >
                                {s.reject}
                              </button>
                              <button
                                onClick={() => handleFriendAction("accept", undefined, req.friendshipId)}
                                className="rounded-xl bg-red-600 px-3.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-red-700"
                              >
                                {s.accept}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outgoing */}
                  {outgoingRequests.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                      <h3 className="px-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        {s.requestSent} ({outgoingRequests.length})
                      </h3>
                      <div className="mt-2 space-y-2">
                        {outgoingRequests.map((req) => (
                          <div
                            key={req.friendshipId}
                            className="flex items-center justify-between rounded-2xl bg-slate-50 p-2.5 dark:bg-sumi-800/40"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar src={req.avatar} name={req.name} sizeClass="h-8 w-8 text-xs" />
                              <span className="text-xs font-bold">{req.name}</span>
                            </div>
                            <button
                              onClick={() => handleFriendAction("cancel", undefined, req.friendshipId)}
                              className="text-[11px] font-bold text-slate-400 hover:text-red-600"
                            >
                              {s.cancelRequest}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FIND NEW FRIENDS */}
              {activeTab === "FIND" && (
                <div className="space-y-3">
                  <form onSubmit={handleSearchUsers} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={s.searchFriendsPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-sumi-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="rounded-2xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700"
                    >
                      {isSearching ? "..." : s.send}
                    </button>
                  </form>

                  {/* Search Results or Suggested Classmates */}
                  <div className="space-y-2">
                    {searchResults.length > 0 ? (
                      searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-sumi-800/40"
                        >
                          <div className="flex items-center gap-2.5">
                            <UserAvatar src={user.avatar} name={user.name} sizeClass="h-9 w-9 text-xs" />
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</p>
                              <span className="text-[10px] text-red-600 dark:text-red-400">
                                {s.levelBadge} {user.learningLevel || "N5"}
                              </span>
                            </div>
                          </div>

                          {user.friendshipStatus === "FRIENDS" ? (
                            <span className="text-[11px] font-bold text-emerald-600">✓ {s.tabFriends}</span>
                          ) : user.friendshipStatus === "REQUEST_SENT" ? (
                            <span className="text-[11px] font-semibold text-slate-400">{s.requestSent}</span>
                          ) : user.friendshipStatus === "REQUEST_RECEIVED" ? (
                            <button
                              onClick={() => handleFriendAction("accept", undefined, user.friendshipId)}
                              className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm"
                            >
                              {s.accept}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFriendAction("request", user.id)}
                              className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-red-600 dark:bg-white dark:text-slate-900"
                            >
                              + {s.addFriend}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="mt-2">
                        <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                          🌟 {s.suggestedFriends}
                        </p>
                        <div className="mt-2 space-y-2">
                          {suggestedLearners.length === 0 ? (
                            <p className="px-1 py-2 text-xs text-slate-400">
                              {s.requestsEmpty}
                            </p>
                          ) : (
                            suggestedLearners.map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-sumi-800/60"
                              >
                                <div className="flex items-center gap-2.5">
                                  <UserAvatar src={u.avatar} name={u.name} sizeClass="h-9 w-9 text-xs" />
                                  <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{u.name}</p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                      <span className="font-bold text-red-600 dark:text-red-400">{u.learningLevel || "N5"}</span>
                                      {u.currentStreak ? <span>• 🔥 {u.currentStreak}d</span> : null}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleFriendAction("request", u.id)}
                                  className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-600 dark:bg-white dark:text-slate-900"
                                >
                                  + {s.addFriend}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =========================================================================
              RIGHT COLUMN: Chat conversation & WebRTC Call Controls
              ========================================================================= */}
          <div
            className={`flex h-full flex-1 flex-col overflow-hidden bg-slate-50/50 dark:bg-sumi-950/30 ${
              selectedFriend ? "flex" : "hidden md:flex"
            }`}
          >
            {selectedFriend ? (
              <>
                {/* Chat Top Header */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-md dark:border-slate-800 dark:bg-sumi-900/90">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                    {/* Back button on mobile */}
                    <button
                      onClick={() => setSelectedFriend(null)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 md:hidden dark:bg-sumi-800 dark:text-slate-300"
                      title="Back"
                    >
                      ❮
                    </button>
                    <UserAvatar
                      src={selectedFriend.avatar}
                      name={selectedFriend.name}
                      sizeClass="h-9 w-9 sm:h-10 sm:w-10 text-sm shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {selectedFriend.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
                        <span className="font-extrabold text-red-600 dark:text-red-400">
                          {selectedFriend.learningLevel || "N5"}
                        </span>
                        <span>•</span>
                        <span className="truncate text-emerald-600 dark:text-emerald-400">✓ {s.tabFriends}</span>
                      </div>
                    </div>
                  </div>

                  {/* Call Actions */}
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() =>
                        startCall(
                          selectedFriend.userId,
                          selectedFriend.name,
                          selectedFriend.avatar,
                          "AUDIO"
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm transition hover:bg-emerald-100 hover:text-emerald-700 dark:bg-sumi-800 dark:hover:bg-emerald-950"
                      title={s.callVoice}
                    >
                      📞
                    </button>
                    <button
                      onClick={() =>
                        startCall(
                          selectedFriend.userId,
                          selectedFriend.name,
                          selectedFriend.avatar,
                          "VIDEO"
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm transition hover:bg-emerald-100 hover:text-emerald-700 dark:bg-sumi-800 dark:hover:bg-emerald-950"
                      title={s.callVideo}
                    >
                      📹
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(s.unfriendConfirm)) {
                          handleFriendAction("unfriend", selectedFriend.userId);
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-400 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-sumi-800"
                      title={s.unfriend}
                    >
                      👤❌
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="p-8 text-center text-xs text-slate-400">Loading...</div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                      <span className="text-4xl">💬</span>
                      <h4 className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                        {selectedFriend.name}
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        {s.startChatHint}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderId === progress?.userId;
                      const isAudio =
                        msg.attachmentType === "AUDIO" ||
                        (Boolean(msg.attachmentData) && msg.attachmentData!.startsWith("data:audio"));
                      const isImage =
                        msg.attachmentType === "IMAGE" ||
                        (Boolean(msg.attachmentData) && msg.attachmentData!.startsWith("data:image"));
                      const isFile = msg.attachmentType === "FILE";

                      // Hide placeholder caption if redundant with attachment display
                      const hideContent =
                        (isAudio && (msg.content.includes("Tin nhắn thoại") || msg.content.includes("Voice Message"))) ||
                        (isImage && (msg.content.includes("Hình ảnh") || msg.content.startsWith("📷 "))) ||
                        (isFile && (msg.content.includes("Tệp đính kèm") || msg.content.startsWith("📎 ")));

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2 animate-slide-in-up ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          {!isMe && (
                            <UserAvatar
                              src={selectedFriend.avatar}
                              name={selectedFriend.name}
                              sizeClass="h-7 w-7 text-[10px]"
                            />
                          )}
                          <div
                            className={`max-w-[85%] sm:max-w-md rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                              isMe
                                ? "bg-red-600 text-white rounded-br-none"
                                : "bg-white text-slate-800 dark:bg-sumi-800 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-800"
                            }`}
                          >
                            {/* 1. Voice Note Player */}
                            {isAudio && msg.attachmentData && (
                              <VoiceMessagePlayer src={msg.attachmentData} isMe={isMe} />
                            )}

                            {/* 2. Image Attachment */}
                            {isImage && msg.attachmentData && (
                              <div className="my-1 overflow-hidden rounded-xl">
                                <img
                                  src={msg.attachmentData}
                                  alt="attachment"
                                  onClick={() => setActiveImagePreview(msg.attachmentData!)}
                                  className="max-h-60 w-full cursor-zoom-in rounded-xl object-cover transition hover:opacity-95"
                                  loading="lazy"
                                />
                              </div>
                            )}

                            {/* 3. Document / File Attachment */}
                            {isFile && msg.attachmentData && (
                              <FileAttachmentBubble
                                data={msg.attachmentData}
                                isMe={isMe}
                                downloadLabel={s.downloadFile}
                              />
                            )}

                            {/* 4. Text Content */}
                            {!hideContent && Boolean(msg.content) && (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}

                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${
                                isMe ? "text-red-200" : "text-slate-400"
                              }`}
                            >
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Japanese Phrases Bar with Native Language Meanings */}
                <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-white/70 px-4 py-1.5 dark:border-slate-800 dark:bg-sumi-900/60">
                  <span className="shrink-0 text-[10px] font-bold text-slate-400">🌸 Kaiwa:</span>
                  {quickPhrases.map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(phrase.jp)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-300"
                      title={phrase.meaning}
                    >
                      {phrase.jp} <span className="opacity-60">({phrase.meaning})</span>
                    </button>
                  ))}
                </div>

                {/* Pending Attachment Preview Banner */}
                {pendingAttachment && (
                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/95 px-4 py-2 dark:border-slate-800 dark:bg-sumi-850 animate-slide-in-down">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {pendingAttachment.type === "IMAGE" ? (
                        <img
                          src={pendingAttachment.dataUrl}
                          alt="preview"
                          className="h-10 w-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-lg dark:bg-sumi-750">
                          📄
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                          {pendingAttachment.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {(pendingAttachment.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-300 dark:bg-sumi-700 dark:text-slate-300"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Bottom Input & Recording Form */}
                <div className="border-t border-slate-200/80 bg-white p-2.5 sm:p-3 dark:border-slate-800 dark:bg-sumi-900">
                  {/* Hidden Native File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                  />

                  {isRecording ? (
                    /* Live Audio Recording Toolbar */
                    <div className="flex items-center gap-2.5 sm:gap-3 rounded-2xl bg-red-50/90 px-3.5 py-2 border border-red-200 dark:bg-red-950/40 dark:border-red-900/60">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600"></span>
                        </span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          {s.recording}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">
                        {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                      </span>

                      {/* Equalizer Wave simulation */}
                      <div className="hidden sm:flex items-center gap-1 h-4">
                        <span className="w-1 bg-red-500 animate-pulse h-3 rounded-full" />
                        <span className="w-1 bg-red-500 animate-pulse h-4 rounded-full delay-75" />
                        <span className="w-1 bg-red-500 animate-pulse h-2 rounded-full delay-150" />
                        <span className="w-1 bg-red-500 animate-pulse h-3 rounded-full delay-100" />
                      </div>

                      <div className="flex flex-1 justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stopRecording(false)}
                          className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-slate-200 text-xs font-bold text-slate-700 transition hover:bg-slate-300 dark:bg-sumi-800 dark:text-slate-200"
                          title={s.cancelRecording}
                        >
                          ✕ {s.cancelRecording}
                        </button>
                        <button
                          type="button"
                          onClick={() => stopRecording(true)}
                          className="flex h-8 items-center gap-1 rounded-xl bg-red-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
                        >
                          <span>🚀</span>
                          <span>{s.send}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Input Bar with File & Voice triggers */
                    <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
                      {/* Attach File/Image Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-sumi-800 dark:text-slate-300 dark:hover:bg-sumi-700"
                        title={s.attachFile}
                      >
                        📎
                      </button>

                      {/* Record Voice Note Button */}
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base text-slate-600 transition hover:bg-red-50 hover:text-red-600 active:scale-95 dark:bg-sumi-800 dark:text-slate-300 dark:hover:bg-sumi-700"
                        title={s.recordVoice}
                      >
                        🎙️
                      </button>

                      <input
                        type="text"
                        placeholder={s.typeMessagePlaceholder}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:bg-white dark:border-slate-700 dark:bg-sumi-800 dark:text-white"
                      />

                      <button
                        type="submit"
                        disabled={!inputMessage.trim() && !pendingAttachment}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md transition hover:bg-red-700 active:scale-95 disabled:opacity-40"
                        title={s.send}
                      >
                        🚀
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              /* Empty Placeholder when no friend selected on desktop */
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl dark:bg-sumi-800">
                  💌
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  {s.noConversationSelected}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {s.selectFriendToChat}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Image Lightbox Modal */}
      {activeImagePreview && (
        <div
          onClick={() => setActiveImagePreview(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md cursor-zoom-out"
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl animate-spring-up">
            <img
              src={activeImagePreview}
              alt="Full view"
              className="h-full w-full max-h-[85vh] object-contain"
            />
            <button
              onClick={() => setActiveImagePreview(null)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white font-bold backdrop-blur-md transition hover:bg-black/90 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesAndFriendsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-sumi-900 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            <span className="text-sm">Đang tải...</span>
          </div>
        </div>
      }
    >
      <MessagesAndFriendsContent />
    </Suspense>
  );
}
