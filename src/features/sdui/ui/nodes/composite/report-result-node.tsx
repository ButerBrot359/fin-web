import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'

import { apiService } from '@/shared/api/api'
import { Button } from '@/shared/ui/buttons'
import {
  accountCodeOf,
  resolveDrilldownKinds,
  type DrilldownRow,
  type DrilldownTargetKind,
} from '@/entities/report-drilldown'

import type { NodeProps, ViewEffect } from '../../../types/view'
import { readPagination } from '../../../lib/utils/pagination'
import { getReportResultGateway } from '../../../lib/report-result-gateway'
import {
  ReportRowMenu,
  type ReportRowMenuAction,
  type ReportRowMenuPosition,
} from './report-row-menu'
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

/**
 * Период применённого запроса — из тела /run, которое нода и так держит: переходы
 * расшифровки открывают отчёт ЗА ТОТ ЖЕ период, иначе суммы не совпадут со строкой.
 */
const drilldownPeriod = (
  body: unknown
): { from?: string; to?: string } | null => {
  const parameters = (body as { parameters?: unknown } | null | undefined)
    ?.parameters
  if (parameters == null || typeof parameters !== 'object') return null
  for (const value of Object.values(parameters as Record<string, unknown>)) {
    if (
      value != null &&
      typeof value === 'object' &&
      ('from' in value || 'to' in value)
    ) {
      return value as { from?: string; to?: string }
    }
  }
  return null
}

/**
 * Карточка записи плана счетов: {@code /modules/<модуль>/accountplan/<тип>/<id>} —
 * легаси-страница, потому что SDUI-маршрут этого домена отвечает «не поддержано».
 * Модуль берётся из адреса отчёта-источника.
 */
