import { useQuery } from '@tanstack/react-query'

import { fetchOsvReport } from '../../api/osv-report-api'
import type { OsvReportParams } from '../../types/osv-report'

/**
 * Данные ОСВ за период. Запрос выполняется только когда заданы обе границы
 * периода и отчёт «активирован» (нажата кнопка «Сформировать») — флаг enabled.
 * Результат кэшируется по набору параметров.
 */
export const useOsvReport = (
  params: OsvReportParams | null,
  enabled: boolean
) => {
  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['osv-report', params?.from, params?.to, params?.accountId ?? null],
    queryFn: ({ signal }) => fetchOsvReport(params!, signal),
    select: (res) => res.data.list,
    enabled: enabled && params != null && !!params.from && !!params.to,
    staleTime: 60 * 1000,
  })

  return {
    rows: data ?? [],
    isLoading: isLoading || isFetching,
    isError,
    error,
  }
}
