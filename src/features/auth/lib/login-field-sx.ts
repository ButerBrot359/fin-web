import type { SxProps, Theme } from '@mui/material'

import { cssVar, palette, semantic } from '@/shared/design/tokens'

/**
 * Поля экрана входа по макету: заливка `ui-02`, без рамки, радиус 12, высота 56.
 *
 * Глобальная тема рисует поля иначе — белая заливка, рамка `ui-03`, радиус 8, высота 44,
 * а «уехавший» вверх лейбл красит в синий. На экране входа всё это переопределяется точечно,
 * а не правкой темы: тема обслуживает сотни форм приложения, и подгонка её под один экран
 * тихо поменяла бы вид везде.
 *
 * Цвета взяты из токенов проекта (`@/shared/design/tokens`), не подобраны на глаз:
 * `ui-02`, `ui-05`, `support-01`. Макет и токены проекта сошлись.
 */
export const loginFieldSx: SxProps<Theme> = {
  '& .MuiFilledInput-root': {
    backgroundColor: cssVar(palette.ui02),
    border: 'none',
    borderRadius: '12px',
    minHeight: 56,
    '&:hover': { backgroundColor: cssVar(palette.pendingBlueBg) },
    '&.Mui-focused': { backgroundColor: cssVar(palette.ui02), border: 'none' },
    '&.Mui-error': { border: 'none' },
  },
  '& .MuiFilledInput-input': {
    paddingTop: '26px',
    paddingBottom: '8px',
  },
  // В макете подпись поля серая и в поднятом состоянии тоже. Синий из темы означал бы
  // «поле в фокусе» там, где макет показывает обычное заполненное поле.
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: cssVar(semantic.textSecondary),
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink.Mui-error': {
    color: cssVar(semantic.error),
  },
}
