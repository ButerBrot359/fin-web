import type { TableExportData } from '@/shared/lib/table-export'
import { formatDate } from '@/shared/lib/utils/date'

import type {
  AccountCardEntry,
  AccountCardTotals,
  HiddenAnalyticsGroups,
} from '../../types/account-card'
import { analyticsList, computeCardLines } from './compute-card-lines'

export interface CardExportLabels {
  period: string
  document: string
  operation: string
  analyticsDt: string
  analyticsKt: string
  corrAccount: string
  debit: string
  credit: string
  currentBalance: string
  openingBalance: string
  turnovers: string
  closingBalance: string
}

/**
 * Готовит данные карточки счёта для выгрузки в Excel: заголовки + строки
 * (сальдо на начало → проводки → обороты → конечное сальдо). Все суммы и сальдо
 * приходят с бэка (через `totals` и поля строк) — фронт ничего не пересчитывает.
 */
export const buildCardExport = (
  rows: AccountCardEntry[],
  totals: AccountCardTotals | null,
  l: CardExportLabels,
  hidden: HiddenAnalyticsGroups = new Set()
): TableExportData => {
  const { lines, totalDt, totalKt, closing } = computeCardLines(rows, totals)
  const opening = totals?.openingBalance ?? 0
  const headers = [
    l.period,
    l.document,
    l.operation,
    l.analyticsDt,
    l.analyticsKt,
    l.corrAccount,
    l.debit,
    l.credit,
    l.currentBalance,
  ]
  const out: (string | number | null)[][] = []
  out.push([l.openingBalance, '', '', '', '', '', '', '', opening])
  for (const line of lines) {
    out.push([
      typeof line.entry.period === 'string'
        ? formatDate(line.entry.period, 'dd.MM.yyyy HH:mm:ss')
        : '',
      line.entry.recorderDocumentName ?? '',
      line.entry.soderzhanie ?? '',
      analyticsList(line.entry, 'Dt', hidden).join('; '),
      analyticsList(line.entry, 'Kt', hidden).join('; '),
      line.entry.korrAccountCode ?? '',
      line.debit || '',
      line.credit || '',
      line.balance,
    ])
  }
  out.push([l.turnovers, '', '', '', '', '', totalDt, totalKt, ''])
  out.push([l.closingBalance, '', '', '', '', '', '', '', closing])
  return { headers, rows: out }
}
