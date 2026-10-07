import {
  useCallback,
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
import { cssZoomOf } from '@/shared/lib/utils/css-zoom'

import {
  GREEN_1C,
  HEAD_FS,
  isHighlightRow,
  isNumericCell,
  isRightAligned,
  isSpanRow,
  resolveReportLang,
} from '../lib/cell-helpers'
import {
  columnContentWidths,
  headWordWidths,
} from '../lib/column-content-widths'
import { fitColumnWidths } from '../lib/fit-column-widths'
import {
  buildHeadModel,
  buildPathHeadModel,
  hasHeaderPath,
} from '../lib/head-model'
import { HeadTitle } from './head-title'
import { ReportCell } from './report-cell'

interface LedgerTableProps {
  result: ReportResultDto
  columns: ReportColumnDto[]
  /**
   * Двойной клик по строке данных (rowKind DATA) — открыть документ-регистратор
   * (drill-down, как в 1С). Вызывается только для строк с `groupRefId`
   * (id записи документа с бэка); навигацию выполняет страница.
   */
  onOpenDocument?: (row: ReportRowDto) => void
  /**
   * Серверная расшифровка строки (SCRUM-370 блок В): двойной клик по строке
   * данных с `rowRef`. Если переданы оба колбэка — приоритет у onDrilldown
   * (`onOpenDocument` остаётся клиентской расшифровкой старого контура по
   * `groupRefId` и не трогается).
   */
  onDrilldown?: (row: ReportRowDto) => void
  fillScrollArea?: boolean
}

const MIN_COL_WIDTH = 40

const scrollAreaOf = (el: HTMLElement | null): HTMLElement | null => {
  for (let node = el; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

const innerHeightOf = (el: HTMLElement): number => {
  const style = getComputedStyle(el)
  return (
    el.clientHeight -
    (parseFloat(style.paddingTop) || 0) -
    (parseFloat(style.paddingBottom) || 0)
  )
}

/** Ширина одного символа колонки (`width` приходит в символах, как в 1С). */
const CHAR_PX = 8

/** Код колонки «Показатель» — её значения задают подписи подстрок (Сумма/Кол.). */
const POKAZATEL_COL = 'Pokazatel'

/** Сетка 1С: тонкие серые линии, плотные ячейки, вертикаль по верху. */
const td = 'border border-pending-gray-1 px-1.5 py-0.5 align-top'
const th = 'overflow-hidden border border-pending-gray-1 px-1.5 py-1 text-left'
const thNumber =
  'overflow-hidden border border-pending-gray-1 px-1.5 py-0.5 text-center'

/** Стиль текста шапки колонок 1С: жирный тёмно-зелёный, 13px, без капса. */
const thTextSx = { color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/**
 * «Логическая» ширина колонки: приоритет — ширина из backend (`width` в
 * символах × CHAR_PX, как в бланке); при её отсутствии — дефолт по
 * роли/семейству (аналитика широкая, период и документ средние, числа узкие).
 * Ширины ужимаются при переполнении (auto-fit), но не растягиваются.
 */
const logicalWidth = (col: ReportColumnDto): number => {
  if (col.width != null) return col.width * CHAR_PX
  if (isNumericCell(col)) return 110
  if (col.groupTitleRu) return 60 // подколонка «Счет» под Дебет/Кредит — узкая
  switch (col.role) {
    case 'PERIOD':
      return 90
    case 'DIMENSION':
      return 210
    case 'ATTRIBUTE':
      return col.code === POKAZATEL_COL ? 70 : 170
    default:
      return 150
  }
}

/**
 * LEDGER-таблица (плоский регистр «как в 1С»): ручной рендер с серой сеткой,
 * ресайзом колонок и auto-fit на ширину страницы. Строки-итоги — жирные
 * тёмно-зелёные без заливки (как в живом 1С). Span-строки (с labelText)
 * рисуют подпись на первые `labelColSpan` колонок; выделенные строки без
 * labelText (напр. «Начальное сальдо» Анализа счёта) — обычные ячейки
 * с 1С-выделением.
 */
export const LedgerTable = ({
  result,
  columns,
  onOpenDocument,
  onDrilldown,
  fillScrollArea = false,
}: LedgerTableProps) => {
  const { t, i18n } = useTranslation()
  // Язык рендера = язык отчёта (result.language), иначе — язык приложения.
  const isKz = resolveReportLang(result.language, i18n.language) === 'kz'

  const headWidths = useMemo(
    () => headWordWidths(columns, (c) => columnTitle(c, isKz)),
    [columns, isKz]
  )

  const defaultWidths = useMemo(
    () =>
      columns.map((c, i) =>
        c.width != null
          ? logicalWidth(c)
          : Math.max(logicalWidth(c), headWidths[i])
      ),
    [columns, headWidths]
  )

  const contentWidths = useMemo(
    () => columnContentWidths(columns, result.rows, headWidths),
    [columns, result.rows, headWidths]
  )

  const [colWidths, setColWidths] = useState<number[]>(defaultWidths)
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fitDoneRef = useRef(false)
  const manualResizeRef = useRef(false)
  const scrollRatioRef = useRef<number | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (!fillScrollArea) {
      setMaxHeight(undefined)
      return
    }
    const area = scrollAreaOf(containerRef.current?.parentElement ?? null)
    if (!area) return
    const update = () => {
      const height = innerHeightOf(area)
      if (height > 0) setMaxHeight(height)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(area)
    return () => {
      observer.disconnect()
    }
  }, [fillScrollArea])

  // Сбрасываем ширины и флаг auto-fit при смене набора колонок.
  useLayoutEffect(() => {
    fitDoneRef.current = false
    manualResizeRef.current = false
    setColWidths(defaultWidths)
  }, [defaultWidths])

  const fitWidths = useCallback(
    (el: HTMLElement): number[] | null => {
      const avail = el.clientWidth - 2
      if (avail <= 0) return null
      const sum = defaultWidths.reduce((a, b) => a + b, 0)
      if (sum <= 0) return null
      return fitColumnWidths(
        defaultWidths,
        columns.map((c) => c.width != null),
        avail,
        contentWidths.map((w) => Math.max(MIN_COL_WIDTH, w))
      )
    },
    [defaultWidths, columns, contentWidths]
  )

  // При первом показе ужимаем колонки под ширину контейнера ТОЛЬКО при
  // переполнении (scale ≤ 1); если натуральная ширина влезает — оставляем её,
  // чтобы таблица не растягивалась на весь экран (как в 1С).
  useLayoutEffect(() => {
    if (fitDoneRef.current || columns.length === 0) return
    const el = containerRef.current
    if (!el) return
    const next = fitWidths(el)
    if (!next) return
    fitDoneRef.current = true
    setColWidths(next)
  }, [columns.length, fitWidths])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastWidth = el.offsetWidth
    const observer = new ResizeObserver(() => {
      const width = el.offsetWidth
      if (width === lastWidth) return
      lastWidth = width
      if (!fitDoneRef.current || manualResizeRef.current) return
      const next = fitWidths(el)
      if (!next) return
      const maxScroll = el.scrollWidth - el.clientWidth
      scrollRatioRef.current = maxScroll > 0 ? el.scrollLeft / maxScroll : 0
      setColWidths(next)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [fitWidths, result.rows.length])

  useLayoutEffect(() => {
    const el = containerRef.current
    const ratio = scrollRatioRef.current
    if (!el || ratio == null) return
    scrollRatioRef.current = null
    el.scrollLeft = ratio * Math.max(0, el.scrollWidth - el.clientWidth)
  }, [colWidths])

  const startResize = (index: number, e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[index]
    const zoom = cssZoomOf(containerRef.current)
    manualResizeRef.current = true
    setResizingCol(index)
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom
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
    manualResizeRef.current = true
    setColWidths((prev) => {
      const next = [...prev]
      next[index] = defaultWidths[index]
      return next
    })
  }

  // Многоуровневая шапка: соседние колонки с одинаковым groupTitle → группа
  // (colspan) с подколонками ниже; при subGroupTitle — средний ряд подгрупп;
  // без groupTitle — rowspan на всю высоту шапки.
  // Разбор склейки « — » НЕ применяется (историческое поведение LEDGER).
  const headModel = useMemo(() => {
    const model = buildHeadModel(columns, { isKz, levels: 'auto' })
    return model.levels > 1
      ? {
          topRow: model.topRow,
          midRow: model.midRow,
          subRow: model.leafRow,
        }
      : null
  }, [columns, isKz])

  const pathModel = useMemo(
    () =>
      hasHeaderPath(columns) ? buildPathHeadModel(columns, { isKz }) : null,
    [columns, isKz]
  )

  const hasColumnNumbers = columns.some((c) => !!c.columnNumber)

  if (result.rows.length === 0 && !result.showEmptyTable) {
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

  /** Подписи подстрок-показателей строки (значение колонки «Показатель»). */
  const rowSubLabels = (row: ReportRowDto): string[] | undefined => {
    const v = row.cells[POKAZATEL_COL]
    return Array.isArray(v) ? v.map((x) => String(x)) : undefined
  }

  /** Рендер одной строки по ячейкам; highlight ⇒ 1С-выделение всех ячеек.
   *  Строка данных (rowKind DATA) с `groupRefId` — двойной клик открывает
   *  документ-регистратор (drill-down, как в 1С). */
  const renderCellsRow = (
    row: ReportRowDto,
    key: string,
    highlight: boolean
  ) => {
    const isDataRow = (row.rowKind ?? 'DATA') === 'DATA'
    // SCRUM-370 блок В: серверная расшифровка (rowRef) приоритетнее клиентской
    // (groupRefId). Строка без rowRef при onDrilldown-режиме не кликабельна.
    const canDrilldown = isDataRow && row.rowRef != null && onDrilldown != null
    const canOpen =
      !onDrilldown &&
      isDataRow &&
      row.groupRefId != null &&
      onOpenDocument != null
    const openRow = canDrilldown ? onDrilldown : canOpen ? onOpenDocument : null
    return (
      <tr
        key={key}
        className={
          highlight
            ? ''
            : `transition-colors hover:bg-ui-07 ${openRow ? 'cursor-pointer' : ''}`
        }
        onDoubleClick={
          openRow
            ? () => {
                // Двойной клик выделяет текст ячейки — снимаем выделение.
                window.getSelection()?.removeAllRanges()
                openRow(row)
              }
            : undefined
        }
      >
        {columns.map((col) => {
          const asLink =
            openRow != null &&
            result.rowRefColumn === col.code &&
            row.rowRef != null &&
            row.cells[col.code] !== '' &&
            row.cells[col.code] != null
          return (
            <td
              key={col.code}
              className={`${td} ${isRightAligned(col) ? 'text-right' : ''}`}
            >
              {asLink ? (
                <button
                  type="button"
                  className="cursor-pointer text-left text-accent-02 underline"
                  onClick={() => {
                    openRow(row)
                  }}
                >
                  <ReportCell
                    value={row.cells[col.code]}
                    col={col}
                    bold={highlight}
                    subLabels={rowSubLabels(row)}
                  />
                </button>
              ) : (
                <ReportCell
                  value={row.cells[col.code]}
                  col={col}
                  bold={highlight}
                  subLabels={rowSubLabels(row)}
                />
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  /**
   * Рендер span-строки: подпись `labelText` на первые `labelColSpan` колонок,
   * затем значения в остальных. Жирный тёмно-зелёный текст, без заливки (1С).
   */
  const renderSpanRow = (row: ReportRowDto, key: string) => {
    const span = Math.min(row.labelColSpan ?? 1, columns.length)
    return (
      <tr key={key}>
        {span > 0 && (
          <td className={td} colSpan={span}>
            <Typography
              variant="body2"
              sx={{
                color: GREEN_1C,
                fontWeight: 700,
                fontSize: HEAD_FS,
              }}
            >
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
              bold
              subLabels={rowSubLabels(row)}
            />
          </td>
        ))}
      </tr>
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-md border border-pending-gray-1"
      style={maxHeight != null ? { maxHeight } : undefined}
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
                  : 'bg-transparent group-hover:bg-accent-02'
              }`}
            />
          </div>
        ))}
        <table className="w-full table-fixed border-collapse bg-white">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            {pathModel ? (
              pathModel.rows.map((cells, level) => (
                <tr key={`path-row-${String(level)}`}>
                  {cells.map((cell) => (
                    <th
                      key={cell.key}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className={`${th} ${
                        cell.vertical
                          ? 'text-center align-bottom'
                          : cell.colSpan > 1
                            ? 'text-center'
                            : ''
                      }`}
                    >
                      <HeadTitle title={cell.title} vertical={cell.vertical} />
                    </th>
                  ))}
                </tr>
              ))
            ) : headModel ? (
              <>
                <tr>
                  {headModel.topRow.map((cell) => (
                    <th
                      key={cell.key}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className={`${th} ${cell.colSpan > 1 ? 'text-center' : ''}`}
                    >
                      <Typography variant="body2" sx={thTextSx}>
                        {cell.title}
                      </Typography>
                    </th>
                  ))}
                </tr>
                {headModel.midRow.length > 0 && (
                  <tr>
                    {headModel.midRow.map((cell) => (
                      <th
                        key={cell.key}
                        colSpan={cell.colSpan}
                        rowSpan={cell.rowSpan}
                        className={`${th} ${cell.colSpan > 1 ? 'text-center' : ''}`}
                      >
                        <Typography variant="body2" sx={thTextSx}>
                          {cell.title}
                        </Typography>
                      </th>
                    ))}
                  </tr>
                )}
                <tr>
                  {headModel.subRow.map(({ key, col }) => (
                    <th key={key} className={th}>
                      <Typography variant="body2" sx={thTextSx}>
                        {columnTitle(col, isKz)}
                      </Typography>
                    </th>
                  ))}
                </tr>
              </>
            ) : (
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.code}
                    className={`${th} ${isRightAligned(col) ? 'text-right' : ''}`}
                  >
                    <Typography variant="body2" sx={thTextSx}>
                      {columnTitle(col, isKz)}
                    </Typography>
                  </th>
                ))}
              </tr>
            )}
            {hasColumnNumbers && (
              <tr data-testid="report-column-numbers">
                {columns.map((col) => (
                  <th key={col.code} className={thNumber}>
                    <Typography variant="body2" sx={thTextSx}>
                      {col.columnNumber ?? ''}
                    </Typography>
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {result.rows.map((row, idx) => {
              const key = String(idx)
              return isSpanRow(row)
                ? renderSpanRow(row, key)
                : renderCellsRow(row, key, isHighlightRow(row.rowKind))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
