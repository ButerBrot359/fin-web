import type { Config } from 'tailwindcss'

import { cssVar, palette, shadows } from './src/shared/design/tokens'

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
        'primary-hover': cssVar(shadows.primaryHover),
        'secondary-hover': cssVar(shadows.secondaryHover),
        popup: cssVar(shadows.popup),
      },
      colors: {
        ui: {
          '01': cssVar(palette.ui01),
          '02': cssVar(palette.ui02),
          '03': cssVar(palette.ui03),
          '04': cssVar(palette.ui04),
          '05': cssVar(palette.ui05),
          '06': cssVar(palette.ui06),
          '07': cssVar(palette.ui07),
          '08': cssVar(palette.ui08),
        },
        accent: {
          '01': {
            DEFAULT: cssVar(palette.accent01),
            hover: cssVar(palette.accent01Hover),
            pressed: cssVar(palette.accent01Pressed),
          },
          '02': {
            DEFAULT: cssVar(palette.accent02),
            hover: cssVar(palette.accent02Hover),
          },
        },
        support: { '01': cssVar(palette.support01) },
        pending: {
          'gray-1': cssVar(palette.pendingGray1),
          'gray-2': cssVar(palette.pendingGray2),
          'gray-3': cssVar(palette.pendingGray3),
          'gray-4': cssVar(palette.pendingGray4),
          'gray-5': cssVar(palette.pendingGray5),
          'gray-6': cssVar(palette.pendingGray6),
          'blue-bg': cssVar(palette.pendingBlueBg),
          'warn-border': cssVar(palette.pendingWarnBorder),
          'warn-bg': cssVar(palette.pendingWarnBg),
          'warn-bg-2': cssVar(palette.pendingWarnBg2),
          'yellow-1': cssVar(palette.pendingYellow1),
          'yellow-2': cssVar(palette.pendingYellow2),
          'yellow-3': cssVar(palette.pendingYellow3),
          'weekend-red': cssVar(palette.pendingWeekendRed),
          'weekend-bg': cssVar(palette.pendingWeekendBg),
        },
      },
    },
  },
  plugins: [],
} satisfies Config
