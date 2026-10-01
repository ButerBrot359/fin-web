import type { ItogiColumn, ItogiTreeLayout } from './itogi-columns'

export interface ItogiHeaderCell {
  key: string
  column: ItogiColumn
  label: string
  colSpan: number
  rowSpan: number
  tree: boolean
}

const cell = (
  column: ItogiColumn,
  label: string,
  key: string,
  span: { colSpan?: number; rowSpan?: number; tree?: boolean } = {}
): ItogiHeaderCell => ({
  key,
  column,
  label,
  colSpan: span.colSpan ?? 1,
  rowSpan: span.rowSpan ?? 1,
  tree: span.tree ?? false,
})

export function buildItogiHeader(
  columns: ItogiColumn[],
  layout: ItogiTreeLayout
): ItogiHeaderCell[][] {
  const { numberIndex, treeIndex, rightIndex } = layout
  if (treeIndex < 0) {
    return [columns.map((c) => cell(c, c.label, c.id))]
  }

  const tree = columns[treeIndex]
  const right = rightIndex >= 0 ? columns[rightIndex] : undefined
  const left = tree.label.split('\n')
  const rightLines = right ? right.label.split('\n') : []
  const height = Math.max(left.length, rightLines.length, 1)
  const leftAt = (i: number) => left[i] ?? ''
  const rightAt = (i: number) => rightLines[i] ?? ''
  const last = height - 1
  const lastFromNumber =
    height > 1 &&
    numberIndex >= 0 &&
    leftAt(last) !== '' &&
    rightAt(last) === ''

  const treeCells = (i: number): ItogiHeaderCell[] => {
    const key = `${tree.id}:${String(i)}`
    if (!right) return [cell(tree, leftAt(i), key, { tree: true })]
    if (rightAt(i) === '') {
      return [cell(tree, leftAt(i), key, { colSpan: 2, tree: true })]
    }
    return [
      cell(tree, leftAt(i), key, { tree: true }),
      cell(right, rightAt(i), `${right.id}:${String(i)}`, { tree: true }),
    ]
  }

  const rows: ItogiHeaderCell[][] = Array.from({ length: height }, () => [])
  columns.forEach((column, index) => {
    if (index === rightIndex) return
    if (index === treeIndex) {
      rows[0].push(...treeCells(0))
      return
    }
    const rowSpan = index === numberIndex && lastFromNumber ? last : height
    rows[0].push(cell(column, column.label, column.id, { rowSpan }))
  })
  for (let i = 1; i < height; i++) {
    if (i === last && lastFromNumber) {
      const colSpan = right ? 3 : 2
      rows[i].push(
        cell(tree, leftAt(i), `${tree.id}:${String(i)}`, {
          colSpan,
          tree: true,
        })
      )
    } else {
      rows[i].push(...treeCells(i))
    }
  }
  return rows
}
