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
import type { SelectOption } from '@/shared/types/select-option'

import { useOsvReport } from '../lib/hooks/use-osv-report'
import { OsvReportTable } from './osv-report-table'
import type { OsvReportParams } from '../types/osv-report'

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
    }
  }, [urlFrom, urlTo, urlAccountId])

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

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={t('osv.title')} onClose={handleClose} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64 [&_.MuiInputBase-root]:!h-10 [&_.MuiInputBase-root]:box-border">
          <DateTimeInput
            value={from}
            onChange={setFrom}
            label={t('osv.periodFrom')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="w-64 [&_.MuiInputBase-root]:!h-10 [&_.MuiInputBase-root]:box-border">
          <DateTimeInput
            value={to}
            onChange={setTo}
            label={t('osv.periodTo')}
            required
            size="small"
            fullWidth
          />
        </div>
        <div className="w-64 [&_.MuiInputBase-root]:!h-10 [&_.MuiInputBase-root]:box-border">
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
      </div>

      {isError ? (
        <div className="py-4 text-error-01">{t('osv.loadError')}</div>
      ) : (
        params != null && (
          <OsvReportTable
            rows={rows}
            total={total}
            title={reportTitle}
            isLoading={isLoading}
          />
        )
      )}
    </div>
  )
}
