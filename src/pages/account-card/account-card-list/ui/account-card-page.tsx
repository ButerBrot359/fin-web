import { useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'

import { useAccountPlanList } from '@/entities/account-plan'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DateTimeInput, AutocompleteInput } from '@/shared/ui/inputs'
import { formatDate } from '@/shared/lib/utils/date'
import { exportTableToXlsx } from '@/shared/lib/table-export'
import type { SelectOption } from '@/shared/types/select-option'

import { useAccountCard } from '../lib/hooks/use-account-card'
import { buildCardExport } from '../lib/utils/build-card-export'
import { AccountCardTable } from './account-card-table'
import {
  ANALYTICS_FILTER_KEYS,
  type AccountCardEntry,
  type AccountCardParams,
} from '../types/account-card'

/**
 * Карточка счёта — движения по счёту за период. Параметры (счёт, период) живут
 * в URL (?from&to&accountId&accountCode) — переживают переключение вкладок,
 * F5, и позволяют делиться ссылкой. Открывается из ОСВ (drill-down) или вручную
 * через панель фильтров.
 */
export const AccountCardPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  useTabMeta(t('accountCard.title'))

  const urlFrom = searchParams.get('from') ?? ''
  const urlTo = searchParams.get('to') ?? ''
  const urlAccountId = searchParams.get('accountId')
  const urlAccountCode = searchParams.get('accountCode') ?? ''

  // Черновики панели фильтров (инициализируются из URL).
  const [from, setFrom] = useState(urlFrom)
  const [to, setTo] = useState(urlTo)
  const [account, setAccount] = useState<SelectOption | null>(null)

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

  // Восстанавливаем выбранный счёт из URL, когда план счетов загрузился.
  useEffect(() => {
    if (!urlAccountId) return
    if (account && String(account.id) === urlAccountId) return
    const found = accountOptions.find((o) => String(o.id) === urlAccountId)
    if (found) setAccount(found)
  }, [urlAccountId, accountOptions, account])

  const params = useMemo<AccountCardParams | null>(() => {
    if (!urlFrom || !urlTo) return null
    const p: AccountCardParams = {
      from: urlFrom,
      to: urlTo,
      accountId: urlAccountId ? Number(urlAccountId) : undefined,
    }
    // Фильтры аналитики, унаследованные при drill-down из ОСВ (URL → запрос).
    for (const key of ANALYTICS_FILTER_KEYS) {
      const raw = searchParams.get(key)
      if (raw) p[key] = Number(raw)
    }
    return p
  }, [urlFrom, urlTo, urlAccountId, searchParams])

  const {
    rows,
    totals,
    totalCount,
    hasMore,
    loadMore,
    isLoadingMore,
    isLoading,
  } = useAccountCard(params, params != null)

  // Сальдо на начало периода вычисляет бэк и отдаёт в заголовке ответа карточки
  // (вся учётная математика на сервере) — отдельный запрос остатков не нужен.
  const opening = totals?.openingBalance ?? 0

  const title = useMemo(() => {
    if (!urlFrom || !urlTo) return t('accountCard.title')
    const period = `${formatDate(urlFrom)} — ${formatDate(urlTo)}`
    const acc = urlAccountCode ? ` ${urlAccountCode}` : ''
    return `${t('accountCard.title')}${acc} ${t('accountCard.forPeriod')} ${period}`
  }, [urlFrom, urlTo, urlAccountCode, t])

  const canSubmit = !!from && !!to
  const handleSubmit = () => {
    if (!canSubmit) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('from', from)
        next.set('to', to)
        if (account) {
          next.set('accountId', String(account.id))
          next.set('accountCode', account.code ?? '')
        } else {
          next.delete('accountId')
          next.delete('accountCode')
        }
        return next
      },
      { replace: true }
    )
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  // Выгрузка сформированной карточки в Excel.
  const handleExportExcel = () => {
    if (!params) return
    const data = buildCardExport(rows, totals, {
      period: t('accountCard.period'),
      document: t('accountCard.document'),
      operation: t('accountCard.operation'),
      analyticsDt: t('accountCard.analyticsDt'),
      analyticsKt: t('accountCard.analyticsKt'),
      debit: t('accountCard.debit'),
      credit: t('accountCard.credit'),
      currentBalance: t('accountCard.currentBalance'),
      openingBalance: t('accountCard.openingBalance'),
      turnovers: t('accountCard.turnovers'),
      closingBalance: t('accountCard.closingBalance'),
    })
    exportTableToXlsx(title, data)
  }

  const handlePrint = () => {
    window.print()
  }

  // Открыть документ-регистратор проводки в карточке документа.
  const handleOpenDocument = (row: AccountCardEntry) => {
    if (!row.recorderDocumentTypeCode || row.recorderDocumentEntryId == null)
      return
    void navigate(
      `/modules/${pageCode}/document/${row.recorderDocumentTypeCode}/${String(
        row.recorderDocumentEntryId
      )}`
    )
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64 [&_.MuiInputBase-root]:!h-10">
          <DateTimeInput
            value={from}
            onChange={setFrom}
            label={t('osv.periodFrom')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="w-64 [&_.MuiInputBase-root]:!h-10">
          <DateTimeInput
            value={to}
            onChange={setTo}
            label={t('osv.periodTo')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="w-64 [&_.MuiInputBase-root]:!h-10">
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
          <>
            <Button
              variant="outlined"
              onClick={handleExportExcel}
              sx={{ height: 40 }}
            >
              {t('accountCard.exportExcel')}
            </Button>
            <Button variant="outlined" onClick={handlePrint} sx={{ height: 40 }}>
              {t('accountCard.print')}
            </Button>
          </>
        )}
      </div>

      {params != null && (
        <AccountCardTable
          rows={rows}
          opening={opening}
          totals={totals}
          totalCount={totalCount}
          hasMore={hasMore}
          onLoadMore={loadMore}
          isLoadingMore={isLoadingMore}
          isLoading={isLoading}
          onOpenDocument={handleOpenDocument}
        />
      )}
    </div>
  )
}
