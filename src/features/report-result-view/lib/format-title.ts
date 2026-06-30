import { formatDate } from '@/shared/lib/utils/date'

import type { ReportResultDto } from '@/pages/reports/report-list/types/report'

/** Ключи подстановки, которые форматируются как дата dd.MM.yyyy. */
const DATE_KEYS = new Set(['from', 'to'])

/**
 * Подставляет `appliedTitleValues` в `titleTemplate` (плейсхолдеры `{key}`).
 * Даты ({from}/{to}) форматируются как `dd.MM.yyyy`; остальное — как есть.
 * Неизвестные/пустые плейсхолдеры заменяются пустой строкой. Если шаблона нет
 * — возвращает пустую строку (блок заголовка не рендерится).
 */
export const formatReportTitle = (result: ReportResultDto): string => {
  const template = result.titleTemplate
  if (!template) return ''
  const values = result.appliedTitleValues ?? {}
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const raw = values[key]
    if (raw == null) return ''
    if (DATE_KEYS.has(key) && typeof raw === 'string') {
      return formatDate(raw) || raw
    }
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    return ''
  })
}
