import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'

import type { AccountCardEntry } from '../types/account-card'

interface AccountCardTableProps {
  rows: AccountCardEntry[]
  isLoading?: boolean
}

const num = (v: number | string | null | undefined): string => {
  if (v == null || v === '') return ''
  const n = typeof v === 'string' ? Number(v) : v
  if (!Number.isNaN(n) && n === 0) return ''
  return formatWithSpaces(String(v))
}

const td = 'whitespace-nowrap border border-ui-04/60 px-3 py-1.5 align-top'
const th =
  'whitespace-nowrap border border-ui-04/60 px-3 py-2 text-left text-xs font-semibold uppercase text-ui-06'

/** Карточка счёта — плоская таблица движений по счёту за период. */
export const AccountCardTable = ({ rows, isLoading }: AccountCardTableProps) => {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-ui-05">
        <Typography variant="body2" className="text-ui-05">
          {t('accountCard.noData')}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-ui-04/60">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          <tr>
            <th className={th}>{t('accountCard.period')}</th>
            <th className={th}>{t('accountCard.debitAccount')}</th>
            <th className={th}>{t('accountCard.creditAccount')}</th>
            <th className={`${th} text-right`}>{t('accountCard.sum')}</th>
            <th className={`${th} text-right`}>{t('accountCard.quantityDt')}</th>
            <th className={`${th} text-right`}>{t('accountCard.quantityKt')}</th>
            <th className={th}>{t('accountCard.content')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-ui-07">
              <td className={td}>
                <Typography variant="body2" noWrap className="text-ui-06">
                  {typeof r.period === 'string'
                    ? formatDate(r.period, 'dd.MM.yyyy HH:mm:ss')
                    : ''}
                </Typography>
              </td>
              <td className={td}>
                <Typography variant="body2" noWrap className="font-medium text-ui-06">
                  {r.accountDtCode ?? ''}
                </Typography>
              </td>
              <td className={td}>
                <Typography variant="body2" noWrap className="font-medium text-ui-06">
                  {r.accountKtCode ?? ''}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Typography variant="body2" noWrap className="tabular-nums text-ui-06">
                  {num(r.summa)}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Typography variant="body2" noWrap className="tabular-nums text-ui-06">
                  {num(r.kolichestvoDt)}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Typography variant="body2" noWrap className="tabular-nums text-ui-06">
                  {num(r.kolichestvoKt)}
                </Typography>
              </td>
              <td className={td}>
                <Typography variant="body2" className="text-ui-06">
                  {r.soderzhanie ?? ''}
                </Typography>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
