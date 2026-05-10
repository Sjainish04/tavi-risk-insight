import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // IBM Carbon blue palette — keeps the UI simple white + IBM blue
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
      },
      fontFamily: {
        sans: ['"Times New Roman"', "Times", "serif"],
        mono: ['"Courier New"', "Courier", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
