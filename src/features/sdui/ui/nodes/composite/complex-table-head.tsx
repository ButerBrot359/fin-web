import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { TableCell, TableHead, TableRow as MuiTableRow } from '@mui/material'
import { flexRender, type Table } from '@tanstack/react-table'

import type { TableRow } from '../../../lib/hooks/use-table-sync'
import type { SduiColumnMetaExtra } from '../../../lib/utils/build-column-defs'
import { ColumnResizeHandle } from './column-resize-handle'
import { ROW_NUMBER_WIDTH } from './table-sizing-colgroup'

interface ComplexTableHeadProps {
  table: Table<TableRow>
  showRowNumbers: boolean
  /**
   * Высота первого ряда шапки (use-sticky-head-offset): второй ряд
   * двухуровневой шапки прилипает ПОД ним, а не к top:0.
   */
  headTopOffset: number
  /** Вешается на первый ряд шапки — замер headTopOffset. */
  setFirstHeadRowRef: (row: HTMLTableRowElement | null) => void
}

/**
 * Шапка сложной ТЧ (COLUMN_GROUP, многоуровневые ряды). Вынесена из
 * `complex-editable-table.tsx` по образцу `editable-table-head.tsx`.
 */
export const ComplexTableHead: FC<ComplexTableHeadProps> = ({
  table,
  showRowNumbers,
  headTopOffset,
  setFirstHeadRowRef,
}) => {
  const { t } = useTranslation()

  return (
    <TableHead>
      {table.getHeaderGroups().map((hg, hgIndex) => (
        <MuiTableRow
          key={hg.id}
          ref={hgIndex === 0 ? setFirstHeadRowRef : undefined}
        >
          {showRowNumbers && hgIndex === 0 && (
            <TableCell
              rowSpan={table.getHeaderGroups().length}
              sx={{
                width: ROW_NUMBER_WIDTH,
                textAlign: 'center',
                fontWeight: 600,
                // Дефолтный padding MUI size="small" — 6px 16px, то есть
                // 32px из 48px ширины колонки уходят в отступы и «N»
                // остаётся 16px. Сжимаем, как уже сделано у ячейки тела.
                p: '4px 8px',
              }}
            >
              {t('table.rowNumber')}
            </TableCell>
          )}
          {hg.headers.map((header) => {
            if (header.isPlaceholder) {
              return <TableCell key={header.id} colSpan={header.colSpan} />
            }
            // VERTICAL-группа сама держит сетку под-строк и рисует
            // разделитель во всю ширину — свой padding ячейки сдвинул бы
            // подписи вниз относительно редакторов и обрезал линию.
            const extra = header.column.columnDef.meta as
              | SduiColumnMetaExtra
              | undefined
            // Ручка — только на ЛИСТОВОЙ колонке: групповой заголовок
            // (subHeaders непусты) шириной не владеет, её задают листья.
            const canResizeHere =
              header.subHeaders.length === 0 && header.column.getCanResize()
            return (
              <TableCell
                key={header.id}
                colSpan={header.colSpan}
                // overflow:hidden — безусловно: подпись шире колонки
                // должна обрезаться и без ресайза, иначе она выходит за
                // границы ячейки и наезжает на соседний заголовок.
                // position НЕ трогаем — см. editable-table-head.tsx:
                // `relative` замещал бы `sticky` от stickyHeader, и шапка
                // с включённым ресайзом уезжала бы при прокрутке строк.
                sx={{
                  overflow: 'hidden',
                  // Второй ряд шапки прилипает ПОД первым, а не к top:0.
                  ...(hgIndex > 0 ? { top: headTopOffset } : {}),
                  ...(extra?.verticalGroup ? { p: 0 } : {}),
                }}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
                {canResizeHere && (
                  <ColumnResizeHandle
                    isResizing={header.column.getIsResizing()}
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                  />
                )}
              </TableCell>
            )
          })}
        </MuiTableRow>
      ))}
    </TableHead>
  )
}
