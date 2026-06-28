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
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"',
          '"Microsoft YaHei"', 'Segoe UI', 'Roboto', 'Helvetica',
          'Arial', 'sans-serif',
        ],
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
