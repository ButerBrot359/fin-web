import { useEffect, type RefObject } from 'react'

import type { TableRow } from './use-table-sync'
import type { TableSearchApi } from './use-table-search'

/**
 * Скролл к текущему совпадению поиска по ТЧ (поиск отбирает строки с совпадением).
 * При виртуализации строка совпадения может быть вне окна — сначала подводим
 * окно к её индексу, затем после кадра доводим по горизонтали к самой ячейке.
 */
export function useSearchScroll(
  search: Pick<TableSearchApi, 'current'>,
  visibleRows: TableRow[],
  virt: { scrollToRow: (index: number) => void },
  containerRef: RefObject<HTMLDivElement | null>
): void {
  useEffect(
    () => {
      const current = search.current
      if (!current) return
      const idx = visibleRows.findIndex((r) => r.rowId === current.rowId)
      if (idx >= 0) virt.scrollToRow(idx)
      requestAnimationFrame(() => {
        containerRef.current
          ?.querySelector('[data-search-hit="true"]')
          ?.scrollIntoView({ block: 'nearest' })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.current?.rowId, search.current?.columnId]
  )
}