const kartochkaZapisiPlanaSchetov = (
  pathname: string,
  typeCode: string,
  id: number
): string => {
  const segments = pathname.split('/').filter((s) => s.length > 0)
  const modul = segments[0] === 'modules' ? segments[1] : undefined
  return modul
    ? `/modules/${modul}/accountplan/${typeCode}/${String(id)}`
    : pathname
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
  const navigate = useNavigate()
  const location = useLocation()
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
  const handleDrilldown = (row: unknown, target?: DrilldownTargetKind) => {
    if (!drilldownCommand) return
    const rowRef = (row as { rowRef?: unknown } | null)?.rowRef
    if (rowRef == null) return
    void dispatch({
      type: 'COMMAND',
      command: drilldownCommand,
      // target — ключ перехода из меню эталона; маршрут и параметры целевого
      // отчёта собирает сервер (токен ?rp= умеет выпускать только он).
      value: target ? { rowRef, target } : { rowRef },
    })
  }

  // Меню действий по строке (1С открывает его и двойным кликом, и правой
  // кнопкой) — состав пунктов знает нода: расшифровка живёт в её пропсах.
  const [rowMenu, setRowMenu] = useState<{
    position: ReportRowMenuPosition
    row: unknown
    ancestors: unknown[]
  } | null>(null)

  const menuRow = rowMenu?.row ?? null
  const menuRowRef = (menuRow as { rowRef?: unknown } | null)?.rowRef
  const menuRowLabel = (menuRow as { groupValue?: unknown } | null)?.groupValue
  // Корень ветки — строка-счёт: её ссылка ведёт в «Карточку счёта», как в 1С.
  // Клик по самой строке-счёту даёт пустых предков, поэтому цепочка включает саму строку.
  const menuChain = (
    rowMenu ? [...rowMenu.ancestors, rowMenu.row] : []
  ) as DrilldownRow[]
  // Корень ветки — строка-счёт: её ссылка ведёт в «Карточку счёта», как в 1С.
  const accountRow = menuChain.find((r) => r.rowRef?.domain === 'ACCOUNT_PLAN')
  const accountRowRef = accountRow?.rowRef ?? null

  // Эталон 1С (БухгалтерскиеОтчетыВызовСервера.ПолучитьПараметрыРасшифровкиОтчета):
  // у строки ОСВ меню из пяти переходов в другие отчёты по тому же счёту, а не один
  // «Открыть». Состав переходов по отчётам знает общий модуль расшифровки — он же
  // обслуживает легаси-экран, чтобы правило жило в одном месте.
  const appliedPeriod = drilldownPeriod(source?.body)
  const drilldownOptions = rowMenu
    ? {
        reportCode: reportCode ?? '',
        chain: menuChain,
        accountRow,
        valueRow: menuChain[menuChain.length - 1],
        from: appliedPeriod?.from,
        to: appliedPeriod?.to,
      }
    : null

  const accountCode = accountCodeOf(accountRow)
  const targetLabel = (kind: DrilldownTargetKind): string =>
    kind === 'osvPoSchetu' ||
    kind === 'analizScheta' ||
    kind === 'turnoverByDays' ||
    kind === 'turnoverByMonths'
      ? t(`reportalt.drilldown.${kind}`, { code: accountCode }).trim()
      : t(`reportalt.drilldown.${kind}`)

  const etalonKinds = drilldownOptions
    ? resolveDrilldownKinds(drilldownOptions)
    : []
  // Отчёт, для которого состав меню в эталоне не задан, сохраняет прежний
  // единственный переход «Карточка счёта» по корню ветки — иначе правка ОСВ
  // отобрала бы работающий переход у отчётов вне этого разбора.
  const kinds: DrilldownTargetKind[] =
    etalonKinds.length > 0 || accountRowRef == null
      ? etalonKinds
      : ['accountCard']

  const reportTargets: ReportRowMenuAction[] = []
  for (const kind of kinds) {
    // Переход по субконто адресует значение кликнутой строки, остальные — счёт
    // корня ветки; строка без нужной ссылки пункта не даёт.
    const targetRow = kind === 'subkontoCard' ? menuRow : accountRow
    const targetRef = (targetRow as DrilldownRow | null)?.rowRef
    if (targetRef == null) continue
    reportTargets.push({
      key: kind,
      label:
        kind === 'accountCard'
          ? `${t('osv.accountCard')} ${accountCode}`.trim()
          : targetLabel(kind),
      onSelect: () => {
        handleDrilldown(targetRow, kind)
      },
    })
  }

  const openValue =
    menuRowRef != null && menuRowRef === accountRowRef
      ? accountCode
      : typeof menuRowLabel === 'string'
        ? menuRowLabel
        : ''
  const openLabel =
    openValue !== ''
      ? `${t('osv.openElement')} «${openValue}»`
      : t('osv.openElement')

  const rowMenuActions: ReportRowMenuAction[] = !drilldownCommand
    ? []
    : [
        // Первый пункт эталона — «Открыть "<значение строки>"». Для субконто и
        // документов объект открывает серверная команда (она же проверяет, что
        // объект существует), для счёта карточки в SDUI нет вовсе
        // (ScreenDispatchKind.ACCOUNT_PLAN → unsupported), поэтому счёт
        // открывается легаси-страницей записи плана счетов.
        ...(menuRowRef != null && menuRowRef !== accountRowRef
          ? [
              {
                key: 'open',
                label: openLabel,
                onSelect: () => {
                  handleDrilldown(menuRow)
                },
              },
            ]
          : []),
        ...(menuRowRef != null && menuRowRef === accountRowRef
          ? [
              {
                key: 'open-account',
                label: openLabel,
                onSelect: () => {
                  void navigate(
                    kartochkaZapisiPlanaSchetov(
                      location.pathname,
                      accountRowRef.typeCode ?? '',
                      accountRowRef.id
                    )
                  )
                },
              },
            ]
          : []),
        ...reportTargets,
      ]

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
          onRowMenu={
            drilldownCommand
              ? (row, ancestors, position) => {
                  window.getSelection()?.removeAllRanges()
                  setRowMenu({ row, ancestors, position })
                }
              : undefined
          }
        />
      ) : Renderer ? (
        // Рендерер на месте, результата нет (отчёт не построился — например,
        // сервер отклонил параметры): это состояние отчёта, а не поломка UI.
        <div
          data-testid="report-result-placeholder"
          className="flex items-center justify-center py-20"
        >
          <Typography className="text-ui-05">{placeholder}</Typography>
        </div>
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

      <ReportRowMenu
        position={rowMenu?.position ?? null}
        actions={rowMenuActions}
        onClose={() => {
          setRowMenu(null)
        }}
      />

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
