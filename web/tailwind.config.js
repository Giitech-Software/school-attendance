
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",   // Blue
        secondary: "#FACC15", // Yellow
        light: "#FFFFFF",     // White
        accent1: "#0EA5E9",   // Sky blue
        accent2: "#10B981",   // Green
        neutral: "#64748B",   // Slate gray
        dark: "#0F172A",      // Navy black
        red: "#EF4444",       // 🔴 Added red (Tailwind default red-500)
      },
    },
  },
  plugins: [],
}
