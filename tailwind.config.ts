import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 全部走 CSS 变量，暗色模式（.dark）下切换为赛博朋克配色
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
        },
        // 漫画风活力配色
        ink: 'rgb(var(--ink) / <alpha-value>)',
        sunny: 'rgb(var(--sunny) / <alpha-value>)',
        coral: 'rgb(var(--coral) / <alpha-value>)',
        mint: 'rgb(var(--mint) / <alpha-value>)',
        sky: 'rgb(var(--sky) / <alpha-value>)',
        grape: 'rgb(var(--grape) / <alpha-value>)',
        cream: 'rgb(var(--cream) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"',
          '"Microsoft YaHei"', 'Segoe UI', 'Roboto', 'Helvetica',
          'Arial', 'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        // 漫画硬阴影（solid offset）；颜色走变量，暗色下变为霓虹
        comic: '3px 3px 0 0 rgb(var(--comic-shadow))',
        'comic-md': '4px 4px 0 0 rgb(var(--comic-shadow))',
        'comic-lg': '6px 6px 0 0 rgb(var(--comic-shadow))',
        'comic-sm': '2px 2px 0 0 rgb(var(--comic-shadow))',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        pop: 'pop .25s ease-out both',
        wiggle: 'wiggle .6s ease-in-out',
      },
      typography: {
        DEFAULT: {
          css: { 'max-width': 'none' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
