import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import { SERVICE_ROW_KEYS } from './service-row-keys'

/**
 * Условное состояние ячейки ТЧ: доступность и обязательность зависят не только
 * от колонки, но и от значений в САМОЙ строке. Перенос `УсловноеОформление` из
 * 1С: «Код платных услуг» обязателен при источнике «Деньги от реализации…» и
 * недоступен при любом другом, «Индексируемый»/«Неиндексируемый заработок»
 * гасят друг друга и т.п. Колоночные `props.readonly`/`props.required` этого не
 * выражают — условие построчное, соседние строки одной ТЧ в разных состояниях.
 *
 * Правила бэк присылает служебными ключами строки (`__requiredCells`,
 * `__readonlyCells`, `__rowReadonly`) — см. `service-row-keys.ts`. Ключа нет
 * вовсе, если правило не сработало: пустых массивов бэк не шлёт, поэтому
 * «нет ключа» и «пустой массив» здесь равнозначны. Отдельной команды «сбросить»
 * тоже нет — читаем текущее состояние строки, каким оно приехало.
 */
export interface CellState {
  readonly: boolean
  required: boolean
}

/** Есть ли `binding` в служебном ключе-массиве строки. */
function listedIn(row: TableRow, key: string, binding: string): boolean {
  const codes: unknown = row[key]
  if (!Array.isArray(codes)) return false
  return (codes as unknown[]).includes(binding)
}

/**
 * Итоговые доступность и обязательность ячейки.
 *
 * readonly СИЛЬНЕЕ required: взаимоисключающих комбинаций бэк не присылает, но
 * правило должно давать тот же результат и на них — помечать обязательной
 * ячейку, в которую нельзя вводить, бессмысленно.
 */
export function resolveCellState(
  col: TableColumnDef,
  row: TableRow
): CellState {
  const readonly =
    col.readonly === true ||
    row[SERVICE_ROW_KEYS.rowReadonly] === true ||
    listedIn(row, SERVICE_ROW_KEYS.readonlyCells, col.binding)

  if (readonly) return { readonly: true, required: false }

  return {
    readonly: false,
    required:
      col.required === true ||
      listedIn(row, SERVICE_ROW_KEYS.requiredCells, col.binding),
  }
}
