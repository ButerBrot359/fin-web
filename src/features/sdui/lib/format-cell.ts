import { format, isValid, parseISO } from 'date-fns'

/**
 * Форматирование значения ячейки SDUI-списка по dataType колонки
 * (TABLE_COLUMN.props.dataType) — SCRUM-244 §B4. Даты — дд.мм.гггг,
 * время показывается только ненулевое (полночь опускается, как в 1С),
 * булево — галочка/пусто. Ссылочные объекты разворачивает вызывающий код.
 */
export function formatSduiCellValue(value: unknown, dataType?: string): string {
  if (value == null || value === '') return ''

  switch (dataType) {
    case 'BOOLEAN':
      return value === true || value === 'true' ? '✓' : ''

    case 'DATE':
    case 'DATETIME': {
      const date = typeof value === 'string' ? parseISO(value) : null
      if (!date || !isValid(date)) return String(value)
      const hasTime =
        dataType === 'DATETIME' &&
        (date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0)
      return format(date, hasTime ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy')
    }

    default:
      return String(value)
  }
}
