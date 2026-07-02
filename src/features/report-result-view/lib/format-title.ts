import { formatDate, isValid, parseISO } from '@/shared/lib/utils/date'

import type { ReportResultDto } from '@/pages/reports/report-list/types/report'

/** Ключи подстановки, которые форматируются как даты периода. */
const DATE_KEYS = new Set(['from', 'to'])

/** Месяцы в именительном падеже для 1С-формата периода («Январь 2024 г.»). */
const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Дата — первый день месяца. */
const isMonthStart = (d: Date): boolean => d.getDate() === 1

/** Дата — последний день месяца (23:59:59 или 00:00 последнего дня). */
const isMonthEnd = (d: Date): boolean => {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return d.getDate() === next.getDate()
}

/** «Январь 2024 г.» */
const monthLabel = (d: Date): string =>
  `${MONTHS_RU[d.getMonth()]} ${String(d.getFullYear())} г.`

/**
 * 1С-формат периода в заголовке отчёта: если границы — целые месяцы
 * («с 1-го по последний день»), выводятся месяцы («Январь 2024 г. -
 * Декабрь 2026 г.», одинаковый месяц — одно значение), иначе даты
 * dd.MM.yyyy.
 */
const formatPeriod = (fromRaw: string, toRaw: string): string | null => {
  const from = parseISO(fromRaw)
  const to = parseISO(toRaw)
  if (!isValid(from) || !isValid(to)) return null
  if (isMonthStart(from) && isMonthEnd(to)) {
    const a = monthLabel(from)
    const b = monthLabel(to)
    return a === b ? a : `${a} - ${b}`
  }
  return `${formatDate(fromRaw) || fromRaw} - ${formatDate(toRaw) || toRaw}`
}

/**
 * Подставляет `appliedTitleValues` в `titleTemplate` (плейсхолдеры `{key}`).
 * Пара {from}…{to} с разделителем между ними сворачивается в единый
 * 1С-формат периода (месяцы для целых месяцев); одиночные даты — dd.MM.yyyy.
 * Неизвестные/пустые плейсхолдеры заменяются пустой строкой. Если шаблона
 * нет — возвращает пустую строку (блок заголовка не рендерится).
 */
export const formatReportTitle = (result: ReportResultDto): string => {
  const template = result.titleTemplate
  if (!template) return ''
  const values = result.appliedTitleValues ?? {}

  let effective = template
  const fromRaw = values.from
  const toRaw = values.to
  if (typeof fromRaw === 'string' && typeof toRaw === 'string') {
    const period = formatPeriod(fromRaw, toRaw)
    if (period) {
      // «{from} - {to}» / «{from} — {to}» → единый блок периода.
      effective = effective.replace(/\{from\}\s*[-—–]\s*\{to\}/, period)
    }
  }

  return effective.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const raw = values[key]
    if (raw == null) return ''
    if (DATE_KEYS.has(key) && typeof raw === 'string') {
      return formatDate(raw) || raw
    }
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    return ''
  })
}
