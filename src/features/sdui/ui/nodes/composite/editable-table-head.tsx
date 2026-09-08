import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { TableCell, TableHead, TableRow as MuiTableRow } from '@mui/material'
import { flexRender, type Table } from '@tanstack/react-table'

import type { TableRow } from '../../../lib/hooks/use-table-sync'
import { ColumnResizeHandle } from './column-resize-handle'
import { ROW_NUMBER_WIDTH } from './table-sizing-colgroup'

interface EditableTableHeadProps {
  table: Table<TableRow>
  showRowNumbers: boolean
  /** Ресайз разрешён бэком: фиксируем ширины ячеек и рисуем ручки. */
  isResizable: boolean
}

/**
 * Шапка простой (плоской) ТЧ. Вынесена из `editable-table.tsx`, чтобы файл
 * остался в пределах лимита строк после добавления ресайза.
 */
export const EditableTableHead: FC<EditableTableHeadProps> = ({
  table,
  showRowNumbers,
  isResizable,
}) => {
  const { t } = useTranslation()

  return (
    <TableHead>
      {table.getHeaderGroups().map((hg) => (
        <MuiTableRow key={hg.id}>
          {showRowNumbers && (
            <TableCell
              sx={{
                width: ROW_NUMBER_WIDTH,
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {t('table.rowNumber')}
            </TableCell>
          )}
          {hg.headers.map((header) => (
            <TableCell
              key={header.id}
              // overflow:hidden — безусловно: подпись шире колонки должна
              // обрезаться и в таблице без ресайза, иначе она выходит за
              // границы ячейки и наезжает на соседний заголовок.
              // position НЕ трогаем: у таблицы включён stickyHeader, и MUI уже
              // ставит ячейкам шапки `position: sticky`. Прежний `relative`
              // (нужен был как якорь для ручки ресайза) ЗАМЕНЯЛ собой sticky —
              // и шапка ТЧ с включённым ресайзом переставала закрепляться, то
              // есть уезжала при прокрутке строк (отказ 08.09.2026). Ручке
              // sticky-ячейки достаточно: она тоже позиционированная и служит
              // содержащим блоком для absolute-элемента (см. ColumnResizeHandle).
              sx={{
                overflow: 'hidden',
                ...(isResizable ? { width: header.getSize() } : {}),
              }}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getCanResize() && (
                <ColumnResizeHandle
                  isResizing={header.column.getIsResizing()}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                />
              )}
            </TableCell>
          ))}
        </MuiTableRow>
      ))}
    </TableHead>
  )
}
