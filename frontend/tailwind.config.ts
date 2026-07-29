import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      colors: {
        primary: {
          DEFAULT: "#3758F9",
          dark: "#1B44C8",
          light: "#EEF2FF",
        },
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        success: {
          DEFAULT: "#22C55E",
          dark: "#16A34A",
          light: "#F0FDF4",
        },
        warning: {
          DEFAULT: "#F59E0B",
          dark: "#D97706",
          light: "#FFFBEB",
        },
        danger: {
          DEFAULT: "#EF4444",
          dark: "#DC2626",
          light: "#FEF2F2",
        },
        info: {
          DEFAULT: "#0EA5E9",
          dark: "#0284C7",
          light: "#F0F9FF",
        },
        surface: "var(--color-surface)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "surface-container-low": "var(--color-surface-container-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "surface-bright": "var(--color-surface-bright)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "outline-variant": "var(--color-outline-variant)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        "card-foreground": "var(--color-card-foreground)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        ring: "var(--color-ring)",
        destructive: "var(--color-destructive)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        focus: "var(--shadow-focus-primary)",
      },
    },
  },
  plugins: [],
};

export default config;
