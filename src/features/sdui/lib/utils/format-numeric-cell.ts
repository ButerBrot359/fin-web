import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import { renderCellValue } from './cell-value'

/** Строка целиком состоит из числа (возможно с минусом и дробной частью). */
const NUMERIC = /^-?\d+([.,]\d+)?$/

/** Типы данных колонки, у которых разряды положено разделять пробелом. */
const CHISLOVYE = new Set(['INTEGER', 'DECIMAL', 'NUMBER'])

/**
 * Значение ячейки → строка для показа, с разделением разрядов у чисел.
 *
 * <p>`dataType` обязателен там, где значение может оказаться длинной цифровой СТРОКОЙ:
 * БИН «160440007161», ИИК, номер счёта и номер документа форматировать пробелами нельзя.
 * Без `dataType` (подвал ТЧ — там приходят посчитанные сервером суммы) числом считается
 * само значение.
 */
export function formatNumericCell(value: unknown, dataType?: string): string {
  const chislovaya = dataType === undefined || CHISLOVYE.has(dataType)
  if (!chislovaya) {
    return renderCellValue(value)
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return formatWithSpaces(String(value))
  }
  if (typeof value === 'string' && NUMERIC.test(value)) {
    return formatWithSpaces(value)
  }
  return renderCellValue(value)
}
