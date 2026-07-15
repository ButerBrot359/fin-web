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
  GREEN_1C,
  HEAD_FS,
  isHighlightRow,
  isMeasure,
  isRightAligned,
  isSpanRow,
  resolveReportLang,
} from '../lib/cell-helpers'
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
}

const MIN_COL_WIDTH = 40

/** Ширина одного символа колонки (`width` приходит в символах, как в 1С). */
const CHAR_PX = 8

/** Код колонки «Показатель» — её значения задают подписи подстрок (Сумма/Кол.). */
const POKAZATEL_COL = 'Pokazatel'

/** Сетка 1С: тонкие серые линии, плотные ячейки, вертикаль по верху. */
const td = 'border border-[#d9d9d9] px-1.5 py-0.5 align-top'
const th = 'overflow-hidden border border-[#d9d9d9] px-1.5 py-1 text-left'

/** Стиль текста шапки колонок 1С: жирный тёмно-зелёный, 13px, без капса. */
const thTextSx = { color: GREEN_1C, fontWeight: 700, fontSize: HEAD_FS }

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Локализованный верхний ряд шапки (группа колонок «Дебет»/«Кредит»). */
const columnGroupTitle = (col: ReportColumnDto, isKz: boolean): string =>
  ((isKz ? col.groupTitleKz : col.groupTitleRu) || col.groupTitleRu) ?? ''

/** Ячейка верхнего ряда двухуровневой шапки: либо группа colspan, либо rowspan. */
interface HeadCell {
  key: string
  title: string
  colSpan: number
  rowSpan: number
  col?: ReportColumnDto
}

/**
 * Модель двухуровневой шапки: соседние колонки с одинаковым groupTitle
 * объединяются в группу (colspan) с подколонками во втором ряду; колонки
 * без groupTitle занимают оба ряда (rowspan=2). Если групп нет вообще —
 * шапка одноуровневая.
 */
const buildHeadModel = (columns: ReportColumnDto[], isKz: boolean) => {
  const hasGroups = columns.some((c) => columnGroupTitle(c, isKz))
  if (!hasGroups) return null

  const topRow: HeadCell[] = []
  const subRow: { key: string; col: ReportColumnDto }[] = []
  let i = 0
  while (i < columns.length) {
    const col = columns[i]
    const group = columnGroupTitle(col, isKz)
    if (!group) {
      topRow.push({
        key: col.code,
        title: columnTitle(col, isKz),
        colSpan: 1,
        rowSpan: 2,
        col,
      })
      i++
      continue
    }
    let j = i
    while (j < columns.length && columnGroupTitle(columns[j], isKz) === group) {
      subRow.push({ key: columns[j].code, col: columns[j] })
      j++
    }
    topRow.push({
      key: `grp-${col.code}`,
      title: group,
      colSpan: j - i,
      rowSpan: 1,
    })
    i = j
  }
  return { topRow, subRow }
}

/**
 * «Логическая» ширина колонки: приоритет — ширина из backend (`width` в
 * символах × CHAR_PX, как в бланке); при её отсутствии — дефолт по
 * роли/семейству (аналитика широкая, период и документ средние, числа узкие).
 * Ширины ужимаются при переполнении (auto-fit), но не растягиваются.
 */
const logicalWidth = (col: ReportColumnDto): number => {
  if (col.width != null) return col.width * CHAR_PX
  if (isMeasure(col)) return 110
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
}: LedgerTableProps) => {
  const { t, i18n } = useTranslation()
  // Язык рендера = язык отчёта (result.language), иначе — язык приложения.
  const isKz = resolveReportLang(result.language, i18n.language) === 'kz'

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

  // При первом показе ужимаем колонки под ширину контейнера ТОЛЬКО при
  // переполнении (scale ≤ 1); если натуральная ширина влезает — оставляем её,
  // чтобы таблица не растягивалась на весь экран (как в 1С).
  useLayoutEffect(() => {
    if (fitDoneRef.current || columns.length === 0) return
    const el = containerRef.current
    if (!el) return
    const avail = el.clientWidth - 2
    if (avail <= 0) return
    const sum = defaultWidths.reduce((a, b) => a + b, 0)
    if (sum <= 0) return
    const scale = Math.min(1, avail / sum)
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

  const headModel = useMemo(
    () => buildHeadModel(columns, isKz),
    [columns, isKz]
  )

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
    const canOpen =
      isDataRow && row.groupRefId != null && onOpenDocument != null
    return (
      <tr
        key={key}
        className={
          highlight
            ? ''
            : `transition-colors hover:bg-ui-07 ${canOpen ? 'cursor-pointer' : ''}`
        }
        onDoubleClick={
          canOpen
            ? () => {
                // Двойной клик выделяет текст ячейки — снимаем выделение.
                window.getSelection()?.removeAllRanges()
                onOpenDocument(row)
              }
            : undefined
        }
      >
        {columns.map((col) => (
          <td
            key={col.code}
            className={`${td} ${isRightAligned(col) ? 'text-right' : ''}`}
          >
            <ReportCell
              value={row.cells[col.code]}
              col={col}
              bold={highlight}
              subLabels={rowSubLabels(row)}
            />
          </td>
        ))}
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
      className="overflow-auto rounded-md border border-[#d9d9d9]"
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
            {headModel ? (
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
