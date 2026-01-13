/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark': {
          'bg': '#0a0a0a',
          'surface': '#111111',
          'border': '#1a1a1a',
          'hover': '#1f1f1f',
        },
      },
    },
  },
  plugins: [],
}
