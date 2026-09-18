import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'
import { renderCellValue } from './cell-value'

/**
 * `unknown` → строка для показа. Явный разбор примитивов вместо `String(value)`:
 * на объекте `String()` дал бы «[object Object]» (правило no-base-to-string), а
 * ссылочные значения `{id, presentation}` умеет разворачивать renderCellValue.
 */
export function toDisplayString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return renderCellValue(value)
}

/**
 * Значение readonly-ячейки ТЧ → строка с форматированием по dataType колонки
 * (вынесено из table-cell-editor.tsx — чистая функция без DOM).
 */
export function formatReadonlyValue(
  value: unknown,
  dataType: string,
  dateFormat?: string
): string {
  if (value == null || value === '') return ''
  // Ссылочные/enum значения {id, presentation} — показываем presentation
  if (typeof value === 'object' && 'presentation' in value) {
    return renderCellValue(value)
  }
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return toDisplayString(value)
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(toDisplayString(value))
    // Формат колонки действует и здесь: у readonly-ячейки «Месяца начисления»
    // нет редактора, но показывать в ней день так же неверно.
    case 'DATE':
      return typeof value === 'string' ? formatDate(value, dateFormat) : ''
    case 'DATETIME':
      if (typeof value !== 'string') return ''
      return dateFormat ? formatDate(value, dateFormat) : formatDateTime(value)
    case 'BOOLEAN':
      // Явное сравнение, а не проверка на «истинность» unknown: у BOOLEAN-колонки
      // на проводе приезжает boolean (или его строковая форма), а для unknown
      // no-unnecessary-condition считает любое значение истинным.
      return value === true || value === 'true' ? '✓' : ''
    default:
      return renderCellValue(value)
  }
}
