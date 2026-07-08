import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchReportMeta } from '../../api/reports-api'

/**
 * Метаданные отчёта по коду (определение + параметры + колонки + варианты).
 * Эндпоинт meta отдаёт ReportMetaDto напрямую (без обёртки), поэтому берём
 * `res.data` — это и есть DTO.
 */
export const useReportMeta = (code: string | undefined) => {
  // Язык в ключе кэша — заголовки/подписи метаданных приходят локализованными,
  // при смене языка meta перезапрашивается.
  const { i18n } = useTranslation()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report-meta', code, i18n.language],
    queryFn: ({ signal }) => fetchReportMeta(code!, signal),
    select: (res) => res.data,
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  })

  return {
    meta: data ?? null,
    isLoading,
    isError,
    error,
  }
}
