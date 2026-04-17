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
        "112.5": "28.125rem", // 450px
      },
    },
  },
  plugins: [],
}