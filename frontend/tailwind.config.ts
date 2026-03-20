import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0e17",
          secondary: "#111827",
          card: "#1a1f2e",
          hover: "#242b3d",
        },
        accent: {
          green: "#10b981",
          red: "#ef4444",
          blue: "#3b82f6",
          yellow: "#f59e0b",
          purple: "#8b5cf6",
        },
        text: {
          primary: "#f3f4f6",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
