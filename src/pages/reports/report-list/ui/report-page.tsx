import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Tooltip, Typography } from '@mui/material'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DateTimeInput } from '@/shared/ui/inputs'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'

import { useReportMeta } from '../lib/hooks/use-report-meta'
import { useRunReport } from '../lib/hooks/use-run-report'
import { ReportResultTable } from './report-result-table'
import { ReportParamField, type ReportParamValue } from './report-param-field'
import type {
  ReportMetaDto,
  ReportParameterDto,
  RunReportBody,
} from '../types/report'

/** Значения формы параметров: ключ = `param.code`. */
type ParamValues = Record<string, ReportParamValue>

/** PERIOD-параметр хранит пару дат; кладём как `{ from, to }` в значение. */
interface PeriodValue {
  from: string
  to: string
}

const isPeriod = (p: ReportParameterDto) => p.dataType === 'PERIOD'

/**
 * Сериализация значений параметров в строку URL (одно поле на параметр).
 * Массивы/объекты — JSON. Так applied-параметры переживают переключение
 * вкладок и обновление страницы (как в ОСВ).
 */
const serializeParams = (values: ParamValues): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [code, v] of Object.entries(values)) {
    if (v == null || v === '') continue
    out[code] = typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  return out
}

/** Десериализация одного значения параметра из URL по типу параметра. */
const deserializeParam = (
  raw: string,
  param: ReportParameterDto
): ReportParamValue => {
  switch (param.dataType) {
    case 'PERIOD':
    case 'ACCOUNT_LIST':
      try {
        return JSON.parse(raw) as ReportParamValue
      } catch {
        return undefined
      }
    case 'BOOLEAN':
      return raw === 'true'
    case 'NUMBER':
      return raw === '' ? '' : Number(raw)
    default:
      return raw
  }
}

/** Дефолтное значение параметра (из meta.defaultValue или пустое по типу). */
const defaultParamValue = (param: ReportParameterDto): ReportParamValue => {
  if (param.defaultValue != null) return param.defaultValue as ReportParamValue
  switch (param.dataType) {
    case 'ACCOUNT_LIST':
      return []
    case 'BOOLEAN':
      return false
    case 'PERIOD':
      return { from: '', to: '' } as unknown as ReportParamValue
    default:
      return ''
  }
}

/** Заполнен ли обязательный параметр. */
const isFilled = (param: ReportParameterDto, v: ReportParamValue): boolean => {
  if (isPeriod(param)) {
    const p = v as PeriodValue | undefined
    return !!p && !!p.from && !!p.to
  }
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'boolean') return true
  return v != null && v !== ''
}

/**
 * Универсальная страница отчёта. Рендерит ЛЮБОЙ отчёт по коду из `:moduleCode`
 * через метаданные `/api/reports/{code}/meta`: динамическая форма параметров +
 * таблица результата. Applied-параметры живут в URL (как в ОСВ) — переживают
 * переключение вкладок и обновление страницы.
 */
