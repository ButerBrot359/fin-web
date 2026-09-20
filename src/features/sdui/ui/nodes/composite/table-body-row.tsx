import { useEffect, useRef, type FC, type MouseEvent } from 'react'
import { TableCell, TableRow as MuiTableRow, Typography } from '@mui/material'
import { flexRender, type Row } from '@tanstack/react-table'

import type { RowAppearanceRule } from '../../../types/view'
import type { TableRow } from '../../../lib/hooks/use-table-sync'
import {
  isSearchHit,
  type TableSearchMatch,
} from '../../../lib/hooks/use-table-search'
import { palette, cssVar } from '@/shared/design/tokens'

import { resolveRowBackground } from '../../../lib/utils/row-appearance'
import { ROW_ERROR_BACKGROUND } from '../../../lib/validation/table-row-errors'
import { SearchHitCell } from './table-search-cell'

interface TableBodyRowProps {
  row: Row<TableRow>
  selected: boolean
  onRowClick: (event: MouseEvent) => void
  onRowDoubleClick: (event: MouseEvent) => void
  /** Строка адресована серверной 422-ошибкой — заливка поверх условной. */
  rowError?: boolean
  showRowNumbers: boolean
  /** Правила условной заливки строк (row-appearance.ts). */
  rowAppearance: RowAppearanceRule[]
  /** Постоянная заливка колонок (column-background.ts) по id колонки. */
  columnBackgrounds: Map<string, string>
  /** Текущее совпадение поиска по ТЧ (подсветка ячейки). */
  searchCurrent: TableSearchMatch | null
  isVirtualized: boolean
  /** Замер высоты строки виртуализатором; undefined без виртуализации. */
  measureRow: ((node: HTMLTableRowElement | null) => void) | undefined
  /** complex: маркер строки для автофокуса SCRUM-363 (`data-sdui-row-id`). */
  sduiRowId?: string
  /** complex: единая высота строки master-detail пары (SCRUM-282 #3). */
  rowHeight?: number
}

/**
 * Строка тела редактируемой ТЧ — общая для EditableTable и
 * ComplexEditableTable (разметка была дословно одинакова, различия — в
 * опциональных props).
 */
/**
 * Интерактивные элементы ячейки: на них первый клик по НЕвыделенной строке гасится, чтобы
 * сработало выделение, а не сразу правка. Ячейка-ссылка (порт {@code CellHyperlink} 1С)
 * исключена намеренно — она по эталону открывается одним кликом.
 */
const REDAKTIRUEMOE =
  'input, textarea, button, [contenteditable="true"], [role="combobox"]'

/**
 * Текущая строка ТЧ. Дефолт MUI (`Mui-selected` — primary на 8% прозрачности) на
 * зебре списка почти не читался: «границы и цвет выделенной строки практически не
 * отличаются от остальных строк» (тестировщик, 20.09.2026). В 1С текущая строка
 * залита сплошным цветом и отбита слева маркером, поэтому видно её сразу.
 */
const VYDELENNAYA_STROKA_FON = cssVar(palette.ui08)
const VYDELENNAYA_STROKA_MARKER = cssVar(palette.accent02)

/** Контейнер таблицы, который слушает хоткеи (стрелки, Insert, Delete, F9). */
const KONTEYNER_KLAVIATURY = '[data-sdui-table-keyboard="true"]'

