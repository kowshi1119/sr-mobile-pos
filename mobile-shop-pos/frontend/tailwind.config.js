/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
          light: 'rgb(var(--color-brand-light) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          low: 'rgb(var(--color-surface-low) / <alpha-value>)',
          high: 'rgb(var(--color-surface-high) / <alpha-value>)',
          highest: 'rgb(var(--color-surface-highest) / <alpha-value>)',
          lowest: 'rgb(var(--color-surface-lowest) / <alpha-value>)',
        },
        onbrand: 'rgb(var(--color-onbrand) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Syne"','sans-serif'],
        body:    ['"DM Sans"','sans-serif'],
        mono:    ['"JetBrains Mono"','monospace'],
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.3s ease',
        'pulse-soft':'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn:    { from:{ opacity:0 }, to:{ opacity:1 } },
        slideUp:   { from:{ opacity:0, transform:'translateY(12px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        pulseSoft: { '0%,100%':{ opacity:1 }, '50%':{ opacity:.5 } },
      },
    },
  },
  plugins: [],
}
