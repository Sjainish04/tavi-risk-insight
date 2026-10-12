import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // IBM Carbon blue palette: keeps the UI white + IBM blue
        ibm: {
          50: "#edf5ff",
          100: "#d0e2ff",
          200: "#a6c8ff",
          300: "#78a9ff",
          400: "#4589ff",
          500: "#0f62fe", // primary
          600: "#0043ce",
          700: "#002d9c",
          800: "#001d6c",
          900: "#001141",
        },
        // Deep navy for the patient strip and hero panels.
        ink: {
          800: "#0b1a33",
          900: "#071226",
        },
      },
      fontFamily: {
        sans: ['"Times New Roman"', "Times", "serif"],
        // Numbers sit in a modern monospace so columns of risks line up.
        mono: ["ui-monospace", "SFMono-Regular", '"SF Mono"', "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.05)",
        lift: "0 2px 6px rgb(15 23 42 / 0.06), 0 16px 40px rgb(15 23 42 / 0.10)",
        glow: "0 8px 24px -8px rgb(15 98 254 / 0.55)",
      },
      keyframes: {
        "grow-x": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "grow-x": "grow-x 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-up": "fade-up 450ms ease-out both",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
