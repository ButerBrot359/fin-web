import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'

import { apiService } from '@/shared/api/api'
import { Button } from '@/shared/ui/buttons'

import type { NodeProps, ViewEffect } from '../../../types/view'
import { readPagination } from '../../../lib/utils/pagination'
import { getReportResultGateway } from '../../../lib/report-result-gateway'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useSduiEffects } from '../../../lib/use-sdui-effects'

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

// Ответ /run обёрнут в ApiDataResponse ({data, success}) — разворачиваем
// толерантно, как легаси-контур (reportalt-api.unwrap): голый DTO тоже принимаем.
const unwrapReportPage = (payload: unknown): ReportResultPage => {
  if (
    payload != null &&
    typeof payload === 'object' &&
    'data' in payload &&
    'success' in payload
  ) {
    return (payload as { data: ReportResultPage }).data
  }
  return payload as ReportResultPage
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
 * SCRUM-370 блок Б шаг 2: настройками владеет сервер (server-settings: true) —
 * клиентского наложения userSettings больше нет, тело /run и download-эффекты
 * приходят готовыми. Блок Г: легаси-ветки печати/экспорта (printSource/
 * exportEnabled + gateway.print/exportXlsx) удалены — печать и экспорт идут
 * только серверными READY-эффектами (printEffect/exportEffect).
 */
export const ReportResultNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const effects = useSduiEffects()
  const dispatch = useSduiDispatch()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const reportCode = node.props?.reportCode as string | undefined
  const reportLayout = node.props?.reportLayout as string | undefined
  // SCRUM-368: pageSize из контракта пагинации; легаси props.pageSize и
  // хардкод 200 — фолбэки для старых ответов
  const pageSize =
    readPagination(node)?.pageSize ??
    (node.props?.pageSize as number | undefined) ??
    200
  // Р2-b: settingsEnabled=false при серверной панели настроек — свою кнопку
  // не рисуем (кнопка уже в серверном тулбаре), иначе их было бы две.
  const settingsEnabled = node.props?.settingsEnabled === true
  const source = node.props?.source as ReportResultSource | null | undefined
  const placeholder =
    (node.props?.placeholder as string | undefined) ||
    t('sdui.reportResult.placeholder')

  // SCRUM-288 §3.2-3.5: READY download-эффекты от бэка — единственный путь
  // печати/экспорта (SCRUM-370 блок Г: легаси-ветки сняты).
  const printEffect = node.props?.printEffect as ViewEffect | undefined
  const exportEffect = node.props?.exportEffect as ViewEffect | undefined

  // SCRUM-370 блок Б (шаг 1): команды настроек приходят готовыми строками.
  // Ветвление — по НАЛИЧИЮ пропа (сервер понимает команду), не по флагу,
  // которого фронт не знает: при выключенном флаге сервер команду игнорирует.
  const settingsApplyCommand = node.props?.settingsApplyCommand as
    | string
    | undefined
  const settingsResetCommand = node.props?.settingsResetCommand as
    | string
    | undefined

  // SCRUM-370 блок В: наличие пропа = «переход разрешён». Нет пропа — строки
  // не кликабельны, по двойному клику не уходит ничего.
  const drilldownCommand = node.props?.drilldownCommand as string | undefined

  // rowRef уходит эхом, как есть (§3.4) — не пересобирать, не дополнять.
  // Строка без rowRef не шлётся вовсе — проверка до dispatch.
  const handleDrilldown = (row: unknown) => {
    if (!drilldownCommand) return
    const rowRef = (row as { rowRef?: unknown } | null)?.rowRef
    if (rowRef == null) return
    void dispatch({
      type: 'COMMAND',
      command: drilldownCommand,
      value: { rowRef },
    })
  }

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['sdui-report-result', source?.url, source?.body],
      queryFn: async ({ pageParam, signal }) => {
        if (!source) throw new Error('REPORT_RESULT node: source is required')
        // §19.6/блок Б шаг 2: тело — целиком source.body с сервера, фронт его
        // не собирает и не мутирует (userSettings уже в нём).
        const res = await apiService.post<ReportResultPage>({
          url: source.url,
          params: { page: pageParam, pageSize },
          data: source.body,
          signal,
        })
        return unwrapReportPage(res.data)
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
  const SettingsPanel = gateway?.SettingsPanel

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {(printEffect || exportEffect || (settingsEnabled && SettingsPanel)) && (
        <div className="flex items-center gap-2">
          {printEffect && (
            <Button
              data-testid="report-result-print"
              onClick={() => {
                effects.play(printEffect)
              }}
            >
              {t('sdui.reportResult.print')}
            </Button>
          )}
          {exportEffect && (
            <Button
              data-testid="report-result-export"
              onClick={() => {
                effects.play(exportEffect)
              }}
            >
              {t('sdui.reportResult.export')}
            </Button>
          )}
          {settingsEnabled && SettingsPanel && (
            <Button
              data-testid="report-result-settings"
              onClick={() => {
                setSettingsOpen(true)
              }}
            >
              {t('sdui.reportResult.settings')}
            </Button>
          )}
        </div>
      )}

      {settingsEnabled && SettingsPanel && reportCode && (
        <SettingsPanel
          reportCode={reportCode}
          appliedUserSettings={undefined}
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false)
          }}
          onApply={(us) => {
            // SCRUM-370 блок Б шаг 2: настройками владеет сервер — локального
            // наложения больше нет, команда единственный путь.
            setSettingsOpen(false)
            if (settingsApplyCommand) {
              void dispatch({
                type: 'COMMAND',
                command: settingsApplyCommand,
                value: us,
              })
            }
          }}
          onReset={() => {
            setSettingsOpen(false)
            if (settingsResetCommand) {
              void dispatch({ type: 'COMMAND', command: settingsResetCommand })
            }
          }}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Typography className="text-ui-05">{t('sdui.loading')}</Typography>
        </div>
      ) : Renderer && result ? (
        <Renderer
          result={result}
          onDrilldown={drilldownCommand ? handleDrilldown : undefined}
        />
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
