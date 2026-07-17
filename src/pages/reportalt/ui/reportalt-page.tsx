import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Typography } from '@mui/material'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { ReportResultView } from '@/features/report-result-view'
import { PageHeader } from '@/widgets/page-header'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { showToast } from '@/shared/ui/toast/show-toast'
import { exportTableToXlsx } from '@/shared/lib/table-export'

import { useReportAltMeta } from '../lib/hooks/use-reportalt-meta'
import { useRunReportAlt } from '../lib/hooks/use-run-reportalt'
import { useReportAltUserSettings } from '../lib/hooks/use-reportalt-user-settings'
import { buildReportAltExport } from '../lib/utils/build-reportalt-export'
import {
  SETTINGS_URL_KEY,
  clearStoredSettings,
} from '../lib/utils/user-settings'
import {
  defaultParamValue,
  deserializeParam,
  isFilled,
  isPeriod,
  normalizeBodyDates,
  serializeParams,
  type ParamValues,
  type PeriodValue,
  type ReportAltParamValue,
} from '../lib/utils/params'
import { ReportAltParamField } from './reportalt-param-field'
import { ReportAltSettingsDrawer } from './settings/reportalt-settings-drawer'
import { printReportAlt } from '../api/reportalt-api'
import type { RunReportAltBody } from '../types/reportalt'

/** Сообщение из тела ошибки бэка (api.ts бросает `error.response.data`). */
const errorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error
  if (error != null && typeof error === 'object') {
    const o = error as { message?: unknown; data?: { message?: unknown } }
    if (typeof o.message === 'string') return o.message
    if (typeof o.data?.message === 'string') return o.data.message
  }
  return undefined
}

/**
 * Универсальная страница отчёта нового контура ReportAlt
 * (`/modules/{pageCode}/reportalt/{code}`). Динамическая форма параметров из
 * `/api/reportalt/{code}/meta`, результат — общий рендерер
 * `features/report-result-view` (LEDGER/TREE/FORM); для LEDGER — постраничная
 * подгрузка «Показать ещё». Applied-параметры живут в URL (переживают
 * перезагрузку и переключение вкладок).
 */
