import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import type { Row } from '@tanstack/react-table'

import { useAccountPlanList } from '@/entities/account-plan'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  REPORT_FILTER_DIMENSIONS,
  ReportSettingsDrawer,
  type ReportFilterItem,
  type ReportGroupItem,
} from '@/features/report-settings'
import { PageHeader } from '@/widgets/page-header'
import { DateTimeInput, AutocompleteInput } from '@/shared/ui/inputs'
import { formatDate } from '@/shared/lib/utils/date'
import type { SelectOption } from '@/shared/types/select-option'

import { useOsvReport } from '../lib/hooks/use-osv-report'
import { OsvReportTable } from './osv-report-table'
import {
  OSV_DEFAULT_DIMENSIONS,
  OSV_GROUP_DIMENSIONS,
  type OsvReportEntry,
  type OsvReportParams,
} from '../types/osv-report'

/**
 * Уровень группировки дерева ОСВ (groupLevel) → query-параметр фильтра карточки
 * счёта. Уровень SUBKONTO (Номенклатура/Физлица) не включён — бэк фильтрует
 * движения по измерениям проводки (FK-колонки), а не по субконто.
 */
const GROUP_LEVEL_TO_FILTER: Record<string, string | undefined> = {
  ORGANIZATION: 'organizatsiyaId',
  PODRAZDELENIE: 'podrazdelenieId',
  FKR: 'fkrId',
  SPETSIFIKA: 'spetsifikaId',
  ISTOCHNIK_FINANSIROVANIYA: 'istochnikFinansirovaniyaId',
}

/** Ключ пункта «По субконто» в панели группировки (не измерение). */
const SUBKONTO_GROUP_KEY = '__subkonto'

