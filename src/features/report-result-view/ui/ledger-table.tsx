import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import {
  isMeasure,
  isRightAligned,
  isBoldMoneyRow,
  isSpanRow,
  isStrongSpanRow,
} from '../lib/cell-helpers'
import { ReportCell } from './report-cell'

interface LedgerTableProps {
  result: ReportResultDto
  columns: ReportColumnDto[]
}

const MIN_COL_WIDTH = 60

const td = 'border border-ui-04/60 px-3 py-1.5 align-top'
const th =
  'overflow-hidden whitespace-nowrap border border-ui-04/60 px-3 py-2 text-left text-xs font-semibold uppercase text-ui-06'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/**
 * «Логическая» ширина колонки по роли/семейству: аналитика широкая, период и
 * документ средние, числа узкие. Пропорции масштабируются на ширину страницы
 * (auto-fit), как в карточке счёта.
 */
const logicalWidth = (col: ReportColumnDto): number => {
  if (isMeasure(col)) return 120
  switch (col.role) {
    case 'PERIOD':
      return 150
    case 'DIMENSION':
      return 220
    case 'ATTRIBUTE':
      return 190
    default:
      return 160
  }
}

/**
 * LEDGER-таблица (плоский регистр «как в 1С»): ручной рендер с grid-границами,
 * ресайзом колонок (как Excel) и auto-fit на ширину страницы. Span-строки
 * (Сальдо/Обороты/Итого) рисуют подпись на первые `labelColSpan` колонок и
 * значения в остальных; DATA-строки — обычные. Порт из account-card-table.
 */
export const LedgerTable = ({ result, columns }: LedgerTableProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'

  const defaultWidths = useMemo(
    () => columns.map((c) => logicalWidth(c)),
    [columns]
  )

  const [colWidths, setColWidths] = useState<number[]>(defaultWidths)
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fitDoneRef = useRef(false)

  // Сбрасываем ширины и флаг auto-fit при смене набора колонок.
  useLayoutEffect(() => {
    fitDoneRef.current = false
    setColWidths(defaultWidths)
  }, [defaultWidths])

  // При первом показе вписываем колонки на всю ширину, сохраняя пропорции.
  useLayoutEffect(() => {
    if (fitDoneRef.current || columns.length === 0) return
    const el = containerRef.current
    if (!el) return
    const avail = el.clientWidth - 2
    if (avail <= 0) return
    const sum = defaultWidths.reduce((a, b) => a + b, 0)
    if (sum <= 0) return
    const scale = avail / sum
    fitDoneRef.current = true
    setColWidths(
      defaultWidths.map((w) => Math.max(MIN_COL_WIDTH, Math.round(w * scale)))
    )
  }, [defaultWidths, columns.length])

  const startResize = (index: number, e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[index]
    setResizingCol(index)
    // eslint-disable-next-line react-hooks/immutability
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
      next[index] = defaultWidths[index]
      return next
    })
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Typography variant="body2" className="text-ui-05">
          {t('reports.noData')}
        </Typography>
      </div>
    )
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  // Правые границы колонок (x в px) — для разделителей-ручек на всю высоту.
  const boundaries = colWidths.map((_, i) =>
    colWidths.slice(0, i + 1).reduce((a, b) => a + b, 0)
  )

  /** Рендер одной DATA-строки: значение в каждой колонке по её метаданным. */
  const renderDataRow = (row: ReportRowDto, key: string) => (
    <tr key={key} className="transition-colors hover:bg-ui-07">
      {columns.map((col) => (
        <td
          key={col.code}
          className={`${td} ${isRightAligned(col) ? 'text-right' : ''}`}
        >
          <ReportCell value={row.cells[col.code]} col={col} />
        </td>
      ))}
    </tr>
  )

  /**
   * Рендер span-строки: подпись `labelText` на первые `labelColSpan` колонок
   * (затенённый фон, жирный для сальдо-конец/итог), затем значения в остальных.
   */
  const renderSpanRow = (row: ReportRowDto, key: string) => {
    const span = Math.min(row.labelColSpan ?? 1, columns.length)
    const strong = isStrongSpanRow(row.rowKind)
    const rowClass = strong ? 'bg-ui-02 font-bold' : 'bg-ui-02 font-medium'
    const labelClass = strong
      ? 'font-bold text-ui-06'
      : 'font-medium text-ui-06'
    const boldMoney = isBoldMoneyRow(row.rowKind)
    return (
      <tr key={key} className={rowClass}>
        {span > 0 && (
          <td className={td} colSpan={span}>
            <Typography variant="body2" className={labelClass}>
              {row.labelText ?? ''}
            </Typography>
          </td>
        )}
        {columns.slice(span).map((col) => (
          <td
            key={col.code}
            className={`${td} ${isRightAligned(col) ? 'text-right' : ''}`}
          >
            <ReportCell
              value={row.cells[col.code]}
              col={col}
              bold={boldMoney}
            />
          </td>
        ))}
      </tr>
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-md border border-ui-04/60"
    >
      {/* relative-обёртка: поверх таблицы — разделители-ручки на всю высоту. */}
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
            title={t('reports.resizeHint')}
            style={{ left: x - 4 }}
            className="group absolute inset-y-0 z-20 flex w-2 cursor-col-resize touch-none select-none justify-center"
          >
            <div
              className={`h-full w-px ${
                resizingCol === i
                  ? 'bg-accent-02'
                  : 'bg-ui-04/40 group-hover:bg-accent-02'
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
            <tr>
              {columns.map((col) => (
                <th
                  key={col.code}
                  className={`${th} ${isRightAligned(col) ? 'text-right' : ''}`}
                >
                  {columnTitle(col, isKz)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, idx) => {
              const key = String(idx)
              return isSpanRow(row.rowKind)
                ? renderSpanRow(row, key)
                : renderDataRow(row, key)
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