export const ReportAltPage = () => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '', moduleCode = '' } = useParams()

  const {
    meta,
    isLoading: isMetaLoading,
    isError: isMetaError,
  } = useReportAltMeta(moduleCode)

  const reportName = meta
    ? (isKz ? meta.definition.nameKz : meta.definition.nameRu) ||
      meta.definition.nameRu
    : t('reportalt.title')
  useTabMeta(reportName)

  const [searchParams, setSearchParams] = useSearchParams()

  // Черновики полей формы (что пользователь правит до «Сформировать»).
  const [values, setValues] = useState<ParamValues>({})
  const [showErrors, setShowErrors] = useState(false)

  // Инициализация черновиков из URL (или дефолтов) при загрузке meta и при
  // перемонтировании вкладки (searchParams в зависимостях).
  useEffect(() => {
    if (!meta) return
    const next: ParamValues = {}
    for (const param of meta.parameters) {
      const raw = searchParams.get(param.code)
      next[param.code] =
        raw != null ? deserializeParam(raw, param) : defaultParamValue(param)
    }
    // Сознательная синхронизация черновика формы из URL+meta при их смене.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
  }, [meta, searchParams])

  // Пользовательские настройки (MVP — клиентские, F-S1): черновик панели,
  // применённая дельта из URL/localStorage для тела /run.
  const {
    supportsSettings,
    draft: settingsDraft,
    setDraft: setSettingsDraft,
    appliedUserSettings,
    encodedDraft,
    persistDraft,
  } = useReportAltUserSettings(moduleCode, meta, searchParams)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Applied-параметры — производные от URL: запрос уходит, когда в URL есть
  // хотя бы один параметр и заполнены все обязательные. userSettings попадает
  // в тело (и через JSON.stringify(body) — в query-key TanStack: другой хэш
  // настроек ⇒ другой кэш).
  const appliedBody = useMemo<RunReportAltBody | null>(() => {
    if (!meta) return null
    const applied: Record<string, unknown> = {}
    let hasAny = false
    for (const param of meta.parameters) {
      const raw = searchParams.get(param.code)
      if (raw == null) continue
      hasAny = true
      applied[param.code] = deserializeParam(raw, param)
    }
    const requiredMet = meta.parameters
      .filter((p) => p.required)
      .every((p) => isFilled(p, applied[p.code] as ReportAltParamValue))
    if (!hasAny || !requiredMet) return null
    return {
      parameters: normalizeBodyDates(applied, meta.parameters),
      ...(appliedUserSettings != null
        ? { userSettings: appliedUserSettings }
        : {}),
    }
  }, [meta, searchParams, appliedUserSettings])

  const isLedger = meta?.definition.layout === 'LEDGER'

  const {
    result,
    isLoading: isRunning,
    isError: isRunError,
    error: runError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useRunReportAlt(moduleCode, appliedBody, appliedBody != null, isLedger)

  // Ошибка формирования (422 — невалидные параметры / слишком большой
  // результат; прочее) — тостом, с сообщением бэка при наличии.
  useEffect(() => {
    if (!isRunError) return
    showToast('error', t('reportalt.loadError'), errorMessage(runError))
  }, [isRunError, runError, t])

  const canSubmit = useMemo(() => {
    if (!meta) return false
    return meta.parameters
      .filter((p) => p.required)
      .every((p) => isFilled(p, values[p.code]))
  }, [meta, values])

  const setParamValue = (code: string, v: ReportAltParamValue) => {
    setValues((prev) => ({ ...prev, [code]: v }))
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    const serialized = serializeParams(values)
    const sameParams = meta?.parameters.every(
      (p) => (searchParams.get(p.code) ?? '') === (serialized[p.code] ?? '')
    )
    const sameSettings =
      (searchParams.get(SETTINGS_URL_KEY) ?? '') === (encodedDraft ?? '')
    // Дельта настроек — личный дефолт отчёта (localStorage) + URL (F-S1).
    persistDraft()
    setSearchParams(
      () => {
        const next = new URLSearchParams()
        for (const [k, v] of Object.entries(serialized)) next.set(k, v)
        if (encodedDraft != null) next.set(SETTINGS_URL_KEY, encodedDraft)
        return next
      },
      { replace: true }
    )
    // Те же параметры и настройки уже применены → форсим refetch (иначе кэш).
    if (sameParams && sameSettings && appliedBody != null) void refetch()
  }

  /** «Стандартные настройки»: пустая дельта — очистить URL и личный дефолт. */
  const handleResetSettings = () => {
    setSettingsDraft(null)
    clearStoredSettings(moduleCode)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(SETTINGS_URL_KEY)
        return next
      },
      { replace: true }
    )
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  const handleExportExcel = () => {
    if (!result) return
    const data = buildReportAltExport(
      result,
      isKz,
      t('reportalt.group'),
      t('reportalt.total')
    )
    exportTableToXlsx(reportName, data)
  }

  // Печать в PDF: бэк может отвечать 501 (печать не реализована) — тост.
  const [isPrinting, setIsPrinting] = useState(false)
  const handlePrintPdf = () => {
    if (!appliedBody || isPrinting) return
    setIsPrinting(true)
    void printReportAlt(moduleCode, appliedBody, isKz ? 'Kz' : 'Ru')
      .then((res) => {
        window.open(URL.createObjectURL(res.data), '_blank')
      })
      .catch(() => {
        showToast('warning', t('reportalt.printUnavailable'))
      })
      .finally(() => {
        setIsPrinting(false)
      })
  }

  if (isMetaLoading) {
    return (
      <div className="flex h-full flex-col gap-5 pt-5">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isMetaError || !meta) {
    return (
      <div className="flex h-full flex-col gap-5 pt-5">
        <PageHeader title={t('reportalt.title')} onClose={handleClose} />
        <div className="py-4">
          <Typography variant="body2" className="text-support-01">
            {t('reportalt.metaLoadError')}
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={reportName} onClose={handleClose} />

      {/* Динамическая форма параметров по meta.parameters. */}
      <div className="flex flex-wrap items-start gap-4">
        {meta.parameters.map((param) => {
          const invalid =
            showErrors && param.required && !isFilled(param, values[param.code])
          // PERIOD раскрываем в пару полей «с … по …».
          if (isPeriod(param)) {
            const period = (values[param.code] as PeriodValue | undefined) ?? {
              from: '',
              to: '',
            }
            const title =
              (isKz ? param.titleKz : param.titleRu) || param.titleRu
            const setPeriod = (patch: Partial<PeriodValue>) => {
              setParamValue(param.code, { ...period, ...patch })
            }
            return (
              <div key={param.code} className="flex flex-wrap gap-4">
                <div className="w-44">
                  <ReportAltParamField
                    param={{
                      ...param,
                      dataType: 'DATE',
                      titleRu: `${title}, ${t('reportalt.periodFrom')}`,
                      titleKz: `${title}, ${t('reportalt.periodFrom')}`,
                    }}
                    value={period.from}
                    onChange={(v) => {
                      setPeriod({ from: typeof v === 'string' ? v : '' })
                    }}
                    invalid={invalid && !period.from}
                  />
                </div>
                <div className="w-44">
                  <ReportAltParamField
                    param={{
                      ...param,
                      dataType: 'DATE',
                      titleRu: `${title}, ${t('reportalt.periodTo')}`,
                      titleKz: `${title}, ${t('reportalt.periodTo')}`,
                    }}
                    value={period.to}
                    onChange={(v) => {
                      setPeriod({ to: typeof v === 'string' ? v : '' })
                    }}
                    invalid={invalid && !period.to}
                  />
                </div>
              </div>
            )
          }
          return (
            <div
              key={param.code}
              className={param.dataType === 'BOOLEAN' ? '' : 'w-72'}
            >
              <ReportAltParamField
                param={param}
                value={values[param.code]}
                onChange={(v) => {
                  setParamValue(param.code, v)
                }}
                invalid={invalid}
              />
            </div>
          )
        })}

        <Button variant="contained" size="medium" onClick={handleSubmit}>
          {t('reportalt.generate')}
        </Button>
        {/* Панель настроек — только для отчётов с наполненным meta (F-S3). */}
        {supportsSettings && (
          <Button
            variant="outlined"
            size="medium"
            onClick={() => {
              setSettingsOpen(true)
            }}
          >
            {t('reportalt.settings.open')}
          </Button>
        )}
      </div>

      {/* Результат. */}
      {isRunning ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : result ? (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outlined" size="small" onClick={handleExportExcel}>
              {t('reportalt.exportExcel')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={isPrinting}
              onClick={handlePrintPdf}
            >
              {t('reportalt.print')}
            </Button>
          </div>
          {result.rows.length === 0 && !result.form ? (
            <Typography variant="body2" className="text-ui-05">
              {t('reportalt.noData')}
            </Typography>
          ) : (
            <div className="min-h-0 overflow-auto pb-4">
              <ReportResultView result={result} />
              {/* LEDGER: постраничная подгрузка (F4 — hasMore/nextOffset). */}
              {isLedger && hasNextPage && (
                <div className="mt-3">
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isFetchingNextPage}
                    onClick={() => {
                      void fetchNextPage()
                    }}
                  >
                    {t('reportalt.showMore')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        appliedBody == null && (
          <Typography variant="body2" className="text-ui-05">
            {t('reportalt.notGenerated')}
          </Typography>
        )
      )}

      {supportsSettings && (
        <ReportAltSettingsDrawer
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false)
          }}
          meta={meta}
          draft={settingsDraft}
          onDraftChange={setSettingsDraft}
          onApply={() => {
            setSettingsOpen(false)
            handleSubmit()
          }}
          onReset={handleResetSettings}
        />
      )}
    </div>
  )
}
