import { Fragment, useEffect, useMemo, useState } from 'react'
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

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import type { OsvReportEntry, OsvReportTotal } from '../types/osv-report'
import { DimensionNameCell } from './dimension-name-cell'

interface OsvReportTableProps {
  /** Колонки оставлены для совместимости сигнатуры; рендер таблицы кастомный. */
  columns?: ColumnDef<OsvReportEntry>[]
  rows: OsvReportEntry[]
  /** Серверная строка «Итого» (с бэка). `null` — бэк её не прислал. */
  total?: OsvReportTotal | null
  isLoading?: boolean
}

/** Поля строки «Сумма» — денежные показатели по 6 колонкам. */
const SUM_FIELDS = [
  'openingDt',
  'openingKt',
  'turnoverDt',
  'turnoverKt',
  'closingDt',
  'closingKt',
] as const

/** Поля строки «Кол.» — количественные показатели по тем же 6 колонкам. */
const QTY_FIELDS = [
  'openingQtyDt',
  'openingQtyKt',
  'turnoverQtyDt',
  'turnoverQtyKt',
  'closingQtyDt',
  'closingQtyKt',
] as const

const toNum = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? 0 : n
}

/** Денежная/количественная ячейка: разряды, пусто для null/0, минус — красным. */
const ValueCell = ({ v }: { v: number | string | null | undefined }) => {
  const num = toNum(v)
  const text = v == null || v === '' || num === 0 ? '' : formatWithSpaces(String(v))
  return (
    <Typography
      variant="body2"
      noWrap
      // Отрицательное значение — красным (сальдо «не своей» стороны, ОСВ 1С).
      className={`text-right tabular-nums ${num < 0 ? 'text-support-01' : 'text-ui-06'}`}
    >
      {text}
    </Typography>
  )
}

const tdValue = 'whitespace-nowrap px-3 py-1.5'

/**
 * Таблица ОСВ со строками-показателями «Сумма» и «Кол.» на каждый узел
 * дерева, как в 1С БГУ. Дерево по измерениям (TanStack), но рендер тела
 * кастомный: каждая строка узла разворачивается в две `<tr>` (Сумма/Кол.),
 * колонки «Счёт»/«Наименование» объединены по вертикали (rowSpan=2).
 */
export const OsvReportTable = ({ rows, total, isLoading }: OsvReportTableProps) => {
  const { t } = useTranslation()
  const data = useMemo(() => rows, [rows])

  // Развёрнутость — управляемая. По умолчанию всё раскрыто (как ОСВ в 1С);
  // при новой выборке сбрасываем в «всё раскрыто».
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [rows])

  // Минимальная колонка-заглушка: TanStack нужна для модели дерева; сам рендер
  // значений делаем вручную, поэтому cell-рендереры здесь не используются.
  const columns = useMemo<ColumnDef<OsvReportEntry>[]>(
    () => [{ id: 'tree', accessorFn: (r) => r.accountCode ?? null }],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children ?? undefined,
    state: { expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    // id строки = путь по индексам от корня — уникален на любой глубине,
    // в отличие от accountId (наследуется узлами измерений → дублировал строки).
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

  const isImbalanced = total?.balanced === false

  const headLabels = [
    t('osv.openingDt'),
    t('osv.openingKt'),
    t('osv.turnoverDt'),
    t('osv.turnoverKt'),
    t('osv.closingDt'),
    t('osv.closingKt'),
  ]

  // Код счёта со стрелкой разворота и отступом по глубине дерева.
  const renderAccountCell = (row: Row<OsvReportEntry>) => {
    const isChild = row.depth > 0
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
    return (
      <div className="flex items-center gap-1" style={{ paddingLeft: row.depth * 20 }}>
        {canExpand ? (
          <button
            type="button"
            aria-label={isExpanded ? t('osv.collapse') : t('osv.expand')}
            className="flex h-4 w-4 items-center justify-center"
            onClick={() => row.toggleExpanded()}
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
        {/* Код показываем только у строки-счёта; узлы измерений его наследуют. */}
        <span className="text-ui-06">{isChild ? '' : (row.original.accountCode ?? '')}</span>
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
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-ui-05">
              {t('osv.account')}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-ui-05">
              {t('osv.accountName')}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-ui-05">
              {t('osv.indicators')}
            </th>
            {headLabels.map((label, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium uppercase text-ui-05"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const bg = row.depth > 0 ? 'bg-ui-02/40' : ''
            return (
              <Fragment key={row.id}>
                {/* Строка показателя «Сумма» */}
                <tr className={`border-t border-ui-04/40 ${bg}`}>
                  <td rowSpan={2} className="whitespace-nowrap px-3 py-1.5 align-top">
                    {renderAccountCell(row)}
                  </td>
                  <td rowSpan={2} className="whitespace-nowrap px-3 py-1.5 align-top">
                    {row.depth > 0 ? (
                      <DimensionNameCell node={row.original} />
                    ) : (
                      <Typography variant="body2" noWrap className="text-ui-06">
                        {row.original.accountNameRu ?? row.original.accountCode ?? ''}
                      </Typography>
                    )}
                  </td>
                  <td className={`${tdValue} text-ui-05`}>
                    <Typography variant="body2" noWrap className="text-ui-05">
                      {t('osv.sum')}
                    </Typography>
                  </td>
                  {SUM_FIELDS.map((f) => (
                    <td key={f} className={tdValue}>
                      <ValueCell v={row.original[f]} />
                    </td>
                  ))}
                </tr>
                {/* Строка показателя «Кол.» */}
                <tr className={bg}>
                  <td className={`${tdValue} text-ui-05`}>
                    <Typography variant="body2" noWrap className="text-ui-05">
                      {t('osv.quantity')}
                    </Typography>
                  </td>
                  {QTY_FIELDS.map((f) => (
                    <td key={f} className={tdValue}>
                      <ValueCell v={row.original[f]} />
                    </td>
                  ))}
                </tr>
              </Fragment>
            )
          })}
        </tbody>
        {total && (
          <tfoot className="bg-ui-02 font-medium">
            <tr className="border-t-2 border-ui-04">
              <td rowSpan={2} colSpan={2} className="whitespace-nowrap px-3 py-1.5 align-top">
                <Typography variant="body2" className="font-medium text-ui-06">
                  {t('osv.total')}
                </Typography>
              </td>
              <td className={`${tdValue} text-ui-05`}>
                <Typography variant="body2" noWrap className="text-ui-05">
                  {t('osv.sum')}
                </Typography>
              </td>
              {SUM_FIELDS.map((f) => (
                <td key={f} className={tdValue}>
                  <ValueCell v={total[f]} />
                </td>
              ))}
            </tr>
            <tr>
              <td className={`${tdValue} text-ui-05`}>
                <Typography variant="body2" noWrap className="text-ui-05">
                  {t('osv.quantity')}
                </Typography>
              </td>
              {QTY_FIELDS.map((f) => (
                <td key={f} className={tdValue}>
                  <ValueCell v={total[f]} />
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
