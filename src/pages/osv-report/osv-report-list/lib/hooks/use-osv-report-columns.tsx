import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { OsvReportEntry } from '../../types/osv-report'

const cellText = (value: React.ReactNode, align: 'left' | 'right' = 'left') => (
  <Typography
    variant="body2"
    noWrap
    className={`text-ui-06 ${align === 'right' ? 'text-right tabular-nums' : ''}`}
  >
    {value}
  </Typography>
)

/** Денежная ячейка: разделители разрядов, пусто для null/0. */
const moneyCell = (v: number | string | null | undefined) => {
  if (v == null || v === '') return cellText('', 'right')
  const num = typeof v === 'string' ? Number(v) : v
  if (!Number.isNaN(num) && num === 0) return cellText('', 'right')
  return cellText(formatWithSpaces(String(v)), 'right')
}

/** Фабрика денежной колонки. */
const moneyColumn = (
  id: keyof OsvReportEntry,
  header: string
): ColumnDef<OsvReportEntry> => ({
  id,
  accessorFn: (row) => row[id] ?? null,
  header: () => <span>{header}</span>,
  cell: ({ getValue }) =>
    moneyCell(getValue() as number | string | null | undefined),
})

export const useOsvReportColumns = (): ColumnDef<OsvReportEntry>[] => {
  const { t } = useTranslation()

  return useMemo(
    () => [
      {
        id: 'accountCode',
        accessorFn: (row) => row.accountCode ?? null,
        header: () => <span>{t('osv.account')}</span>,
        cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
      },
      {
        id: 'accountNameRu',
        // Наименование счёта; фолбэк на код, если имя пустое.
        accessorFn: (row) => row.accountNameRu ?? row.accountCode ?? null,
        header: () => <span>{t('osv.accountName')}</span>,
        cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
      },
      moneyColumn('openingDt', t('osv.openingDt')),
      moneyColumn('openingKt', t('osv.openingKt')),
      moneyColumn('turnoverDt', t('osv.turnoverDt')),
      moneyColumn('turnoverKt', t('osv.turnoverKt')),
      moneyColumn('closingDt', t('osv.closingDt')),
      moneyColumn('closingKt', t('osv.closingKt')),
    ],
    [t]
  )
}
