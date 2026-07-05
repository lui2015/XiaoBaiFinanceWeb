import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          500: '#2c7be5',
          600: '#1f63c4',
          700: '#1a53a3',
        },
        // 漫画风活力配色
        ink: '#1f1a2e',
        sunny: '#ffcf33',
        coral: '#ff6b6b',
        mint: '#22c993',
        sky: '#38bdf8',
        grape: '#8b5cf6',
        cream: '#fff9f0',
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
        // 漫画硬阴影（solid offset）
        comic: '3px 3px 0 0 #1f1a2e',
        'comic-md': '4px 4px 0 0 #1f1a2e',
        'comic-lg': '6px 6px 0 0 #1f1a2e',
        'comic-sm': '2px 2px 0 0 #1f1a2e',
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