export const OsvReportPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()

  useTabMeta(t('osv.title'))

  // Применённые параметры отчёта живут в URL (?from&to&accountId), а не в
  // локальном useState — иначе они теряются при переключении вкладок (страница
  // размонтируется, см. ErrorBoundary key=pathname в App.tsx) и при обновлении
  // страницы. Вкладки сохраняют path+search в sessionStorage, поэтому URL
  // переживает оба случая и отчёт восстанавливается сам.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFrom = searchParams.get('from') ?? ''
  const urlTo = searchParams.get('to') ?? ''
  const urlAccountId = searchParams.get('accountId')

  // Черновики полей формы (что пользователь правит до «Сформировать»).
  // Инициализируются из URL — при перемонтировании подхватывают applied-значения.
  const [from, setFrom] = useState(urlFrom)
  const [to, setTo] = useState(urlTo)
  const [account, setAccount] = useState<SelectOption | null>(null)

  // Группировка (панель «Настройки → Группировка»). По умолчанию все измерения
  // включены (полное дерево, как сейчас); субконто-разворот выключен. Меняет
  // запрос → дерево перестраивается на бэке.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [enabledDims, setEnabledDims] = useState<Set<string>>(
    () => new Set(OSV_DEFAULT_DIMENSIONS)
  )
  const [expandBySubkonto, setExpandBySubkonto] = useState(false)
  // Показатели (вкладка «Показатели»): «Количество» — показ строк «Кол.».
  const [showQuantity, setShowQuantity] = useState(true)
  // Отборы (вкладка «Отборы»): query-параметр измерения → ID значения.
  const [filters, setFilters] = useState<Record<string, number | null>>({})

  const { entries: accounts } = useAccountPlanList()
  const accountOptions = useMemo<SelectOption[]>(
    () =>
      accounts.map((a) => ({
        id: a.id,
        code: a.code,
        label: a.nameRu ? `${a.code} — ${a.nameRu}` : a.code,
      })),
    [accounts]
  )

  // Восстанавливаем выбранный счёт из URL (при монтировании / смене URL, когда
  // справочник счетов загрузился). НЕ зависим от `account` и НЕ сбрасываем его в
  // null — иначе ручной выбор в выпадающем списке тут же затирался бы (поле
  // очищалось), ведь URL обновляется только при «Сформировать».
  useEffect(() => {
    if (!urlAccountId) return
    const found = accountOptions.find((o) => String(o.id) === urlAccountId)
    if (found) setAccount(found)
  }, [urlAccountId, accountOptions])

  // Applied-параметры — производные от URL. Запрос включается, когда заданы
  // обе границы периода.
  const params = useMemo<OsvReportParams | null>(() => {
    if (!urlFrom || !urlTo) return null
    return {
      from: urlFrom,
      to: urlTo,
      accountId: urlAccountId ? Number(urlAccountId) : undefined,
      // Включённые измерения в фиксированном порядке — состав уровней дерева.
      groupBy: OSV_GROUP_DIMENSIONS.filter((d) => enabledDims.has(d.key)).map(
        (d) => d.key
      ),
      expandBySubkonto,
      dimensionFilters: filters,
    }
  }, [urlFrom, urlTo, urlAccountId, enabledDims, expandBySubkonto, filters])

  // Пункты вкладки «Группировка»: измерения + «По субконто» (разворот листа).
  const toggleGroup = (key: string) => {
    if (key === SUBKONTO_GROUP_KEY) {
      setExpandBySubkonto((v) => !v)
      return
    }
    setEnabledDims((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const groupItems = useMemo<ReportGroupItem[]>(() => {
    const items: ReportGroupItem[] = OSV_GROUP_DIMENSIONS.map((d) => ({
      key: d.key,
      label: t(d.labelKey),
      checked: enabledDims.has(d.key),
    }))
    items.push({
      key: SUBKONTO_GROUP_KEY,
      label: t('osv.bySubkonto'),
      checked: expandBySubkonto,
    })
    return items
  }, [enabledDims, expandBySubkonto, t])

  const indicatorItems = useMemo<ReportGroupItem[]>(
    () => [
      { key: 'quantity', label: t('osv.quantity'), checked: showQuantity },
    ],
    [showQuantity, t]
  )
  const toggleIndicator = (key: string) => {
    if (key === 'quantity') setShowQuantity((v) => !v)
  }

  const filterItems = useMemo<ReportFilterItem[]>(
    () =>
      REPORT_FILTER_DIMENSIONS.map((d) => ({
        key: d.paramKey,
        label: t(d.labelKey),
        dictTypeCode: d.dictTypeCode,
        valueId: filters[d.paramKey] ?? null,
      })),
    [filters, t]
  )
  const onFilterChange = (key: string, valueId: number | null) => {
    setFilters((prev) => ({ ...prev, [key]: valueId }))
  }

  const { rows, total, isLoading, isError, refetch } = useOsvReport(
    params,
    params != null
  )

  const canSubmit = !!from && !!to

  const handleSubmit = () => {
    if (!canSubmit) return
    const accountId = account ? String(account.id) : undefined
    // Те же параметры, что уже применены → URL/queryKey не изменится и
    // автозапроса не будет: форсим refetch вручную.
    const sameAsApplied =
      urlFrom === from && urlTo === to && (urlAccountId ?? undefined) === accountId
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('from', from)
        next.set('to', to)
        if (accountId) next.set('accountId', accountId)
        else next.delete('accountId')
        return next
      },
      { replace: true }
    )
    if (sameAsApplied) void refetch()
  }

  // Заголовок отчёта (как в 1С): «Оборотно-сальдовая ведомость по счёту N за
  // <период>». Строится по применённым параметрам (params из URL).
  const reportTitle = useMemo(() => {
    if (!params) return ''
    const period = `${formatDate(params.from)} — ${formatDate(params.to)}`
    const acc =
      account && params.accountId === Number(account.id) ? account : null
    const accPart = acc ? ` ${t('osv.byAccount')} ${acc.code ?? acc.label}` : ''
    return `${t('osv.title')}${accPart} ${t('osv.forPeriod')} ${period}`
  }, [params, account, t])

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  // Двойной клик по строке ОСВ → карточка счёта (drill-down, как в 1С): движения
  // по счёту за тот же период. Если кликнули по узлу измерения (ФКР, Подразделение
  // и т.д.), наследуем фильтры аналитики ВСЕХ уровней от корня до узла — карточка
  // строится только по этой ветке дерева.
  const handleOpenAccountCard = (row: Row<OsvReportEntry>) => {
    // Цепочка от корня (счёт) до кликнутого узла включительно.
    const chain = [...row.getParentRows(), row]
    const rootEntry = chain[0]?.original ?? row.original
    const accId = rootEntry.accountId ?? params?.accountId
    if (!params || accId == null) return
    const sp = new URLSearchParams({
      from: params.from,
      to: params.to,
      accountId: String(accId),
      accountCode: rootEntry.accountCode ?? '',
    })
    // Уровень группировки ОСВ → query-параметр фильтра карточки.
    for (const node of chain) {
      const { groupLevel, groupRefId } = node.original
      if (groupRefId == null) continue
      const key = GROUP_LEVEL_TO_FILTER[groupLevel ?? '']
      if (key) sp.set(key, String(groupRefId))
    }
    void navigate(`/modules/${pageCode}/account-card?${sp.toString()}`)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={t('osv.title')} onClose={handleClose} />

      <div className="flex flex-wrap items-start gap-4">
        <div className="report-param-field w-64">
          <DateTimeInput
            value={from}
            onChange={setFrom}
            label={t('osv.periodFrom')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <DateTimeInput
            value={to}
            onChange={setTo}
            label={t('osv.periodTo')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="report-param-field w-64">
          <AutocompleteInput
            value={account}
            options={accountOptions}
            onChange={setAccount}
            label={t('osv.account')}
            size="small"
            fullWidth
          />
        </div>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
          sx={{ height: 40 }}
        >
          {t('osv.generate')}
        </Button>
        {params != null && (
          <Button
            variant="outlined"
            onClick={() => {
              setSettingsOpen(true)
            }}
            sx={{ height: 40 }}
          >
            {t('reportSettings.title')}
          </Button>
        )}
      </div>

      {isError ? (
        <div className="py-4 text-error-01">{t('osv.loadError')}</div>
      ) : (
        params != null && (
          <OsvReportTable
            rows={rows}
            total={total}
            title={reportTitle}
            onRowDoubleClick={handleOpenAccountCard}
            showQuantity={showQuantity}
            isLoading={isLoading}
          />
        )
      )}

      <ReportSettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
        }}
        groupItems={groupItems}
        onToggleGroup={toggleGroup}
        indicatorItems={indicatorItems}
        onToggleIndicator={toggleIndicator}
        filterItems={filterItems}
        onFilterChange={onFilterChange}
      />
    </div>
  )
}
