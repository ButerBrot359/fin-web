import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'

import { apiService } from '@/shared/api/api'
import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'
import { getReportResultGateway } from '../../../lib/report-result-gateway'

interface ReportResultSource {
  url: string
  method?: string
  body: unknown
}

// SDUI держит результат отчёта как непрозрачную структуру (§19.6 — не читать
// по имени колонки, не мутировать); page/hasMore/rows нужны только для мержа
// LEDGER-страниц, остальное уходит в gateway.Renderer как есть.
interface ReportResultPage {
  reportNameRu?: string
  page?: number
  hasMore?: boolean
  rows?: unknown[]
  [key: string]: unknown
}

const mergeReportPages = (
  pages: ReportResultPage[] | undefined,
  reportLayout: string | undefined
): ReportResultPage | null => {
  if (!pages || pages.length === 0) return null
  if (reportLayout !== 'LEDGER' || pages.length === 1) return pages[0]
  return { ...pages[0], rows: pages.flatMap((p) => p.rows ?? []) }
}

/**
 * SCRUM-291 K2 — REPORT_RESULT: результат отчёта reportalt рисует легаси
 * `features/report-result-view` через gateway (SDUI не импортирует легаси
 * напрямую). `source == null` на открытии — точная копия поведения 1С
 * (§19.1): нода не фетчит на монтировании и не сбрасывает source сама.
 *
 * Phase-1 (K2): встроенная панель настроек (поля/отборы/сортировка/
 * группировка/оформление) и наложение клиентских userSettings поверх
 * source.body НЕ реализованы — отчёт показывается с серверными дефолтами,
 * settingsEnabled только читается, панель — follow-up.
 */
export const ReportResultNode: FC<NodeProps> = ({ node }) => {
  const { t, i18n } = useTranslation()

  const reportCode = node.props?.reportCode as string | undefined
  const reportLayout = node.props?.reportLayout as string | undefined
  const pageSize = (node.props?.pageSize as number | undefined) ?? 200
  const printEnabled = node.props?.printEnabled === true
  const exportEnabled = node.props?.exportEnabled === true
  const source = node.props?.source as ReportResultSource | null | undefined
  const placeholder =
    (node.props?.placeholder as string | undefined) ||
    t('sdui.reportResult.placeholder')

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['sdui-report-result', source?.url, source?.body],
      queryFn: async ({ pageParam, signal }) => {
        if (!source) throw new Error('REPORT_RESULT node: source is required')
        // §19.6: тело — целиком source.body, фронт его не собирает и не мутирует.
        const res = await apiService.post<ReportResultPage>({
          url: source.url,
          params: { page: pageParam, pageSize },
          data: source.body,
          signal,
        })
        return res.data
      },
      initialPageParam: 0,
      getNextPageParam: (
        lastPage: ReportResultPage,
        pages: ReportResultPage[]
      ) =>
        reportLayout === 'LEDGER' && lastPage.hasMore
          ? (lastPage.page ?? pages.length - 1) + 1
          : undefined,
      enabled: !!source,
    })

  if (!source) {
    return (
      <div
        data-testid="report-result-placeholder"
        className="flex items-center justify-center py-20"
      >
        <Typography className="text-ui-05">{placeholder}</Typography>
      </div>
    )
  }

  const result = mergeReportPages(data?.pages, reportLayout)
  const gateway = getReportResultGateway()
  const Renderer = gateway?.Renderer
  const reportName = result?.reportNameRu || reportCode || ''

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {(printEnabled || exportEnabled) && (
        <div className="flex items-center gap-2">
          {printEnabled && (
            <Button
              data-testid="report-result-print"
              onClick={() => {
                void gateway?.print?.(
                  reportCode ?? '',
                  source.body,
                  i18n.language
                )
              }}
            >
              {t('sdui.reportResult.print')}
            </Button>
          )}
          {exportEnabled && (
            <Button
              data-testid="report-result-export"
              disabled={!result}
              onClick={() => {
                if (result) gateway?.exportXlsx?.(result, reportName)
              }}
            >
              {t('sdui.reportResult.export')}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Typography className="text-ui-05">{t('sdui.loading')}</Typography>
        </div>
      ) : Renderer && result ? (
        <Renderer result={result} />
      ) : (
        <div
          data-testid="report-result-gateway-missing"
          className="flex items-center justify-center py-20"
        >
          <Typography className="text-ui-05">
            {t('sdui.reportResult.gatewayMissing')}
          </Typography>
        </div>
      )}

      {reportLayout === 'LEDGER' && hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            data-testid="report-result-show-more"
            disabled={isFetchingNextPage}
            onClick={() => {
              void fetchNextPage()
            }}
          >
            {isFetchingNextPage ? (
              <CircularProgress size={14} />
            ) : (
              t('sdui.reportResult.showMore')
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
