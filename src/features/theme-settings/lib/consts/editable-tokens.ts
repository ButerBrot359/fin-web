import { palette } from '@/shared/design/tokens'

/**
 * Токены, предлагаемые пользователю в диалоге «Тема оформления», — кураторский
 * поднабор реестра `tokens.ts`: то, что безопасно и осмысленно крутить руками.
 * Ключ — имя токена без `--` (формат контракта `/api/theme-settings`),
 * `labelKey` — ключ i18n, `defaultValue` — из реестра (для placeholder).
 */
export type EditableThemeTokenLabel =
  | 'accent'
  | 'actionButtons'
  | 'appBackground'
  | 'panelBackground'

export interface EditableThemeToken {
  key: string
  labelKey: EditableThemeTokenLabel
  defaultValue: string
}

const token = (
  cssVar: string,
  labelKey: EditableThemeTokenLabel,
  defaultValue: string
): EditableThemeToken => ({
  key: cssVar.replace(/^--/, ''),
  labelKey,
  defaultValue,
})

export const EDITABLE_THEME_TOKENS: EditableThemeToken[] = [
  token(palette.accent02.cssVar, 'accent', palette.accent02.value),
  token(palette.accent01.cssVar, 'actionButtons', palette.accent01.value),
  token(palette.ui02.cssVar, 'appBackground', palette.ui02.value),
  token(palette.ui01.cssVar, 'panelBackground', palette.ui01.value),
]

/** Ступени масштаба интерфейса; значение — множитель строкой для `ui-scale`. */
export const UI_SCALE_OPTIONS = ['0.9', '1', '1.1', '1.25'] as const
