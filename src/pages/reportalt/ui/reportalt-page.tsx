import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button, Typography } from '@mui/material'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { ReportResultView } from '@/features/report-result-view'
import { PageHeader } from '@/widgets/page-header'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { showToast } from '@/shared/ui/toast/show-toast'
import { exportTableToXlsx } from '@/shared/lib/table-export'

import {
  fetchReportAltBlank,
  saveReportAlt,
  vygruzkaFno,
} from '../api/reportalt-api'
import { rasshifrovkaKletki } from '../lib/utils/blank-drilldown'
import {
  pustyeOblastiStranits,
  stranitsaPrilozheniya,
} from '../lib/utils/blank-ochistka'
import { useReportAltMeta } from '../lib/hooks/use-reportalt-meta'
import { useRunReportAlt } from '../lib/hooks/use-run-reportalt'
import { useReportAltUserSettings } from '../lib/hooks/use-reportalt-user-settings'
import { useReportAltParamState } from '../lib/hooks/use-reportalt-param-state'
import { buildAccountCardParams } from '../lib/utils/account-card-link'
import {
  DRILLDOWN_URL_KEY,
  buildDrilldownTarget,
  resolveDrilldownKinds,
} from '../lib/utils/report-drilldown'
import { buildReportAltExport } from '../lib/utils/build-reportalt-export'
import {
  SETTINGS_URL_KEY,
  clearStoredSettings,
} from '../lib/utils/user-settings'
import {
  LANG_PARAM_CODE,
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
import {
  initialParamRaw,
  readParamDraft,
  saveParamDraft,
} from '../lib/utils/param-draft'
import { PeriodQuickSelect } from './period-quick-select'
import { ReportAltParamField } from './reportalt-param-field'
import {
  ReportAltRowMenu,
  type ReportAltMenuItem,
  type ReportAltMenuPosition,
} from './reportalt-row-menu'
import { ReportAltSettingsDrawer } from './settings/reportalt-settings-drawer'
import { printReportAlt } from '../api/reportalt-api'
import type {
  ReportAltRowDto,
  ReportAltRowRefDto,
  RunReportAltBody,
} from '../types/reportalt'

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

  // Параметр «Язык формы» (YazykFormy) выводим не в строке параметров, а
  // отдельным контролом в панели настроек справа (как «Язык печатной формы» в
  // 1С). visibleParams — параметры верхней строки без языка.
  const langParam = useMemo(
    () => meta?.parameters.find((p) => p.code === LANG_PARAM_CODE) ?? null,
    [meta]
  )
  const visibleParams = useMemo(
    () => meta?.parameters.filter((p) => p.code !== LANG_PARAM_CODE) ?? [],
    [meta]
  )

  const [searchParams, setSearchParams] = useSearchParams()

  const rezhimRasshifrovki = searchParams.get(DRILLDOWN_URL_KEY) === '1'

  // Черновики полей формы (что пользователь правит до «Сформировать»).
  const [values, setValues] = useState<ParamValues>({})
  const [showErrors, setShowErrors] = useState(false)
  const { paramState, refreshParamState } = useReportAltParamState(moduleCode)

  // Инициализация черновиков из URL (или дефолтов) при загрузке meta и при
  // перемонтировании вкладки (searchParams в зависимостях).
  useEffect(() => {
    if (!meta) return
    // Набранный, но не применённый отбор переживает уход на другую вкладку:
    // из URL приходит только применённое «Сформировать», остальное — из черновика
    // сессии (см. param-draft.ts). URL главнее: он описывает таблицу на экране.
    const draft = readParamDraft(moduleCode)
    const next: ParamValues = {}
    for (const param of meta.parameters) {
      const raw = initialParamRaw(param, searchParams.get(param.code), draft)
      next[param.code] =
        raw != null ? deserializeParam(raw, param) : defaultParamValue(param)
    }
    // Сознательная синхронизация черновика формы из URL+meta при их смене.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next)
    if (meta.parameters.some((p) => p.refreshesForm)) {
      void refreshParamState(normalizeBodyDates(next, meta.parameters), null)
    }
  }, [meta, moduleCode, searchParams, refreshParamState])

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

  // Клетки бланка, которые заполняет пользователь: в 1С ручная правка табличного документа
  // приоритетнее автозаполнения, поэтому значения уходят в тело /run и возвращаются в бланке.
  const [blankValues, setBlankValues] = useState<Record<string, string>>({})
  // Выделенная клетка бланка: в 1С «Расшифровать» работает от имени области текущей области.
  const [vybrannayaOblast, setVybrannayaOblast] = useState<string | null>(null)
  const [aktivnayaStranitsa, setAktivnayaStranitsa] = useState(0)
  const izmenitKletku = useCallback((field: string, value: string) => {
    setBlankValues((prev) => ({ ...prev, [field]: value }))
  }, [])

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
      ...(Object.keys(blankValues).length > 0 ? { blankValues } : {}),
    }
  }, [meta, searchParams, appliedUserSettings, blankValues])

  const isLedger = meta?.definition.layout === 'LEDGER'

  // Незаполненный бланк: 1С открывает форму отчёта пустым утверждённым листом и наполняет его
  // только по «Заполнить». Отчёты без бланка отвечают пустым телом — тогда показывать нечего.
  // «Добавить строку» и «Удалить строку» формы 1С меняют число строк в таблицах приложений:
  // в макете строка одна и размножается по этому числу.
  const [strokBlanka, setStrokBlanka] = useState(1)
  const { data: pustoyBlank } = useQuery({
    queryKey: ['reportalt-blank', moduleCode, strokBlanka],
    queryFn: ({ signal }) =>
      fetchReportAltBlank(moduleCode, strokBlanka, signal),
    enabled: moduleCode.length > 0,
    staleTime: Infinity,
  })

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

  // Бланк на экране: заполненный после «Сформировать», иначе пустой утверждённый лист.
  const blankDokument = result?.spreadsheet ?? pustoyBlank
  const estPrilozhenie20005 =
    blankDokument?.sheets.some((s) =>
      stranitsaPrilozheniya(s.title, '200.05')
    ) ?? false

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
    const next = { ...values, [code]: v }
    setValues(next)
    // Черновик пишем на каждую правку: уход на другую вкладку происходит без
    // всякого «сохранить», и единственный момент, когда значение ещё есть, — этот.
    saveParamDraft(moduleCode, next)
    if (!meta?.parameters.find((p) => p.code === code)?.refreshesForm) return
    void refreshParamState(
      normalizeBodyDates(next, meta.parameters),
      code
    ).then((state) => {
      if (!state || Object.keys(state.values).length === 0) return
      setValues((prev) => {
        const merged = { ...prev, ...(state.values as ParamValues) }
        saveParamDraft(moduleCode, merged)
        return merged
      })
    })
  }

  /**
   * «Сохранить» формы 1С: пишет документ «Регламентированный отчет» — из таких документов
   * строится список сохранённой отчётности. Сам бланк не сохраняется: он пересобирается по
   * организации и периоду, а вот ручной ввод повторить неоткуда, поэтому уходит в документ.
   */
  const handleSave = () => {
    if (!meta) return
    const organizatsiya = meta.parameters.find(
      (p) => p.valueType === 'DICTIONARY_REF'
    )
    const period = meta.parameters.find((p) => p.valueType === 'PERIOD')
    const periodValue = period
      ? (values[period.code] as PeriodValue | undefined)
      : undefined
    const organizatsiyaValue = organizatsiya
      ? values[organizatsiya.code]
      : undefined

    void saveReportAlt(moduleCode, {
      kodOtcheta: moduleCode,
      naimenovanie: reportName,
      organizatsiyaId:
        typeof organizatsiyaValue === 'number' ? organizatsiyaValue : null,
      periodOt: periodValue?.from ?? null,
      periodDo: periodValue?.to ?? null,
      kazakhskiy: values[LANG_PARAM_CODE] === 'Kz',
      znacheniyaBlanka: blankValues,
    })
      .then(() => {
        showToast('success', t('reportalt.saved'))
      })
      .catch((e: unknown) => {
        showToast('error', t('reportalt.saveError'), errorMessage(e))
      })
  }

  /** «Очистить» формы 1С: бланк возвращается к пустому, ручной ввод сбрасывается. */
  const handleClear = () => {
    setBlankValues({})
    const next = new URLSearchParams(searchParams)
    meta?.parameters.forEach((p) => {
      next.delete(p.code)
    })
    setSearchParams(next, { replace: true })
  }

  /**
   * «Очистить текущую страницу» и «Очистить приложение 200.05» формы 1С: стираются области
   * только выбранных страниц, остальной бланк остаётся заполненным.
   */
  const ochistitStranitsy = (
    nuzhna: (title: string, indeks: number) => boolean
  ) => {
    const pustye = pustyeOblastiStranits(blankDokument, nuzhna)
    setBlankValues((prev) => ({ ...prev, ...pustye }))
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
        if (rezhimRasshifrovki) next.set(DRILLDOWN_URL_KEY, '1')
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

  const [rowMenu, setRowMenu] = useState<{
    position: ReportAltMenuPosition
    row: ReportAltRowDto
    ancestors: ReportAltRowDto[]
  } | null>(null)

  const menuRow = rowMenu?.row ?? null
  const openRef =
    menuRow?.rowRef && menuRow.rowRef.domain !== 'ACCOUNT_PLAN'
      ? menuRow.rowRef
      : null
  const openLabel = openRef
    ? menuRow?.groupValue
      ? `${t('osv.openElement')} «${menuRow.groupValue}»`
      : t('osv.openElement')
    : null
  const accountRow = rowMenu
    ? [...rowMenu.ancestors, rowMenu.row]
        .reverse()
        .find((r) => r.rowRef?.domain === 'ACCOUNT_PLAN')
    : undefined
  const accountCardLabel = accountRow
    ? `${t('osv.accountCard')} ${accountRow.groupValue ?? ''}`.trim()
    : null

  const openRowRef = (ref: ReportAltRowRefDto) => {
    const segment = ref.domain === 'DICTIONARY' ? 'dictionary' : 'document'
    void navigate(
      `/modules/${pageCode}/${segment}/${ref.typeCode}/${String(ref.id)}`
    )
  }

  const handleOpenElement = () => {
    if (!openRef) return
    openRowRef(openRef)
  }

  const appliedPeriod = appliedBody?.parameters
    ? (Object.values(appliedBody.parameters).find(
        (v): v is { from?: string; to?: string } =>
          typeof v === 'object' && v !== null && ('from' in v || 'to' in v)
      ) ?? {})
    : {}

  const handleOpenAccountCard = () => {
    if (!accountRow?.rowRef) return
    const params = buildAccountCardParams(
      rowMenu ? [...rowMenu.ancestors, rowMenu.row] : [],
      {
        accountId: accountRow.rowRef.id,
        accountCode: accountRow.groupValue ?? '',
        from: appliedPeriod.from,
        to: appliedPeriod.to,
      }
    )
    void navigate(`/modules/${pageCode}/account-card?${params.toString()}`)
  }

  const drilldownOptions = rowMenu
    ? {
        reportCode: moduleCode,
        chain: [...rowMenu.ancestors, rowMenu.row],
        accountRow,
        valueRow: rowMenu.row,
        from: appliedPeriod.from,
        to: appliedPeriod.to,
      }
    : null

  const rowMenuItems: ReportAltMenuItem[] = []
  if (openLabel != null) {
    rowMenuItems.push({
      key: 'open',
      label: openLabel,
      onClick: handleOpenElement,
    })
  }
  for (const kind of drilldownOptions
    ? resolveDrilldownKinds(drilldownOptions)
    : []) {
    if (kind === 'accountCard') {
      if (accountCardLabel != null) {
        rowMenuItems.push({
          key: kind,
          label: accountCardLabel,
          onClick: handleOpenAccountCard,
        })
      }
      continue
    }
    const target = drilldownOptions
      ? buildDrilldownTarget(kind, drilldownOptions)
      : null
    if (target == null) continue
    const label =
      kind === 'osvPoSchetu' ||
      kind === 'analizScheta' ||
      kind === 'turnoverByDays' ||
      kind === 'turnoverByMonths'
        ? `${t(`reportalt.drilldown.${kind}`)} ${accountRow?.groupValue ?? ''}`.trim()
        : t(`reportalt.drilldown.${kind}`)
    rowMenuItems.push({
      key: kind,
      label,
      onClick: () => {
        void navigate(
          `/modules/${pageCode}/reportalt/${target.reportCode}?${target.params.toString()}`
        )
      },
    })
  }

  // Печать в PDF: бэк может отвечать 501 (печать не реализована) — тост.
  const [isPrinting, setIsPrinting] = useState(false)
  /**
   * «Выгрузить в XML» формы 1С: файл ФНО по организации и кварталу отчёта.
   *
   * Коды форм налоговой отчётности бэк принимает в виде «200.00» — у нас он живёт в наименовании
   * отчёта, поэтому берётся оттуда; отчёты, у которых такого кода нет, выгрузку не поддерживают.
   */
  const stroka = (znachenie: ReportAltParamValue): string | null =>
    typeof znachenie === 'string' && znachenie.length > 0 ? znachenie : null

  const handleExportXml = () => {
    const kodFormy = /\d{3}\.\d{2}/.exec(reportName)?.[0]
    const organizatsiya = meta?.parameters.find(
      (p) => p.valueType === 'DICTIONARY_REF'
    )
    const period = meta?.parameters.find((p) => p.valueType === 'PERIOD')
    const organizatsiyaId = organizatsiya
      ? values[organizatsiya.code]
      : undefined
    const periodValue = period
      ? (values[period.code] as PeriodValue | undefined)
      : undefined

    if (
      !kodFormy ||
      typeof organizatsiyaId !== 'number' ||
      !periodValue?.from
    ) {
      showToast('warning', t('reportalt.exportXmlUnavailable'))
      return
    }
    void vygruzkaFno(kodFormy, organizatsiyaId, periodValue.from, {
      vidDeklaratsii: stroka(values.VidDeklaratsii),
      nomerUvedomleniya: stroka(values.NomerUvedomleniya),
      dataUvedomleniya: stroka(values.DataUvedomleniya),
    })
      .then((res) => {
        const ssylka = document.createElement('a')
        ssylka.href = URL.createObjectURL(res.data)
        ssylka.download = `${kodFormy}.xml`
        ssylka.click()
      })
      .catch((e: unknown) => {
        showToast('error', t('reportalt.exportXmlUnavailable'), errorMessage(e))
      })
  }

  /**
   * «Расшифровать» формы 1С: от имени области выделенной клетки бланка открывается регистр
   * налогового учёта по ИПН и СН за месяц её графы (графа 4 — за весь квартал).
   */
  const handleDecipher = () => {
    const organizatsiyaId = values.Organizatsiya
    const period = values.Period as PeriodValue | undefined
    const target = rasshifrovkaKletki(
      vybrannayaOblast,
      typeof organizatsiyaId === 'number' ? organizatsiyaId : null,
      period
    )
    if (!target) {
      showToast('warning', t('reportalt.decipherUnavailable'))
      return
    }
    void navigate(
      `/modules/${pageCode}/reportalt/${target.reportCode}?${target.params.toString()}`
    )
  }

  const handlePrintPdf = () => {
    if (!appliedBody || isPrinting) return
    // Язык печати — выбранный «Язык формы» (YazykFormy): берём применённое
    // значение (совпадает с языком экранного результата), затем черновик поля;
    // если у отчёта нет параметра языка — фолбэк на язык приложения.
    const pickedLang =
      appliedBody.parameters[LANG_PARAM_CODE] ?? values[LANG_PARAM_CODE]
    const printLanguage: 'Ru' | 'Kz' =
      pickedLang === 'Kz'
        ? 'Kz'
        : pickedLang === 'Ru'
          ? 'Ru'
          : isKz
            ? 'Kz'
            : 'Ru'
    setIsPrinting(true)
    void printReportAlt(moduleCode, appliedBody, printLanguage)
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

      {/* Динамическая форма параметров по meta.parameters (без «Язык формы» —
          он живёт отдельным контролом в панели настроек справа). */}
      <div className="flex flex-wrap items-start gap-4">
        {visibleParams.map((param) => {
          const invalid =
            showErrors && param.required && !isFilled(param, values[param.code])
          // Незаполненный обязательный параметр объясняется текстом, а не только
          // красной рамкой: иначе «Сформировать» выглядит как молча не сработавшая.
          const requiredHint = invalid ? t('errors.required') : undefined
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
                <div className="w-56">
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
                    helperText={!period.from ? requiredHint : undefined}
                  />
                </div>
                <div className="w-56">
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
                    helperText={!period.to ? requiredHint : undefined}
                  />
                </div>
                {/* Быстрый период: месяц/квартал/год одним действием. Поля дат
                    остаются рабочими — список только проставляет в них границы. */}
                <div className="w-48">
                  <PeriodQuickSelect
                    period={period}
                    onChange={(next) => {
                      setParamValue(param.code, next)
                    }}
                  />
                </div>
              </div>
            )
          }
          return (
            <div
              key={param.code}
              // Чекбоксы — в общем потоке строки, центрируем по высоте
              // инпутов (48px = minHeight 44 + marginBottom 4 из темы).
              className={
                param.dataType === 'BOOLEAN' ? 'flex h-12 items-center' : 'w-72'
              }
            >
              <ReportAltParamField
                param={param}
                value={values[param.code]}
                onChange={(v) => {
                  setParamValue(param.code, v)
                }}
                invalid={invalid}
                disabled={paramState.disabledParams.includes(param.code)}
                helperText={paramState.messages[param.code] ?? requiredHint}
                optionsSource={paramState.optionsSources[param.code]}
              />
            </div>
          )
        })}

        {/* Высота 48 = высоте блока инпута (как в легаси osv-report-page):
            кнопки стоят вровень с полями и не «прыгают» при переносе строки. */}
        <Button
          variant="contained"
          size="medium"
          sx={{ height: 48, flexShrink: 0 }}
          onClick={handleSubmit}
        >
          {pustoyBlank ? t('reportalt.fill') : t('reportalt.generate')}
        </Button>
        {/* «Очистить» и «Обновить» — соседи «Заполнить» на панели формы 1С: первая возвращает
            пустой бланк, вторая перезапрашивает те же данные. */}
        {pustoyBlank && (
          <>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              onClick={handleClear}
            >
              {t('reportalt.clear')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              disabled={appliedBody == null}
              onClick={() => {
                void refetch()
              }}
            >
              {t('reportalt.refresh')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              onClick={handleSave}
            >
              {t('reportalt.save')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              onClick={handleExportXml}
            >
              {t('reportalt.exportXml')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              onClick={handleDecipher}
            >
              {t('reportalt.decipher')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              disabled={blankDokument == null}
              onClick={() => {
                ochistitStranitsy((_, indeks) => indeks === aktivnayaStranitsa)
              }}
            >
              {t('reportalt.clearPage')}
            </Button>
            {estPrilozhenie20005 && (
              <Button
                variant="outlined"
                size="medium"
                sx={{ height: 48, flexShrink: 0 }}
                onClick={() => {
                  ochistitStranitsy((title) =>
                    stranitsaPrilozheniya(title, '200.05')
                  )
                }}
              >
                {t('reportalt.clearPrilozhenie20005')}
              </Button>
            )}
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              onClick={() => {
                setStrokBlanka((prev) => prev + 1)
              }}
            >
              {t('reportalt.addRow')}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              sx={{ height: 48, flexShrink: 0 }}
              disabled={strokBlanka <= 1}
              onClick={() => {
                setStrokBlanka((prev) => Math.max(prev - 1, 1))
              }}
            >
              {t('reportalt.removeRow')}
            </Button>
          </>
        )}
        {/* Панель настроек — для отчётов с наполненным meta (F-S3) ИЛИ когда
            есть «Язык формы» (у ГСМ/МО прочих настроек нет, но язык нужен). */}
        {(supportsSettings || langParam != null) && !rezhimRasshifrovki && (
          <Button
            variant="outlined"
            size="medium"
            sx={{ height: 48, flexShrink: 0 }}
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
          {result.rows.length === 0 && !result.form && !result.spreadsheet ? (
            <Typography variant="body2" className="text-ui-05">
              {t('reportalt.noData')}
            </Typography>
          ) : (
            <div className="min-h-0 overflow-auto pb-4">
              <ReportResultView
                result={result}
                blankValues={blankValues}
                onBlankValueChange={izmenitKletku}
                vybrannayaOblast={vybrannayaOblast}
                onVyborOblasti={setVybrannayaOblast}
                aktivnayaStranitsa={aktivnayaStranitsa}
                onVyborStranitsy={setAktivnayaStranitsa}
                onDrilldown={(row) => {
                  if (!row.rowRef || row.rowRef.domain === 'ACCOUNT_PLAN')
                    return
                  openRowRef(row.rowRef)
                }}
                onRowDoubleClick={(row, ancestors, event) => {
                  setRowMenu({
                    position: { top: event.clientY, left: event.clientX },
                    row,
                    ancestors,
                  })
                }}
              />
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
      ) : pustoyBlank ? (
        /* Как в 1С: до «Заполнить» форма показывает пустой утверждённый бланк, и в его клетки
           ручного ввода уже можно вписывать реквизиты, которых нет в учёте. */
        <div className="min-h-0 overflow-auto pb-4">
          <ReportResultView
            result={{ rows: [], columns: [], spreadsheet: pustoyBlank }}
            blankValues={blankValues}
            onBlankValueChange={izmenitKletku}
            vybrannayaOblast={vybrannayaOblast}
            onVyborOblasti={setVybrannayaOblast}
            aktivnayaStranitsa={aktivnayaStranitsa}
            onVyborStranitsy={setAktivnayaStranitsa}
          />
        </div>
      ) : (
        appliedBody == null && (
          <Typography variant="body2" className="text-ui-05">
            {t('reportalt.notGenerated')}
          </Typography>
        )
      )}

      {(supportsSettings || langParam != null) && !rezhimRasshifrovki && (
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
          langParam={langParam}
          langValue={
            typeof values[LANG_PARAM_CODE] === 'string'
              ? values[LANG_PARAM_CODE]
              : ''
          }
          onLangChange={(v) => {
            setParamValue(LANG_PARAM_CODE, v)
          }}
          groupingTitles={paramState.groupingTitles}
        />
      )}

      <ReportAltRowMenu
        position={rowMenu?.position ?? null}
        onClose={() => {
          setRowMenu(null)
        }}
        items={rowMenuItems}
      />
    </div>
  )
}
