import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import { isCellEmpty } from './is-cell-empty'
import { resolveCellState } from './resolve-cell-state'

/**
 * Одноразовая цель автофокуса потокового ввода (SCRUM-363). Создаётся кнопкой
 * «Добавить» или commit'ом предыдущей ячейки; sequence отличает новую цель от
 * уже отработанной (ручной фокус список не открывает).
 */
export interface AutoAdvanceTarget {
  rowId: string
  binding: string
  cellWidget?: string
  sequence: number
  /**
   * Активация уже отработала (фокус поставлен, список раскрыт). Мутируется
   * ref'ом без ре-рендера: ручной повторный фокус список не раскрывает, но
   * цель остаётся текущей — её commit продолжает цепочку.
   */
  consumed?: boolean
}

/**
 * Следующая ячейка потокового ввода (SCRUM-363 §4.2): первая после
 * `afterBinding` (или с начала строки) колонка, которая одновременно видима,
 * доступна для записи по построчному состоянию (`resolveCellState`, включая
 * `__readonlyCells`) и пуста по общему правилу `isCellEmpty`.
 *
 * `enabled:false` НАМЕРЕННО не пропускается: при пустой шапке документа у
 * первого ссылочного поля может не быть вариантов — фокус и пустой список
 * должны остаться в нём, чтобы пользователь понял, что сначала нужна шапка.
 *
 * Колонки обходятся в порядке layout (слева направо, включая leaf'ы групп).
 * Helper чистый: не меняет state, не шлёт EVENT, не знает кода документа.
 */
export function findAutoAdvanceColumn(
  columns: TableColumnDef[],
  row: TableRow,
  afterBinding?: string
): TableColumnDef | undefined {
  const afterIndex = afterBinding
    ? columns.findIndex((c) => c.binding === afterBinding)
    : -1
  for (let i = afterIndex + 1; i < columns.length; i++) {
    const col = columns[i]
    if (col.props.visible === false) continue
    if (resolveCellState(col, row).readonly) continue
    if (!isCellEmpty(row[col.binding], col.cellWidget)) continue
    return col
  }
  return undefined
}
