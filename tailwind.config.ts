import type { Config } from "tailwindcss";

/**
 * ÖRZA design tokens — ported from the ÖRZA ecosystem site
 * (warm cream canvas, frosted glass surfaces, energy gradient, cyan focus).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        editorial: ["var(--font-playfair)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        orza: {
          // canvas
          "bg-0": "#FBF7F1",
          "bg-1": "#F6F0E8",
          "bg-2": "#EFE7DD",
          "bg-3": "#E7DDD1",
          // text
          strong: "#141414",
          DEFAULT: "#2A2A2A",
          muted: "#5B5B5B",
          subtle: "#7A7A7A",
          inverse: "#F7F4EF",
          // hero
          hero: "#07090C",
          "hero-2": "#0B0F14",
          // accents
          cyan: { 50: "#E8FBFF", 100: "#CFF6FF", 200: "#9DEEFF", 300: "#63E2FA", 400: "#2FD2F0", DEFAULT: "#0BBEDC", 600: "#0B8FA6", 700: "#0A6F82", 800: "#0A5664", 900: "#083B45" },
          violet: { 50: "#F4F1FF", 100: "#EAE4FF", 300: "#BFA8FF", DEFAULT: "#8757F2", 600: "#6E3ED6", 800: "#3F257A" },
          amber: "#FFB454",
          coral: "#FF7A6A",
          pink: "#FF5FA2",
          cream: "#FFE7C8",
          success: "#127A56",
          warning: "#B06A00",
          error: "#B02C2C",
          info: "#0B8FA6",
        },
      },
      borderRadius: {
        "orza-xs": "8px",
        "orza-sm": "12px",
        "orza-md": "16px",
        "orza-lg": "20px",
        "orza-xl": "28px",
      },
      boxShadow: {
        "orza-glass": "0 10px 30px rgba(20,20,20,0.08), 0 1px 0 rgba(255,255,255,0.55) inset",
        "orza-glass-hover": "0 16px 44px rgba(20,20,20,0.10), 0 1px 0 rgba(255,255,255,0.62) inset",
        "orza-floating": "0 18px 60px rgba(20,20,20,0.10)",
        "orza-cta": "0 18px 60px rgba(20,20,20,0.18), 0 1px 0 rgba(255,255,255,0.18) inset",
      },
      backdropBlur: { orza: "22px" },
      transitionTimingFunction: {
        orza: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "orza-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "orza-in": "cubic-bezier(0.7, 0, 0.84, 0)",
      },
      transitionDuration: { 150: "150ms", 220: "220ms", 320: "320ms", 500: "500ms" },
      backgroundImage: {
        "orza-energy": "linear-gradient(135deg, #FFB454 0%, #FF7A6A 50%, #FF5FA2 100%)",
        "orza-dot": "radial-gradient(circle at 30% 30%, #FFB454, #FF7A6A)",
      },
      keyframes: {
        "orza-pulse": { "0%,100%": { transform: "scale(1)", opacity: "0.9" }, "50%": { transform: "scale(1.04)", opacity: "1" } },
        "orza-float": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        "orza-spin-slow": { to: { transform: "rotate(360deg)" } },
        "orza-shimmer": { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "orza-pulse": "orza-pulse 4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite",
        "orza-float": "orza-float 6s ease-in-out infinite",
        "orza-spin-slow": "orza-spin-slow 60s linear infinite",
        "orza-shimmer": "orza-shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
