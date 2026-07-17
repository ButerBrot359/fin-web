import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchReportAltMeta } from '../../api/reportalt-api'

/**
 * Метаданные отчёта ReportAlt (definition + parameters + variants + filters).
 * Язык — в ключе кэша: подписи метаданных локализуются сервером по
 * Accept-Language, при смене языка meta перезапрашивается.
 */
export const useReportAltMeta = (code: string | undefined) => {
  const { i18n } = useTranslation()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reportalt-meta', code, i18n.language],
    queryFn: ({ signal }) => fetchReportAltMeta(code!, signal),
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  })

  return { meta: data ?? null, isLoading, isError, error }
}
