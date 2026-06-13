/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Pretendard Variable', '-apple-system', 'sans-serif'],
      },
      colors: {
        base: {
          900: '#0b0e13',
          850: '#10141c',
          800: '#151a24',
          700: '#1d2433',
          600: '#2a3347',
          500: '#3e5068',
          400: '#7e93ad',
          300: '#9fb2c7',
          200: '#c0cfe0',
          100: '#e2e8f4',
        },
        quality: {
          uncommon: '#1eff00',
          rare: '#0070dd',
          epic: '#a335ee',
          legendary: '#ff8000',
        },
      },
    },
  },
  plugins: [],
};
