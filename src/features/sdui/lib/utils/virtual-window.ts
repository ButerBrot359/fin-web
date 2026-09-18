/**
 * Строки для отрисовки: окно виртуализации (SCRUM-368) либо все строки —
 * `virtualItems === null` значит «ниже порога, рендер прежний».
 */
export function windowedRows<T>(
  virtualItems: { index: number }[] | null,
  rows: T[]
): T[] {
  return virtualItems ? virtualItems.map((item) => rows[item.index]) : rows
}
