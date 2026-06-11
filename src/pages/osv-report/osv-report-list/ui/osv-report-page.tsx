import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'

import { useAccountPlanList } from '@/entities/account-plan'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DateTimeInput, AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import { useOsvReport } from '../lib/hooks/use-osv-report'
import { useOsvReportColumns } from '../lib/hooks/use-osv-report-columns'
import { OsvReportTable } from './osv-report-table'
import type { OsvReportParams } from '../types/osv-report'

export const OsvReportPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()

  useTabMeta(t('osv.title'))

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [account, setAccount] = useState<SelectOption | null>(null)
  const [params, setParams] = useState<OsvReportParams | null>(null)

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

  const columns = useOsvReportColumns()
  const { rows, total, isLoading, isError } = useOsvReport(params, params != null)

  const canSubmit = !!from && !!to

  const handleSubmit = () => {
    if (!canSubmit) return
    setParams({
      from,
      to,
      accountId: account ? Number(account.id) : undefined,
    })
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
          <OsvReportTable
            columns={columns}
            rows={rows}
            total={total}
            isLoading={isLoading}
          />
        )
      )}
    </div>
  )
}
