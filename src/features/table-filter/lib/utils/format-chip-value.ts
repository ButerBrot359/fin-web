import i18n from '@/app/config/i18n'
import type { ColumnMetaDto, FilterCondition } from '@/entities/document-entry'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'

const safeToString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/**
 * Returns true if the value carries a user-meaningful time portion.
 *
 * `T00:00:00` и `T23:59:59` — синтетические edge-метки, которые фронт
 * проставляет сам по оператору (gte/lte/between/…) поверх date-only
 * пикера. В чипе их прятать, чтобы не путать «10.04.2026 23:59»
 * с реальным вводом времени.
 */
const hasNonZeroTime = (value: string): boolean => {
  const match = /T(\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?/.exec(value)
  if (!match) return false
  const time = match[1]
  return time !== '00:00' && time !== '00:00:00' && time !== '23:59' && time !== '23:59:59'
}

const fmtScalar = (value: unknown, column: ColumnMetaDto): string => {
  if (value === null || value === undefined || value === '') return '∅'
  switch (column.dataType) {
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : safeToString(value)
    case 'DATETIME':
      if (typeof value !== 'string') return safeToString(value)
      return hasNonZeroTime(value) ? formatDateTime(value) : formatDate(value)
    case 'BOOLEAN':
      return value === true
        ? i18n.t('tableFilter.yes')
        : i18n.t('tableFilter.no')
    case 'DICTIONARY':
    case 'DOCUMENT':
    case 'ENUMS': {
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        if (typeof obj.label === 'string' && obj.label) return obj.label
        if (typeof obj.displayName === 'string' && obj.displayName)
          return obj.displayName
        if (typeof obj.nameRu === 'string' && obj.nameRu) return obj.nameRu
        if (typeof obj.code === 'string' && obj.code) return obj.code
        if (typeof obj.id === 'number' || typeof obj.id === 'string')
          return `#${String(obj.id)}`
      }
      return safeToString(value)
    }
    default:
      return safeToString(value)
  }
}

export const formatChipValue = (
  condition: FilterCondition,
  column: ColumnMetaDto
): string => {
  const { op, value } = condition

  if (op === 'isNull' || op === 'isNotNull') return ''

  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    return `${fmtScalar(value[0], column)} – ${fmtScalar(value[1], column)}`
  }

  if ((op === 'in' || op === 'notIn') && Array.isArray(value)) {
    return value.map((v) => fmtScalar(v, column)).join(', ')
  }

  return fmtScalar(value, column)
}
