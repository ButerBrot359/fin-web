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

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={t('osv.title')} onClose={handleClose} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <DateTimeInput
            value={from}
            onChange={setFrom}
            label={t('osv.periodFrom')}
            required
            size="small"
          />
        </div>
        <div className="w-56">
          <DateTimeInput
            value={to}
            onChange={setTo}
            label={t('osv.periodTo')}
            required
            size="small"
          />
        </div>
        <div className="w-80">
          <AutocompleteInput
            value={account}
            options={accountOptions}
            onChange={setAccount}
            label={t('osv.account')}
            size="small"
          />
        </div>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {t('osv.generate')}
        </Button>
      </div>

      {isError ? (
        <div className="py-4 text-error-01">{t('osv.loadError')}</div>
      ) : (
        params != null && (
          <OsvReportTable rows={rows} total={total} isLoading={isLoading} />
        )
      )}
    </div>
  )
}
