import type { ReactNode } from "react";
import Image from "next/image";
import { BASE64_IMAGES } from "@/lib/assets/base64Images";
import Link from "next/link";
import { NihonQuestLogo } from "@/components/NihonQuestLogo";
import { LandingHeaderActions, LandingHeroCta } from "@/components/landing/LandingHeaderActions";
import {
  BrushEdge,
  IconArrow,
  IconBook,
  IconCards,
  IconChat,
  IconDiscord,
  IconFlame,
  IconPen,
  IconPin,
  IconSpark,
  IconTelegram,
  IconTrain,
  IconYouTube,
  KanaArt,
  KanjiArt,
  MapArt,
  Petals,
  StreakArt,
  SrsArt,
  SurvivalArt,
  ToriiMark,
} from "@/components/landing/LandingArt";
import "./landing.css";

export const metadata = {
  title: "Nihon Quest — Học Tiếng Nhật. Khám Phá Nhật Bản.",
  description:
    "Nền tảng luyện tiếng Nhật: bảng 50 âm Gojūon, canvas tập viết Kana, ôn tập lặp lại SRS SM-2, từ vựng JLPT N5 và hội thoại sinh tồn thực chiến.",
};

/* Đổi đường dẫn ở đây nếu route thật khác. */
const NAV = [
  { label: "Trang chủ", href: "/", active: true },
  { label: "Khám phá", href: "#tinh-nang" },
  { label: "Hành trình", href: "/app" },
  { label: "Cộng đồng", href: "/app" },
];

const SOCIALS = [
  { label: "YouTube", href: "#", icon: <IconYouTube /> },
  { label: "Discord", href: "#", icon: <IconDiscord /> },
  { label: "Telegram", href: "#", icon: <IconTelegram /> },
];

const CHIPS: { icon: ReactNode; text: ReactNode }[] = [
  { icon: <IconBook />, text: <>Bảng 50 âm<br />&amp; chữ cái</> },
  { icon: <IconPen />, text: <>Canvas luyện viết<br />thông minh</> },
  { icon: <IconSpark />, text: <>Tích hợp SRS<br />SM-2</> },
  { icon: <IconTrain />, text: <>Bản đồ Shinkansen<br />khám phá Nhật Bản</> },
];

const FEATURES: {
  tone: string;
  icon: ReactNode;
  title: string;
  desc: string;
  cta: string;
  art: ReactNode;
}[] = [
  {
    tone: "sakura",
    icon: <span lang="ja">あ</span>,
    title: "Bảng 50 Âm & Canvas Viết Chữ",
    desc: "Sắp xếp khoa học theo 5 nguyên âm a-i-u-e-o. Canvas HTML5 nhận diện nét vẽ giúp bạn rèn chữ Hiragana và Katakana chuẩn xác.",
    cta: "Khám phá",
    art: <KanaArt />,
  },
  {
    tone: "fuji",
    icon: <IconCards />,
    title: "Flashcard Ôn Tập Lặp Lại (SRS)",
    desc: "Thuật toán Spaced Repetition SM-2 phân bố thời gian ôn tập tối ưu (Again, Hard, Good, Easy), giúp kiến thức khắc sâu vào trí nhớ dài hạn.",
    cta: "Bắt đầu ngay",
    art: <SrsArt />,
  },
  {
    tone: "matcha",
    icon: <IconPin />,
    title: "Japan Journey: Bản Đồ Khám Phá",
    desc: "Chinh phục các chặng tàu từ Tokyo, Hakone, Kyoto, Osaka đến Hokkaido. Tích lũy XP để mở khóa danh lam thắng cảnh và danh hiệu.",
    cta: "Khám phá",
    art: <MapArt />,
  },
  {
    tone: "rose",
    icon: <IconChat />,
    title: "Chế Độ Sinh Tồn Thực Chiến",
    desc: "Nhập vai các tình huống đời thực: gọi mì Ramen tại quán, hỏi đường ở ga Shinjuku, tính tiền tại Konbini.",
    cta: "Trải nghiệm",
    art: <SurvivalArt />,
  },
  {
    tone: "teal",
    icon: <span lang="ja">漢</span>,
    title: "Kho Từ Vựng & Hán Tự JLPT N5",
    desc: "Tra cứu âm On, âm Kun, số nét, ý nghĩa và ví dụ thực tế của hơn 100 chữ Hán và từ vựng cốt lõi.",
    cta: "Luyện ngay",
    art: <KanjiArt />,
  },
  {
    tone: "amber",
    icon: <IconFlame />,
    title: "Gamification: Streak & Daily Quests",
    desc: "Giữ thói quen mỗi ngày với chuỗi Streak, nhiệm vụ hằng ngày và bảng xếp hạng để thăng cấp nhân vật.",
    cta: "Xem chi tiết",
    art: <StreakArt />,
  },
];

