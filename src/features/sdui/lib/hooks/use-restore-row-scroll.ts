import { useEffect, useRef } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'

import type { ListRow } from '../../ui/nodes/composite/list-column-defs'

export const useRestoreRowScroll = (
  rowId: number | null | undefined,
  rows: ListRow[],
  rowVirtualizer: Pick<Virtualizer<HTMLDivElement, Element>, 'scrollToIndex'>
): void => {
  const pendingRef = useRef(rowId != null)

  useEffect(() => {
    if (!pendingRef.current || rows.length === 0) return
    pendingRef.current = false
    const index = rows.findIndex((row) => row.id === rowId)
    if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: 'center' })
  }, [rowId, rows, rowVirtualizer])
}
