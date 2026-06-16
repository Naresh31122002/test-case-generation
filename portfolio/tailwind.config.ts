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
        background: "var(--color-background)",
        muted: "var(--color-muted)",
        foreground: "var(--foreground)",
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        surface: "var(--color-surface)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          light: "var(--color-text-light)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        heading: ["var(--font-plus-jakarta-sans)"],
      },
    },
  },
  plugins: [],
};
export default config;