export default function Home() {
  return (
    <div className="hp">
      {/* ============================ HERO ============================ */}
      <section className="hp-hero" aria-labelledby="hp-hero-title">
        <div className="hp-hero__scene" aria-hidden="true">
          {/* Ảnh đặt tại public/images/hero-japan.webp */}
          <Image
            src={BASE64_IMAGES.heroJapan} unoptimized
            alt=""
            fill
            priority
            sizes="100vw"
            quality={85}
            className="hp-hero__img"
          />
        </div>
        <Petals />

        <div className="hp-wrap hp-hero__inner">
          <header className="hp-header">
            <Link href="/" className="hp-brand shrink-0" aria-label="Nihon Quest — trang chủ">
              <NihonQuestLogo size="md" />
            </Link>

            <nav className="hp-nav" aria-label="Điều hướng chính">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={item.active ? "is-active" : undefined}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <LandingHeaderActions />
          </header>

          <div className="hp-hero__body">
            <span className="hp-badge">
              <ToriiMark size={18} />
              Khám phá tiếng Nhật theo cách mới
            </span>

            <h1 id="hp-hero-title" className="hp-h1">
              <span className="hp-h1__a">Học Tiếng Nhật.</span>
              <span className="hp-h1__b">Khám Phá Nhật Bản.</span>
            </h1>

            <p className="hp-lead">
              Bạn không chỉ đơn thuần học ngoại ngữ. Bạn đang bắt đầu chuyến hành trình Shinkansen
              xuyên qua Tokyo, Kyoto, Osaka với bảng 50 âm Gojūon, canvas tập viết nét chữ và các
              tình huống giao tiếp sinh tồn đời thực.
            </p>

            <LandingHeroCta />
          </div>

          <ul className="hp-chips" style={{ listStyle: "none", margin: 0, paddingLeft: 0 }}>
            {CHIPS.map((c, i) => (
              <li key={i} className="hp-chip">
                <span className="hp-chip__icon">{c.icon}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <BrushEdge />
      </section>

      {/* ============================ FEATURES ============================ */}
      <section id="tinh-nang" className="hp-features" aria-labelledby="hp-features-title">
        <div className="hp-head">
          <div className="hp-eyebrow">Tính năng đột phá</div>
          <div className="hp-title-wrap">
            <ToriiMark size={48} />
            <h2 id="hp-features-title" className="hp-title">
              Mọi Công Cụ Bạn Cần Để Làm Chủ Tiếng Nhật
            </h2>
          </div>
          <p className="hp-sub">
            Từ bảng chữ cái cơ bản đến hội thoại đời thực, Nihon Quest đồng hành cùng bạn trên từng
            chặng đường.
          </p>
        </div>

        <div className="hp-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className={`hp-card hp-card--${f.tone}`}>
              <div className="hp-card__body">
                <span className="hp-card__icon" aria-hidden="true">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="hp-card__cta">
                  <Link href="/app" className="hp-pill">
                    {f.cta}
                    <IconArrow size={14} />
                  </Link>
                </div>
              </div>
              <div className="hp-card__art" aria-hidden="true">{f.art}</div>
            </article>
          ))}
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="hp-footer">
        <BrushEdge />
        <div className="hp-footer__bg" aria-hidden="true">
          <div className="hp-footer__pic">
            {/* Ảnh đặt tại public/images/footer-japan.webp */}
            <Image
              src={BASE64_IMAGES.footerJapan} unoptimized
              alt=""
              fill
              sizes="100vw"
              quality={85}
              className="hp-footer__img"
            />
          </div>
        </div>

        <div className="hp-wrap hp-footer__inner">
          <div className="hp-footer__row">
            <blockquote className="hp-quote">
              Không chỉ là một app học tiếng Nhật, mà là cánh cửa mở ra thế giới mới.
            </blockquote>

            <div className="hp-footer__side">
              <nav className="hp-footer__nav" aria-label="Liên kết chân trang">
                {NAV.map((item) => (
                  <Link key={item.label} href={item.href}>{item.label}</Link>
                ))}
              </nav>
              <div className="hp-social">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} aria-label={s.label}>{s.icon}</a>
                ))}
                <span className="hp-hanko" lang="ja" aria-hidden="true">学習</span>
              </div>
            </div>
          </div>

          <p className="hp-copy">
            © 2026 Nihon Quest (日本クエスト). Đồng hành học tiếng Nhật. Đi khám phá xứ sở hoa anh đào.
          </p>
        </div>
      </footer>
    </div>
  );
}
