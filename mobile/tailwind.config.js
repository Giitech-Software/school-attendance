/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        secondary: "#FACC15",
        light: "#FFFFFF",
        accent1: "#0EA5E9",
        accent2: "#10B981",
        green: {
          300: "#22C55E",
          500: "#16A34A",
        },
        neutral: "#64748B",
        dark: "#0F172A",
        danger: "#EF4444",
      },
    },
  },
  plugins: [],
};
