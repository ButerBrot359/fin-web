import { formatNumericCell } from './format-numeric-cell'

/**
 * Значение подвала ТЧ → строка для показа.
 *
 * Числа форматируются ровно так же, как значения колонок: в ячейках ТЧ стояло «590 000», а в
 * строке итогов — «268610000», потому что подвал печатался через `String(value)` (дефект со
 * стенда 19.09.2026). Нечисловые итоги (1С-подвалы `CURRENT_ROW` и `HEADER_ATTRIBUTE` приносят
 * даты и ссылки) идут прежним путём.
 *
 * <p>`dataType` не передаётся: в подвал сервер кладёт уже посчитанные суммы, и цифровых строк
 * вроде БИН там не бывает.
 */
export function formatFooterValue(value: unknown): string {
  return formatNumericCell(value)
}
