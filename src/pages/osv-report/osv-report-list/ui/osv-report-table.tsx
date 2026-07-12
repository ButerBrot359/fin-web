import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
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
  /** Заголовок отчёта (название + счёт + период), как в 1С. */
  title?: string
  /**
   * Двойной клик по строке — открыть меню выбора («Открыть элемент» / «Карточка
   * счёта»), как в 1С. Передаём `Row` (для цепочки родителей — наследование
   * фильтров аналитики) и событие (для позиции меню у курсора).
   */
  onRowDoubleClick?: (row: Row<OsvReportEntry>, e: ReactMouseEvent) => void
  /** Показывать строки «Кол.» (показатель «Количество»). */
  showQuantity?: boolean
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

// Вертикальный разделитель перед каждой группой колонок (Сальдо нач / Обороты /
// Сальдо кон) — у «дебетовых» ячеек (чётные индексы 0,2,4), как линии в 1С.
const groupBorder = (i: number) => (i % 2 === 0 ? 'border-l border-ui-04' : '')

/** Денежная/количественная ячейка: разряды, пусто для null/0, минус — красным. */
const ValueCell = ({
  v,
  bold,
}: {
  v: number | string | null | undefined
  bold?: boolean
}) => {
  const num = toNum(v)
  const text = v == null || v === '' || num === 0 ? '' : formatWithSpaces(String(v))
  return (
    <Typography
      variant="body2"
      noWrap
      // Отрицательное значение — красным (сальдо «не своей» стороны, ОСВ 1С).
      className={`text-right tabular-nums ${num < 0 ? 'text-support-01' : 'text-ui-06'} ${
        bold ? 'font-bold' : ''
      }`}
    >
      {text}
    </Typography>
  )
}

const tdValue = 'overflow-hidden whitespace-nowrap px-3 py-1.5'
const thBase =
  'whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase text-ui-06'

/**
 * Логические колонки ОСВ для ресайза (рендер таблицы кастомный, поэтому ширины
 * задаём вручную через `<colgroup>`):
 * 0 Счёт · 1 Наименование · 2 Показатели · 3-8 Дт/Кт по 3 группам сальдо/оборотов.
 */
const DEFAULT_COL_WIDTHS = [150, 320, 100, 120, 120, 120, 120, 120, 120]
const MIN_COL_WIDTH = 60

/**
 * Таблица ОСВ со строками-показателями «Сумма» и «Кол.» на каждый узел дерева,
 * как в 1С БГУ. Дизайн подогнан под референс 1С токенами проекта: двухуровневая
 * шапка с группами сальдо/оборотов, жирные строка-счёт и «Итого», вертикальные
 * разделители групп, выделение фоном. Дерево по измерениям (TanStack), рендер
 * тела кастомный — каждая строка узла даёт две `<tr>` (Сумма/Кол.).
 */
