/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#17181D',
        surface: '#22242C',
        'surface-container': '#22242C',
        'surface-container-high': '#292B33',
        'surface-container-highest': '#353640',
        primary: '#B78362',
        'primary-hover': '#C28F6F',
        'primary-light': '#CCA184',
        'border-slate': '#353640',
        'border-slate-light': '#454751',
        'on-surface': '#F3F1EF',
        'on-surface-variant': '#B8B9C1',
        'on-surface-subtle': '#999AA3',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
