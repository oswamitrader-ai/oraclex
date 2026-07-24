/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0c0e',
        surface: '#131619',
        surface2: '#1a1e22',
        border: '#23282d',
        yes: '#00d992',
        no: '#ff5170',
        accent: '#1652f0',
      }
    },
  },
  plugins: [],
}