export const OsvReportTable = ({
  rows,
  total,
  title,
  onRowDoubleClick,
  showQuantity = true,
  isLoading,
}: OsvReportTableProps) => {
  const { t } = useTranslation()
  const data = useMemo(() => rows, [rows])

  // Развёрнутость — управляемая. По умолчанию всё раскрыто (как ОСВ в 1С);
  // при новой выборке сбрасываем в «всё раскрыто».
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  useEffect(() => {
    setExpanded(true)
  }, [rows])

  // Ресайз колонок мышью (как в Excel). Рендер таблицы кастомный, поэтому
  // ширины храним сами и применяем через <colgroup>.
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS)
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fitDoneRef = useRef(false)

  // При первом открытии вписываем колонки на всю ширину страницы, сохраняя
  // «логические» пропорции (наименование широкое, числа узкие).
  useLayoutEffect(() => {
    if (fitDoneRef.current || isLoading || rows.length === 0) return
    const el = containerRef.current
    if (!el) return
    const avail = el.clientWidth - 2
    if (avail <= 0) return
    const sum = DEFAULT_COL_WIDTHS.reduce((a, b) => a + b, 0)
    const scale = avail / sum
    fitDoneRef.current = true
    setColWidths(
      DEFAULT_COL_WIDTHS.map((w) =>
        Math.max(MIN_COL_WIDTH, Math.round(w * scale))
      )
    )
  }, [isLoading, rows.length])

  const startResize = (index: number, e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[index]
    setResizingCol(index)
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      setColWidths((prev) => {
        const next = [...prev]
        next[index] = Math.max(MIN_COL_WIDTH, startW + dx)
        return next
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      setResizingCol(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const resetColWidth = (index: number) => {
    setColWidths((prev) => {
      const next = [...prev]
      next[index] = DEFAULT_COL_WIDTHS[index]
      return next
    })
  }

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
      parent ? `${parent.id}.${String(index)}` : String(index),
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

  // Код счёта со стрелкой разворота и отступом по глубине дерева.
  const renderAccountCell = (row: Row<OsvReportEntry>) => {
    const isChild = row.depth > 0
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
    return (
      // Иерархия: стрелка разворота сдвигается каскадом по глубине дерева
      // (как в 1С) — вместе с отступом наименования делает вложенность явной.
      <div className="flex items-center gap-1" style={{ paddingLeft: row.depth * 20 }}>
        {canExpand ? (
          <button
            type="button"
            aria-label={isExpanded ? t('osv.collapse') : t('osv.expand')}
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
        {/* Код показываем только у строки-счёта; узлы измерений его наследуют. */}
        <span className={`text-ui-06 ${isChild ? '' : 'font-bold'}`}>
          {isChild ? '' : (row.original.accountCode ?? '')}
        </span>
      </div>
    )
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  // Правые границы колонок (x в px) — для разделителей-ручек на всю высоту.
  const boundaries = colWidths.map((_, i) =>
    colWidths.slice(0, i + 1).reduce((a, b) => a + b, 0)
  )

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-md border border-ui-04"
    >
      {/* Шапка отчёта: название + счёт + период, как в 1С. */}
      {title && (
        <div className="border-b border-ui-04 bg-ui-02 px-3 py-2">
          <Typography variant="body1" className="font-bold text-ui-06">
            {title}
          </Typography>
        </div>
      )}
      {isImbalanced && (
        <div className="m-2 rounded-md bg-support-01/10 px-3 py-2 text-support-01">
          <Typography variant="body2" className="text-support-01">
            {t('osv.imbalanceWarning')}
          </Typography>
        </div>
      )}
      {/* relative-обёртка: поверх таблицы — разделители-ручки на всю высоту
          (как линии колонок в 1С), а не только во второй строке шапки. */}
      <div className="relative" style={{ width: totalWidth }}>
        {boundaries.map((x, i) => (
          <div
            key={i}
            onMouseDown={(e) => {
              startResize(i, e)
            }}
            onDoubleClick={() => {
              resetColWidth(i)
            }}
            title="Потяните, чтобы изменить ширину"
            style={{ left: x - 4 }}
            className="group absolute inset-y-0 z-20 flex w-2 cursor-col-resize touch-none select-none justify-center"
          >
            {/* Тонкая линия 1px по границе; зона захвата — 8px (невидима).
                Границы Счёт|Наименование и Наименование|Показатели (i=0,1) не
                имеют структурного border-l, поэтому рисуем сплошную линию —
                чтобы по чёткости совпадали с разделителями групп. */}
            <div
              className={`h-full w-px ${
                resizingCol === i
                  ? 'bg-accent-02'
                  : i <= 1
                    ? 'bg-ui-04 group-hover:bg-accent-02'
                    : 'bg-transparent group-hover:bg-accent-02'
              }`}
            />
          </div>
        ))}
        <table className="w-full table-fixed border-collapse">
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="bg-ui-02">
          {/* Уровень 1 — группы колонок (как в 1С). */}
          <tr className="border-b border-ui-04">
            {/* Колонка «Счёт» с легендой уровней группировки (как в 1С):
                перечень измерений, по которым строится разворот дерева. */}
            <th rowSpan={2} className={`${thBase} align-top text-left`}>
              <div>{t('osv.account')}</div>
              <div className="mt-1 space-y-0.5 font-normal normal-case text-ui-05">
                <div>{t('osv.levelOrganization')}</div>
                <div>{t('osv.levelSubdivision')}</div>
                <div>{t('osv.levelFkr')}</div>
                <div>{t('osv.levelSpetsifika')}</div>
                <div>{t('osv.levelFundingSource')}</div>
                <div>{t('osv.levelNomenclature')}</div>
                <div>{t('osv.levelIndividuals')}</div>
              </div>
            </th>
            <th rowSpan={2} className={`${thBase} text-left`}>
              {t('osv.accountName')}
            </th>
            <th rowSpan={2} className={`${thBase} text-left`}>
              {t('osv.indicators')}
            </th>
            <th colSpan={2} className={`${thBase} border-l border-ui-04 text-center`}>
              {t('osv.openingBalance')}
            </th>
            <th colSpan={2} className={`${thBase} border-l border-ui-04 text-center`}>
              {t('osv.turnovers')}
            </th>
            <th colSpan={2} className={`${thBase} border-l border-ui-04 text-center`}>
              {t('osv.closingBalance')}
            </th>
          </tr>
          {/* Уровень 2 — Дебет/Кредит внутри каждой группы. */}
          <tr>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <th
                key={i}
                className={`${thBase} text-right normal-case ${groupBorder(i)}`}
              >
                {i % 2 === 0 ? t('osv.debit') : t('osv.credit')}
              </th>
            ))}
          </tr>
        </thead>
        {table.getRowModel().rows.map((row) => {
          const isAccount = row.depth === 0
          // Строка-счёт — выделена фоном и жирным, как в 1С; дочерние узлы —
          // лёгкий фон по глубине для читаемой иерархии.
          const rowBg = isAccount ? 'bg-ui-02' : 'bg-ui-01'
          const bold = isAccount
          // Каждая запись — отдельный <tbody class="group">, чтобы при наведении
          // подсвечивались ОБЕ строки показателя (Сумма + Кол.) разом, как в 1С.
          return (
            <tbody
              key={row.id}
              className={`group ${onRowDoubleClick ? 'cursor-pointer' : ''}`}
              onDoubleClick={(e) => onRowDoubleClick?.(row, e)}
            >
              {/* Строка показателя «Сумма» */}
                <tr className={`border-t border-ui-04/60 ${rowBg} group-hover:bg-ui-07`}>
                  <td
                    rowSpan={showQuantity ? 2 : 1}
                    className="overflow-hidden whitespace-nowrap px-3 py-1.5 align-top"
                  >
                    {renderAccountCell(row)}
                  </td>
                  {/* Иерархия передаётся отступом наименования по глубине дерева
                      (как в 1С), при выровненных стрелках в колонке «Счёт». */}
                  <td
                    rowSpan={showQuantity ? 2 : 1}
                    className="cell-wrap py-1.5 pr-3 align-top"
                    style={{ paddingLeft: 12 + row.depth * 18 }}
                  >
                    {row.depth > 0 ? (
                      <DimensionNameCell node={row.original} />
                    ) : (
                      <Typography variant="body2" noWrap className="font-bold text-ui-06">
                        {row.original.accountNameRu ?? row.original.accountCode ?? ''}
                      </Typography>
                    )}
                  </td>
                  <td className={tdValue}>
                    <Typography variant="body2" noWrap className="text-ui-05">
                      {t('osv.sum')}
                    </Typography>
                  </td>
                  {SUM_FIELDS.map((f, i) => (
                    <td key={f} className={`${tdValue} ${groupBorder(i)}`}>
                      <ValueCell v={row.original[f]} bold={bold} />
                    </td>
                  ))}
                </tr>
                {/* Строка показателя «Кол.» */}
                {showQuantity && (
                  <tr className={`${rowBg} group-hover:bg-ui-07`}>
                    <td className={tdValue}>
                      <Typography variant="body2" noWrap className="text-ui-05">
                        {t('osv.quantity')}
                      </Typography>
                    </td>
                    {QTY_FIELDS.map((f, i) => (
                      <td key={f} className={`${tdValue} ${groupBorder(i)}`}>
                        <ValueCell v={row.original[f]} bold={bold} />
                      </td>
                    ))}
                  </tr>
                )}
            </tbody>
          )
        })}
        {total && (
          <tfoot className="bg-ui-02 font-bold">
            <tr className="border-t-2 border-ui-03">
              <td
                rowSpan={showQuantity ? 2 : 1}
                colSpan={2}
                className="overflow-hidden whitespace-nowrap px-3 py-1.5 align-top"
              >
                <Typography variant="body2" className="font-bold text-ui-06">
                  {t('osv.total')}
                </Typography>
              </td>
              <td className={tdValue}>
                <Typography variant="body2" noWrap className="text-ui-05">
                  {t('osv.sum')}
                </Typography>
              </td>
              {SUM_FIELDS.map((f, i) => (
                <td key={f} className={`${tdValue} ${groupBorder(i)}`}>
                  <ValueCell v={total[f]} bold />
                </td>
              ))}
            </tr>
            {showQuantity && (
              <tr>
                <td className={tdValue}>
                  <Typography variant="body2" noWrap className="text-ui-05">
                    {t('osv.quantity')}
                  </Typography>
                </td>
                {QTY_FIELDS.map((f, i) => (
                  <td key={f} className={`${tdValue} ${groupBorder(i)}`}>
                    <ValueCell v={total[f]} bold />
                  </td>
                ))}
              </tr>
            )}
          </tfoot>
        )}
        </table>
      </div>
    </div>
  )
}
