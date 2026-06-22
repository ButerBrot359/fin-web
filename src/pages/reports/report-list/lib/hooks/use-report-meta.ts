import { useQuery } from '@tanstack/react-query'

import { fetchReportMeta } from '../../api/reports-api'

/**
 * Метаданные отчёта по коду (определение + параметры + колонки + варианты).
 * Эндпоинт meta отдаёт ReportMetaDto напрямую (без обёртки), поэтому берём
 * `res.data` — это и есть DTO.
 */
export const useReportMeta = (code: string | undefined) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report-meta', code],
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
