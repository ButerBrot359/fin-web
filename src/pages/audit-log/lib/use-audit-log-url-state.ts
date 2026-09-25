import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  filtersFromSearchParams,
  filtersToSearchParams,
  type AuditLogFilterValues,
} from './audit-log-filters'

/**
 * Применённый отбор и страница журнала — в адресной строке. Переход в объект из журнала и
 * «Назад» возвращают ту же выборку; быстрый отбор из карточки события — просто новый адрес.
 */
export const useAuditLogUrlState = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, page } = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams]
  )
  // Ключ только отбора, без страницы: листание не должно сбрасывать черновик в полях отбора.
  const filtersKey = filtersToSearchParams(filters).toString()

  // Страница сбрасывается вместе с отбором: остаться на 40-й странице нового отбора значит
  // показать пустой экран там, где данные есть.
  const applyFilters = (next: AuditLogFilterValues) => {
    setSearchParams(filtersToSearchParams(next, 0))
  }

  const setPage = (next: number) => {
    setSearchParams(filtersToSearchParams(filters, Math.max(0, next)))
  }

  return { filters, filtersKey, page, applyFilters, setPage }
}
