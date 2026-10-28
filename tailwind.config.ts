import type { Config } from "tailwindcss";

// Theme tokens live in CSS variables (see globals.css) so every utility adapts to light/dark.
// `white` is remapped to the foreground token: `text-white/60` = "60% foreground" in both themes.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("fg"),
        surface: v("surface"),
        safe: v("safe"),
        active: v("active"),
        warn: v("warn"),
        danger: v("danger"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      keyframes: {
        ring: {
          "0%,100%": { transform: "rotate(0)" },
          "10%,30%,50%,70%": { transform: "rotate(-14deg)" },
          "20%,40%,60%,80%": { transform: "rotate(14deg)" },
        },
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgb(var(--danger) / 0.5)" },
          "50%": { boxShadow: "0 0 0 18px rgb(var(--danger) / 0)" },
        },
      },
      animation: {
        ring: "ring 1s ease-in-out infinite",
        pulseGlow: "pulseGlow 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
