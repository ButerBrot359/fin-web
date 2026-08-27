/**
 * Постоянная заливка ячеек КОЛОНКИ (`TABLE_COLUMN.props.backgroundColor`) —
 * порт свойства «ЦветФона» элемента управляемой формы 1С. Условия нет: колонка
 * залита всегда (итоговые суммы плана финансирования — светло-зелёные, учётные
 * колонки инвентаризации — серые).
 *
 * Это НЕ `rowAppearance` (см. row-appearance.ts): там правило на узле ТАБЛИЦЫ
 * красит СТРОКУ по значению колонки. Механизмы независимы и могут встретиться
 * на одной таблице; при совпадении выигрывает строка — условная подсветка несёт
 * состояние записи, и потерять её под постоянной заливкой хуже, чем наоборот.
 * В 1С приоритет такой же: УсловноеОформление перекрывает ЦветФона элемента.
 */

/** Цвет из props колонки; пустая строка и не-строка — как будто пропа нет. */
export function columnBackground(
  props: Record<string, unknown> | undefined
): string | undefined {
  const raw = props?.backgroundColor
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

/**
 * Карта «id колонки → цвет» для таблиц на TanStack: там ячейка знает только
 * `cell.column.id`, а props колонки остаются в исходном описании.
 */
export function buildColumnBackgroundMap(
  columns: { id: string; props?: Record<string, unknown> }[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const col of columns) {
    const color = columnBackground(col.props)
    if (color) map.set(col.id, color)
  }
  return map
}
