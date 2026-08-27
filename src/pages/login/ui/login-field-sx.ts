import type { SxProps, Theme } from '@mui/material'

/**
 * Поля экрана входа по макету: заливка `ui-02`, без рамки, радиус 12, высота 56.
 *
 * Глобальная тема рисует поля иначе — белая заливка, рамка `#c3cee0`, радиус 8, высота 44,
 * а «уехавший» вверх лейбл красит в синий. На экране входа всё это переопределяется точечно,
 * а не правкой темы: тема обслуживает сотни форм приложения, и подгонка её под один экран
 * тихо поменяла бы вид везде.
 *
 * Цвета взяты из `tailwind.config.ts`, не подобраны на глаз: `#f2f6fd` = `ui-02`,
 * `#9fa9ba` = `ui-05`, `#f4482a` = `support-01`. Макет и токены проекта сошлись.
 */
export const loginFieldSx: SxProps<Theme> = {
  '& .MuiFilledInput-root': {
    backgroundColor: '#f2f6fd',
    border: 'none',
    borderRadius: '12px',
    minHeight: 56,
    '&:hover': { backgroundColor: '#e9f0fc' },
    '&.Mui-focused': { backgroundColor: '#f2f6fd', border: 'none' },
    '&.Mui-error': { border: 'none' },
  },
  '& .MuiFilledInput-input': {
    paddingTop: '26px',
    paddingBottom: '8px',
  },
  // В макете подпись поля серая и в поднятом состоянии тоже. Синий из темы означал бы
  // «поле в фокусе» там, где макет показывает обычное заполненное поле.
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#9fa9ba',
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink.Mui-error': {
    color: '#f4482a',
  },
}
