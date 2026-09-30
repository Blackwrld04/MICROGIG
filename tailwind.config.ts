import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Design tokens — PRD v1.1 §16.
 *
 * Contrast notes (WCAG 2.1 AA, PRD §17):
 * - White on #1DBF73 is ~2.4:1 and FAILS, so text on primary fills uses
 *   #222325 (~6.5:1). Never put green text on white for body copy.
 * - Focus rings use charcoal: green on white is below the 3:1 non-text minimum.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#404145",
        heading: "#222325",
        border: "#E4E5E7",
        input: "#E4E5E7",
        ring: "#222325",
        primary: {
          DEFAULT: "#1DBF73",
          hover: "#19A463",
          foreground: "#222325",
        },
        surface: "#F7F7F7",
        muted: {
          DEFAULT: "#F7F7F7",
          foreground: "#5F6168",
        },
        accent: {
          DEFAULT: "#F7F7F7",
          foreground: "#222325",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#404145",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        // Logo artwork colours (brand sheet): darker green on light, PRD green on dark.
        brand: {
          mark: "#13A06F",
          "mark-on-dark": "#1DBF73",
          ink: "#222325",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
