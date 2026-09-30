import type { Components, Theme } from '@mui/material/styles'

import { cssVar, palette, semantic } from '@/shared/design/tokens'

// Табы форм/панелей по Figma (side-panel 324:13541, компонент Tab):
// активный — тёмная плашка с белым текстом, неактивные — белые, обычный
// регистр; индикатор — синяя полоска под баром.
export const tabsComponents: Components<Omit<Theme, 'components'>> = {
  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 36 },
      // Родной индикатор MUI позиционируется JS-ом по offsetLeft/offsetWidth
      // активной вкладки; когда ширины вкладок меняются после первого замера
      // (догрузился шрифт), полоса остаётся на старом месте и «выходит за
      // рамки» плашки (SCRUM-412 п.6). Вместо него полоску рисует box-shadow
      // самой активной вкладки (см. MuiTab ниже) — чистый CSS, разъехаться не
      // может.
      indicator: { display: 'none' },
      flexContainer: { gap: 2 },
      // Вертикальная лента (ЭСФ, tabsPlacement=LEFT): полоска не снизу, а по
      // внутреннему краю плашки — как у родного вертикального индикатора.
      vertical: {
        '& .MuiTab-root.Mui-selected': {
          boxShadow: `inset -3px 0 0 0 ${cssVar(semantic.primary)}`,
        },
      },
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
          // Синяя полоска-подчёркивание строго по ширине плашки — замена
          // JS-индикатора MuiTabs (см. комментарий выше).
          boxShadow: `inset 0 -3px 0 0 ${cssVar(semantic.primary)}`,
        },
      },
    },
  },
}
