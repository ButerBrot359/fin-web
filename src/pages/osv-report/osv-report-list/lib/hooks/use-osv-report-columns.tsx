import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import type { OsvReportEntry } from '../../types/osv-report'
import { SubkontoNameCell } from '../../ui/subkonto-name-cell'

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
        // Колонка «Счёт» несёт стрелку разворота и отступ для дочерних строк
        // по субконто (разворот ровно на 1 уровень, как ОСВ в 1С).
        cell: ({ row, getValue }) => {
          const isChild = row.depth > 0
          const canExpand = row.getCanExpand()
          const isExpanded = row.getIsExpanded()
          return (
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: row.depth * 20 }}
            >
              {canExpand ? (
                <button
                  type="button"
                  aria-label={isExpanded ? t('osv.collapse') : t('osv.expand')}
                  className="flex h-4 w-4 items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    row.toggleExpanded()
                  }}
                >
                  <ArrowDownIcon
                    className={`h-3 w-3 shrink-0 transition-transform ${
                      isExpanded ? '' : '-rotate-90'
                    }`}
                  />
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              {/* Дочерние строки субконто наследуют код счёта — не дублируем. */}
              <span className="text-ui-06">
                {isChild ? '' : ((getValue() as string | null) ?? '')}
              </span>
            </div>
          )
        },
      },
      {
        id: 'accountNameRu',
        // Наименование счёта; фолбэк на код, если имя пустое.
        accessorFn: (row) => row.accountNameRu ?? row.accountCode ?? null,
        header: () => <span>{t('osv.accountName')}</span>,
        // Дочерняя строка — имя субконто (резолв ID → имя как в журнале).
        cell: ({ row, getValue }) =>
          row.depth > 0 ? (
            <SubkontoNameCell subkonto={row.original.subkonto} />
          ) : (
            cellText((getValue() as string | null) ?? '')
          ),
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
