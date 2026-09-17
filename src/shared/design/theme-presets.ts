/** Пары «токен → значение»; дублирует ThemeTokens из entities/theme — shared не может импортировать вверх. */
type ThemeTokens = Record<string, string>

/**
 * Готовые темы оформления (решение владельца 10.09: пользователю — выбор из
 * пресетов, не RGB-палитра). «Стандартная» — канон Figma, токены не
 * переопределяются вовсе. Дополнительные пресеты переопределяют семейство
 * акцентов ЦЕЛИКОМ (основной + hover/pressed) — иначе наведение оставалось
 * бы в цветах старой темы.
 *
 * `swatch` — два цвета для превью в диалоге (акцент + кнопка действия).
 */
export type ThemePresetId = 'standard' | 'emerald' | 'indigo'

export interface ThemePreset {
  id: ThemePresetId
  tokens: ThemeTokens
  swatch: [string, string]
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'standard',
    tokens: {},
    swatch: ['#2a75f4', '#daf449'],
  },
  // Тени — тоже часть акцентного семейства (свечение primary-кнопки — это
  // прозрачный accent-01, синие тени — прозрачный accent-02): без их
  // переопределения индиго-кнопка светилась лаймом стандартной темы
  // (живой дефект 10.09).
  {
    id: 'emerald',
    tokens: {
      'accent-02': '#0f766e',
      'accent-02-hover': '#115e59',
      'accent-01': '#a7f3d0',
      'accent-01-hover': '#6ee7b7',
      'accent-01-pressed': '#34d399',
      'shadow-primary-hover': '2px 4px 8px rgba(167,243,208,0.8)',
      'shadow-secondary-hover': '0px 4px 8px rgba(15,118,110,0.2)',
      'shadow-popup': '0 3px 24px rgba(15,118,110,0.4)',
    },
    swatch: ['#0f766e', '#a7f3d0'],
  },
  {
    id: 'indigo',
    tokens: {
      'accent-02': '#4f46e5',
      'accent-02-hover': '#4338ca',
      'accent-01': '#c7d2fe',
      'accent-01-hover': '#a5b4fc',
      'accent-01-pressed': '#818cf8',
      'shadow-primary-hover': '2px 4px 8px rgba(199,210,254,0.8)',
      'shadow-secondary-hover': '0px 4px 8px rgba(79,70,229,0.2)',
      'shadow-popup': '0 3px 24px rgba(79,70,229,0.4)',
    },
    swatch: ['#4f46e5', '#c7d2fe'],
  },
]

/** Ступени масштаба интерфейса; значение — множитель строкой для `ui-scale`. */
export const UI_SCALE_OPTIONS = ['0.9', '1', '1.1', '1.25'] as const
