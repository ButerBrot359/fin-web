import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

/**
 * Служебный per-row ключ ТЧ: коды колонок, обязательных ИМЕННО в этой строке.
 * Тот же класс ключей, что `__rowParentIds` — приходит от бэка в снимке строк,
 * колонкой не показывается и как значение ячейки не редактируется.
 */
const REQUIRED_CELLS_KEY = '__requiredCells'

/**
 * Обязательна ли конкретная ячейка ТЧ.
 *
 * Два независимых источника обязательности:
 *   - колоночный `props.required` (SCRUM-329) — вся колонка обязательна;
 *   - условная обязательность строки: бэк кладёт код колонки в
 *     `row.__requiredCells`. Пример — «Код платных услуг» обязателен только в
 *     строках с источником финансирования «Деньги от реализации…» (в 1С это
 *     сообщение, привязанное к пути «Начисления[N].КодПлатныхУслуг»).
 *
 * Ключ бэк ставит по источнику, а не по пустоте: заполненная ячейка остаётся
 * помеченной, поэтому метка не мигает при вводе. Строки с другим источником
 * ключа не несут вовсе — отсутствие ключа и пустой массив равнозначны.
 */
export function isCellRequired(col: TableColumnDef, row: TableRow): boolean {
  if (col.required) return true
  const cells: unknown = row[REQUIRED_CELLS_KEY]
  if (!Array.isArray(cells)) return false
  return (cells as unknown[]).includes(col.binding)
}
