import type { FC, MouseEvent } from 'react'
import { TableCell, TableRow as MuiTableRow, Typography } from '@mui/material'
import { flexRender, type Row } from '@tanstack/react-table'

import type { RowAppearanceRule } from '../../../types/view'
import type { TableRow } from '../../../lib/hooks/use-table-sync'
import {
  isSearchHit,
  type TableSearchMatch,
} from '../../../lib/hooks/use-table-search'
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
}) => (
  <MuiTableRow
    hover
    data-index={isVirtualized ? row.index : undefined}
    {...(sduiRowId !== undefined ? { 'data-sdui-row-id': sduiRowId } : {})}
    data-sdui-row-index={row.index}
    ref={measureRow}
    selected={selected}
    onClick={onRowClick}
    onDoubleClick={onRowDoubleClick}
    // Заливка идёт ПРОСТЫМ `backgroundColor` в sx — у выделения и ховера MUI
    // селекторы с классом-модификатором (`.MuiTableRow-root.Mui-selected`),
    // они специфичнее и остаются видимыми поверх условного фона. Иначе
    // выделенная зелёная строка была бы неотличима от невыделенной.
    sx={{
      cursor: 'pointer',
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
