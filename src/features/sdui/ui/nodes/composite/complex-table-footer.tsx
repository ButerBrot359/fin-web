import type { FC } from 'react'
import { TableCell, TableFooter, TableRow as MuiTableRow } from '@mui/material'
import type { ColumnDef, Table } from '@tanstack/react-table'

import type { TableRow } from '../../../lib/hooks/use-table-sync'
import {
  verticalSubRows,
  type SduiColumnMetaExtra,
} from '../../../lib/utils/build-column-defs'
import { formatFooterValue } from '../../../lib/utils/format-footer-value'
import { footerCell } from './table-footer-value'

/**
 * Есть ли у таблицы подвал: хотя бы одна листовая колонка (рекурсивно)
 * объявила `footer`. Итоги под-колонок ВЕРТИКАЛЬНОЙ группы лежат в
 * meta.footerKeys: сама группа — одна колонка TanStack и своего `footer`
 * не имеет.
 */
export function tableHasFooter(tableColumns: ColumnDef<TableRow>[]): boolean {
  return tableColumns.some((col) => {
    const hasFooterDef = (c: ColumnDef<TableRow>): boolean => {
      if ('columns' in c && Array.isArray(c.columns)) {
        return c.columns.some(hasFooterDef)
      }
      const meta = c.meta as SduiColumnMetaExtra | undefined
      return Boolean(c.footer) || Boolean(meta?.footerKeys)
    }
    return hasFooterDef(col)
  })
}

interface ComplexTableFooterProps {
  table: Table<TableRow>
  footerValues: Record<string, unknown>
  showRowNumbers: boolean
}

/**
 * Подвал сложной ТЧ: итоги плоских колонок и стопки итогов VERTICAL-групп.
 * Вынесен из `complex-editable-table.tsx` (декомпозиция, поведение прежнее).
 */
export const ComplexTableFooter: FC<ComplexTableFooterProps> = ({
  table,
  footerValues,
  showRowNumbers,
}) => (
  <TableFooter>
    {table.getFooterGroups().map((fg) => (
      <MuiTableRow key={fg.id}>
        {showRowNumbers && <TableCell />}
        {fg.headers.map((header) => {
          const meta = header.column.columnDef.meta as
            | SduiColumnMetaExtra
            | undefined
          // ВЕРТИКАЛЬНАЯ группа: итоги идут стопкой той же сетки, что
          // и значения — иначе второй итог показать негде.
          if (meta?.footerKeys) {
            return (
              <TableCell key={header.id} colSpan={header.colSpan} sx={{ p: 0 }}>
                {verticalSubRows(
                  meta.footerKeys.map((key, index) => ({
                    key: key ?? `empty-${String(index)}`,
                    content: footerCell(
                      key != null && footerValues[key] !== undefined
                        ? formatFooterValue(footerValues[key])
                        : ''
                    ),
                  })),
                  16,
                  true,
                  meta.subRowCount ?? meta.footerKeys.length
                )}
              </TableCell>
            )
          }
          const footerId = header.column.columnDef.footer
          const footerText =
            typeof footerId === 'string' && footerValues[footerId] !== undefined
              ? formatFooterValue(footerValues[footerId])
              : ''
          return (
            <TableCell key={header.id} colSpan={header.colSpan}>
              {footerCell(footerText)}
            </TableCell>
          )
        })}
      </MuiTableRow>
    ))}
  </TableFooter>
)
