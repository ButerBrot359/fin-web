import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { ViewNode } from '../../types/view'
import { renderCellValue } from './cell-value'
import { isNodeVisible } from './node-visibility'
import { numberPrecision } from './number-input-mode'
import { nodeToTableColumnDef } from './table-column-def'
import { textColorProp } from './table-text-color'

export interface ItogiColumn {
  id: string
  label: string
  binding: string
  numeric: boolean
  precision?: number
  textColor?: string
}

export interface ItogiRow {
  rowId: string
  __level: number
  __parentRowId: string | null
  __stil?: string
  __gruppirovka?: string
  [key: string]: unknown
}

export interface ItogiTreeLayout {
  numberIndex: number
  treeIndex: number
  rightIndex: number
}

export interface ItogiBodyCell {
  column: ItogiColumn
  colSpan: number
  tree: boolean
}

const NUMERIC_TYPES = new Set(['INTEGER', 'DECIMAL', 'NUMBER'])

const ACROSS_TREE = new Set(['FizicheskoeLitso', 'VidNachisleniya', 'Itogo'])

const FROM_NUMBER_COLUMN = new Set(['VidNachisleniya', 'Itogo'])

export function extractItogiColumns(
  children: ViewNode[] | undefined
): ItogiColumn[] {
  return (children ?? [])
    .filter((c) => c.type === 'TABLE_COLUMN' && isNodeVisible(c))
    .map((c) => {
      const def = nodeToTableColumnDef(c)
      return {
        id: def.id,
        label: def.label,
        binding: def.binding,
        numeric: NUMERIC_TYPES.has(def.dataType),
        precision: numberPrecision(def.props),
        textColor: textColorProp(def.props),
      }
    })
}

export function itogiTreeLayout(columns: ItogiColumn[]): ItogiTreeLayout {
  const treeIndex = columns.findIndex((c) => !c.numeric)
  if (treeIndex < 0) return { numberIndex: -1, treeIndex: -1, rightIndex: -1 }
  const right = columns[treeIndex + 1] as ItogiColumn | undefined
  const before = columns[treeIndex - 1] as ItogiColumn | undefined
  return {
    numberIndex: before?.numeric ? treeIndex - 1 : -1,
    treeIndex,
    rightIndex: right && !right.numeric ? treeIndex + 1 : -1,
  }
}

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || value === ''

export function itogiBodyCells(
  columns: ItogiColumn[],
  layout: ItogiTreeLayout,
  row: ItogiRow
): ItogiBodyCell[] {
  const { numberIndex, treeIndex, rightIndex } = layout
  const gruppirovka = row.__gruppirovka ?? ''
  const spanRight = rightIndex >= 0 && ACROSS_TREE.has(gruppirovka)
  const spanNumber =
    numberIndex >= 0 &&
    isEmpty(row[columns[numberIndex].binding]) &&
    FROM_NUMBER_COLUMN.has(gruppirovka)

  const cells: ItogiBodyCell[] = []
  columns.forEach((column, index) => {
    if (index === numberIndex && spanNumber) return
    if (index === rightIndex && spanRight) return
    if (index !== treeIndex) {
      cells.push({ column, colSpan: 1, tree: false })
      return
    }
    const colSpan = 1 + (spanNumber ? 1 : 0) + (spanRight ? 1 : 0)
    cells.push({ column, colSpan, tree: true })
  })
  return cells
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return Number.NaN
}

export function formatItogiValue(value: unknown, column: ItogiColumn): string {
  if (!column.numeric) return renderCellValue(value)
  const number = toNumber(value)
  if (Number.isNaN(number)) return renderCellValue(value)
  if (number === 0) return ''
  const text =
    column.precision !== undefined
      ? number.toFixed(column.precision)
      : String(number)
  return formatWithSpaces(text)
}
