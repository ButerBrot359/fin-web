import { useMemo } from 'react'

import type { ViewNode } from '../../types/view'
import type { ListFilterChip } from '../../ui/nodes/composite/list-filter-chips'
import { readQuickFilters } from '../../ui/nodes/composite/list-quick-filters'

/**
 * Панель отбора над таблицей (как в журнале 1С). Значения берём из тех же
 * чипов, что рисуются под панелью: показанное в панели и снятое чипом — одно
 * состояние. Вынесено из list-node.tsx при декомпозиции (>300 строк), 1:1.
 */
export function useListQuickFilters(
  node: ViewNode,
  columnNodes: ViewNode[],
  filterChips: ListFilterChip[]
) {
  const quickFilterValues = useMemo(
    () =>
      Object.fromEntries(
        filterChips.map((chip) => [
          chip.field,
          (chip as { value?: unknown }).value,
        ])
      ),
    [filterChips]
  )
  return useMemo(
    () => readQuickFilters(node, columnNodes, quickFilterValues),
    [node, columnNodes, quickFilterValues]
  )
}
