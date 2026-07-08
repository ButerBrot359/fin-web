import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

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
  // Язык в ключе кэша — названия полей отбора локализованы; при смене языка
  // список полей перезапрашивается.
  const { i18n } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['report-filter-fields', code, accountId ?? null, i18n.language],
    queryFn: ({ signal }) => fetchFilterFields(code!, accountId, signal),
    select: (res) => res.data.list,
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  })

  return { fields: data ?? [], isLoading }
}
