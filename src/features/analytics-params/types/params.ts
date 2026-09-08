/** Значения параметров по коду: то, что редактирует панель параметров. */
export type AnalyticsParamValues = Record<string, unknown>

/**
 * Значение параметра типа DATE_RANGE. Даты храним строками `yyyy-MM-dd`:
 * такое значение переживает сериализацию в URL и localStorage, а на бэкенд
 * уходит как есть (см. `expandParams`).
 */
export interface AnalyticsDateRangeValue {
  from: string | null
  to: string | null
}
