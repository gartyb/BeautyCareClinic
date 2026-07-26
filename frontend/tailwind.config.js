/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'clinic-bg':     '#FFF8F6',
        'clinic-pink':   '#F6D6D9',
        'clinic-blush':  '#FCEEEF',
        'clinic-gold':   '#D8B56D',
        'clinic-text':   '#3A2E2E',
        'clinic-muted':  '#8A7A7A',
        'clinic-border': '#F1DCDC',
      },
      fontFamily: {
        sans: ['Assistant', 'sans-serif'],
      },
      zIndex: {
        '60': '60',
      },
    },
  },
  plugins: [],
}
