import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          50: "#F3F7F8",
          100: "#E4F1F3",
          200: "#C5DEE2",
          700: "#2C7480",
          800: "#25656F",
          900: "#1A4C54",
          950: "#0F3338",
        },
        gold: {
          100: "#F8F1DE",
          400: "#D4B483",
          500: "#C4A15A",
          700: "#8C6A32",
        },
        ink: "#143238",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 18px 40px -24px rgba(16, 46, 51, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
