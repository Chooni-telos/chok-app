import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        jd: {
          bg: "#0b0a18",
          surface: "#ffffff0a",
          border: "#ffffff14",
          muted: "#e8e6f0",
          yes: "#4ade80",
          no: "#f87171",
          pq: "#fbbf24",
          accent: "#9b78ff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
