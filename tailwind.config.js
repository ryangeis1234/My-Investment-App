/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        background: "#090d13",
        panel: "#121820",
        borderLine: "#252e38",
        highlight: "#58a6ff",
        emeraldGreen: "#4ade80",
        roseRed: "#f87171",
        alertAmber: "#fb923c"
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}