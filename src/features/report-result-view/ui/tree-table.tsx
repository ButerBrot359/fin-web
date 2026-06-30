import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table'

import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import { isMeasure, isRightAligned } from '../lib/cell-helpers'
import { ReportCell } from './report-cell'

interface TreeTableProps {
  result: ReportResultDto
  columns: ReportColumnDto[]
}

const tdBase = 'overflow-hidden whitespace-nowrap px-3 py-1.5'
const thBase =
  'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase text-ui-06'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/**
 * TREE-таблица результата (как ОСВ): рекурсивное дерево по `rows[].children`
 * через TanStack, раскрытие узлов. Денежные ячейки — единый 1С-формат
 * (negativeRed/blankOnZero). Группы (depth 0 ∥ rowKind=GROUP_HEADER) жирные.
 * Внизу — строка «Итого» из `result.total`.
 */
export const TreeTable = ({ result, columns }: TreeTableProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'

  const data = useMemo(() => result.rows, [result.rows])

  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [result])

  // Колонка-заглушка для модели дерева TanStack; рендер тела кастомный.
  const tableColumns = useMemo<ColumnDef<ReportRowDto>[]>(
    () => [{ id: 'tree', accessorFn: (r) => r.groupValue ?? null }],
    []
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => (row.children.length > 0 ? row.children : undefined),
    state: { expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    getRowId: (_row, index, parent) =>
      parent ? `${parent.id}.${String(index)}` : String(index),
  })

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Typography variant="body2" className="text-ui-05">
          {t('reports.noData')}
        </Typography>
      </div>
    )
  }

  /** Жирная ли строка-группа (узел верхнего уровня или явный GROUP_HEADER). */
  const isGroupRow = (row: Row<ReportRowDto>): boolean =>
    row.original.rowKind === 'GROUP_HEADER' || row.depth === 0

  // Первая колонка (наименование группы) со стрелкой разворота и отступом.
  const renderGroupCell = (row: Row<ReportRowDto>) => {
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
    const bold = isGroupRow(row)
    const label = row.original.labelText ?? row.original.groupValue ?? ''
    return (
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: row.depth * 20 }}
      >
        {canExpand ? (
          <button
            type="button"
            aria-label={
              isExpanded ? t('reports.collapse') : t('reports.expand')
            }
            className="flex h-4 w-4 items-center justify-center"
            onClick={() => {
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
        <Typography
          variant="body2"
          noWrap
          className={`text-ui-06 ${bold ? 'font-bold' : ''}`}
        >
          {label}
        </Typography>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-ui-04">
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          <tr className="border-b border-ui-04">
            {/* Первая колонка — наименование группы (дерево). */}
            <th className={`${thBase} text-left`}>{t('reports.group')}</th>
            {columns.map((col) => (
              <th
                key={col.code}
                className={`${thBase} ${
                  isRightAligned(col) ? 'text-right' : 'text-left'
                }`}
              >
                {columnTitle(col, isKz)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const bold = isGroupRow(row)
            const rowBg = row.depth === 0 ? 'bg-ui-02' : 'bg-ui-01'
            return (
              <tr
                key={row.id}
                className={`border-t border-ui-04/60 ${rowBg} hover:bg-ui-07`}
              >
                <td className={`${tdBase} align-top`}>
                  {renderGroupCell(row)}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.code}
                    className={`${tdBase} align-top ${
                      isMeasure(col) ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    <ReportCell
                      value={row.original.cells[col.code]}
                      col={col}
                      bold={bold}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {Object.keys(result.total).length > 0 && (
          <tfoot className="bg-ui-02 font-bold">
            <tr className="border-t-2 border-ui-03">
              <td className={tdBase}>
                <Typography variant="body2" className="font-bold text-ui-06">
                  {t('reports.total')}
                </Typography>
              </td>
              {columns.map((col) => (
                <td
                  key={col.code}
                  className={`${tdBase} ${
                    isMeasure(col) ? 'text-right tabular-nums' : ''
                  }`}
                >
                  <ReportCell value={result.total[col.code]} col={col} bold />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
