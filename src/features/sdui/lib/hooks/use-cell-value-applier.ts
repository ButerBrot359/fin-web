import { useEffect, type RefObject } from 'react'

import {
  registerCellValueApplier,
  unregisterCellValueApplier,
} from '../cell-value-appliers'
import type { TableColumnDef, UseTableSyncResult } from './use-table-sync'

/**
 * ADR-0029: значение, выбранное/созданное для строки БЕЗ БД-id, сервер применить
 * не может — он возвращает его эффектом без applyToParentCommand, а кладём его
 * мы (см. cell-value-appliers). Колонку узнаём по id узла, строку — по rowId.
 *
 * `syncRef`, а не сам sync: applier перерегистрируется только по [columns] и
 * обязан видеть актуальные методы синхронизации (у complex-таблицы updateCell
 * ещё и обёрнут учётом выделения — обёртка тоже приходит через этот ref).
 */
export function useCellValueApplier(
  columns: TableColumnDef[],
  syncRef: RefObject<Pick<UseTableSyncResult, 'updateCell' | 'commitCell'>>
): void {
  useEffect(() => {
    const token = registerCellValueApplier((columnNodeId, rowId, value) => {
      const col = columns.find((c) => c.id === columnNodeId)
      if (!col) return false
      syncRef.current.updateCell(rowId, col.binding, value)
      syncRef.current.commitCell()
      return true
    })
    return () => {
      unregisterCellValueApplier(token)
    }
  }, [columns, syncRef])
}