export const TableBodyRow: FC<TableBodyRowProps> = ({
  row,
  selected,
  onRowClick,
  onRowDoubleClick,
  rowError,
  showRowNumbers,
  rowAppearance,
  columnBackgrounds,
  searchCurrent,
  isVirtualized,
  measureRow,
  sduiRowId,
  rowHeight,
}) => {
  const strokaRef = useRef<HTMLTableRowElement | null>(null)

  // Текущая строка всегда видна: стрелками ↑/↓ выделение уходит за нижнюю кромку
  // прокрутки, и без доводки таблица выглядела «не реагирующей» на клавиши —
  // приходилось догонять колесом мыши (обращение 20.09.2026 по доверенности).
  // block: 'nearest' — строка уже в кадре ничего не двигает.
  useEffect(() => {
    const stroka = strokaRef.current
    // typeof — jsdom метода не реализует, а падать в тестах компоненту незачем.
    if (selected && typeof stroka?.scrollIntoView === 'function') {
      stroka.scrollIntoView({ block: 'nearest' })
    }
  }, [selected])

  const privyazatRef = (node: HTMLTableRowElement | null) => {
    strokaRef.current = node
    measureRow?.(node)
  }

  return (
    <MuiTableRow
      hover
      data-index={isVirtualized ? row.index : undefined}
      {...(sduiRowId !== undefined ? { 'data-sdui-row-id': sduiRowId } : {})}
      data-sdui-row-index={row.index}
      ref={privyazatRef}
      selected={selected}
      onClick={onRowClick}
      // Первый клик по строке делает её текущей, и только второй открывает ячейку на правку —
      // так ведёт себя таблица 1С. До этого ячейка становилась редактируемой сразу: клик по
      // ТМЗ вместо выделения строки открывал выбор другого ТМЗ (обращение 20.09.2026).
      // Гасим ТОЛЬКО фокус (preventDefault на mousedown) — сам клик доходит до onClick и
      // выделяет строку.
      onMouseDownCapture={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (target.closest('[data-sdui-cell-hyperlink="true"]')) return
        const vRedaktiruemom = target.closest(REDAKTIRUEMOE) !== null
        if (!selected && vRedaktiruemom) event.preventDefault()
        // Фокус уходит контейнеру таблицы, иначе хоткеи (стрелки, Insert, Delete)
        // не доходят: гашение фокуса выше оставляло его на body, и клавиатура по
        // строкам не работала вовсе.
        if (!vRedaktiruemom || !selected) {
          const konteyner = target.closest(KONTEYNER_KLAVIATURY)
          if (konteyner instanceof HTMLElement) konteyner.focus()
        }
      }}
      onDoubleClick={onRowDoubleClick}
      // Заливка идёт ПРОСТЫМ `backgroundColor` в sx — у выделения и ховера MUI
      // селекторы с классом-модификатором (`.MuiTableRow-root.Mui-selected`),
      // они специфичнее и остаются видимыми поверх условного фона. Иначе
      // выделенная зелёная строка была бы неотличима от невыделенной.
      sx={{
        cursor: 'pointer',
        '&.MuiTableRow-root.Mui-selected': {
          backgroundColor: VYDELENNAYA_STROKA_FON,
        },
        '&.MuiTableRow-root.Mui-selected:hover': {
          backgroundColor: VYDELENNAYA_STROKA_FON,
        },
        '&.MuiTableRow-root.Mui-selected > td:first-of-type': {
          boxShadow: `inset 3px 0 0 ${VYDELENNAYA_STROKA_MARKER}`,
        },
        ...(rowHeight !== undefined ? { height: rowHeight } : {}),
        backgroundColor: rowError
          ? ROW_ERROR_BACKGROUND
          : resolveRowBackground(rowAppearance, row.original),
      }}
    >
      {showRowNumbers && (
        <TableCell sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}>
          <Typography variant="body2" color="text.secondary">
            {row.index + 1}
          </Typography>
        </TableCell>
      )}
      {row.getVisibleCells().map((cell) => (
        <SearchHitCell
          key={cell.id}
          columnId={cell.column.id}
          isHit={isSearchHit(searchCurrent, row.original.rowId, cell.column.id)}
          backgroundColor={
            // Условная заливка строки перекрывает постоянную заливку колонки —
            // см. column-background.ts.
            resolveRowBackground(rowAppearance, row.original)
              ? undefined
              : columnBackgrounds.get(cell.column.id)
          }
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </SearchHitCell>
      ))}
    </MuiTableRow>
  )
}
