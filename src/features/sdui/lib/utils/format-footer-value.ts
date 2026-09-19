import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import { renderCellValue } from './cell-value'

/** Строка целиком состоит из числа (возможно с минусом и дробной частью). */
const NUMERIC = /^-?\d+([.,]\d+)?$/

/**
 * Значение подвала ТЧ → строка для показа.
 *
 * Числа форматируются ровно так же, как значения колонок
 * ({@link formatWithSpaces}): в ячейках ТЧ стояло «590 000», а в строке итогов —
 * «268610000», потому что подвал печатался через `String(value)` (дефект со
 * стенда 19.09.2026). Нечисловые итоги (1С-подвалы `CURRENT_ROW` и
 * `HEADER_ATTRIBUTE` приносят даты и ссылки) идут прежним путём.
 */
export function formatFooterValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return formatWithSpaces(String(value))
  }
  if (typeof value === 'string' && NUMERIC.test(value)) {
    return formatWithSpaces(value)
  }
  return renderCellValue(value)
}
