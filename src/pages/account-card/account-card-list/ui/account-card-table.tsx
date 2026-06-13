import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'

import type { AccountCardEntry } from '../types/account-card'

interface AccountCardTableProps {
  rows: AccountCardEntry[]
  /** Начальное сальдо счёта (signed = Дт − Кт) на начало периода. */
  opening: number
  /** Код счёта карточки — определяет сторону (Дт/Кт) и корр-счёт. */
  cardCode: string
  /** Открыть документ-регистратор проводки (клик по колонке «Документ»). */
  onOpenDocument?: (row: AccountCardEntry) => void
  isLoading?: boolean
}

const toNum = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? 0 : n
}

const td = 'border border-ui-04/60 px-3 py-1.5 align-top'
const th =
  'whitespace-nowrap border border-ui-04/60 px-3 py-2 text-left text-xs font-semibold uppercase text-ui-06'

/** Денежная ячейка: разряды, пусто для 0, отрицательное — красным. */
const Money = ({
  v,
  bold,
  showZero,
}: {
  v: number
  bold?: boolean
  showZero?: boolean
}) => {
  const text = v === 0 && !showZero ? '' : formatWithSpaces(String(v))
  return (
    <Typography
      variant="body2"
      noWrap
      className={`text-right tabular-nums ${v < 0 ? 'text-support-01' : 'text-ui-06'} ${
        bold ? 'font-bold' : ''
      }`}
    >
      {text}
    </Typography>
  )
}

/** Список значений аналитики (измерения + субконто стороны) — построчно. */
const analyticsList = (
  entry: AccountCardEntry,
  side: 'Dt' | 'Kt'
): string[] => {
  const out: string[] = []
  const dims = [
    entry.organizatsiya,
    entry.podrazdelenie,
    entry.fkr,
    entry.spetsifika,
    entry.istochnikFinansirovaniya,
    entry.kodPlatnykhUslug,
  ]
  for (const d of dims) if (d?.presentation) out.push(d.presentation)
  const subs = side === 'Dt' ? entry.subkontosDt : entry.subkontosKt
  for (const s of subs ?? []) {
    const nm = s.displayName ?? s.nameRu ?? s.code
    if (nm) out.push(nm)
  }
  return out
}

const AnalyticsCell = ({ items }: { items: string[] }) => (
  <div className="flex max-w-72 flex-col gap-0.5">
    {items.map((it, i) => (
      <Typography key={i} variant="body2" className="text-ui-06">
        {it}
      </Typography>
    ))}
  </div>
)

/**
 * Карточка счёта — хронология движений по счёту с накопительным сальдо и
 * аналитикой Дт/Кт (как в 1С). Строки: «Сальдо на начало» → проводки (Период,
 * Документ, Операция, Аналитика Дт/Кт, Дебет, Кредит, Текущее сальдо) →
 * «Обороты за период» → «Конечное сальдо». Текущее = предыдущее + Дт − Кт.
 */
