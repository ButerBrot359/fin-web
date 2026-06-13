import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { useAutoFitColumns } from '@/shared/lib/table-autofit/use-auto-fit-columns'

import type { AccountPlanRow } from '../lib/utils/build-tree-rows'

// Логическая ширина колонок плана счетов: код/флаги/№ — узкие, наименования —
// широкие, субконто — средние.
const COLUMN_WEIGHTS: Record<string, number> = {
  // Код шире: помещаются длинные коды (до «000000001») + значок и отступ дерева.
  code: 2.6,
  name: 3,
  fullNameKz: 3,
  subkonto1: 1.8,
  subkonto2: 1.8,
  subkonto3: 1.8,
  accountType: 1.2,
  isCurrency: 0.7,
  isQuantity: 0.7,
  isOffBalance: 0.7,
  nomerMo: 1,
}

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
  const containerRef = useRef<HTMLDivElement>(null)

  // Ширина колонок «на всю страницу» при первом открытии (по весам), затем ресайз.
  const { columnSizing, onColumnSizingChange } = useAutoFitColumns(
    containerRef,
    !isLoading && rows.length > 0,
    COLUMN_WEIGHTS,
    4
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.entry.id),
    // Ресайз колонок мышью (как в Excel): тянем границу заголовка.
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 48, size: 180 },
    state: { columnSizing },
    onColumnSizingChange,
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
    <div
      ref={containerRef}
      className="overflow-auto rounded-md border border-ui-04/60"
    >
      <table
        className="table-fixed border-collapse"
        style={{ width: table.getTotalSize() }}
      >
        <thead className="bg-ui-02">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="border border-ui-04/60 p-0 text-left text-xs font-medium uppercase text-ui-05"
                  style={{ width: header.column.getSize() }}
                >
                  {/* flex + items-stretch: ручка ресайза тянется на всю высоту
                      заголовка без абсолютного позиционирования (надёжно в
                      любой раскладке таблицы). */}
                  <div className="flex items-stretch">
                    <span className="min-w-0 flex-1 truncate px-3 py-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </span>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => {
                          header.column.resetSize()
                        }}
                        title="Потяните, чтобы изменить ширину"
                        className="group flex w-2 shrink-0 cursor-col-resize touch-none select-none justify-center"
                      >
                        {/* тонкая линия 1px; зона захвата — 8px (невидима) */}
                        <div
                          className={`h-full w-px ${
                            header.column.getIsResizing()
                              ? 'bg-accent-02'
                              : 'bg-transparent group-hover:bg-accent-02'
                          }`}
                        />
                      </div>
                    )}
                  </div>
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
                className={`cursor-pointer select-none transition-colors hover:bg-ui-07 ${
                  isSelected ? 'bg-ui-08' : ''
                }`}
                onClick={() => onRowClick?.(row.original)}
                onDoubleClick={() => onRowDoubleClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="cell-wrap border border-ui-04/60 px-3 py-2 align-top"
                    style={{ width: cell.column.getSize() }}
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
