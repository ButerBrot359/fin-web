import type { DocumentAttribute } from '@/entities/document-type'

import { resolveSelectValue } from './resolve-select-value'
import { formatDate, formatDateTime } from './date'

export const formatWithSpaces = (raw: string): string => {
  if (!raw) return ''
  const normalized = raw.replace('.', ',')
  const negative = normalized.startsWith('-')
  const withoutMinus = negative ? normalized.slice(1) : normalized
  const commaIdx = withoutMinus.indexOf(',')
  const intPart = commaIdx >= 0 ? withoutMinus.slice(0, commaIdx) : withoutMinus
  const decPart = commaIdx >= 0 ? withoutMinus.slice(commaIdx) : ''
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (negative ? '-' : '') + formattedInt + decPart
}

export const formatCellValue = (
  value: unknown,
  column: DocumentAttribute
): string => {
  if (value == null || value === '') return ''
  const { dataType } = column

  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return value as string
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(String(value as number))
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : ''
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : ''
    default:
      if (typeof value === 'object') {
        const resolved = resolveSelectValue(value, [])
        return resolved?.label ?? ''
      }
      return String(value as string | number)
  }
}
