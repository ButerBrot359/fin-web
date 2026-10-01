import type { ExpandedState } from '@tanstack/react-table'

import type { ReportRowDto } from '@/pages/reports/report-list/types/report'

export const treeLevelCount = (rows: ReportRowDto[]): number =>
  rows.reduce(
    (max, row) =>
      row.children.length > 0
        ? Math.max(max, 1 + treeLevelCount(row.children))
        : max,
    1
  )

export const expandedToLevel = (
  rows: ReportRowDto[],
  level: number
): ExpandedState => {
  const expanded: Record<string, boolean> = {}
  const walk = (
    nodes: ReportRowDto[],
    parentId: string | null,
    depth: number
  ) => {
    if (depth >= level - 1) return
    nodes.forEach((node, index) => {
      if (node.children.length === 0) return
      const id =
        parentId == null ? String(index) : `${parentId}.${String(index)}`
      expanded[id] = true
      walk(node.children, id, depth + 1)
    })
  }
  walk(rows, null, 0)
  return expanded
}
