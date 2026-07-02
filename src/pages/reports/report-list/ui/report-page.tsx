import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Typography } from '@mui/material'

import { format, isValid, parseISO } from '@/shared/lib/utils/date'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  ReportSettingsDrawer,
  type ReportFilterItem,
  type ReportGroupItem,
} from '@/features/report-settings'
import {
  ReportResultView,
  isUnifiedRendererEnabled,
} from '@/features/report-result-view'
import { PageHeader } from '@/widgets/page-header'
import { DateTimeInput } from '@/shared/ui/inputs'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { exportTableToXlsx } from '@/shared/lib/table-export'

import { useReportMeta } from '../lib/hooks/use-report-meta'
import { useRunReport } from '../lib/hooks/use-run-report'
import { buildReportExport } from '../lib/utils/build-report-export'
import { ReportResultTable } from './report-result-table'
import { ReportParamField, type ReportParamValue } from './report-param-field'
import type {
  ReportFilterDto,
  ReportIndicatorDto,
  ReportMetaDto,
  ReportParameterDto,
  RunReportBody,
  RunReportFilter,
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
 * Нормализация даты для тела `/run`: бэкенд ждёт локальную дату
 * (`yyyy-MM-dd`, границы дня он расставляет сам), а инпуты отдают ISO с `Z`
 * (UTC) — такой формат бэкенд не парсит, и период молча терялся (отчёт без
 * движений).
 */
const toLocalDateTime = (raw: string): string => {
  if (!raw) return raw
  const d = parseISO(raw)
  if (!isValid(d)) return raw
  return format(d, 'yyyy-MM-dd')
}

/** Нормализует значения дат (DATE-строки и PERIOD-объекты {from,to}) в теле запроса. */
const normalizeBodyDates = (
  parameters: Record<string, unknown>,
  metaParams: ReportParameterDto[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...parameters }
  for (const p of metaParams) {
    if (p.dataType === 'DATE') {
      const v = out[p.code]
      if (typeof v === 'string' && v) out[p.code] = toLocalDateTime(v)
      continue
    }
    if (!isPeriod(p)) continue
    const v = out[p.code] as PeriodValue | undefined
    if (v && typeof v === 'object') {
      out[p.code] = {
        ...v,
        from: toLocalDateTime(v.from),
        to: toLocalDateTime(v.to),
      }
    }
  }
  return out
}

/** Префикс ключей URL для отборов (вкладка «Отборы»), чтобы не путать с параметрами. */
const FILTER_PREFIX = 'flt.'

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
    case 'REF_LIST':
      try {
        return JSON.parse(raw) as ReportParamValue
      } catch {
        return undefined
      }
    case 'BOOLEAN':
      return raw === 'true'
    case 'NUMBER':
    case 'ACCOUNT_REF':
    case 'DICTIONARY_REF':
    case 'ENUM_REF':
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
    case 'REF_LIST':
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
 * таблица результата. Applied-параметры и отборы живут в URL (как в ОСВ) —
 * переживают переключение вкладок и обновление страницы.
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

  // Структурные отборы из URL (вкладка «Отборы»). Ключ URL = FILTER_PREFIX+field.
  const appliedFilters = useMemo<RunReportFilter[]>(() => {
    if (!meta) return []
    const out: RunReportFilter[] = []
    for (const f of meta.filters) {
      const raw = searchParams.get(`${FILTER_PREFIX}${f.field}`)
      if (raw == null || raw === '') continue
      out.push({
        field: f.field,
        comparison: f.defaultComparison ?? f.comparisons?.[0] ?? 'EQUAL',
        values: [Number(raw)],
      })
    }
    return out
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
    return {
      parameters: normalizeBodyDates(applied, meta.parameters),
      ...(appliedFilters.length > 0 ? { filters: appliedFilters } : {}),
    }
  }, [meta, searchParams, appliedFilters])

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
      (prev) => {
        const next = new URLSearchParams()
        for (const [k, v] of Object.entries(serialized)) next.set(k, v)
        // Сохраняем активные отборы (flt.*) при пересоздании query-строки.
        for (const [k, v] of prev.entries()) {
          if (k.startsWith(FILTER_PREFIX)) next.set(k, v)
        }
        return next
      },
      { replace: true }
    )
    if (sameAsApplied && appliedBody != null) void refetch()
  }

  // Изменение отбора (вкладка «Отборы») — пишем/удаляем flt.<field> в URL.
  const onFilterChange = (field: string, valueId: number | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const key = `${FILTER_PREFIX}${field}`
        if (valueId != null) next.set(key, String(valueId))
        else next.delete(key)
        return next
      },
      { replace: true }
    )
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
      onFilterChange={onFilterChange}
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
  onFilterChange: (field: string, valueId: number | null) => void
}

