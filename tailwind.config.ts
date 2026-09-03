import type { Config } from 'tailwindcss'

import { palette, shadows } from './src/shared/design/tokens'

const cssVarForConfig = (token: { cssVar: string }): string =>
  `var(${token.cssVar})`

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
        'primary-hover': cssVarForConfig(shadows.primaryHover),
        'secondary-hover': cssVarForConfig(shadows.secondaryHover),
        popup: cssVarForConfig(shadows.popup),
      },
      colors: {
        ui: {
          '01': cssVarForConfig(palette.ui01),
          '02': cssVarForConfig(palette.ui02),
          '03': cssVarForConfig(palette.ui03),
          '04': cssVarForConfig(palette.ui04),
          '05': cssVarForConfig(palette.ui05),
          '06': cssVarForConfig(palette.ui06),
          '07': cssVarForConfig(palette.ui07),
          '08': cssVarForConfig(palette.ui08),
        },
        accent: {
          '01': {
            DEFAULT: cssVarForConfig(palette.accent01),
            hover: cssVarForConfig(palette.accent01Hover),
            pressed: cssVarForConfig(palette.accent01Pressed),
          },
          '02': {
            DEFAULT: cssVarForConfig(palette.accent02),
            hover: cssVarForConfig(palette.accent02Hover),
          },
        },
        support: { '01': cssVarForConfig(palette.support01) },
        pending: {
          'gray-1': cssVarForConfig(palette.pendingGray1),
          'gray-2': cssVarForConfig(palette.pendingGray2),
          'gray-3': cssVarForConfig(palette.pendingGray3),
          'gray-4': cssVarForConfig(palette.pendingGray4),
          'gray-5': cssVarForConfig(palette.pendingGray5),
          'gray-6': cssVarForConfig(palette.pendingGray6),
          'blue-bg': cssVarForConfig(palette.pendingBlueBg),
          'warn-border': cssVarForConfig(palette.pendingWarnBorder),
          'warn-bg': cssVarForConfig(palette.pendingWarnBg),
          'warn-bg-2': cssVarForConfig(palette.pendingWarnBg2),
          'yellow-1': cssVarForConfig(palette.pendingYellow1),
          'yellow-2': cssVarForConfig(palette.pendingYellow2),
          'yellow-3': cssVarForConfig(palette.pendingYellow3),
          'weekend-red': cssVarForConfig(palette.pendingWeekendRed),
          'weekend-bg': cssVarForConfig(palette.pendingWeekendBg),
        },
      },
    },
  },
  plugins: [],
} satisfies Config
