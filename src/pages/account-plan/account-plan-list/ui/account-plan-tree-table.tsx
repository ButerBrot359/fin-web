import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'

import type { AccountPlanRow } from '../lib/utils/build-tree-rows'

interface AccountPlanTreeTableProps {
  columns: ColumnDef<AccountPlanRow>[]
  rows: AccountPlanRow[]
  isLoading?: boolean
  selectedId?: number | null
  onRowClick?: (row: AccountPlanRow) => void
  onRowDoubleClick?: (row: AccountPlanRow) => void
}

/**
 * Минимальная tree-table — клиентский TanStack-table без виртуализации
 * (план счетов это сотни строк, не тысячи; виртуализация не нужна).
 * Структура классов и состояний — как в EavEntityTable.
 */
export const AccountPlanTreeTable = ({
  columns,
  rows,
  isLoading,
  selectedId,
  onRowClick,
  onRowDoubleClick,
}: AccountPlanTreeTableProps) => {
  const { t } = useTranslation()
  const data = useMemo(() => rows, [rows])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.entry.id),
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
        {t('accountPlan.empty')}
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
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedId === row.original.entry.id
            return (
              <tr
                key={row.id}
                // select-none: двойной клик не выделяет текст в ячейке (иначе
                // браузер «съедает» dblclick и запись не открывается).
                className={`cursor-pointer select-none border-b border-ui-04/40 transition-colors hover:bg-ui-07 ${
                  isSelected ? 'bg-ui-08' : ''
                }`}
                onClick={() => onRowClick?.(row.original)}
                onDoubleClick={() => onRowDoubleClick?.(row.original)}
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