export const ReportPage = () => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '', moduleCode = '' } = useParams()

  const {
    meta,
    isLoading: isMetaLoading,
    isError: isMetaError,
  } = useReportMeta(moduleCode)

  const reportName = meta
    ? (isKz ? meta.definition.nameKz : meta.definition.nameRu) ||
      meta.definition.nameRu
    : t('reports.title')
  useTabMeta(reportName)

  const [searchParams, setSearchParams] = useSearchParams()

  // Черновики полей формы (что пользователь правит до «Сформировать»).
  const [values, setValues] = useState<ParamValues>({})
  // Подсветка незаполненных обязательных полей после неуспешной попытки.
  const [showErrors, setShowErrors] = useState(false)

  // Инициализация черновиков из URL (или дефолтов) — когда meta загрузилась.
  // Зависит от searchParams, чтобы восстанавливать applied-значения при
  // перемонтировании (переключение вкладок).
  useEffect(() => {
    if (!meta) return
    const next: ParamValues = {}
    for (const param of meta.parameters) {
      const raw = searchParams.get(param.code)
      next[param.code] =
        raw != null ? deserializeParam(raw, param) : defaultParamValue(param)
    }
    // Сознательная синхронизация черновика формы из URL+meta при их смене
    // (восстановление applied-параметров при перемонтировании вкладки).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
  }, [meta, searchParams])

  // Applied-параметры — производные от URL. Запрос включается, когда заданы
  // все обязательные параметры (есть хотя бы один query-параметр => применено).
  const appliedBody = useMemo<RunReportBody | null>(() => {
    if (!meta) return null
    const applied: Record<string, unknown> = {}
    let hasAny = false
    for (const param of meta.parameters) {
      const raw = searchParams.get(param.code)
      if (raw == null) continue
      hasAny = true
      applied[param.code] = deserializeParam(raw, param)
    }
    // Все обязательные параметры должны присутствовать в URL.
    const requiredMet = meta.parameters
      .filter((p) => p.required)
      .every((p) => isFilled(p, applied[p.code] as ReportParamValue))
    if (!hasAny || !requiredMet) return null
    return { parameters: applied }
  }, [meta, searchParams])

  const isDraft = meta?.definition.status === 'DRAFT'

  const {
    result,
    isLoading: isRunning,
    isError: isRunError,
    refetch,
  } = useRunReport(moduleCode, appliedBody, appliedBody != null)

  // Можно ли формировать: все обязательные параметры заполнены в черновике.
  const canSubmit = useMemo(() => {
    if (!meta) return false
    return meta.parameters
      .filter((p) => p.required)
      .every((p) => isFilled(p, values[p.code]))
  }, [meta, values])

  const setParamValue = (code: string, v: ReportParamValue) => {
    setValues((prev) => ({ ...prev, [code]: v }))
  }

  const setPeriodValue = (code: string, patch: Partial<PeriodValue>) => {
    setValues((prev) => {
      const cur = (prev[code] as PeriodValue | undefined) ?? {
        from: '',
        to: '',
      }
      return {
        ...prev,
        [code]: { ...cur, ...patch } as unknown as ReportParamValue,
      }
    })
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    const serialized = serializeParams(values)
    // Те же параметры, что уже применены → форсим refetch (иначе кэш в окне
    // staleTime вернётся без запроса).
    const sameAsApplied = meta?.parameters.every(
      (p) => (searchParams.get(p.code) ?? '') === (serialized[p.code] ?? '')
    )
    setSearchParams(
      () => {
        const next = new URLSearchParams()
        for (const [k, v] of Object.entries(serialized)) next.set(k, v)
        return next
      },
      { replace: true }
    )
    if (sameAsApplied && appliedBody != null) void refetch()
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
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
        <PageHeader title={t('reports.title')} onClose={handleClose} />
        <div className="py-4">
          <Typography variant="body2" className="text-support-01">
            {t('reports.loadError')}
          </Typography>
        </div>
      </div>
    )
  }

  return (
    <ReportPageContent
      meta={meta}
      reportName={reportName}
      isKz={isKz}
      values={values}
      showErrors={showErrors}
      setParamValue={setParamValue}
      setPeriodValue={setPeriodValue}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onClose={handleClose}
      applied={appliedBody != null}
      isDraft={isDraft}
      isRunning={isRunning}
      isRunError={isRunError}
      result={result}
    />
  )
}

interface ReportPageContentProps {
  meta: ReportMetaDto
  reportName: string
  isKz: boolean
  values: ParamValues
  showErrors: boolean
  setParamValue: (code: string, v: ReportParamValue) => void
  setPeriodValue: (code: string, patch: Partial<PeriodValue>) => void
  canSubmit: boolean
  onSubmit: () => void
  onClose: () => void
  applied: boolean
  isDraft: boolean
  isRunning: boolean
  isRunError: boolean
  result: ReturnType<typeof useRunReport>['result']
}

