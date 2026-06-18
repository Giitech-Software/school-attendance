/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        "primary-dark": "#172554",
        secondary: "#FACC15",
        light: "#FFFFFF",
        accent1: "#0EA5E9",
        accent2: "#10B981",
        neutral: "#64748B",
        dark: "#0F172A",
        red: {
          DEFAULT: "#EF4444",
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          500: "#EF4444",
          600: "#DC2626",
          700: "#B91C1C",
        },
      },
    },
  },
  plugins: [],
};
