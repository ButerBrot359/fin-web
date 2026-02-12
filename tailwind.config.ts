import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Google Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h2: ['26px', { lineHeight: 'auto', fontWeight: '700' }],
        h3: ['20px', { lineHeight: 'auto', fontWeight: '700' }],
        body1: ['16px', { lineHeight: 'auto', fontWeight: '500' }],
        body2: ['14px', { lineHeight: 'auto', fontWeight: '500' }],
      },
      colors: {
        ui: {
          '01': '#ffffff',
          '02': '#f2f6fd',
          '03': '#c3cee0',
          '04': '#dbe7fd',
          '05': '#9fa9ba',
          '06': '#222124',
        },
        accent: {
          '01': '#daf449',
          '02': '#2a75f4',
        },
        support: {
          '01': '#f4482a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
