import type { TableColumnDef } from '../hooks/use-table-sync'

export { isNodeVisible } from './node-visibility'

/**
 * `props.visible === false` у TABLE_COLUMN / COLUMN_GROUP: колонка НЕ рендерится
 * (ни в шапке, ни в ячейках, ни в подвале), но её значение остаётся в данных
 * строки и уезжает в EVENT — спека сложных таблиц §111/§273, ADR-0013 §2.4.
 *
 * Второе здесь важнее первого: на скрытых колонках держатся ключи master-detail
 * (например `vychetIPNKey` в ИПН) и служебные значения. Поэтому фильтруем
 * ТОЛЬКО там, где собирается то, что рисуется, и никогда — там, откуда берутся
 * колонки для `useTableSync` (`buildEmptyRow`, отслеживание правок, снимок в
 * EVENT). Иначе новая строка приезжала бы без ключа связи и выпадала из фильтра
 * detail-таблицы.
 *
 * Признак динамический: `setProp(colNodeId, "visible", …)` меняет узел дерева, и
 * колонки пересобираются из него на следующем рендере (§124).
 *
 * Само правило — общее для всех узлов, живёт в `node-visibility.ts` и здесь
 * только переэкспортируется для потребителей колонок.
 */

/** То же правило для уже собранного описания колонки. */
export function isColumnVisible(col: TableColumnDef): boolean {
  return col.props.visible !== false
}