/** Контент страницы — выделен, чтобы хуки meta/run вызывались до раннего return. */
const ReportPageContent = ({
  meta,
  reportName,
  isKz,
  values,
  showErrors,
  setParamValue,
  setPeriodValue,
  canSubmit,
  onSubmit,
  onClose,
  applied,
  isDraft,
  isRunning,
  isRunError,
  result,
}: ReportPageContentProps) => {
  const { t } = useTranslation()

  const description = meta.definition.description

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={reportName} onClose={onClose} />

      {description && (
        <Typography variant="body2" className="text-ui-05">
          {description}
        </Typography>
      )}

      {/* Динамическая форма параметров по meta.parameters. */}
      {meta.parameters.length === 0 ? (
        <Typography variant="body2" className="text-ui-05">
          {t('reports.noParams')}
        </Typography>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          {meta.parameters.map((param) => {
            const invalid =
              showErrors &&
              param.required &&
              !isFilled(param, values[param.code])
            // PERIOD раскрываем в пару полей from/to.
            if (isPeriod(param)) {
              const period = (values[param.code] as
                | PeriodValue
                | undefined) ?? {
                from: '',
                to: '',
              }
              const title =
                (isKz ? param.titleKz : param.titleRu) || param.titleRu
              return (
                <div key={param.code} className="flex flex-wrap gap-4">
                  <div className="report-param-field w-64">
                    <DateTimeInput
                      value={period.from}
                      onChange={(v) => {
                        setPeriodValue(param.code, { from: v })
                      }}
                      label={`${title}: ${t('reports.periodFrom')}`}
                      required={param.required}
                      error={invalid}
                      size="small"
                      fullWidth
                    />
                  </div>
                  <div className="report-param-field w-64">
                    <DateTimeInput
                      value={period.to}
                      onChange={(v) => {
                        setPeriodValue(param.code, { to: v })
                      }}
                      label={`${title}: ${t('reports.periodTo')}`}
                      required={param.required}
                      error={invalid}
                      size="small"
                      fullWidth
                    />
                  </div>
                </div>
              )
            }
            return (
              <div
                key={param.code}
                className={
                  param.dataType === 'BOOLEAN'
                    ? 'flex items-center'
                    : 'report-param-field w-64'
                }
              >
                <ReportParamField
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

          <Button
            variant="contained"
            disabled={!canSubmit}
            onClick={onSubmit}
            sx={{ height: 48 }}
          >
            {t('reports.generate')}
          </Button>

          {/* Печать — заглушка 501: показываем disabled с подсказкой, не вызываем. */}
          <Tooltip title={t('reports.printNotImplemented')}>
            <span>
              <Button variant="outlined" disabled sx={{ height: 48 }}>
                {t('reports.print')}
              </Button>
            </span>
          </Tooltip>
        </div>
      )}

      {/* Результат. */}
      {applied && (
        <>
          {isRunning && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isRunning && isRunError && isDraft && (
            <div className="rounded-md bg-ui-02 px-4 py-6 text-center">
              <Typography variant="body1" className="text-ui-06">
                {t('reports.notImplemented')}
              </Typography>
            </div>
          )}

          {!isRunning && isRunError && !isDraft && (
            <div className="py-4">
              <Typography variant="body2" className="text-support-01">
                {t('reports.loadError')}
              </Typography>
            </div>
          )}

          {!isRunning && !isRunError && result && (
            <ReportResult result={result} />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Рендер результата: если это ReportResultDto (есть columns+rows) — таблица;
 * иначе (NATIVE_DELEGATE спец-DTO без columns/rows) — сообщение, что отчёт
 * открывается на отдельном экране.
 */
const ReportResult = ({
  result,
}: {
  result: NonNullable<ReturnType<typeof useRunReport>['result']>
}) => {
  const { t } = useTranslation()

  const isTabular = Array.isArray(result.columns) && Array.isArray(result.rows)

  if (!isTabular) {
    return (
      <div className="rounded-md bg-ui-02 px-4 py-6 text-center">
        <Typography variant="body1" className="text-ui-06">
          {t('reports.separateScreen')}
        </Typography>
      </div>
    )
  }

  return <ReportResultTable result={result} />
}