/** Локализованный заголовок отбора/показателя. */
const localized = (ru: string, kz: string | undefined, isKz: boolean): string =>
  (isKz ? kz : ru) || ru

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
  onFilterChange,
}: ReportPageContentProps) => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Унифицированный 1С-рендерер включён ПО УМОЛЧАНИЮ; откат на старую таблицу —
  // ?renderer=v1 (или off/false/0) ∥ localStorage 'unifiedReportRenderer'='false'.
  const useUnifiedRenderer = useMemo(
    () => isUnifiedRendererEnabled(`?${searchParams.toString()}`),
    [searchParams]
  )

  const description = meta.definition.description

  // Табличный результат (есть columns+rows) — иначе спец-DTO без таблицы.
  const tabularResult =
    result && Array.isArray(result.columns) && Array.isArray(result.rows)
      ? result
      : null

  // DIMENSION-колонки результата — пункты вкладки «Группировка».
  const dimensionColumns = useMemo(
    () => tabularResult?.columns.filter((c) => c.role === 'DIMENSION') ?? [],
    [tabularResult]
  )

  // Состояние показателей (display-only): включён ли показатель. Инициализация
  // из defaultEnabled; пересобираем при смене набора показателей в meta.
  const [indicatorState, setIndicatorState] = useState<Record<string, boolean>>(
    {}
  )
  useEffect(() => {
    const next: Record<string, boolean> = {}
    for (const ind of meta.indicators) next[ind.code] = ind.defaultEnabled
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndicatorState(next)
  }, [meta.indicators])

  // Скрытые DIMENSION-группы (display-only).
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set())

  const indicators: ReportIndicatorDto[] = meta.indicators
  const filters: ReportFilterDto[] = meta.filters

  // Вкладка «Показатели».
  const indicatorItems = useMemo<ReportGroupItem[]>(
    () =>
      indicators.map((ind) => ({
        key: ind.code,
        label: localized(ind.titleRu, ind.titleKz, isKz),
        checked: indicatorState[ind.code] ?? ind.defaultEnabled,
      })),
    [indicators, indicatorState, isKz]
  )
  const onToggleIndicator = (key: string) => {
    setIndicatorState((prev) => {
      const cur = prev[key] ?? true
      return { ...prev, [key]: !cur }
    })
  }

  // Вкладка «Группировка» — из DIMENSION-колонок результата.
  const groupItems = useMemo<ReportGroupItem[]>(
    () =>
      dimensionColumns.map((col) => ({
        key: col.code,
        label: localized(col.titleRu, col.titleKz, isKz),
        checked: !hiddenGroups.has(col.code),
      })),
    [dimensionColumns, hiddenGroups, isKz]
  )
  const onToggleGroup = (key: string) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Вкладка «Отборы» — из meta.filters; значение читаем из URL (flt.<field>).
  const filterItems = useMemo<ReportFilterItem[]>(
    () =>
      filters.map((f) => {
        const raw = searchParams.get(`${FILTER_PREFIX}${f.field}`)
        return {
          key: f.field,
          label: localized(f.titleRu, f.titleKz, isKz),
          dictTypeCode: f.referenceDomain ?? '',
          valueId: raw ? Number(raw) : null,
        }
      }),
    [filters, searchParams, isKz]
  )

  // Колонки, скрытые настройками: выключенные показатели + скрытые группы.
  const hiddenColumns = useMemo<Set<string>>(() => {
    const set = new Set<string>(hiddenGroups)
    for (const ind of indicators) {
      const enabled = indicatorState[ind.code] ?? ind.defaultEnabled
      if (!enabled) {
        for (const col of ind.controlsColumns ?? []) set.add(col)
      }
    }
    return set
  }, [hiddenGroups, indicators, indicatorState])

  const hasSettings =
    filters.length > 0 || indicators.length > 0 || dimensionColumns.length > 0

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!tabularResult) return
    const visibleColumns = tabularResult.columns.filter(
      (c) => !hiddenColumns.has(c.code)
    )
    const data = buildReportExport(
      tabularResult,
      visibleColumns,
      t('reports.group'),
      isKz,
      t('reports.total')
    )
    exportTableToXlsx(reportName, data)
  }

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

          {/* «Сформировать» — фирменная жёлтая кнопка 1С. */}
          <Button
            variant="contained"
            disableElevation
            disabled={!canSubmit}
            onClick={onSubmit}
            sx={{
              height: 48,
              bgcolor: '#fcd53b',
              color: '#1a1a1a',
              fontWeight: 700,
              border: '1px solid #e3b93c',
              '&:hover': { bgcolor: '#f6c827' },
            }}
          >
            {t('reports.generate')}
          </Button>

          {/* Печать / Excel — когда отчёт сформирован табличный. */}
          {applied && tabularResult && (
            <>
              <Button
                variant="outlined"
                onClick={handlePrint}
                sx={{ height: 48 }}
              >
                {t('reports.print')}
              </Button>
              <Button
                variant="outlined"
                onClick={handleExportExcel}
                sx={{ height: 48 }}
              >
                {t('reports.exportExcel')}
              </Button>
            </>
          )}
          {hasSettings && (
            <Button
              variant="outlined"
              onClick={() => {
                setSettingsOpen(true)
              }}
              sx={{ height: 48, marginLeft: 'auto' }}
            >
              {t('reportSettings.title')}
            </Button>
          )}
        </div>
      )}

      {/* Watermark 1С до первого формирования. */}
      {!applied && meta.parameters.length > 0 && (
        <div className="flex items-center justify-center py-16">
          <Typography
            variant="body2"
            className="rounded border border-[#d9d9d9] bg-[#fffbe6] px-4 py-2"
            sx={{ color: '#333' }}
          >
            {t('reports.notGenerated')}
          </Typography>
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

          {!isRunning && !isRunError && result && !tabularResult && (
            <div className="rounded-md bg-ui-02 px-4 py-6 text-center">
              <Typography variant="body1" className="text-ui-06">
                {t('reports.separateScreen')}
              </Typography>
            </div>
          )}

          {!isRunning && !isRunError && tabularResult && useUnifiedRenderer && (
            <div className="report-print-area">
              <ReportResultView
                result={tabularResult}
                hiddenColumns={hiddenColumns}
              />
            </div>
          )}

          {!isRunning &&
            !isRunError &&
            tabularResult &&
            !useUnifiedRenderer && (
              <ReportResultTable
                result={tabularResult}
                hiddenColumns={hiddenColumns}
              />
            )}
        </>
      )}

      {hasSettings && (
        <ReportSettingsDrawer
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false)
          }}
          groupItems={groupItems}
          onToggleGroup={onToggleGroup}
          indicatorItems={indicatorItems}
          onToggleIndicator={onToggleIndicator}
          filterItems={filterItems}
          onFilterChange={onFilterChange}
        />
      )}
    </div>
  )
}
