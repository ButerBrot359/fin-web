import { format, isValid, parseISO } from 'date-fns'

import type { AnalyticsValueFormat } from '@/entities/analytics'

/** Неразрывный пробел — разделитель разрядов, как в печатных формах 1С. */
const NBSP = '\u00A0'

/** Метка «Да» для булевых значений: глиф не требует перевода. */
const TRUE_MARK = '✓'
const FALSE_MARK = '—'

/** Язык подписей: 'kz' включает казахские варианты (labelKz/titleKz). */
export const isKazakh = (lang?: string | null): boolean => {
  const normalized = (lang ?? '').toLowerCase()
  return normalized.startsWith('kz') || normalized.startsWith('kk')
}

/**
 * Число из значения датасета. PostgreSQL numeric приходит строкой, поэтому
 * строки разбираем; `null` остаётся `null` (в графике это разрыв, не ноль).
 */
export const toFiniteNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const groupDigits = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)

/**
 * Детерминированное форматирование числа: разряды через неразрывный пробел,
 * дробная часть через запятую. От локали браузера не зависит.
 */
export const formatNumber = (value: number, fractionDigits = 2): string => {
  const fixed = value.toFixed(fractionDigits)
  const negative = fixed.startsWith('-') && Number(fixed) !== 0
  const [intPart = '0', fracPart] = (
    negative ? fixed.slice(1) : fixed.replace(/^-/, '')
  ).split('.')
  const grouped = groupDigits(intPart)
  const sign = negative ? '-' : ''
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`
}

export const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value === 'number') {
    const fromEpoch = new Date(value)
    return isValid(fromEpoch) ? fromEpoch : null
  }
  if (typeof value !== 'string' || value === '') return null
  const iso = parseISO(value)
  if (isValid(iso)) return iso
  const fallback = new Date(value)
  return isValid(fallback) ? fallback : null
}

const formatDatePart = (value: unknown, pattern: string): string => {
  const parsed = parseDateValue(value)
  return parsed ? format(parsed, pattern) : ''
}

const formatFixed = (value: unknown, fractionDigits: number): string => {
  const parsed = toFiniteNumber(value)
  if (parsed == null) return typeof value === 'string' ? value : ''
  return formatNumber(parsed, fractionDigits)
}

/** Текст произвольного значения: примитивы как есть, объекты — пусто. */
export const asText = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'boolean') return value ? TRUE_MARK : FALSE_MARK
  if (value instanceof Date) return format(value, 'dd.MM.yyyy')
  return ''
}

/**
 * Значение ячейки/подписи по формату из спецификации.
 * Пустое значение — всегда пустая строка, без «null» и «undefined».
 */
export const formatValue = (
  value: unknown,
  valueFormat?: AnalyticsValueFormat | null
): string => {
  if (value == null) return ''
  switch (valueFormat) {
    case 'MONEY':
    case 'DECIMAL2':
      return formatFixed(value, 2)
    case 'INTEGER':
      return formatFixed(value, 0)
    case 'PERCENT': {
      const parsed = toFiniteNumber(value)
      if (parsed == null) return asText(value)
      return `${formatNumber(parsed, 2)}${NBSP}%`
    }
    case 'DATE':
      return formatDatePart(value, 'dd.MM.yyyy')
    case 'DATETIME':
      return formatDatePart(value, 'dd.MM.yyyy HH:mm')
    default:
      return asText(value)
  }
}

interface LabelSource {
  label?: string | null
  labelKz?: string | null
}

interface TitleSource {
  title?: string | null
  titleKz?: string | null
}

/** Подпись поля/колонки с учётом языка интерфейса. */
export const pickLabel = (
  source: LabelSource | null | undefined,
  fallback: string,
  lang?: string | null
): string => {
  if (!source) return fallback
  const preferred = isKazakh(lang) ? source.labelKz : source.label
  return preferred ?? source.label ?? fallback
}

/** Заголовок виджета/спецификации с учётом языка интерфейса. */
export const pickTitle = (
  source: TitleSource | null | undefined,
  lang?: string | null
): string => {
  if (!source) return ''
  const preferred = isKazakh(lang) ? source.titleKz : source.title
  return preferred ?? source.title ?? ''
}
