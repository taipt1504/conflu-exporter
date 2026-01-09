/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './public/*.html'
  ],
  theme: {
    extend: {
      colors: {
        'confluence-blue': '#0052CC',
      }
    }
  },
  plugins: []
}
