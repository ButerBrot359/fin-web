import { useQuery } from '@tanstack/react-query'

import { fetchFilterFields } from '../../api/reports-api'

/**
 * Динамические поля отбора для вкладки «Отборы» (СКД-таблица 1С). Возвращает
 * КБП-каталог (6 измерений) + при заданном `accountId` — поля субконто счёта.
 * Запрос включается, когда задан код отчёта; при смене счёта список полей
 * пересобирается (accountId входит в ключ кэша).
 */
export const useFilterFields = (
  code: string | undefined,
  accountId?: number | null
) => {
  const { data, isLoading } = useQuery({
    queryKey: ['report-filter-fields', code, accountId ?? null],
    queryFn: ({ signal }) => fetchFilterFields(code!, accountId, signal),
    select: (res) => res.data.list,
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  })

  return { fields: data ?? [], isLoading }
}
