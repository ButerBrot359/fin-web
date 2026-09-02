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

/**
 * Цвет ТЕКСТА ячеек колонки (`TABLE_COLUMN.props.textColor`) — порт
 * «ЦветТекста» из УсловногоОформления СКД с пустым отбором, то есть заданного
 * колонке безусловно (эталон — «К выплате» свода «Итоги», #0000FF).
 *
 * Отличие от `tableTextColor` (table-text-color.ts): тот красит ВСЮ таблицу,
 * этот — одну колонку. Механизмы независимы; колоночный, как более точный,
 * перекрывает табличный.
 */
export function columnTextColor(
  props: Record<string, unknown> | undefined
): string | undefined {
  const raw = props?.textColor
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}
