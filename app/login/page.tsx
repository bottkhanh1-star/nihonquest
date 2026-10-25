"use client";

import { BASE64_IMAGES } from "@/lib/assets/base64Images";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Sriracha } from "next/font/google";
import "./login.css";
import { NihonQuestLogo } from "@/components/NihonQuestLogo";
import { NQIcon } from "@/components/JapanIllustration";
import { useNativeLanguage, SUPPORTED_LANGUAGES } from "@/components/LanguageContext";

const brush = Sriracha({ subsets: ["latin", "vietnamese"], weight: "400", display: "swap" });

function RegisteredNotice() {
  const { t } = useNativeLanguage();
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !params.get("registered")) return null;
  return (
    <div className="nq-notice nq-notice-ok">
      ✓ {t("loginSuccessNotice") || "Tài khoản đã tạo thành công. Hãy đăng nhập để bắt đầu hành trình."}
    </div>
  );
}

function AuthErrorNotice() {
  const { t } = useNativeLanguage();
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const code = params.get("error");
  if (!mounted || !code) return null;

  let message = t("loginErrInvalid") || "Email hoặc mật khẩu không đúng. Vui lòng thử lại.";
  if (code === "OAuthSignin") {
    message = "Đăng nhập Google thất bại (Chưa thiết lập GOOGLE_CLIENT_ID / NEXTAUTH_URL hoặc bị từ chối).";
  } else if (code === "OAuthCallback" || code === "Callback") {
    message = "Không thể xác thực tài khoản. Cơ sở dữ liệu bị gián đoạn hoặc ngắt kết nối. Vui lòng kiểm tra DATABASE_URL trong .env.";
  }

  return (
    <div role="alert" className="nq-notice nq-notice-err" style={{ marginBottom: 14 }}>
      {message} <small>({code})</small>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const { t } = useNativeLanguage();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      redirect: false,
      email: String(data.get("email") || ""),
      password: String(data.get("password") || ""),
    });
    if (res?.error) {
      setError(t("loginErrInvalid") || "Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
      setLoading(false);
      return;
    }
    router.push("/app");
  }

  return (
    <form onSubmit={onSubmit} className="nq-login-form">
      <div className="nq-field">
        <label htmlFor="login-email">{t("loginEmail") || "Email"}</label>
        <div className="nq-input-wrap">
          <span className="nq-input-icon"><NQIcon name="mail" /></span>
          <input id="login-email" autoComplete="email" name="email" type="email" required placeholder={t("loginEmailPlaceholder") || "Nhập địa chỉ email của bạn"} />
        </div>
      </div>

      <div className="nq-field">
        <label htmlFor="login-password">{t("loginPassword") || "Mật khẩu"}</label>
        <div className="nq-input-wrap">
          <span className="nq-input-icon"><NQIcon name="lock" /></span>
          <input id="login-password" autoComplete="current-password" name="password" type={showPassword ? "text" : "password"} required placeholder={t("loginPasswordPlaceholder") || "Nhập mật khẩu"} />
          <button type="button" className="nq-password-toggle" aria-label={showPassword ? (t("regHidePassword") || "Ẩn mật khẩu") : (t("regShowPassword") || "Hiện mật khẩu")} onClick={() => setShowPassword((v) => !v)}>
            <NQIcon name="eye" />
            <span>{showPassword ? (t("regHidePassword") || "Ẩn") : (t("regShowPassword") || "Hiện")}</span>
          </button>
        </div>
      </div>

      <div className="nq-remember">
        <label><input type="checkbox" defaultChecked /> {t("loginRemember") || "Ghi nhớ đăng nhập"}</label>
        <Link href="/forgot-password">{t("loginForgot") || "Quên mật khẩu?"}</Link>
      </div>

      {error && <div role="alert" className="nq-notice nq-notice-err">{error}</div>}

      <button type="submit" disabled={loading} className="nq-submit-red" data-magnetic>
        <span>{loading ? (t("loginSubmitting") || "Đang đăng nhập...") : (t("loginSubmit") || "Đăng nhập")}</span>
        <NQIcon name="arrow" />
      </button>
    </form>
  );
}

