import type { ViewNode } from '../../types/view'
import type { TableColumnDef } from '../hooks/use-table-sync'
import { toColumnWidth } from './column-sizing'

/**
 * Чистый маппинг ViewNode → TableColumnDef, без React. Вынесено из
 * build-column-defs.ts при декомпозиции (2026-09-18), поведение 1:1.
 */

/** Maps a TABLE_COLUMN ViewNode to the TableColumnDef shape. */
export function nodeToTableColumnDef(node: ViewNode): TableColumnDef {
  const props = node.props ?? {}
  return {
    id: node.id,
    label: (props.label as string | undefined) ?? '',
    binding: node.binding ?? (props.binding as string | undefined) ?? node.id,
    flex: props.flex as number | string | undefined,
    // Ширины ресайза (контракт бэка): width — начальная ширина, minWidth — пол
    // при перетаскивании (приходит редко), resizable эмитится только как false.
    width: toColumnWidth(props.width),
    minWidth: toColumnWidth(props.minWidth),
    resizable: props.resizable as boolean | undefined,
    cellWidget: (props.cellWidget as string | undefined) ?? 'TEXT_FIELD',
    dataType: (props.dataType as string | undefined) ?? 'STRING',
    readonly: (props.readonly as boolean | undefined) ?? false,
    required: (props.required as boolean | undefined) ?? false,
    props,
    // ADR-0029 Phase 2b: аффордансы пикера ячейки. Бэк эмитит их на TABLE_COLUMN
    // только под флагом и только для персистентного rowId — отсутствие поля здесь
    // и есть штатный сигнал «работаем легаси-пикером».
    actions: node.actions,
  }
}

/**
 * Recursively extracts ALL leaf TABLE_COLUMN nodes from a ViewNode tree,
 * including hidden columns (visible === false). This is used to give
 * useTableSync the full column list for buildEmptyRow and dirty tracking —
 * hidden columns may carry master-detail keys needed in data.
 */
export function extractAllLeafColumns(
  children: ViewNode[] | undefined
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
