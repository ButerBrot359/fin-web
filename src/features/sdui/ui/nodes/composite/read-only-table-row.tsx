import type { FC } from 'react'
import { TableCell, TableRow } from '@mui/material'

import type { RowAppearanceRule } from '../../../types/view'
import { renderCellValue } from '../../../lib/utils/cell-value'
import type {
  HeaderCell,
  ReadOnlyColumnDef,
} from '../../../lib/utils/read-only-header-model'
import { resolveRowBackground } from '../../../lib/utils/row-appearance'
import { isNoWrapColumn } from '../../../lib/utils/nowrap-columns'
import { ColumnHeaderLabel } from './column-header-label'
import { ColumnResizeHandle } from './column-resize-handle'
import { AuditHistoryCell } from './audit-history-cell'
import type { UseManualColumnResizeResult } from '../../../lib/hooks/use-manual-column-resize'

interface ReadOnlyHeaderCellProps {
  cell: HeaderCell
  /** Показывать ручку ресайза (листовая колонка, ресайз не запрещён). */
  resizable: boolean
  resize: UseManualColumnResizeResult
}

/** Ячейка шапки read-only таблицы (вынесено из read-only-table.tsx). */
export const ReadOnlyHeaderCell: FC<ReadOnlyHeaderCellProps> = ({
  cell,
  resizable,
  resize,
}) => (
  <TableCell
    colSpan={cell.colSpan}
    rowSpan={cell.rowSpan}
    align={cell.align}
    // overflow:hidden — безусловно: обрезка заголовка нужна и без ресайза,
    // иначе подпись шире колонки выходит за её границы. position НЕ трогаем:
    // ячейке шапки его уже задал stickyHeader (`sticky`), и прежний
    // `relative` — якорь ручки ресайза — замещал бы закрепление (та же
    // регрессия, что чинилась в editable-table-head.tsx). Ручке достаточно
    // sticky: это тоже позиционированный элемент.
    sx={{ overflow: 'hidden' }}
  >
    <ColumnHeaderLabel label={cell.label} align={cell.align ?? 'left'} />
    {resizable && (
      <ColumnResizeHandle
        isResizing={resize.resizingColumnId === cell.id}
        onMouseDown={resize.mouseDownHandler(cell.id)}
        onTouchStart={resize.touchStartHandler(cell.id)}
      />
    )}
  </TableCell>
)

interface SimpleTableRow {
  rowId: string
  [key: string]: unknown
}

interface ReadOnlyTableRowProps {
  row: SimpleTableRow
  index: number
  columns: ReadOnlyColumnDef[]
  showRowNumbers: boolean
  rowAppearance: RowAppearanceRule[]
  isResizable: boolean
  /** ТЧ журнала аудита (binding=history): свой рендерер ячейки и вёрстка. */
  isHistory?: boolean
  isVirtualized: boolean
  measureRow: ((node: HTMLTableRowElement | null) => void) | undefined
}

/** Строка данных read-only таблицы (вынесено из read-only-table.tsx). */
export const ReadOnlyTableRow: FC<ReadOnlyTableRowProps> = ({
  row,
  index,
  columns,
  showRowNumbers,
  rowAppearance,
  isResizable,
  isHistory,
  isVirtualized,
  measureRow,
}) => (
  <TableRow
    data-index={isVirtualized ? index : undefined}
    ref={measureRow}
    // Условная заливка строки (см. row-appearance.ts): правило
    // живёт на узле таблицы, признак — в данных строки.
    sx={{
      backgroundColor: resolveRowBackground(rowAppearance, row),
    }}
  >
    {showRowNumbers && <TableCell align="center">{index + 1}</TableCell>}
    {columns.map((col) => (
      <TableCell
        key={col.id}
        // overflowWrap:anywhere — безусловно: ширины колонок
        // фиксированы, и «неразрывное» значение (код, счёт,
        // номер без пробелов) без него не переносится, а при
        // включённом ресайзе ещё и срезается overflow:hidden.
        // Исключение — колонки isNoWrapColumn (шапка ТЧ
        // «Начисления» в эталоне 1С): там перенос раздувает
        // каждую строку, и значение держится в одну строку с
        // многоточием.
        sx={{
          ...(isNoWrapColumn(col.binding ?? '', col.label)
            ? {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }
            : { overflowWrap: 'anywhere' }),
          ...(isResizable ? { overflow: 'hidden' } : {}),
          ...(isHistory
            ? {
                overflowWrap: 'normal',
                wordBreak: 'normal',
                verticalAlign: 'top',
                py: 1.75,
              }
            : {}),
          // Постоянная заливка колонки (column-background.ts).
          // Уступает условной заливке строки: та сообщает о
          // состоянии записи и не должна теряться под фоном.
          ...(resolveRowBackground(rowAppearance, row)
            ? {}
            : { backgroundColor: col.backgroundColor }),
        }}
      >
        {col.binding !== undefined ? (
          isHistory ? (
            <AuditHistoryCell row={row} binding={col.binding} />
          ) : (
            renderCellValue(row[col.binding])
          )
        ) : (
          ''
        )}
      </TableCell>
    ))}
  </TableRow>
)
