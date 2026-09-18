import type { Components, Theme } from '@mui/material/styles'

import { cssVar, palette, semantic } from '@/shared/design/tokens'

// Табы форм/панелей по Figma (side-panel 324:13541, компонент Tab):
// активный — тёмная плашка с белым текстом, неактивные — белые, обычный
// регистр; индикатор — синяя полоска под баром.
export const tabsComponents: Components<Omit<Theme, 'components'>> = {
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 36 },
      indicator: {
        height: 3,
        borderRadius: 2,
        backgroundColor: cssVar(semantic.primary),
      },
      flexContainer: { gap: 2 },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontSize: 16,
        fontWeight: 500,
        minHeight: 36,
        padding: '8px 16px',
        color: cssVar(semantic.textPrimary),
        backgroundColor: cssVar(palette.ui01),
        borderRadius: '8px 8px 0 0',
        '&:hover:not(.Mui-selected)': {
          color: cssVar(semantic.primary),
        },
        '&.Mui-selected': {
          backgroundColor: cssVar(palette.ui06),
          color: cssVar(palette.ui01),
        },
      },
    },
  },
}
