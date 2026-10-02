import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        charcoal: {
          900: "#0e0f11",
          800: "#13141a",
          700: "#1a1b22",
          600: "#22232d",
        },
      },
      boxShadow: {
        "glow-amber":   "0 0 32px -6px rgba(245,158,11,0.45)",
        "glow-emerald": "0 0 32px -6px rgba(16,185,129,0.40)",
        "glow-rose":    "0 0 32px -8px rgba(251,113,133,0.45)",
        "panel":        "0 1px 3px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)",
      },
      animation: {
        "pulse-slow": "pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow":  "spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