export default function LoginPage() {
  const { nativeLanguage, setNativeLanguage, t } = useNativeLanguage();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === nativeLanguage) || SUPPORTED_LANGUAGES[0];

  const storyEyebrow = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "學習日語，開啟全新視界。" : "学习日语，开启全新视界。")
    : nativeLanguage !== "vi"
      ? "Learn Japanese, unlock the world."
      : "Học tiếng Nhật, mở ra thế giới.";

  const storyHeading = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "日語，開啟一段嶄新旅程。" : "日语，开启一段崭新旅程。")
    : nativeLanguage !== "vi"
      ? "Japanese, opening a new journey."
      : "Tiếng Nhật, mở ra một hành trình mới.";

  const storyDesc = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "從最初的一筆一劃，到自然流暢的日常會話。讓每一天的學習都成為探索日本的奇妙之旅。" : "从最初的一笔一划，到自然流畅的日常会话。让每一天的学习都成为探索日本的奇妙之旅。")
    : nativeLanguage !== "vi"
      ? "From your first kana stroke to everyday conversations. Make every study session a step towards discovering Japan."
      : "Từ nét chữ đầu tiên đến cuộc trò chuyện bạn hằng mong đợi. Biến mỗi ngày học thành một bước khám phá Nhật Bản.";

  const ben1Title = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "清晰科學的路線" : "清晰科学的路线")
    : nativeLanguage !== "vi"
      ? "Structured Learning Path"
      : "Học có lộ trình rõ ràng";

  const ben1Desc = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "從五十音假名到實用交際、JLPT 備考及進階表達。" : "从五十音假名到实用交际、JLPT 备考及进阶表达。")
    : nativeLanguage !== "vi"
      ? "From basic kana to real conversation, JLPT test prep, and beyond."
      : "Từ bảng chữ cái đến giao tiếp thực tế, thi JLPT và hơn thế nữa.";

  const ben2Title = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "身臨其境的文化體驗" : "身临其境的文化体验")
    : nativeLanguage !== "vi"
      ? "Vibrant Culture"
      : "Trải nghiệm văn hóa sống động";

  const ben2Desc = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "探索真實的日本風土人情與語言背後的文化故事。" : "探索真实的日本风土人情与语言背后的文化故事。")
    : nativeLanguage !== "vi"
      ? "Explore Japanese traditions, daily life, and the stories behind the language."
      : "Khám phá đất nước, con người và những câu chuyện Nhật Bản.";

  const ben3Title = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "全球學習者同行" : "全球学习者同行")
    : nativeLanguage !== "vi"
      ? "Global Community"
      : "Cộng đồng đồng hành";

  const ben3Desc = nativeLanguage.startsWith("zh")
    ? (nativeLanguage === "zh-TW" ? "與成千上萬的學習者一起打卡分享，穩步並肩成長。" : "与成千上万的学习者一起打卡分享，稳步并肩成长。")
    : nativeLanguage !== "vi"
      ? "Join thousands of learners, sharing milestones and growing every day."
      : "Cùng hàng ngàn người học, chia sẻ và tiến bộ mỗi ngày.";

  return (
    <div className="nq-auth relative">
      <div
        className="nq-auth-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${BASE64_IMAGES.loginBg})` }}
      />

      {/* Language Switcher in top corner */}
      <div className="absolute top-4 right-4 z-30" ref={langRef}>
        <button
          type="button"
          onClick={() => setLangOpen(!langOpen)}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-white/90 px-3 py-1.5 text-xs font-black text-rose-700 shadow-sm backdrop-blur transition hover:border-rose-300 dark:border-slate-700 dark:bg-sumi-900/90 dark:text-rose-300"
          aria-label="Change native language"
        >
          <span>{currentLang.flag}</span>
          <span className="font-bold">{currentLang.nativeName}</span>
          <span className="text-[10px] opacity-60">▾</span>
        </button>

        {langOpen && (
          <div className="absolute right-0 top-10 z-50 w-48 max-h-72 overflow-y-auto rounded-2xl border border-rose-100 bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-sumi-950">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setNativeLanguage(lang.code);
                  setLangOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition text-left ${
                  nativeLanguage === lang.code
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-sumi-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </span>
                {nativeLanguage === lang.code && <span>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="nq-auth-layout">
        <section className="nq-auth-story">
          <Link href="/" data-intro><NihonQuestLogo size="md" /></Link>

          <div className="nq-auth-copy" data-intro>
            <span className="nq-eyebrow-dot">{storyEyebrow}</span>
            <h1 className={brush.className}>{storyHeading}</h1>
            <p>{storyDesc}</p>
          </div>

          <div className="nq-auth-benefits" data-intro>
            <div className="nq-auth-benefit">
              <span><NQIcon name="book" /></span>
              <div>
                <b>{ben1Title}</b>
                <small>{ben1Desc}</small>
              </div>
            </div>
            <div className="nq-auth-benefit">
              <span><NQIcon name="torii" /></span>
              <div>
                <b>{ben2Title}</b>
                <small>{ben2Desc}</small>
              </div>
            </div>
            <div className="nq-auth-benefit">
              <span><NQIcon name="people" /></span>
              <div>
                <b>{ben3Title}</b>
                <small>{ben3Desc}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="nq-auth-form-wrap">
          <div className="nq-login-card" data-intro>
            <NihonQuestLogo size="md" />
            <h2>{t("loginTitle") || "Đăng nhập"}</h2>
            <p className="nq-login-sub">{t("loginSubtitle") || "Đăng nhập an toàn để tiếp tục hành trình học tiếng Nhật của bạn."}</p>
            <Suspense><RegisteredNotice /><AuthErrorNotice /></Suspense>
            <LoginForm />
            <div className="nq-or"><span>{t("loginOr") || "Hoặc"}</span></div>
            <button
              type="button"
              className="nq-google"
              disabled={googleLoading}
              onClick={() => {
                setGoogleLoading(true);
                try {
                  document.cookie = `nq_native_language=${nativeLanguage}; path=/; max-age=31536000; SameSite=Lax`;
                  localStorage.setItem("nq_native_language", nativeLanguage);
                  localStorage.setItem("nihonquest_native_language", nativeLanguage);
                } catch {}
                signIn("google", { callbackUrl: "/app" }).catch(() => setGoogleLoading(false));
              }}
            >
              <GoogleIcon />
              <span>{t("loginGoogle") || "Đăng nhập bằng Google"}</span>
            </button>
            <div className="nq-login-footer">
              {t("loginNoAccount") || "Chưa có tài khoản?"}{" "}
              <Link href="/register">
                {t("loginCreateAccount") || "Tạo tài khoản"} <NQIcon name="arrow" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
