/**
 * ЕДИНСТВЕННОЕ место literal-значений дизайна (спека
 * docs/superpowers/specs/2026-09-03-design-system-audit-design.md §1).
 * Имена канонических токенов = переменным Figma (UI 01…, Accent 01/02).
 * pending* — «левые» цвета, зафиксированные при переезде Ф1 как есть;
 * их канонизация — по чек-листу аудита (Ф3/Ф4).
 */
export interface DesignToken {
  cssVar: string
  value: string
}

const t = (cssVar: string, value: string): DesignToken => ({ cssVar, value })

export const palette = {
  ui01: t('--ui-01', '#ffffff'),
  ui02: t('--ui-02', '#f2f6fd'),
  ui03: t('--ui-03', '#c3cee0'),
  ui04: t('--ui-04', '#dbe7fd'),
  ui05: t('--ui-05', '#9fa9ba'),
  ui06: t('--ui-06', '#222124'),
  ui07: t('--ui-07', '#e0eafc'),
  ui08: t('--ui-08', '#c4d6f5'),
  accent01: t('--accent-01', '#daf449'),
  accent01Hover: t('--accent-01-hover', '#dafe10'),
  accent01Pressed: t('--accent-01-pressed', '#c0e10b'),
  accent02: t('--accent-02', '#2a75f4'),
  accent02Hover: t('--accent-02-hover', '#1f66db'),
  support01: t('--support-01', '#f4482a'),
  support02: t('--support-02', '#21d73b'),
  // pending: значения зафиксированы Ф1 как есть, судьба — аудит (Ф3)
  pendingGray1: t('--pending-gray-1', '#d9d9d9'),
  pendingGray2: t('--pending-gray-2', '#dcdcdc'),
  pendingGray3: t('--pending-gray-3', '#e5e7eb'),
  pendingGray4: t('--pending-gray-4', '#e6e9ee'),
  pendingGray5: t('--pending-gray-5', '#eceff4'),
  pendingGray6: t('--pending-gray-6', '#808080'),
  pendingBlueBg: t('--pending-blue-bg', '#e9f0fc'),
  pendingWarnBorder: t('--pending-warn-border', '#f0a000'),
  pendingWarnBg: t('--pending-warn-bg', '#fff8e1'),
  pendingWarnBg2: t('--pending-warn-bg-2', '#fffbe6'),
  pendingYellow1: t('--pending-yellow-1', '#fcd53b'),
  pendingYellow2: t('--pending-yellow-2', '#f6c827'),
  pendingYellow3: t('--pending-yellow-3', '#e3b93c'),
  pendingWeekendRed: t('--pending-weekend-red', '#d32f2f'),
  pendingWeekendBg: t('--pending-weekend-bg', 'rgba(211, 47, 47, 0.06)'),
  pendingDark1: t('--pending-dark-1', '#2f2e33'),
  pendingDark2: t('--pending-dark-2', '#3b3a40'),
  pendingDark3: t('--pending-dark-3', '#1a1a1a'),
  pendingText1: t('--pending-text-1', '#333'),
  pendingText2: t('--pending-text-2', '#666'),
  pendingViolet1: t('--pending-violet-1', '#6366f1'),
  pendingViolet2: t('--pending-violet-2', '#8b5cf6'),
} satisfies Record<string, DesignToken>

// Семантические алиасы: код читает смысл, значение — ссылка на палитру.
export const semantic = {
  textPrimary: palette.ui06,
  textSecondary: palette.ui05,
  divider: palette.ui03,
  zebra: palette.ui02,
  headerLine: palette.ui06,
  surface: palette.ui01,
  surfaceRaised: palette.ui02,
  selection: palette.ui04,
  primary: palette.accent02,
  error: palette.support01,
  brand: palette.accent01,
} satisfies Record<string, DesignToken>

export const shadows = {
  primaryHover: t('--shadow-primary-hover', '2px 4px 8px rgba(218,244,73,0.8)'),
  secondaryHover: t(
    '--shadow-secondary-hover',
    '0px 4px 8px rgba(42,117,244,0.2)'
  ),
  popup: t('--shadow-popup', '0 3px 24px rgba(42, 117, 244, 0.4)'),
} satisfies Record<string, DesignToken>

export const fontFamily = "'Google Sans', system-ui, sans-serif"

export const typography = {
  h2: { size: 26, weight: 700 },
  h3: { size: 20, weight: 700 },
  body1: { size: 16, weight: 500 },
  body2: { size: 14, weight: 500 },
  caption: { size: 12, weight: 500 },
} as const

export const radii = { sm: 4, md: 8, lg: 12 } as const

/** Шкала отступов, кратная 4 — для gap/padding в TS-коде и MUI sx. */
export const spacing = [4, 8, 12, 16, 20, 24, 32] as const

export const cssVar = (token: DesignToken): string =>
  `var(${token.cssVar}, ${token.value})`

export const allTokens = (): DesignToken[] => [
  ...Object.values(palette),
  ...Object.values(shadows),
]
