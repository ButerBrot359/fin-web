import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  decodeFilterFromUrl,
  encodeFilterToUrl,
} from '@/shared/lib/filter/url-codec'

import { useTableFilterStore, useTableFilters } from './use-table-filter-store'

const PARAM = 'filter'

/**
 * Двусторонняя синхронизация Zustand-стора и `?filter=` в URL.
 *
 * - При монтировании: читает URL → пишет в стор (если URL непуст).
 * - При изменении стора: пишет URL.
 *
 * Используется на пилотной странице, где включена фильтрация.
 */
export const useFilterUrlSync = (tableId: string | undefined) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const setAll = useTableFilterStore((s) => s.setAll)
  const filters = useTableFilters(tableId ?? '')
  const hydratedRef = useRef(false)
  const enabled = !!tableId

  useEffect(() => {
    if (!enabled) return
    if (hydratedRef.current) return
    hydratedRef.current = true
    const raw = searchParams.get(PARAM)
    const decoded = decodeFilterFromUrl(raw)
    if (decoded.filters.length > 0) {
      setAll(tableId, decoded.filters)
    }
  }, [searchParams, setAll, tableId, enabled])

  useEffect(() => {
    if (!enabled) return
    if (!hydratedRef.current) return
    const encoded = encodeFilterToUrl({ filters, logic: 'AND' })
    const current = searchParams.get(PARAM)
    if (encoded === current) return

    const next = new URLSearchParams(searchParams)
    if (encoded === null) next.delete(PARAM)
    else next.set(PARAM, encoded)
    setSearchParams(next, { replace: true })
  }, [filters, searchParams, setSearchParams, enabled])
}
