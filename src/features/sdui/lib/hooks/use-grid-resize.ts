import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'

import {
  GRID_UNITS,
  rowFreeUnits,
  type GridZone,
} from '../customize-form/grid-zones'

/** Ключ рефа строки редактора — по паре индексов зоны и строки. */
export const gridRowKey = (zoneIndex: number, rowIndex: number): string =>
  `${String(zoneIndex)}:${String(rowIndex)}`

/**
 * Ресайз плашки грид-редактора за правую кромку (v4): ширина тянется мышью с
 * прилипанием к единицам 24-сетки в пределах свободного остатка строки.
 * Слушатели mousemove/mouseup живут на window на время жеста; превью — в
 * локальном состоянии, готовый span отдаётся наружу одним коммитом.
 */
export function useGridResize(
  zones: GridZone[],
  onCommit: (nodeId: string, span: number) => void
): {
  resizePreview: Map<string, number>
  rowRefs: RefObject<Map<string, HTMLDivElement>>
  startResize: (
    e: ReactMouseEvent,
    zoneIndex: number,
    rowIndex: number,
    nodeId: string
  ) => void
} {
  const [resizePreview, setResizePreview] = useState<Map<string, number>>(
    new Map()
  )
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const startResize = (
    e: ReactMouseEvent,
    zoneIndex: number,
    rowIndex: number,
    nodeId: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const rowEl = rowRefs.current.get(gridRowKey(zoneIndex, rowIndex))
    if (!rowEl) return
    const unit = rowEl.getBoundingClientRect().width / GRID_UNITS
    const zone = zones[zoneIndex]
    const row = zone.rows[rowIndex]
    const item = row.find((i) => i.nodeId === nodeId)
    if (!item) return
    const startX = e.clientX
    const startSpan = item.span
    const maxSpan = startSpan + rowFreeUnits(row)

    const move = (ev: MouseEvent) => {
      const deltaUnits = Math.round((ev.clientX - startX) / unit)
      const span = Math.max(1, Math.min(maxSpan, startSpan + deltaUnits))
      setResizePreview(new Map([[nodeId, span]]))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const deltaUnits = Math.round((ev.clientX - startX) / unit)
      const span = Math.max(1, Math.min(maxSpan, startSpan + deltaUnits))
      setResizePreview(new Map())
      if (span !== startSpan) onCommit(nodeId, span)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return { resizePreview, rowRefs, startResize }
}
