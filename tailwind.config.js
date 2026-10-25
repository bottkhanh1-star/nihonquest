/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    // Band điện thoại 360–430px chưa được `sm` (640px) phủ tới, nên thêm
    // breakpoint xs để có một bước điều chỉnh riêng cho màn hình nhỏ.
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        sakura: {
          50: "#fff3ee",
          100: "#ffe4d9",
          200: "#f6caba",
          300: "#efa98e",
          400: "#e58166",
          500: "#ca503e",
          600: "#b73d30",
          700: "#9e3329",
          800: "#812d26",
          900: "#682a24",
        },
        torii: {
          500: "#dc2626",
          600: "#b91c1c",
          700: "#991b1b",
        },
        sumi: {
          800: "#26382f",
          900: "#19271f",
          950: "#111916",
        },
        fuji: {
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        matcha: {
          500: "#10b981",
          600: "#059669",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "system-ui", "sans-serif"],
        jp: ["var(--font-jp)", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)",
        "card-hover": "0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)",
        glow: "0 0 20px -3px rgba(244, 63, 110, 0.35)",
        "glow-gold": "0 0 20px -3px rgba(245, 158, 11, 0.35)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        springUp: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slideInUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        indeterminate: {
          "0%": { transform: "translateX(-100%) scaleX(0.2)" },
          "50%": { transform: "translateX(0%) scaleX(0.7)" },
          "100%": { transform: "translateX(100%) scaleX(0.2)" },
        },
        pop: {
          "0%": { transform: "scale(0.96)" },
          "50%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)" },
        },
        heartPop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.03)" },
        },
        waveEqualizer: {
          "0%, 100%": { height: "6px" },
          "50%": { height: "24px" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        fadeIn: "fadeIn 0.28s ease-out forwards",
        springUp: "springUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        slideInUp: "slideInUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        slideInDown: "slideInDown 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        indeterminate: "indeterminate 1.8s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite",
        pop: "pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        heartPop: "heartPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        waveEqualizer: "waveEqualizer 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
