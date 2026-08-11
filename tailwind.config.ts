import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Konfirmimi i rezervimit: shenja vizatohet, unaza shpërndahet, letrat bien.
        "check-draw": {
          from: { strokeDashoffset: "32" },
          to: { strokeDashoffset: "0" },
        },
        "ring-out": {
          from: { transform: "scale(0.6)", opacity: "0.55" },
          to: { transform: "scale(1.9)", opacity: "0" },
        },
        "badge-pop": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "60%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        confetti: {
          "0%": { transform: "translate3d(0,0,0) rotate(0deg)", opacity: "0" },
          "12%": { opacity: "1" },
          "100%": {
            transform: "translate3d(var(--dx), var(--dy), 0) rotate(var(--spin))",
            opacity: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "check-draw": "check-draw 0.45s cubic-bezier(0.65,0,0.35,1) 0.25s backwards",
        "ring-out": "ring-out 1.1s ease-out 0.15s",
        "badge-pop": "badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) backwards",
        confetti: "confetti 1.15s cubic-bezier(0.2,0.6,0.35,1) backwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
