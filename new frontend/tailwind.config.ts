import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#FAFBFC",
        surface: "#FFFFFF",
        navy: "#0F172A",
        muted: "#64748B",
        border: "#E2E8F0",
        pink: "#FF0A78",
        cyan: "#06B6D4",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        "surface-pink": "#FFF0F7",
        "surface-cyan": "#ECFEFF",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        display: ["32px", { fontWeight: "700" }],
        h1: ["24px", { fontWeight: "600" }],
        h2: ["18px", { fontWeight: "600" }],
        h3: ["15px", { fontWeight: "600" }],
        body: ["14px", { fontWeight: "400" }],
        "body-strong": ["14px", { fontWeight: "600" }],
        small: ["12px", { fontWeight: "400" }],
        "small-strong": ["12px", { fontWeight: "600" }],
        mono: ["13px", { fontWeight: "400" }],
        "mono-strong": ["13px", { fontWeight: "600" }],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
      },
      borderRadius: {
        card: "10px",
        btn: "6px",
      },
      boxShadow: {
        card: "0 4px 16px rgba(0,0,0,0.06)",
      },
      maxWidth: {
        content: "1200px",
      },
      width: {
        sidebar: "240px",
      },
    },
  },
  plugins: [],
};
export default config;
