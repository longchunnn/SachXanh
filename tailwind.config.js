/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  important: true, // Để Tailwind có thể đè style của Ant Design
  theme: {
    extend: {
      spacing: {
        "13": "3.25rem",
        "112.5": "28.125rem", // 450px
        "138": "34.5rem",
        "152": "38rem",
        "168": "42rem",
      },
      zIndex: {
        "60": "60",
      },
    },
  },
  plugins: [],
}