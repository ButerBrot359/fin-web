import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      fontFamily: {
        sans: ['Google Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h2: ['26px', { lineHeight: 'auto', fontWeight: '700' }],
        h3: ['20px', { lineHeight: 'auto', fontWeight: '700' }],
        body1: ['16px', { lineHeight: 'auto', fontWeight: '500' }],
        body2: ['14px', { lineHeight: 'auto', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        'primary-hover': '2px 4px 8px rgba(218,244,73,0.8)',
        'secondary-hover': '0px 4px 8px rgba(42,117,244,0.2)',
      },
      colors: {
        ui: {
          '01': '#ffffff',
          '02': '#f2f6fd',
          '03': '#c3cee0',
          '04': '#dbe7fd',
          '05': '#9fa9ba',
          '06': '#222124',
          '07': '#E0EAFC',
          '08': '#c4d6f5',
        },
        accent: {
          '01': {
            DEFAULT: '#daf449',
            hover: '#dafe10',
            pressed: '#c0e10b',
          },
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
