import type { RefObject } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from '../hooks/use-table-sync'
import type { UseTableValidationResult } from '../hooks/use-table-validation'
import { resolveCellState } from './resolve-cell-state'
import { columnSizeProps } from './column-sizing'
import { isNoWrapColumn } from './nowrap-columns'
import type { CellRefHandlersFactory } from './build-column-defs'
import { ColumnHeaderLabel } from '../../ui/nodes/composite/column-header-label'
import { TableCellEditor } from '../../ui/nodes/composite/table-cell-editor'

export interface BuildFlatColumnDefsParams {
  /** Только ВИДИМЫЕ колонки: скрытая не рендерится и не ищется. */
  visibleColumns: TableColumnDef[]
  syncRef: RefObject<UseTableSyncResult>
  validationRef: RefObject<UseTableValidationResult>
  /** Фабрика server-ref-команд пикера ячейки (use-cell-ref-handlers). */
  cellRefHandlers: CellRefHandlersFactory
}

/**
 * Колонки TanStack плоской (без COLUMN_GROUP) редактируемой ТЧ.
 *
 * Вызывающий мемоизирует результат по [visibleColumns]: при ре-рендере таблицы
 * (ввод символа → setLocalRows) определения колонок/cell-функций НЕ
 * пересоздаются, поэтому TanStack не ремонтит ячейку и инпут сохраняет фокус.
 * cell-колбэки берут актуальный sync через syncRef.current, dispatch — через
 * ref внутри cellRefHandlers (см. server-ref-commands).
 */
export function buildFlatColumnDefs({
  visibleColumns,
  syncRef,
  validationRef,
  cellRefHandlers,
}: BuildFlatColumnDefsParams): ColumnDef<TableRow>[] {
  return visibleColumns.map((col) => ({
    id: col.id,
    accessorFn: (row: TableRow) => row[col.binding],
    // TanStack `header` — string | функция (не элемент): подпись всегда
    // оборачиваем в render-функцию. ColumnHeaderLabel обрезает её
    // многоточием по ширине колонки — иначе длинный заголовок переносится
    // и наезжает на соседний (SCRUM-329).
    header: () => (
      <ColumnHeaderLabel
        label={col.label}
        required={col.required && !col.readonly}
      />
    ),
    // Ширина колонки: с бэка (props.width) либо прежний фолбэк 150/flex.
    ...columnSizeProps(col.props),
    size: col.width ?? (col.flex ? undefined : 150),
    cell: ({ row }) => {
      // Доступность и обязательность считаются на ЯЧЕЙКЕ, а не на колонке:
      // строка несёт собственное условное состояние (см. resolve-cell-state).
      const state = resolveCellState(col, row.original)
      // ADR-0029 Phase 2b: серверные аффордансы пикера ячейки — координата
      // строки добавляется в момент клика (см. server-ref-commands).
      const serverRef = cellRefHandlers(col, row.original)
      return (
        <TableCellEditor
          cellWidget={col.cellWidget}
          dataType={col.dataType}
          value={row.original[col.binding]}
          readonly={state.readonly}
          props={col.props}
          required={state.required}
          noWrap={isNoWrapColumn(col.binding, col.label)}
          revealErrors={validationRef.current.revealErrors}
          onServerShowAll={serverRef.onServerShowAll}
          onServerCreate={serverRef.onServerCreate}
          onServerOpen={serverRef.onServerOpen}
          onChange={(val) => {
            syncRef.current.updateCell(row.original.rowId, col.binding, val)
          }}
          onCommit={() => {
            syncRef.current.commitCell()
          }}
        />
      )
    },
  }))
}
