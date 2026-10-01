import type { FC } from 'react'
import { Box, TableCell, TableRow } from '@mui/material'

import {
  formatItogiValue,
  type ItogiBodyCell,
  type ItogiRow,
} from '../../../../lib/utils/itogi-columns'
import { itogiRowText } from '../../../../lib/utils/itogi-row-style'
import { ITOGI_CELL_SX } from './itogi-cell-sx'
import { ItogiTreeToggle } from './itogi-tree-toggle'

export const ITOGI_LEVEL_INDENT = 12

interface ItogiBodyRowProps {
  row: ItogiRow
  cells: ItogiBodyCell[]
  background?: string
  expandable: boolean
  expanded: boolean
  onToggle: (rowId: string) => void
}

export const ItogiBodyRow: FC<ItogiBodyRowProps> = ({
  row,
  cells,
  background,
  expandable,
  expanded,
  onToggle,
}) => {
  const text = itogiRowText(row.__stil)
  return (
    <TableRow sx={{ backgroundColor: background }}>
      {cells.map(({ column, colSpan, tree }) => {
        const value = formatItogiValue(row[column.binding], column)
        return (
          <TableCell
            key={column.id}
            colSpan={colSpan > 1 ? colSpan : undefined}
            sx={{
              ...ITOGI_CELL_SX,
              fontWeight: text.fontWeight,
              fontSize: text.fontSize,
              color: column.textColor ?? text.color,
              textAlign: column.numeric && !tree ? 'right' : 'left',
            }}
          >
            {tree ? (
              <Box
                className="flex items-center gap-1"
                style={{ paddingLeft: row.__level * ITOGI_LEVEL_INDENT }}
              >
                <ItogiTreeToggle
                  expandable={expandable}
                  expanded={expanded}
                  onToggle={() => {
                    onToggle(row.rowId)
                  }}
                />
                <span>{value}</span>
              </Box>
            ) : (
              value
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
