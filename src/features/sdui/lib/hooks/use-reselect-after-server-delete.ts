import { useCallback, useEffect, useRef } from 'react'

import type { TableRow } from './use-table-sync'

interface OzhidaemoeUdalenie {
  udalyaemaya: string
  sosed: string | null
}

export function useReselectAfterServerDelete(
  visibleRows: TableRow[],
  selectRow: (rowId: string) => void
): (rowIds: string[]) => void {
  const ozhidanieRef = useRef<OzhidaemoeUdalenie | null>(null)
  const selectRowRef = useRef(selectRow)
  useEffect(() => {
    selectRowRef.current = selectRow
  }, [selectRow])

  const expectRemoval = useCallback(
    (rowIds: string[]) => {
      if (rowIds.length !== 1) {
        ozhidanieRef.current = null
        return
      }
      const udalyaemaya = rowIds[0]
      const indeks = visibleRows.findIndex((r) => r.rowId === udalyaemaya)
      if (indeks < 0) {
        ozhidanieRef.current = null
        return
      }
      const sosed =
        indeks + 1 < visibleRows.length
          ? visibleRows[indeks + 1].rowId
          : indeks > 0
            ? visibleRows[indeks - 1].rowId
            : null
      ozhidanieRef.current = { udalyaemaya, sosed }
    },
    [visibleRows]
  )

  useEffect(() => {
    const ozhidanie = ozhidanieRef.current
    if (ozhidanie === null) return
    ozhidanieRef.current = null
    if (visibleRows.some((r) => r.rowId === ozhidanie.udalyaemaya)) return
    if (
      ozhidanie.sosed !== null &&
      visibleRows.some((r) => r.rowId === ozhidanie.sosed)
    ) {
      selectRowRef.current(ozhidanie.sosed)
    }
  }, [visibleRows])

  return expectRemoval
}
