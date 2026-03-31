/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand:    { DEFAULT:'#E8A020', dark:'#C4880A', light:'#FFD070' },
        surface:  { DEFAULT:'#131313','low':'#1C1B1B','high':'#2A2A2A','highest':'#353534','lowest':'#0E0E0E' },
        onbrand:  '#1A0E00',
        accent:   '#4EDEA3',
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
