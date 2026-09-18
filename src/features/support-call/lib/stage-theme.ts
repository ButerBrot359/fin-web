import { cssVar, palette, semantic } from '@/shared/design/tokens'

/**
 * Тёмная сцена разговора в палитре webbuh.
 *
 * <p>LiveKit красит свои примитивы собственными переменными, и по умолчанию это чужая тёмно-серая
 * тема. Переопределяем их на цвета сайта — тогда плитки участников, подписи и рамки выглядят
 * частью webbuh, а не встроенным виджетом.
 */
export const STAGE_THEME = {
  // Сырые palette-токены, не semantic: тёмный ФОН сцены — это ui06 как цвет
  // поверхности, а не «цвет текста»; серверная тема фазы 2, меняя textPrimary,
  // не должна перекрашивать фон звонилки (финальное ревью Ф1+Ф2, seed §3).
  '--lk-bg': cssVar(palette.ui06),
  '--lk-bg2': cssVar(palette.pendingDark1),
  '--lk-bg3': cssVar(palette.pendingDark2),
  '--lk-fg': cssVar(palette.ui01),
  '--lk-fg2': cssVar(palette.ui03),
  '--lk-fg3': cssVar(palette.ui05),
  '--lk-accent-bg': cssVar(semantic.primary),
  '--lk-accent-fg': cssVar(palette.ui01),
  '--lk-danger': cssVar(semantic.error),
  '--lk-success': cssVar(semantic.brand),
  '--lk-border-color': cssVar(palette.pendingLkBorder),
  '--lk-border-radius': '12px',
  '--lk-grid-gap': '12px',
  '--lk-font-family': '"Google Sans", system-ui, sans-serif',
} as const
