"use client";

import React from "react";
import { useNativeLanguage } from "@/components/LanguageContext";

export type MascotKind = "shiba" | "kitsune" | "neko" | "daruma";
export type MascotMood = "cheer" | "happy" | "study" | "sleepy";

interface AnimeMascotProps {
  kind?: MascotKind;
  mood?: MascotMood;
  size?: number | string;
  className?: string;
  speech?: string;
}

/**
 * Bộ linh vật Anime vector Nhật Bản sắc nét, siêu nhẹ (SVG thuần túy),
 * mang lại nét dễ thương, ấm áp và sinh động cho NihonQuest.
 */
export function AnimeMascot({
  kind = "shiba",
  mood = "happy",
  size = 64,
  className = "",
  speech,
}: AnimeMascotProps) {
  const numSize = typeof size === "number" ? size : 64;

  const renderMascotSvg = () => {
    switch (kind) {
      case "kitsune":
        // Cáo thần đền Kitsune (trắng tuyết, tai viền đỏ cam, má ửng hồng, đeo chuông vàng)
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm select-none"
            aria-label="Kitsune Linh vật Cáo Thần"
          >
            {/* Tai trái & Tai phải */}
            <path d="M28 20L50 56H20L28 20Z" fill="#ff6b6b" />
            <path d="M32 26L46 54H24L32 26Z" fill="#ffe3e3" />
            <path d="M92 20L70 56H100L92 20Z" fill="#ff6b6b" />
            <path d="M88 26L74 54H96L88 26Z" fill="#ffe3e3" />

            {/* Đầu cáo tròn trĩnh mềm mại */}
            <ellipse cx="60" cy="68" rx="42" ry="38" fill="#ffffff" stroke="#ff8787" strokeWidth="2.5" />
            
            {/* Má hồng phấn */}
            <ellipse cx="34" cy="74" rx="8" ry="4.5" fill="#ffa8a8" opacity="0.6" />
            <ellipse cx="86" cy="74" rx="8" ry="4.5" fill="#ffa8a8" opacity="0.6" />

            {/* Họa tiết Miko đỏ trên trán */}
            <path d="M60 48L57 58H63L60 48Z" fill="#e03131" />
            <circle cx="60" cy="44" r="2.5" fill="#e03131" />

            {/* Mắt theo tâm trạng */}
            {mood === "cheer" || mood === "happy" ? (
              <>
                {/* Mắt tít cười vui vẻ ^ ^ */}
                <path d="M40 64C43 59 49 59 52 64" stroke="#495057" strokeWidth="3" strokeLinecap="round" />
                <path d="M68 64C71 59 77 59 80 64" stroke="#495057" strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Mắt tròn lấp lánh */}
                <circle cx="46" cy="63" r="5" fill="#343a40" />
                <circle cx="44.5" cy="61.5" r="1.8" fill="#ffffff" />
                <circle cx="74" cy="63" r="5" fill="#343a40" />
                <circle cx="72.5" cy="61.5" r="1.8" fill="#ffffff" />
              </>
            )}

            {/* Mũi & miệng cáo */}
            <ellipse cx="60" cy="72" rx="2.8" ry="2" fill="#e03131" />
            <path d="M56 75Q60 78 64 75" stroke="#495057" strokeWidth="2" strokeLinecap="round" />

            {/* Vòng cổ đỏ & Chuông vàng đền thần (Suzu) */}
            <rect x="42" y="96" width="36" height="5" rx="2.5" fill="#e03131" />
            <circle cx="60" cy="104" r="7" fill="#fcc419" stroke="#fab005" strokeWidth="1.5" />
            <circle cx="60" cy="103" r="1.5" fill="#e67700" />
            <line x1="56" y1="106" x2="64" y2="106" stroke="#e67700" strokeWidth="1.5" />
          </svg>
        );

      case "neko":
        // Mèo Maneki Neko may mắn (tai tam thể, vẫy tay may mắn, ôm đồng xu vàng)
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm select-none"
            aria-label="Maneki Neko Mèo May Mắn"
          >
            {/* Tai trái tam thể (cam) & Tai phải (đen/trắng) */}
            <path d="M26 26L48 56H20L26 26Z" fill="#ff922b" />
            <path d="M31 32L44 54H24L31 32Z" fill="#ffe8cc" />
            <path d="M94 26L72 56H100L94 26Z" fill="#495057" />
            <path d="M89 32L76 54H96L89 32Z" fill="#f1f3f5" />

            {/* Đầu mèo */}
            <ellipse cx="60" cy="66" rx="43" ry="37" fill="#ffffff" stroke="#ced4da" strokeWidth="2" />
            {/* Đốm cam trên trán */}
            <path d="M46 36C52 38 56 46 54 52C48 54 42 46 46 36Z" fill="#ffa94d" opacity="0.8" />

            {/* Má hồng */}
            <ellipse cx="32" cy="74" rx="7" ry="4" fill="#ff8787" opacity="0.6" />
            <ellipse cx="88" cy="74" rx="7" ry="4" fill="#ff8787" opacity="0.6" />

            {/* Mắt híp cười phúc hậu (^_^) */}
            <path d="M38 63C42 58 48 58 52 63" stroke="#212529" strokeWidth="3" strokeLinecap="round" />
            <path d="M68 63C72 58 78 58 82 63" stroke="#212529" strokeWidth="3" strokeLinecap="round" />

            {/* Mũi hồng & Miệng chữ w */}
            <ellipse cx="60" cy="70" rx="2.5" ry="1.8" fill="#ff8787" />
            <path d="M54 74C56 77 59 77 60 74C61 77 64 77 66 74" stroke="#212529" strokeWidth="2" strokeLinecap="round" />

            {/* Râu mèo 2 bên */}
            <line x1="20" y1="68" x2="32" y2="70" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="76" x2="32" y2="75" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="68" x2="88" y2="70" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="76" x2="88" y2="75" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" />

            {/* Tay vẫy chào mời may mắn */}
            <ellipse cx="92" cy="46" rx="9" ry="14" transform="rotate(25 92 46)" fill="#ffffff" stroke="#ced4da" strokeWidth="2" />
            <circle cx="94" cy="38" r="4" fill="#ffc9c9" />

            {/* Đồng tiền Koban vàng (Koban) */}
            <ellipse cx="60" cy="98" rx="14" ry="10" fill="#ffd43b" stroke="#fab005" strokeWidth="2" />
            <text x="60" y="102" textAnchor="middle" fontSize="10" fontWeight="900" fill="#d9480f">千万</text>
          </svg>
        );

      case "daruma":
        // Daruma quyết tâm (bầu bĩnh, lông mày vạc, mắt kiên cường, áo đỏ truyền thống)
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm select-none"
            aria-label="Daruma Quyết Tâm"
          >
            {/* Thân tròn đỏ rực */}
            <ellipse cx="60" cy="66" rx="46" ry="44" fill="#e03131" />
            <ellipse cx="60" cy="66" rx="44" ry="42" fill="url(#darumaGrad)" />
            <defs>
              <radialGradient id="darumaGrad" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="100%" stopColor="#c92a2a" />
              </radialGradient>
            </defs>

            {/* Mặt màu trắng ngà bên trong */}
            <ellipse cx="60" cy="58" rx="30" ry="28" fill="#fff9db" />

            {/* Lông mày cánh hạc đặc trưng Daruma */}
            <path d="M38 46C42 42 48 44 50 48" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M82 46C78 42 72 44 70 48" stroke="#212529" strokeWidth="3.5" strokeLinecap="round" />

            {/* Mắt to tròn biểu trưng cho ý chí đạt mục tiêu */}
            <circle cx="45" cy="56" r="6" fill="#212529" />
            <circle cx="43" cy="54" r="2" fill="#ffffff" />
            <circle cx="75" cy="56" r="6" fill="#212529" />
            <circle cx="73" cy="54" r="2" fill="#ffffff" />

            {/* Ria mép rùa */}
            <path d="M42 68C48 70 52 68 56 65" stroke="#212529" strokeWidth="3" strokeLinecap="round" />
            <path d="M78 68C72 70 68 68 64 65" stroke="#212529" strokeWidth="3" strokeLinecap="round" />

            {/* Má hồng */}
            <circle cx="37" cy="62" r="5" fill="#ffa8a8" opacity="0.6" />
            <circle cx="83" cy="62" r="5" fill="#ffa8a8" opacity="0.6" />

            {/* Chữ Phúc (福) hoặc Thắng (勝) màu vàng kim trước bụng */}
            <text x="60" y="100" textAnchor="middle" fontSize="18" fontWeight="900" fill="#ffd43b" fontFamily="serif">
              必勝
            </text>
          </svg>
        );

      case "shiba":
      default:
        // Chú chó Shiba Inu vui tươi (vàng nâu ấm, má phính, tai vểnh, cánh hoa đào)
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm select-none"
            aria-label="Shiba Inu Linh vật Anh Đào"
          >
            {/* Tai trái & Tai phải vểnh tam giác */}
            <path d="M26 22L52 50H22L26 22Z" fill="#e8590c" />
            <path d="M30 28L46 48H26L30 28Z" fill="#ffe8cc" />
            <path d="M94 22L68 50H98L94 22Z" fill="#e8590c" />
            <path d="M90 28L74 48H94L90 28Z" fill="#ffe8cc" />

            {/* Đầu Shiba tròn béo */}
            <ellipse cx="60" cy="66" rx="44" ry="38" fill="#f76707" />
            {/* Mảng lông trắng hình trái tim đặc trưng quanh má và cằm */}
            <path
              d="M32 72C32 60 44 54 52 60C56 63 60 66 60 66C60 66 64 63 68 60C76 54 88 60 88 72C88 88 72 98 60 98C48 98 32 88 32 72Z"
              fill="#fff9db"
            />

            {/* Đốm lông tròn màu trắng như lông mày trên mắt */}
            <circle cx="44" cy="50" r="4" fill="#fff9db" />
            <circle cx="76" cy="50" r="4" fill="#fff9db" />

            {/* Má ửng hồng phấn */}
            <ellipse cx="36" cy="74" rx="7" ry="4.5" fill="#ff8787" opacity="0.65" />
            <ellipse cx="84" cy="74" rx="7" ry="4.5" fill="#ff8787" opacity="0.65" />

            {/* Mắt theo tâm trạng */}
            {mood === "cheer" || mood === "happy" ? (
              <>
                {/* Mắt tít hình vòm cười siêu đáng yêu */}
                <path d="M42 62C45 57 51 57 54 62" stroke="#2b1810" strokeWidth="3" strokeLinecap="round" />
                <path d="M66 62C69 57 75 57 78 62" stroke="#2b1810" strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Mắt cún tròn to long lanh */}
                <circle cx="48" cy="61" r="5" fill="#2b1810" />
                <circle cx="46.5" cy="59.5" r="1.8" fill="#ffffff" />
                <circle cx="72" cy="61" r="5" fill="#2b1810" />
                <circle cx="70.5" cy="59.5" r="1.8" fill="#ffffff" />
              </>
            )}

            {/* Mũi đen hình tam giác bo tròn */}
            <ellipse cx="60" cy="69" rx="3.5" ry="2.5" fill="#2b1810" />
            {/* Miệng cười xinh xắn */}
            <path d="M54 73Q60 77 66 73" stroke="#2b1810" strokeWidth="2" strokeLinecap="round" />
            {/* Lưỡi hồng thè nhẹ nếu cheer */}
            {mood === "cheer" && (
              <path d="M58 75C58 78 62 78 62 75Z" fill="#ff8787" stroke="#e03131" strokeWidth="0.8" />
            )}

            {/* Cánh hoa anh đào Sakura cài tai */}
            <g transform="translate(80, 28) scale(0.65) rotate(25)">
              <path
                d="M12 0C6 1 0 7 0 14C0 21 8 28 12 32C16 28 24 21 24 14C24 7 18 1 12 0Z"
                fill="#f783ac"
              />
              <circle cx="12" cy="14" r="3" fill="#ffffff" opacity="0.8" />
            </g>

            {/* Khăn quàng cổ Torii đỏ phong cách Nhật Bản */}
            <path d="M38 92C48 97 72 97 82 92C84 96 78 101 60 101C42 101 36 96 38 92Z" fill="#e03131" />
            <circle cx="60" cy="99" r="3" fill="#ffd43b" />
          </svg>
        );
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-center select-none group ${className}`}>
      {speech && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white dark:bg-sumi-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-[11px] font-black text-slate-800 dark:text-slate-100 shadow-[0_6px_16px_rgba(0,0,0,0.12)] z-20 animate-bounce duration-1000">
          <span>{speech}</span>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-sumi-800" />
        </div>
      )}
      
      {/* 3D Animated Figurine */}
      <div
        style={{ width: numSize, height: numSize }}
        className="nq-mascot-3d relative z-10 transition-transform duration-300 group-hover:scale-110 active:scale-95"
      >
        {renderMascotSvg()}
      </div>

      {/* 3D Ground Perspective Shadow */}
      <div
        style={{ width: typeof numSize === "number" ? numSize * 0.75 : "75%" }}
        className="nq-mascot-ground-shadow h-2 -mt-1 rounded-full bg-slate-900/20 dark:bg-black/60 blur-[2px]"
        aria-hidden="true"
      />
    </div>
  );
}

/** Thẻ khích lệ học tập kèm Mascot anime 3D (đặt đầu bài học / từ vựng) */
export function MascotCheerBanner({
  kind = "shiba",
  quote,
  author,
  tag,
  actionButton,
  className = "",
}: {
  kind?: MascotKind;
  quote: string;
  author?: string;
  tag?: string;
  actionButton?: React.ReactNode;
  className?: string;
}) {
  const { t } = useNativeLanguage();
  const displayTag = tag ?? t("mascotCheerTag");

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-rose-200/90 border-b-[4px] border-b-rose-300 dark:border-b-red-900/60 bg-gradient-to-r from-rose-50/90 via-white to-amber-50/70 p-4 sm:p-5 nq-card-3d dark:border-red-950/40 dark:from-sumi-900 dark:via-sumi-900 dark:to-red-950/20 ${className}`}
    >
      {/* Background Japanese pattern accents */}
      <div className="pointer-events-none absolute -right-6 -top-6 text-7xl opacity-5 select-none font-serif">
        桜
      </div>

      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <AnimeMascot kind={kind} mood="cheer" size={56} />
        </div>
        <div className="min-w-0 flex-1">
          {displayTag && (
            <span className="inline-block rounded-full bg-red-100/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-950/60 dark:text-red-300">
              {displayTag}
            </span>
          )}
          <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 italic leading-snug">
            “{quote}”
          </p>
          {author && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              — {author}
            </p>
          )}
        </div>
        {actionButton && <div className="shrink-0">{actionButton}</div>}
      </div>
    </div>
  );
}

