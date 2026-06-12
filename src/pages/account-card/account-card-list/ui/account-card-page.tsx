import { useMemo } from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { formatDate } from '@/shared/lib/utils/date'

import { useAccountCard } from '../lib/hooks/use-account-card'
import { AccountCardTable } from './account-card-table'
import type { AccountCardParams } from '../types/account-card'

/**
 * Карточка счёта — движения по счёту за период (drill-down из ОСВ по двойному
 * клику). Параметры (счёт, период) приходят в URL: ?accountId&accountCode&from&to.
 */
export const AccountCardPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '' } = useParams()
  const [searchParams] = useSearchParams()

  useTabMeta(t('accountCard.title'))

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const accountId = searchParams.get('accountId')
  const accountCode = searchParams.get('accountCode') ?? ''

  const params = useMemo<AccountCardParams | null>(() => {
    if (!from || !to) return null
    return {
      from,
      to,
      accountId: accountId ? Number(accountId) : undefined,
    }
  }, [from, to, accountId])

  const { rows, isLoading } = useAccountCard(params, params != null)

  const title = useMemo(() => {
    if (!from || !to) return t('accountCard.title')
    const period = `${formatDate(from)} — ${formatDate(to)}`
    const acc = accountCode ? ` ${accountCode}` : ''
    return `${t('accountCard.title')}${acc} ${t('accountCard.forPeriod')} ${period}`
  }, [from, to, accountCode, t])

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      {params != null && <AccountCardTable rows={rows} isLoading={isLoading} />}
    </div>
  )
}
