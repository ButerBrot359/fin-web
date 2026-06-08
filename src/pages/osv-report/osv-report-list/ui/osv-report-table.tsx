import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { OsvReportEntry } from '../types/osv-report'

interface OsvReportTableProps {
  columns: ColumnDef<OsvReportEntry>[]
  rows: OsvReportEntry[]
  isLoading?: boolean
}

/** Денежные колонки, по которым считается строка «Итого». */
const SUM_KEYS: (keyof OsvReportEntry)[] = [
  'openingDt',
  'openingKt',
  'turnoverDt',
  'turnoverKt',
  'closingDt',
  'closingKt',
]

const toNum = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? 0 : n
}

/**
 * Плоская таблица ОСВ (клиентский TanStack-table без виртуализации — счетов
 * сотни, не тысячи) со строкой «Итого» по денежным колонкам, как в 1С.
 */
export const OsvReportTable = ({
  columns,
  rows,
  isLoading,
}: OsvReportTableProps) => {
  const { t } = useTranslation()
  const data = useMemo(() => rows, [rows])

  const totals = useMemo(() => {
    const acc: Partial<Record<keyof OsvReportEntry, number>> = {}
    for (const key of SUM_KEYS) {
      acc[key] = rows.reduce((s, r) => s + toNum(r[key]), 0)
    }
    return acc
  }, [rows])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => String(row.accountId ?? index),
  })

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
          {t('osv.noData')}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-ui-05"
                  style={{ width: header.column.getSize() }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-ui-04/40 transition-colors hover:bg-ui-07"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="whitespace-nowrap px-3 py-2 first:rounded-l-md last:rounded-r-md"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-ui-02 font-medium">
          <tr>
            {table.getVisibleFlatColumns().map((col, idx) => {
              const key = col.id as keyof OsvReportEntry
              const isSum = SUM_KEYS.includes(key)
              return (
                <td
                  key={col.id}
                  className="whitespace-nowrap px-3 py-2 text-ui-06"
                >
                  {idx === 0 ? (
                    <Typography variant="body2" className="font-medium text-ui-06">
                      {t('osv.total')}
                    </Typography>
                  ) : isSum ? (
                    <Typography
                      variant="body2"
                      noWrap
                      className="text-right font-medium tabular-nums text-ui-06"
                    >
                      {totals[key]
                        ? formatWithSpaces(String(totals[key]))
                        : ''}
                    </Typography>
                  ) : null}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
