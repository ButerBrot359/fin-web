import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { runReport } from '../../api/reports-api'
import type { RunReportBody } from '../../types/report'

/**
 * Формирование отчёта по применённым параметрам. Запрос включается только когда
 * `enabled` (нажата «Сформировать» и заполнены обязательные параметры).
 * Результат кэшируется по коду + телу запроса.
 *
 * Для DRAFT-отчётов бэк отвечает 422 — `api.ts` бросает тело ответа, поэтому
 * здесь оно прилетает в `error` (без HTTP-статуса). Страница интерпретирует
 * ошибку как «не реализован», опираясь на `definition.status === 'DRAFT'`.
 */
export const useRunReport = (
  code: string | undefined,
  body: RunReportBody | null,
  enabled: boolean
) => {
  // Язык — в ключе кэша: при смене языка ключ меняется и отчёт перезапрашивается
  // (заголовок Accept-Language уходит с новым языком через интерсептор api.ts).
  const { i18n } = useTranslation()
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['report-run', code, i18n.language, JSON.stringify(body)],
    queryFn: ({ signal }) => runReport(code!, body!, signal),
    // Эндпоинт run отдаёт ReportResultDto напрямую — берём `res.data`.
    select: (res) => res.data,
    enabled: enabled && !!code && body != null,
    // Отчёт пересобирается по кнопке — не дёргаем на фокусе/реконнекте.
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60 * 1000,
  })

  return {
    result: data ?? null,
    isLoading: isLoading || isFetching,
    isError,
    error,
    refetch,
  }
}
