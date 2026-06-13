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
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      'osv-report',
      params?.from,
      params?.to,
      params?.accountId ?? null,
      (params?.groupBy ?? []).join(','),
      params?.expandBySubkonto ?? false,
    ],
    queryFn: ({ signal }) => fetchOsvReport(params!, signal),
    // Берём и строки (`list`), и серверную строку «Итого» (`total`).
    select: (res) => ({ list: res.data.list, total: res.data.total ?? null }),
    enabled: enabled && params != null && !!params.from && !!params.to,
    staleTime: 60 * 1000,
  })

  return {
    rows: data?.list ?? [],
    total: data?.total ?? null,
    isLoading: isLoading || isFetching,
    isError,
    error,
    // Принудительный перезапрос — для повторного «Сформировать» с теми же
    // параметрами (иначе TanStack Query вернёт кэш в окне staleTime).
    refetch,
  }
}
