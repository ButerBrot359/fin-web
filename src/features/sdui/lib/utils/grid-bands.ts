import type { ViewNode } from '../../types/view'
import { isNodeVisible } from './node-visibility'

const numberProp = (node: ViewNode, key: string): number => {
  const raw = node.props?.[key]
  return typeof raw === 'number' ? raw : 0
}

function reflowBand(cells: ViewNode[]): ViewNode[] {
  const lanes = new Map<number, Map<number, ViewNode[]>>()
  for (const cell of cells) {
    if (cell.type === 'SPACER' || !isNodeVisible(cell)) continue
    const lane = numberProp(cell, 'gridLane')
    const slot = numberProp(cell, 'gridSlot')
    const slots = lanes.get(lane) ?? new Map<number, ViewNode[]>()
    slots.set(slot, [...(slots.get(slot) ?? []), cell])
    lanes.set(lane, slots)
  }
  const columns = [...lanes.keys()]
    .sort((a, b) => a - b)
    .map((lane) =>
      [...lanes.get(lane)!.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, group]) => group)
    )
  const rows = Math.max(0, ...columns.map((column) => column.length))
  const result: ViewNode[] = []
  for (let row = 0; row < rows; row++) {
    for (const column of columns) {
      if (row < column.length) result.push(...column[row])
    }
  }
  return result
}

export function layoutGridCells(children: ViewNode[]): ViewNode[] {
  const result: ViewNode[] = []
  const placedBands = new Set<string>()
  for (const child of children) {
    const band = child.props?.gridBand
    if (typeof band !== 'string') {
      if (isNodeVisible(child)) result.push(child)
      continue
    }
    if (placedBands.has(band)) continue
    placedBands.add(band)
    result.push(
      ...reflowBand(children.filter((c) => c.props?.gridBand === band))
    )
  }
  return result
}
