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
import { useAccountCardOpening } from '../lib/hooks/use-account-card-opening'
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

  // Начальное сальдо — остаток счёта на момент ДО начала периода (from − 1 сек),
  // чтобы проводки самого from не задвоились в начальном сальдо и оборотах.
  const openingDate = useMemo(() => {
    if (!from) return null
    const d = new Date(from)
    if (Number.isNaN(d.getTime())) return null
    d.setSeconds(d.getSeconds() - 1)
    return d.toISOString()
  }, [from])

  const { opening } = useAccountCardOpening(
    openingDate,
    accountId ? Number(accountId) : undefined,
    params != null
  )

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
      {params != null && (
        <AccountCardTable
          rows={rows}
          opening={opening}
          cardCode={accountCode}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
