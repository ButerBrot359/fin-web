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
 * Панель настроек (§19.1): полностью реализуется на app-слое через
 * `gateway.SettingsPanel` (легаси-drawer + meta-фетч, follow-up таска). Нода
 * лишь держит клиентский `userSettings` (unknown) и накладывает его поверх
 * `source.body` ровно одним полем (§19.6 — не пересобирает тело).
 */
export const ReportResultNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const effects = useSduiEffects()
  const dispatch = useSduiDispatch()
  const [userSettings, setUserSettings] = useState<unknown>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const reportCode = node.props?.reportCode as string | undefined
  const reportLayout = node.props?.reportLayout as string | undefined
  // SCRUM-368: pageSize из контракта пагинации; легаси props.pageSize и
  // хардкод 200 — фолбэки для старых ответов
  const pageSize =
    readPagination(node)?.pageSize ??
    (node.props?.pageSize as number | undefined) ??
    200
  const printSource = node.props?.printSource as
    | { url: string; method?: string }
    | undefined
  const exportEnabled = node.props?.exportEnabled === true
  const settingsEnabled = node.props?.settingsEnabled === true
  const source = node.props?.source as ReportResultSource | null | undefined
  const placeholder =
    (node.props?.placeholder as string | undefined) ||
    t('sdui.reportResult.placeholder')

  // SCRUM-288 §3.2-3.5: READY download-эффекты от бэка. Если присутствуют —
  // печать/экспорт проигрываются через useSduiEffects, старый gateway-путь
  // (printSource/exportEnabled) не трогаем — ветвление строго по наличию.
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

  // §3.5 п.3: клиентское наложение userSettings сохраняется и для нового
  // пути — ADD ровно одно поле поверх request.body перед проигрыванием.
  const playDownload = (effect: ViewEffect) => {
    const req = effect.request
    if (
      req &&
      userSettings != null &&
      typeof req.body === 'object' &&
      req.body != null
    ) {
      effects.play({
        ...effect,
        request: { ...req, body: { ...req.body, userSettings } },
      })
    } else {
      effects.play(effect)
    }
  }

  // §19.6: наложение — ADD ровно одно поле поверх source.body, никогда не
  // пересобирать тело; без userSettings или при не-объектном body body уходит как есть.
  const effectiveBody =
    userSettings != null &&
    typeof source?.body === 'object' &&
    source.body != null
      ? { ...(source.body as Record<string, unknown>), userSettings }
      : source?.body

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['sdui-report-result', source?.url, effectiveBody],
      queryFn: async ({ pageParam, signal }) => {
        if (!source) throw new Error('REPORT_RESULT node: source is required')
        // §19.6: тело — целиком source.body (+userSettings), фронт его не собирает и не мутирует иначе.
        const res = await apiService.post<ReportResultPage>({
          url: source.url,
          params: { page: pageParam, pageSize },
          data: effectiveBody,
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
  const SettingsPanel = gateway?.SettingsPanel
  const reportName = result?.reportNameRu || reportCode || ''

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      {(printSource ||
        printEffect ||
        exportEnabled ||
        exportEffect ||
        (settingsEnabled && SettingsPanel)) && (
        <div className="flex items-center gap-2">
          {printEffect ? (
            <Button
              data-testid="report-result-print"
              onClick={() => {
                playDownload(printEffect)
              }}
            >
              {t('sdui.reportResult.print')}
            </Button>
          ) : printSource ? (
            <Button
              data-testid="report-result-print"
              onClick={() => {
                void gateway?.print?.(printSource.url, effectiveBody)
              }}
            >
              {t('sdui.reportResult.print')}
            </Button>
          ) : null}
          {exportEffect ? (
            <Button
              data-testid="report-result-export"
              onClick={() => {
                playDownload(exportEffect)
              }}
            >
              {t('sdui.reportResult.export')}
            </Button>
          ) : exportEnabled ? (
            <Button
              data-testid="report-result-export"
              disabled={!result}
              onClick={() => {
                if (result) gateway?.exportXlsx?.(result, reportName)
              }}
            >
              {t('sdui.reportResult.export')}
            </Button>
          ) : null}
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
          appliedUserSettings={userSettings}
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false)
          }}
          onApply={(us) => {
            // SCRUM-370 блок Б шаг 1: аддитивно шлём команду серверу (настройки
            // в FormSession), локальное наложение сохраняется до шага 2.
            setUserSettings(us)
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
            setUserSettings(undefined)
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