export const AccountCardTable = ({
  rows,
  opening,
  cardCode,
  onOpenDocument,
  isLoading,
}: AccountCardTableProps) => {
  const { t } = useTranslation()

  const { lines, totalDt, totalKt, closing } = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      (a.period ?? '').localeCompare(b.period ?? '')
    )
    let running = opening
    let totalDt = 0
    let totalKt = 0
    const lines = sorted.map((entry) => {
      const summa = toNum(entry.summa)
      let debit = 0
      let credit = 0
      let debitQty = 0
      let creditQty = 0
      if (entry.accountKtCode === cardCode && entry.accountDtCode !== cardCode) {
        credit = summa
        creditQty = toNum(entry.kolichestvoKt)
        running -= summa
        totalKt += summa
      } else {
        // Дт-сторона счёта карточки (или счёт карточки не определён) — приход.
        debit = summa
        debitQty = toNum(entry.kolichestvoDt)
        running += summa
        totalDt += summa
      }
      return { entry, debit, credit, debitQty, creditQty, balance: running }
    })
    return { lines, totalDt, totalKt, closing: opening + totalDt - totalKt }
  }, [rows, opening, cardCode])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-ui-04/60">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          <tr>
            <th className={th}>{t('accountCard.period')}</th>
            <th className={th}>{t('accountCard.document')}</th>
            <th className={th}>{t('accountCard.operation')}</th>
            <th className={th}>{t('accountCard.analyticsDt')}</th>
            <th className={th}>{t('accountCard.analyticsKt')}</th>
            <th className={`${th} text-right`}>{t('accountCard.debit')}</th>
            <th className={`${th} text-right`}>{t('accountCard.credit')}</th>
            <th className={`${th} text-right`}>
              {t('accountCard.currentBalance')}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Сальдо на начало */}
          <tr className="bg-ui-02 font-medium">
            <td className={td} colSpan={7}>
              <Typography variant="body2" className="font-medium text-ui-06">
                {t('accountCard.openingBalance')}
              </Typography>
            </td>
            <td className={`${td} text-right`}>
              <Money v={opening} bold showZero />
            </td>
          </tr>

          {/* Проводки */}
          {lines.map(({ entry, debit, credit, debitQty, creditQty, balance }) => (
            <tr key={entry.id} className="transition-colors hover:bg-ui-07">
              <td className={`${td} whitespace-nowrap`}>
                <Typography variant="body2" noWrap className="text-ui-06">
                  {typeof entry.period === 'string'
                    ? formatDate(entry.period, 'dd.MM.yyyy HH:mm:ss')
                    : ''}
                </Typography>
              </td>
              <td className={`${td} max-w-52`}>
                {entry.recorderDocumentName ? (
                  <button
                    type="button"
                    onClick={() => onOpenDocument?.(entry)}
                    className="text-left text-accent-02 hover:underline"
                  >
                    {entry.recorderDocumentName}
                  </button>
                ) : (
                  ''
                )}
              </td>
              <td className={`${td} max-w-44`}>
                <Typography variant="body2" className="text-ui-06">
                  {entry.soderzhanie ?? ''}
                </Typography>
              </td>
              <td className={td}>
                <AnalyticsCell items={analyticsList(entry, 'Dt')} />
              </td>
              <td className={td}>
                <AnalyticsCell items={analyticsList(entry, 'Kt')} />
              </td>
              <td className={`${td} text-right`}>
                <Money v={debit} />
                {debitQty !== 0 && (
                  <Typography
                    variant="caption"
                    className="block text-right tabular-nums text-ui-05"
                  >
                    {formatWithSpaces(String(debitQty))}
                  </Typography>
                )}
              </td>
              <td className={`${td} text-right`}>
                <Money v={credit} />
                {creditQty !== 0 && (
                  <Typography
                    variant="caption"
                    className="block text-right tabular-nums text-ui-05"
                  >
                    {formatWithSpaces(String(creditQty))}
                  </Typography>
                )}
              </td>
              <td className={`${td} text-right`}>
                <Money v={balance} showZero />
              </td>
            </tr>
          ))}

          {/* Обороты за период */}
          <tr className="bg-ui-02 font-medium">
            <td className={td} colSpan={5}>
              <Typography variant="body2" className="font-medium text-ui-06">
                {t('accountCard.turnovers')}
              </Typography>
            </td>
            <td className={`${td} text-right`}>
              <Money v={totalDt} bold showZero />
            </td>
            <td className={`${td} text-right`}>
              <Money v={totalKt} bold showZero />
            </td>
            <td className={td} />
          </tr>

          {/* Конечное сальдо */}
          <tr className="bg-ui-02 font-bold">
            <td className={td} colSpan={7}>
              <Typography variant="body2" className="font-bold text-ui-06">
                {t('accountCard.closingBalance')}
              </Typography>
            </td>
            <td className={`${td} text-right`}>
              <Money v={closing} bold showZero />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
