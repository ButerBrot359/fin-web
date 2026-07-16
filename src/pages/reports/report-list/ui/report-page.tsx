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
  ReportSettingsPanel,
  isFilterRowReady,
  type ReportAppearance,
  type ReportFilterRow,
  type ReportGroupItem,
} from '@/features/report-settings'
import {
  DocumentMovementsReportView,
  ReportResultView,
  isDocumentMovementsReportResult,
  isUnifiedRendererEnabled,
} from '@/features/report-result-view'
import { PageHeader } from '@/widgets/page-header'
import { getDocumentEntry } from '@/entities/document-entry'
import { DateTimeInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { exportTableToXlsx } from '@/shared/lib/table-export'

import { useReportMeta } from '../lib/hooks/use-report-meta'
import { useRunReport } from '../lib/hooks/use-run-report'
import { useFilterFields } from '../lib/hooks/use-filter-fields'
import { buildReportExport } from '../lib/utils/build-report-export'
import { ReportResultTable } from './report-result-table'
import { ReportPdfView } from './report-pdf-view'
import { ReportParamField, type ReportParamValue } from './report-param-field'
import { MemorialOrderSettingsPanel } from './memorial-order-settings-panel'
import type {
  ReportBlankResultDto,
  ReportIndicatorDto,
  ReportMetaDto,
  ReportParameterDto,
  ReportRowDto,
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

/** Ключ URL для активных отборов (вкладка «Отборы») — весь список одним JSON. */
const FILTER_URL_KEY = 'flt'

/** Ключ URL для выбранного варианта группировки (селектор «Вариант»). */
const VARIANT_URL_KEY = '__variant'

/** Десериализация строк отбора из URL-JSON (с базовой валидацией типов). */
const parseFilterRows = (raw: string | null): ReportFilterRow[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const rows: ReportFilterRow[] = []
    for (const item of parsed) {
      if (item == null || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (typeof o.field !== 'string') continue
      rows.push({
        field: o.field,
        ...(typeof o.kindId === 'number' ? { kindId: o.kindId } : {}),
        comparison: typeof o.comparison === 'string' ? o.comparison : 'EQUAL',
        values: Array.isArray(o.values)
          ? o.values.filter(
              (v): v is number | string =>
                typeof v === 'number' || typeof v === 'string'
            )
          : [],
        enabled: o.enabled !== false,
      })
    }
    return rows
  } catch {
    return []
  }
}

/** Периодичность отчёта — NUMBER-параметр с фиксированным списком значений. */
const isPeriodicity = (p: ReportParameterDto): boolean =>
  p.dataType === 'NUMBER' && (p.allowedValues?.length ?? 0) > 0

/**
 * Подразделение — параметр КБП, вынесенный из шапки в отбор (в /filter-fields
 * оно уже есть как поле `podrazdelenie`, значение задаётся во вкладке «Отборы»).
 */
const isPodrazdelenie = (p: ReportParameterDto): boolean =>
  p.referenceDomain === 'PodrazdeleniyaOrganizatsiy' ||
  /podrazdelenie/i.test(p.code)

/**
 * Тумблер формы (напр. «Язык формы (рус/каз)») — BOOLEAN с group='form'.
 * Для табличных СКД-отчётов (ТМЗ) выносим его из шапки в чекбоксы вкладки
 * «Основные» панели настроек (как «Детализация» у МО). У бланков-МО язык уже
 * попадает в свою панель через detailParams — там isFormToggle не используется.
 */
const isFormToggle = (p: ReportParameterDto): boolean =>
  p.dataType === 'BOOLEAN' && p.group === 'form'

/**
 * Параметр «Организация» — остаётся в шапке бланка (как период). Определяем по
 * справочнику-источнику или коду (устойчиво к регистру/суффиксам).
 */
const isOrganizatsiya = (p: ReportParameterDto): boolean =>
  p.referenceDomain === 'Organizatsii' || /organizatsiya/i.test(p.code)

/** Параметр «Список счетов» (ACCOUNT_LIST) — остаётся в шапке бланка, как в 1С. */
const isAccountList = (p: ReportParameterDto): boolean =>
  p.dataType === 'ACCOUNT_LIST'

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

  // Активные отборы (вкладка «Отборы») — весь список в URL одним JSON-параметром.
  const filterRows = useMemo<ReportFilterRow[]>(
    () => parseFilterRows(searchParams.get(FILTER_URL_KEY)),
    [searchParams]
  )

  // В тело /run уходят только готовые отборы (включён + есть значение при нужде).
  const appliedFilters = useMemo<RunReportFilter[]>(
    () =>
      filterRows.filter(isFilterRowReady).map((r) => ({
        field: r.field,
        ...(r.kindId != null ? { kindId: r.kindId } : {}),
        comparison: r.comparison,
        values: r.values,
      })),
    [filterRows]
  )

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
    const variantCode =
      searchParams.get(VARIANT_URL_KEY) ?? meta.variants[0]?.code
    return {
      parameters: normalizeBodyDates(applied, meta.parameters),
      ...(variantCode ? { variantCode } : {}),
      ...(appliedFilters.length > 0 ? { filters: appliedFilters } : {}),
    }
  }, [meta, searchParams, appliedFilters])

  // Выбранный вариант группировки (для селектора): из URL или первый из meta.
  const selectedVariant =
    searchParams.get(VARIANT_URL_KEY) ?? meta?.variants[0]?.code ?? null

  const setVariant = (code: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(VARIANT_URL_KEY, code)
        return next
      },
      { replace: true }
    )
  }

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
        // Сохраняем активные отборы (flt) и вариант при пересоздании query-строки.
        const flt = prev.get(FILTER_URL_KEY)
        if (flt) next.set(FILTER_URL_KEY, flt)
        const variant = prev.get(VARIANT_URL_KEY)
        if (variant) next.set(VARIANT_URL_KEY, variant)
        return next
      },
      { replace: true }
    )
    if (sameAsApplied && appliedBody != null) void refetch()
  }

  // Изменение отборов (вкладка «Отборы») — сериализуем весь список в URL (flt).
  const setFilterRows = (rows: ReportFilterRow[]) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (rows.length > 0) next.set(FILTER_URL_KEY, JSON.stringify(rows))
        else next.delete(FILTER_URL_KEY)
        return next
      },
      { replace: true }
    )
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  // Расшифровка (drill-down) строки данных: открыть документ-регистратор, как
  // в 1С. `groupRefId` строки — id записи документа с бэка; typeCode в строке
  // отсутствует, поэтому резолвим его запросом записи по id (тот же эндпоинт,
  // что грузит карточку документа) и строим маршрут как в карточке счёта.
  const handleOpenDocument = (row: ReportRowDto) => {
    const id = row.groupRefId
    if (id == null) return
    void (async () => {
      try {
        const res = await getDocumentEntry(String(id))
        const typeCode = res.data.data.documentTypeCode
        if (!typeCode) return
        await navigate(
          `/modules/${pageCode}/document/${typeCode}/${String(id)}`
        )
      } catch {
        // Запись не найдена / groupRefId — не документ: молча не открываем.
      }
    })()
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
      code={moduleCode}
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
      appliedBody={appliedBody}
      isDraft={isDraft}
      isRunning={isRunning}
      isRunError={isRunError}
      result={result}
      filterRows={filterRows}
      onFilterRowsChange={setFilterRows}
      selectedVariant={selectedVariant}
      onVariantChange={setVariant}
      onOpenDocument={handleOpenDocument}
    />
  )
}

