import { type RefObject, createElement } from 'react'
import type { ColumnDef, CellContext } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import type {
  TableRow,
  TableColumnDef,
  UseTableSyncResult,
} from '../hooks/use-table-sync'
import { TableCellEditor } from '../../ui/nodes/composite/table-cell-editor'

/**
 * If value is an object with a `presentation` field, return it as string.
 * Otherwise return String(value ?? '').
 */
export function renderCellValue(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'presentation' in value) {
    return String((value as Record<string, unknown>).presentation ?? '')
  }
  return String(value ?? '')
}

/**
 * If value is an object with an `id` field, return the id.
 * Otherwise return value as-is.
 */
export function normalizeKey(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'id' in value) {
    return (value as Record<string, unknown>).id
  }
  return value
}

/**
 * Recursively builds TanStack Table column definitions from SDUI ViewNode children.
 *
 * - TABLE_COLUMN  → leaf ColumnDef with cell editor
 * - COLUMN_GROUP / orientation=HORIZONTAL (default) → grouped columns (multi-level header)
 * - COLUMN_GROUP / orientation=VERTICAL → single column with stacked editors in one cell
 *
 * Nodes with props.visible === false are excluded from rendering.
 */
export function buildColumnDefs(
  children: ViewNode[] | undefined,
  syncRef: RefObject<UseTableSyncResult>,
): ColumnDef<TableRow>[] {
  if (!children) return []

  const result: ColumnDef<TableRow>[] = []

  for (const node of children) {
    // Skip hidden nodes
    if (node.props?.visible === false) continue

    const nodeType = node.type as string

    if (nodeType === 'TABLE_COLUMN') {
      const col = nodeToTableColumnDef(node)
      const colDef: ColumnDef<TableRow> = {
        id: col.id,
        accessorFn: (row: TableRow) => row[col.binding],
        header: col.label,
        cell: (info: CellContext<TableRow, unknown>) =>
          createElement(TableCellEditor, {
            cellWidget: col.cellWidget,
            dataType: col.dataType,
            value: info.row.original[col.binding],
            readonly: col.readonly,
            onChange: (val: unknown) =>
              syncRef.current?.updateCell(
                info.row.original.rowId,
                col.binding,
                val,
              ),
            onCommit: () => syncRef.current?.commitCell(),
          }),
        ...(node.props?.footer === true ? { footer: col.id } : {}),
      }
      result.push(colDef)
      continue
    }

    if (nodeType === 'COLUMN_GROUP') {
      const orientation = (node.props?.orientation as string | undefined) ?? 'HORIZONTAL'
      const groupId = node.id
      const groupLabel = (node.props?.label as string | undefined) ?? ''

      if (orientation === 'VERTICAL') {
        // Vertical group: single column, cell renders stacked editors
        const visibleChildren = (node.children ?? []).filter(
          (child) => child.props?.visible !== false,
        )

        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          header: groupLabel,
          cell: (info: CellContext<TableRow, unknown>) =>
            createElement(
              'div',
              { className: 'flex flex-col gap-1' },
              ...visibleChildren.map((child) => {
                const childCol = nodeToTableColumnDef(child)
                return createElement(TableCellEditor, {
                  key: childCol.id,
                  cellWidget: childCol.cellWidget,
                  dataType: childCol.dataType,
                  value: info.row.original[childCol.binding],
                  readonly: childCol.readonly,
                  onChange: (val: unknown) =>
                    syncRef.current?.updateCell(
                      info.row.original.rowId,
                      childCol.binding,
                      val,
                    ),
                  onCommit: () => syncRef.current?.commitCell(),
                })
              }),
            ),
        }
        result.push(colDef)
      } else {
        // Horizontal group (default): multi-level header via TanStack grouped columns
        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          header: groupLabel,
          columns: buildColumnDefs(node.children, syncRef),
        }
        result.push(colDef)
      }
      continue
    }
  }

  return result
}

/**
 * Recursively extracts ALL leaf TABLE_COLUMN nodes from a ViewNode tree,
 * including hidden columns (visible === false). This is used to give
 * useTableSync the full column list for buildEmptyRow and dirty tracking —
 * hidden columns may carry master-detail keys needed in data.
 */
export function extractAllLeafColumns(
  children: ViewNode[] | undefined,
): TableColumnDef[] {
  if (!children) return []

  const result: TableColumnDef[] = []

  for (const node of children) {
    const nodeType = node.type as string
    if (nodeType === 'TABLE_COLUMN') {
      result.push(nodeToTableColumnDef(node))
    } else if (nodeType === 'COLUMN_GROUP') {
      result.push(...extractAllLeafColumns(node.children))
    }
  }

  return result
}

/** Maps a TABLE_COLUMN ViewNode to the TableColumnDef shape. */
export function nodeToTableColumnDef(node: ViewNode): TableColumnDef {
  const props = node.props ?? {}
  return {
    id: node.id,
    label: (props.label as string | undefined) ?? '',
    binding: node.binding ?? (props.binding as string | undefined) ?? node.id,
    flex: props.flex as number | string | undefined,
    cellWidget: (props.cellWidget as string | undefined) ?? 'TEXT_FIELD',
    dataType: (props.dataType as string | undefined) ?? 'STRING',
    readonly: (props.readonly as boolean | undefined) ?? false,
    required: (props.required as boolean | undefined) ?? false,
  }
}
