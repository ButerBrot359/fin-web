import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { OsvReportEntry, OsvReportTotal } from '../types/osv-report'

interface OsvReportTableProps {
  columns: ColumnDef<OsvReportEntry>[]
  rows: OsvReportEntry[]
  /** Серверная строка «Итого» (с бэка). `null` — бэк её не прислал. */
  total?: OsvReportTotal | null
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
  total,
  isLoading,
}: OsvReportTableProps) => {
  const { t } = useTranslation()
  const data = useMemo(() => rows, [rows])

  // Развёрнутость — управляемая. По умолчанию всё раскрыто (как ОСВ в 1С);
  // при новой выборке («Сформировать») сбрасываем обратно в «всё раскрыто»,
  // иначе часть уровней остаётся свёрнутой. Тоггл стрелкой при этом работает.
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [rows])

  // «Итого» считает БЭК (по счетам 1-го порядка, без забалансовых, с
  // валидацией двойной записи) и присылает в `total`. Фронт сам больше НЕ
  // суммирует. Fallback на клиентский расчёт оставлен лишь на случай старой
  // сборки бэка без поля `total`.
  const totals = useMemo(() => {
    const acc: Partial<Record<keyof OsvReportEntry, number>> = {}
    for (const key of SUM_KEYS) {
      acc[key] = total
        ? toNum(total[key as keyof OsvReportTotal] as number | string | null)
        : rows.reduce(
            (s, r) => s + toNum(r[key] as number | string | null | undefined),
            0
          )
    }
    return acc
  }, [rows, total])

  // Двойная запись не сошлась (Σ Дт ≠ Σ Кт) — бэк прислал balanced=false.
  // null = проверка не делалась (отчёт по одному счёту) → не предупреждаем.
  const isImbalanced = total?.balanced === false

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // Рекурсивный разворот дерева ОСВ по измерениям (любая глубина):
    // ORGANIZATION → … → SUBKONTO. У листьев children = null — дерево
    // дальше не разворачивается. TanStack сам обрабатывает любую глубину.
    getSubRows: (row) => row.children ?? undefined,
    // Управляемая развёрнутость: по умолчанию всё раскрыто, тоггл работает.
    state: { expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    // id строки = путь по индексам от корня (0 / 0.1 / 0.1.2 …). НЕ опираемся
    // на accountId: у всех узлов измерений он наследуется от счёта (одинаков),
    // и при пересечении индексов id'шники дублировались — раскрытие/сворачивание
    // размножало строки. Путь по позициям уникален на любой глубине.
    getRowId: (_row, index, parent) =>
      parent ? `${parent.id}.${index}` : String(index),
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
      {isImbalanced && (
        <div className="mb-2 rounded-md bg-support-01/10 px-3 py-2 text-support-01">
          <Typography variant="body2" className="text-support-01">
            {t('osv.imbalanceWarning')}
          </Typography>
        </div>
      )}
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
              className={`border-b border-ui-04/40 transition-colors hover:bg-ui-07 ${
                row.depth > 0 ? 'bg-ui-02/40' : ''
              }`}
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
                      // Отрицательный итог — красным, как суммы в строках (ОСВ 1С).
                      className={`text-right font-medium tabular-nums ${
                        (totals[key] ?? 0) < 0 ? 'text-support-01' : 'text-ui-06'
                      }`}
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
