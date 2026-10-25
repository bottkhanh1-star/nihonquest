"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserProgress } from "@/components/UserProgressContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { useGlobalCall } from "@/components/social/GlobalCallContext";
import { useNativeLanguage } from "@/components/LanguageContext";
import { getSocialTranslation } from "@/lib/socialI18n";

interface PostAuthor {
  id: string;
  name: string;
  avatar?: string | null;
  learningLevel?: string;
  currentStreak?: number;
}

interface PostItem {
  id: string;
  title?: string | null;
  content: string;
  category: string;
  levelTag: string;
  imageUrl?: string | null;
  createdAt: string;
  author: PostAuthor;
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
    learningLevel?: string;
  };
}

const LEVEL_TAGS = ["ALL", "N5", "N4", "N3", "N2", "N1"];

export default function CommunityPage() {
  const { nativeLanguage } = useNativeLanguage();
  const s = getSocialTranslation(nativeLanguage);

  const { progress } = useUserProgress();
  const { playClick, showToast } = useSoundAndTheme();
  const { startCall } = useGlobalCall();

  const categories = [
    { key: "ALL", label: s.categoryAll, icon: "🌐" },
    { key: "QUESTION", label: s.categoryQuestion, icon: "❓" },
    { key: "GRAMMAR", label: s.categoryGrammar, icon: "文" },
    { key: "VOCAB", label: s.categoryVocab, icon: "あ" },
    { key: "TIPS", label: s.categoryTips, icon: "💡" },
    { key: "GENERAL", label: s.categoryGeneral, icon: "💬" },
  ];

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [onlyFriends, setOnlyFriends] = useState(false);
  const [sortOrder, setSortOrder] = useState<"latest" | "popular">("latest");
  const [searchQuery, setSearchQuery] = useState("");

  // Post Creator State
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("GENERAL");
  const [newLevel, setNewLevel] = useState(progress?.learningLevel || "N5");
  const [submitting, setSubmitting] = useState(false);

  // Expanded comments by postId
  const [expandedPostComments, setExpandedPostComments] = useState<Record<string, CommentItem[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedLevel !== "ALL") params.set("levelTag", selectedLevel);
      if (onlyFriends) params.set("friends", "true");
      if (sortOrder !== "latest") params.set("sort", sortOrder);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/feed?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Error loading feed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [selectedCategory, selectedLevel, onlyFriends, sortOrder]);

  const handleDeletePost = async (postId: string) => {
    if (!confirm(s.deleteConfirm)) return;
    try {
      const res = await fetch(`/api/feed/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        showToast({ title: s.deletePost, description: s.deletePost, type: "success" });
      } else {
        showToast({ title: "Error", description: "Could not delete post", type: "error" });
      }
    } catch {
      showToast({ title: "Error", description: "Network error", type: "error" });
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim() || undefined,
          content: newContent.trim(),
          category: newCategory,
          levelTag: newLevel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [data.post, ...prev]);
        setNewTitle("");
        setNewContent("");
        playClick();
        showToast({
          title: s.postButton,
          description: s.communityTitle,
          type: "success",
        });
      } else {
        showToast({ title: "Error", description: "Post creation failed", type: "error" });
      }
    } catch (err) {
      console.error(err);
      showToast({ title: "Error", description: "Network error", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFeed();
  };

  // Toggle Like
  const handleToggleLike = async (postId: string) => {
    playClick();
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.hasLiked;
          return {
            ...p,
            hasLiked: nextLiked,
            likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
          };
        }
        return p;
      })
    );

    try {
      await fetch(`/api/feed/${postId}/like`, { method: "POST" });
    } catch {
      fetchFeed();
    }
  };

  // Load comments
  const toggleComments = async (postId: string) => {
    playClick();
    if (expandedPostComments[postId]) {
      setExpandedPostComments((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return;
    }

    try {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
      const res = await fetch(`/api/feed/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setExpandedPostComments((prev) => ({ ...prev, [postId]: data.comments || [] }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Send comment
  const handleSendComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    try {
      const res = await fetch(`/api/feed/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setExpandedPostComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment],
        }));
        setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
        );
        playClick();
      }
    } catch {
      showToast({ title: "Error", description: "Could not send comment", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-32 sm:pb-24 text-slate-900 dark:bg-sumi-950 dark:text-slate-100">
      <AppNav />

      <main className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        {/* Banner Header */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                🌸 {s.communityTitle}
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                {s.communityTitle}
              </h1>
              <p className="mt-1 text-sm text-red-100 sm:text-base">
                {s.communitySubtitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/app/messages"
                onClick={playClick}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-red-600 shadow-md transition hover:bg-red-50 sm:text-sm"
              >
                <span>💬</span>
                <span>{s.messagesTitle}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Feed Column */}
          <div className="lg:col-span-8">
            {/* Post Creator Box */}
            <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-sumi-900">
              <div className="flex items-center gap-3 pb-3">
                <UserAvatar
                  src={progress?.avatar}
                  name={progress?.displayName || "Bạn"}
                  sizeClass="h-10 w-10 text-sm"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {progress?.displayName || s.newPostTitle}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">
                    {s.newPostTitle}
                  </span>
                </div>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-3">
                <input
                  type="text"
                  placeholder={s.postTitleOptional}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-red-500 focus:bg-white dark:border-slate-700 dark:bg-sumi-800 dark:text-white"
                />
                <textarea
                  rows={3}
                  placeholder={s.newPostPlaceholder}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-medium text-slate-900 outline-none transition focus:border-red-500 focus:bg-white dark:border-slate-700 dark:bg-sumi-800 dark:text-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Selector */}
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
                    >
                      {categories.filter((c) => c.key !== "ALL").map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>

                    {/* Level Selector */}
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 outline-none dark:border-slate-700 dark:bg-sumi-800 dark:text-red-400"
                    >
                      {LEVEL_TAGS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl === "ALL" ? `${s.filterLevel}: All` : `${s.filterLevel} ${lvl}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !newContent.trim()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
                  >
                    <span>{submitting ? s.posting : `${s.postButton} 🚀`}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Filter Bar: Categories, Level, Search */}
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Horizontal scroll categories */}
                <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => {
                        playClick();
                        setSelectedCategory(cat.key);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-bold transition ${
                        selectedCategory === cat.key
                          ? "bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                {/* Sort & Friends Toggles */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-2xl bg-slate-200/60 p-0.5 dark:bg-sumi-800">
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSortOrder("latest");
                      }}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        sortOrder === "latest"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-sumi-900 dark:text-white"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      {s.sortLatest}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSortOrder("popular");
                      }}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        sortOrder === "popular"
                          ? "bg-white text-slate-900 shadow-sm dark:bg-sumi-900 dark:text-white"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      ⭐ {s.sortPopular}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      playClick();
                      setOnlyFriends(!onlyFriends);
                    }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                      onlyFriends
                        ? "border border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-sumi-900 dark:text-slate-300"
                    }`}
                  >
                    <span>👥</span>
                    <span>{s.tabFriends}</span>
                  </button>
                </div>
              </div>

              {/* Search & Level Tag filter row */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <form onSubmit={handleSearch} className="relative flex-1">
                  <input
                    type="text"
                    placeholder={s.searchFeedPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 pl-9 text-xs font-semibold text-slate-900 outline-none transition focus:border-red-500 dark:border-slate-800 dark:bg-sumi-900 dark:text-white"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                </form>

                <div className="flex items-center gap-1 overflow-x-auto">
                  {LEVEL_TAGS.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        playClick();
                        setSelectedLevel(lvl);
                      }}
                      className={`rounded-xl px-2.5 py-1 text-xs font-extrabold transition ${
                        selectedLevel === lvl
                          ? "bg-red-600 text-white"
                          : "bg-slate-200/70 text-slate-600 hover:bg-slate-300 dark:bg-sumi-800 dark:text-slate-400"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Posts List */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-3xl border border-slate-200/60 bg-white dark:border-slate-800 dark:bg-sumi-900"
                  />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-sumi-900">
                <span className="text-4xl">🍵</span>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {s.emptyFeed}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {s.emptyFeedSub}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => {
                  const isExpanded = Boolean(expandedPostComments[post.id]);
                  const comments = expandedPostComments[post.id] || [];

                  return (
                    <article
                      key={post.id}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-800 dark:bg-sumi-900"
                    >
                      {/* Author Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={post.author.avatar}
                            name={post.author.name}
                            sizeClass="h-10 w-10 text-sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {post.author.name}
                              </span>
                              {post.author.learningLevel && (
                                <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                  {post.author.learningLevel}
                                </span>
                              )}
                              {post.author.currentStreak && post.author.currentStreak > 0 ? (
                                <span className="text-[11px] font-semibold text-amber-500">
                                  🔥 {post.author.currentStreak}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(post.createdAt).toLocaleDateString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5">
                          {post.levelTag !== "ALL" && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600 dark:bg-sumi-800 dark:text-slate-300">
                              {post.levelTag}
                            </span>
                          )}
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                            {categories.find((c) => c.key === post.category)?.label || post.category}
                          </span>
                        </div>
                      </div>

                      {/* Title & Body */}
                      <div className="mt-3.5 space-y-2">
                        {post.title && (
                          <h4 className="text-base font-black text-slate-900 dark:text-white">
                            {post.title}
                          </h4>
                        )}
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                          {post.content}
                        </p>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          {/* Like Button */}
                          <button
                            onClick={() => handleToggleLike(post.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-90 ${
                              post.hasLiked
                                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-800"
                            }`}
                          >
                            <span className={post.hasLiked ? "inline-block animate-heart-pop" : "inline-block"}>
                              {post.hasLiked ? "❤️" : "🤍"}
                            </span>
                            <span>{post.likesCount} {s.like}</span>
                          </button>

                          {/* Comments Button */}
                          <button
                            onClick={() => toggleComments(post.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-sumi-800"
                          >
                            <span>💬</span>
                            <span>{post.commentsCount} {s.comment}</span>
                          </button>
                        </div>

                        {/* Quick Message Author or Delete Post */}
                        <div className="flex items-center gap-2">
                          {post.author.id === progress?.userId ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                              title={s.deletePost}
                            >
                              🗑️ {s.deletePost}
                            </button>
                          ) : (
                            <Link
                              href={`/app/messages?friendId=${post.author.id}`}
                              className="text-xs font-bold text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              {s.tabChats} ➔
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Comments Drawer / Section */}
                      {isExpanded && (
                        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                          {loadingComments[post.id] ? (
                            <p className="text-xs text-slate-400">Loading...</p>
                          ) : comments.length === 0 ? (
                            <p className="text-xs text-slate-400">{s.noComments}</p>
                          ) : (
                            <div className="space-y-3 pb-3">
                              {comments.map((c) => (
                                <div key={c.id} className="flex items-start gap-2.5">
                                  <UserAvatar
                                    src={c.author.avatar}
                                    name={c.author.name}
                                    sizeClass="h-7 w-7 text-xs"
                                  />
                                  <div className="rounded-2xl bg-slate-100 px-3.5 py-2 dark:bg-sumi-800">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {c.author.name}
                                      </span>
                                      {c.author.learningLevel && (
                                        <span className="text-[9px] font-bold text-red-600 dark:text-red-400">
                                          {c.author.learningLevel}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
                                      {c.content}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Write Comment Box */}
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              placeholder={s.writeCommentPlaceholder}
                              value={commentInputs[post.id] || ""}
                              onChange={(e) =>
                                setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSendComment(post.id);
                              }}
                              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 outline-none transition focus:border-red-500 focus:bg-white dark:border-slate-700 dark:bg-sumi-800 dark:text-white"
                            />
                            <button
                              onClick={() => handleSendComment(post.id)}
                              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95"
                            >
                              {s.sendComment}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Study Groups & Friends */}
          <div className="space-y-6 lg:col-span-4">
            {/* Quick Actions Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-sumi-900">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
                {s.messagesTitle}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {s.selectFriendToChat}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/app/messages"
                  className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-3 text-xs font-bold text-white shadow-md transition hover:opacity-95"
                >
                  <span className="flex items-center gap-2">
                    <span>👥</span>
                    <span>{s.tabFriends} & {s.tabChats}</span>
                  </span>
                  <span>➔</span>
                </Link>
                <Link
                  href="/app/leaderboard"
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-sumi-800 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <span>🏆</span>
                    <span>Leaderboard</span>
                  </span>
                  <span>➔</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