interface ReportPageContentProps {
  code: string
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
  appliedBody: RunReportBody | null
  isDraft: boolean
  isRunning: boolean
  isRunError: boolean
  result: ReturnType<typeof useRunReport>['result']
  filterRows: ReportFilterRow[]
  onFilterRowsChange: (rows: ReportFilterRow[]) => void
  /** Выбранный вариант группировки (код) и его смена — раздел «Группировка». */
  selectedVariant: string | null
  onVariantChange: (code: string) => void
  /** Двойной клик по строке данных — открыть документ-регистратор (drill-down). */
  onOpenDocument: (row: ReportRowDto) => void
}

/** Локализованный заголовок отбора/показателя. */
const localized = (ru: string, kz: string | undefined, isKz: boolean): string =>
  (isKz ? kz : ru) || ru

/** Контент страницы — выделен, чтобы хуки meta/run вызывались до раннего return. */
const ReportPageContent = ({
  code,
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
  appliedBody,
  isDraft,
  isRunning,
  isRunError,
  result,
  filterRows,
  onFilterRowsChange,
  selectedVariant,
  onVariantChange,
  onOpenDocument,
}: ReportPageContentProps) => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()

  // Варианты группировки отчёта (селектор в панели). Лейбл — nameKz при KZ.
  const variantOptions = useMemo<SelectOption[]>(
    () =>
      meta.variants.map((v) => ({
        id: v.code,
        code: v.code,
        label: localized(v.nameRu, v.nameKz, isKz),
      })),
    [meta.variants, isKz]
  )

  // Видимость докнутой панели настроек — тоггл «Скрыть/Показать настройки»
  // (аналог одноимённой кнопки 1С). По умолчанию видна, как сейчас.
  const [settingsVisible, setSettingsVisible] = useState(true)

  // Оформление (вкладка «Оформление»): дефолты как в 1С (обе — вкл).
  const [appearance, setAppearance] = useState<ReportAppearance>({
    highlightNegatives: true,
    reducedIndent: true,
  })
  const onAppearanceChange = (patch: Partial<ReportAppearance>) => {
    setAppearance((prev) => ({ ...prev, ...patch }))
  }

  // Бланк-мемориальный ордер (МО-13/Форма 396): параметры детализации и отборы
  // уезжают в боковую панель «Настройки» (скрыта по умолчанию, тумблер-кнопка).
  const isMemorialOrder = meta.definition.kind === 'MEMORIAL_ORDER'
  const [showSettings, setShowSettings] = useState(false)
  const [hideSettingsOnSubmit, setHideSettingsOnSubmit] = useState(false)

  // Раскладка как в 1С. В шапке над бланком остаются период, «Организация» и
  // «Список счетов». Всё прочее уходит в панель «Настройки»:
  //  • «Детализация» — параметры-флажки (BOOLEAN, включая тумблер языка);
  //  • «Отбор» — единая таблица «Поле | Тип сравнения | Список» (сравнение
  //    «Равно») со ВСЕМИ справочными параметрами-отборами: Классификация
  //    расходов (ФКР), Специфика, Источник финансирования, Код платных услуг,
  //    Программа, Код администратора, Подпрограмма, Контрагент.
  const detailParams = useMemo<ReportParameterDto[]>(
    () =>
      isMemorialOrder
        ? meta.parameters.filter((p) => p.dataType === 'BOOLEAN')
        : [],
    [isMemorialOrder, meta.parameters]
  )
  const filterParams = useMemo<ReportParameterDto[]>(
    () =>
      isMemorialOrder
        ? meta.parameters.filter(
            (p) =>
              // Период — это PERIOD или ПАРА DATE-параметров («Начало/Конец
              // периода»); все они остаются в шапке, а не в «Отборе».
              !isPeriod(p) &&
              p.dataType !== 'DATE' &&
              !isOrganizatsiya(p) &&
              !isAccountList(p) &&
              !isPeriodicity(p) &&
              !isPodrazdelenie(p) &&
              p.dataType !== 'BOOLEAN'
          )
        : [],
    [isMemorialOrder, meta.parameters]
  )
  // Коды параметров, вынесенных в панель — исключаем их из верхней шапки.
  const settingsParamCodes = useMemo<Set<string>>(
    () => new Set([...detailParams, ...filterParams].map((p) => p.code)),
    [detailParams, filterParams]
  )

  // Параметр «Счёт» (ACCOUNT_REF) и его значение — источник accountId для
  // динамических полей отбора (субконто счёта) в /filter-fields.
  const accountParam = useMemo(
    () => meta.parameters.find((p) => p.dataType === 'ACCOUNT_REF'),
    [meta.parameters]
  )
  const accountId =
    accountParam != null && typeof values[accountParam.code] === 'number'
      ? (values[accountParam.code] as number)
      : null

  // Параметр «Периодичность» — выносим из шапки в панель (Основные/Группировка).
  const periodicityParam = useMemo(
    () => meta.parameters.find(isPeriodicity),
    [meta.parameters]
  )

  // Доступные поля отбора (КБП + субконто выбранного счёта).
  const { fields: filterFields } = useFilterFields(code, accountId)

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

  // Спец-результат «Движения документа» (DvizheniyaDokumenta): groups[] +
  // documentEntryId вместо columns/rows — рендерим вкладками движений по
  // регистрам (тот же компонент, что кнопка «Дт/Кт» формы документа).
  const movementsResult = isDocumentMovementsReportResult(result)
    ? result
    : null

  // DIMENSION-колонки — пункты вкладки «Группировка». До формирования берём из
  // meta.columns (коды совпадают с колонками результата), чтобы разрезы были
  // видны сразу, как в 1С; после формирования — из результата.
  const dimensionColumns = useMemo(
    () =>
      (tabularResult?.columns ?? meta.columns).filter(
        (c) => c.role === 'DIMENSION'
      ),
    [tabularResult, meta.columns]
  )

  // Тумблеры формы (язык и т.п.) — раздел вкладки «Основные» панели ТМЗ (как у МО).
  const formToggleParams = useMemo(
    () => meta.parameters.filter(isFormToggle),
    [meta.parameters]
  )
  // Параметр «Язык формы» (boolean group='form') — выводим ВЫПАДАЮЩИМ списком
  // Русский/Казахский (как в Инвентарной карточке), а не чекбоксом.
  const languageParam = useMemo(
    () => formToggleParams.find((p) => /yazyk/i.test(p.code)) ?? null,
    [formToggleParams]
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

  // Прочие тумблеры формы (без языка — он идёт выпадающим списком) — чекбоксы
  // вкладки «Основные». Это реальные параметры отчёта (уходят в /run).
  const formToggleItems = useMemo<ReportGroupItem[]>(
    () =>
      formToggleParams
        .filter((p) => !/yazyk/i.test(p.code))
        .map((p) => ({
          key: p.code,
          label: localized(p.titleRu, p.titleKz, isKz),
          checked: values[p.code] === true,
        })),
    [formToggleParams, values, isKz]
  )
  const onToggleFormParam = (key: string) => {
    setParamValue(key, values[key] !== true)
  }

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

  // Панель настроек — только для табличных отчётов (не мемориальные ордера/бланки).
  // Гейт по meta (доступен до формирования): показатели, периодичность, счёт
  // (динамические отборы субконто) либо табличные колонки.
  const hasSettings = useMemo(() => {
    if (meta.definition.kind === 'MEMORIAL_ORDER') return false
    return (
      meta.variants.length > 1 ||
      indicators.length > 0 ||
      periodicityParam != null ||
      accountParam != null ||
      formToggleParams.length > 0 ||
      meta.columns.some((c) => c.role === 'DIMENSION' || c.role === 'MEASURE')
    )
  }, [meta, indicators, periodicityParam, accountParam, formToggleParams])

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
          {/* В шапке — только Период(даты), Счёт, Организация. Периодичность и
              Подразделение вынесены в докнутую панель настроек (как в 1С). */}
          {meta.parameters
            .filter(
              (p) =>
                !isPeriodicity(p) &&
                !isPodrazdelenie(p) &&
                !settingsParamCodes.has(p.code) &&
                !isFormToggle(p)
            )
            .map((param) => {
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
            onClick={() => {
              onSubmit()
              // «Скрывать настройки при формировании отчёта» — прячем панель.
              if (canSubmit && hideSettingsOnSubmit) setShowSettings(false)
            }}
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

          {/* «Настройки» (бланк-МО): тумблер боковой панели, скрытой по умолчанию. */}
          {isMemorialOrder &&
            (detailParams.length > 0 || filterParams.length > 0) && (
              <Button
                variant="outlined"
                onClick={() => {
                  setShowSettings((v) => !v)
                }}
                sx={{ height: 48 }}
              >
                {showSettings
                  ? t('reports.hideSettings')
                  : t('reports.showSettings')}
              </Button>
            )}

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

          {/* Тоггл докнутой панели настроек (аналог 1С «Скрыть настройки»). */}
          {hasSettings && (
            <Button
              variant="outlined"
              onClick={() => {
                setSettingsVisible((v) => !v)
              }}
              sx={{ height: 48 }}
            >
              {t(
                settingsVisible
                  ? 'reports.hideSettings'
                  : 'reports.showSettings'
              )}
            </Button>
          )}
        </div>
      )}

      {/* Результат слева + докнутая панель настроек справа (тоггл «Скрыть настройки», как в 1С). */}
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
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

              {/* Спец-результат «Движения документа» (groups[]+documentEntryId):
                  вкладки движений по регистрам, как кнопка «Дт/Кт» формы. */}
              {!isRunning && !isRunError && movementsResult && (
                <div className="report-print-area">
                  <DocumentMovementsReportView result={movementsResult} />
                </div>
              )}

              {/* Нетабличный результат (спец-DTO без columns/rows — отчёт-бланк,
                  например «Инвентарная карточка ОС»): показываем серверный PDF
                  (/print) + неблокирующий список B0-сообщений (как окно сообщений
                  формы 1С). Если печать не реализована (501) — ReportPdfView сам
                  покажет фолбэк «отдельный экран». */}
              {!isRunning &&
                !isRunError &&
                result &&
                !tabularResult &&
                !movementsResult && (
                  <div className="report-print-area">
                    <ReportPdfView
                      code={code}
                      body={appliedBody}
                      hasCards={
                        ((result as unknown as ReportBlankResultDto).cards
                          ?.length ?? 0) > 0
                      }
                      validationMessages={
                        (result as unknown as ReportBlankResultDto)
                          .validationMessages
                      }
                    />
                  </div>
                )}

              {!isRunning &&
                !isRunError &&
                tabularResult &&
                useUnifiedRenderer && (
                  <div className="report-print-area">
                    <ReportResultView
                      result={tabularResult}
                      hiddenColumns={hiddenColumns}
                      appearance={appearance}
                      onOpenDocument={onOpenDocument}
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
        </div>

        {hasSettings && settingsVisible && (
          <ReportSettingsPanel
            isKz={isKz}
            variantOptions={variantOptions}
            selectedVariant={selectedVariant}
            onVariantChange={onVariantChange}
            hasLanguage={languageParam != null}
            languageIsRu={
              languageParam ? values[languageParam.code] === true : false
            }
            onLanguageChange={(isRu) => {
              if (languageParam) setParamValue(languageParam.code, isRu)
            }}
            formToggleItems={formToggleItems}
            onToggleFormParam={onToggleFormParam}
            indicatorItems={indicatorItems}
            onToggleIndicator={onToggleIndicator}
            groupItems={groupItems}
            onToggleGroup={onToggleGroup}
            periodicityParam={periodicityParam}
            periodicityValue={
              periodicityParam
                ? ((values[periodicityParam.code] as number | string | null) ??
                  null)
                : null
            }
            onPeriodicityChange={(v) => {
              if (periodicityParam) setParamValue(periodicityParam.code, v)
            }}
            filterFields={filterFields}
            filterRows={filterRows}
            onFilterRowsChange={onFilterRowsChange}
            appearance={appearance}
            onAppearanceChange={onAppearanceChange}
          />
        )}

        {isMemorialOrder && showSettings && (
          <MemorialOrderSettingsPanel
            detailParams={detailParams}
            filterParams={filterParams}
            values={values}
            setParamValue={setParamValue}
            isKz={isKz}
            hideOnSubmit={hideSettingsOnSubmit}
            onHideOnSubmitChange={setHideSettingsOnSubmit}
          />
        )}
      </div>
    </div>
  )
}
