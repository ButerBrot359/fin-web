import type { Table } from '@tanstack/react-table'

/** Ширина служебной колонки «N» (showRowNumbers) — она вне модели TanStack. */
export const ROW_NUMBER_WIDTH = 48

interface TableSizingColgroupProps<TRow> {
  table: Table<TRow>
  /** Ширина ведущей служебной колонки (номер строки), если она рендерится. */
  leadingWidth?: number
}

/**
 * `<colgroup>` с ширинами листовых колонок TanStack.
 *
 * <p>Ширины задаются здесь, а НЕ в ячейках шапки: при `tableLayout: fixed`
 * браузер берёт ширины из первой строки таблицы, а там у многоуровневой шапки
 * стоят групповые заголовки с `colSpan` — ширин листовых колонок они не задают.
 * `<col>` перекрывает первую строку, поэтому плоская и группированная шапки
 * работают одинаково.
 *
 * <p>Рендерить только когда ресайз включён: без него раскладка таблиц остаётся
 * прежней (auto), и вид уже работающих таблиц не меняется.
 */
export function TableSizingColgroup<TRow>({
  table,
  leadingWidth,
}: TableSizingColgroupProps<TRow>) {
  return (
    <colgroup>
      {leadingWidth !== undefined && <col style={{ width: leadingWidth }} />}
      {table.getVisibleLeafColumns().map((column) => (
        <col key={column.id} style={{ width: column.getSize() }} />
      ))}
    </colgroup>
  )
}
