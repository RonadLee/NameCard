import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1f23",
        mute: "#8b919a",
        line: "#eceef2",
        canvas: "#f4f6f9",
        brand: "#1aa3e8",
      },
      boxShadow: {
        card: "0 8px 28px rgba(28, 31, 35, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
