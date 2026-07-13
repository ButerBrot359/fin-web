import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { printReport } from '../../api/reports-api'
import type { RunReportBody } from '../../types/report'

/**
 * Печать отчёта в PDF по применённым параметрам (для отчётов-бланков, чей /run
 * отдаёт спец-DTO без таблицы — например «Инвентарная карточка ОС»). Запрос
 * включается только когда `enabled` и задано тело. Возвращает PDF как Blob;
 * объектный URL создаёт вызывающий компонент (чтобы управлять его жизненным
 * циклом через useEffect-cleanup).
 *
 * Для отчётов без движка печати бэк отвечает 501 — прилетает в `isError`,
 * страница показывает фолбэк-сообщение.
 */
export const usePrintReport = (
  code: string | undefined,
  body: RunReportBody | null,
  enabled: boolean
) => {
  // Язык — в ключе кэша и как query-параметр (?language=): бэк локализует бланк
  // по нему (kz → казахский, иначе русский).
  const { i18n } = useTranslation()
  const language: 'Ru' | 'Kz' = i18n.language === 'kz' ? 'Kz' : 'Ru'

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['report-print', code, language, JSON.stringify(body)],
    queryFn: ({ signal }) => printReport(code!, body!, language, signal),
    select: (res) => res.data,
    enabled: enabled && !!code && body != null,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60 * 1000,
  })

  return {
    blob: data ?? null,
    isLoading: isLoading || isFetching,
    isError,
  }
}
