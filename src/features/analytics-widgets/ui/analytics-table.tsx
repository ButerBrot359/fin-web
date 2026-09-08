import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Typography } from '@mui/material'

import type {
  AnalyticsColumn,
  AnalyticsEncoding,
  AnalyticsQueryColumn,
  AnalyticsValueFormat,
} from '@/entities/analytics'
import { cn } from '@/shared/lib/utils/cn'

import { buildSpecMap, findColumnIndex } from '../lib/build-chart-data'
import {
  buildTableModel,
  sortRows,
  type AnalyticsTableRow,
} from '../lib/build-table-model'
import { formatValue, pickLabel } from '../lib/format-value'
import { MICRO_LABEL_SX } from '@/shared/ui/micro-label'

export interface AnalyticsTableProps {
  columns: AnalyticsQueryColumn[]
  rows: unknown[][]
  specColumns?: AnalyticsColumn[]
  encoding?: AnalyticsEncoding
  title?: string
  maxHeight?: number
  showTotals?: boolean
}

/** Ниже этого числа строк виртуализация только мешает отладке. */
const VIRTUALIZE_FROM = 200
const ROW_HEIGHT = 36

const RIGHT_FORMATS: AnalyticsValueFormat[] = [
  'MONEY',
  'INTEGER',
  'DECIMAL2',
  'PERCENT',
]

const isRight = (
  column: AnalyticsQueryColumn,
  spec?: AnalyticsColumn
): boolean =>
  column.type === 'INTEGER' ||
  column.type === 'DECIMAL' ||
  (spec != null && RIGHT_FORMATS.includes(spec.format))

// Волосяной разделитель светлее `ui-03`: в плотной таблице линия в полный
// контраст читается как сетка, а нужна лишь опора для глаза.
const cellClass =
  'border-b border-ui-03/45 px-3 py-2 text-body2 text-ui-06 tabular-nums'

/**
 * Таблица результата (виды TABLE и PIVOT): сортировка по клику на заголовок,
 * форматы и итоги из спецификации, группировка по `encoding.groupBy`.
 * Данные готовит `buildTableModel` — здесь только отрисовка.
 */
export const AnalyticsTable = ({
  columns,
  rows,
  specColumns,
  encoding,
  title,
  maxHeight,
  showTotals = true,
}: AnalyticsTableProps) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const spec = useMemo(() => buildSpecMap(specColumns), [specColumns])
  const formats = columns.map((column) => spec.get(column.name)?.format ?? null)
  const aligns = columns.map((column) => isRight(column, spec.get(column.name)))

  const sortedRows = useMemo(() => {
    if (sorting.length === 0) return rows
    const { id, desc } = sorting[0]
    const index = findColumnIndex(columns, id)
    if (index < 0) return rows
    return sortRows(rows, index, desc, columns[index].type)
  }, [rows, columns, sorting])

  const model = useMemo(
    () =>
      buildTableModel({
        columns,
        rows: sortedRows,
        specColumns,
        groupBy: encoding?.groupBy,
        showTotals,
        totalLabel: t('analytics.report.total'),
      }),
    [columns, sortedRows, specColumns, encoding?.groupBy, showTotals, t]
  )

  const tableColumns = useMemo<ColumnDef<AnalyticsTableRow>[]>(
    () =>
      columns.map((column, index) => ({
        id: column.name,
        accessorFn: (row: AnalyticsTableRow) => row.cells[index],
        header: pickLabel(spec.get(column.name), column.name, lang),
      })),
    [columns, spec, lang]
  )

  const table = useReactTable({
    data: model,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const tableRows = table.getRowModel().rows
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const virtualize = tableRows.length > VIRTUALIZE_FROM
  const virtualRows = virtualizer.getVirtualItems()
  const hasVirtual = virtualize && virtualRows.length > 0
  const paddingTop = hasVirtual ? virtualRows[0].start : 0
  const paddingBottom = hasVirtual
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0
  const visibleRows = virtualize
    ? virtualRows.map((item) => tableRows[item.index])
    : tableRows

  const renderRow = (row: (typeof tableRows)[number]) => {
    const entry = row.original
    if (entry.kind === 'group') {
      return (
        <tr key={row.id} className="bg-ui-02">
          <td
            className={cn(cellClass, 'font-medium')}
            colSpan={columns.length}
            style={{ paddingLeft: 12 + entry.depth * 16 }}
          >
            {entry.label}
          </td>
        </tr>
      )
    }

    const isTotal = entry.kind === 'total'
    return (
      <tr
        key={row.id}
        className={
          isTotal
            ? 'border-t border-ui-06 font-semibold [&>td]:text-ui-06'
            : undefined
        }
      >
        {row.getVisibleCells().map((cell, index) => (
          <td
            key={cell.id}
            className={cn(
              cellClass,
              aligns[index] && 'text-right tabular-nums',
              isTotal && 'font-medium'
            )}
            style={
              isTotal && index === 0
                ? { paddingLeft: 12 + entry.depth * 16 }
                : undefined
            }
          >
            {isTotal && index === 0
              ? entry.label
              : formatValue(cell.getValue(), formats[index])}
          </td>
        ))}
      </tr>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {title && (
        <Typography className="mb-2" sx={MICRO_LABEL_SX}>
          {title}
        </Typography>
      )}
      <div
        ref={scrollRef}
        className="min-h-0 w-full flex-1 overflow-auto"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full min-w-max border-collapse">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header, index) => {
                  const direction = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        'sticky top-0 z-10 cursor-pointer whitespace-nowrap border-b border-ui-03 bg-ui-01 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-05',
                        aligns[index] ? 'text-right' : 'text-left'
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {direction === 'asc' && ' ▲'}
                      {direction === 'desc' && ' ▼'}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: paddingTop }} />
              </tr>
            )}
            {visibleRows.map(renderRow)}
            {paddingBottom > 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ height: paddingBottom }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
