import type { FC } from 'react'
import { TableCell, TableHead, TableRow } from '@mui/material'

import type { ItogiHeaderCell } from '../../../../lib/utils/itogi-header-model'
import {
  ITOGI_HEADER_BACKGROUND,
  ITOGI_HEADER_TEXT,
} from '../../../../lib/utils/itogi-row-style'
import { ITOGI_CELL_SX } from './itogi-cell-sx'

interface ItogiHeaderProps {
  rows: ItogiHeaderCell[][]
}

export const ItogiHeader: FC<ItogiHeaderProps> = ({ rows }) => (
  <TableHead sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
    {rows.map((cells, index) => (
      <TableRow key={index}>
        {cells.map((cell) => (
          <TableCell
            key={cell.key}
            colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
            rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
            sx={{
              ...ITOGI_CELL_SX,
              backgroundColor: ITOGI_HEADER_BACKGROUND,
              fontWeight: ITOGI_HEADER_TEXT.fontWeight,
              fontSize: ITOGI_HEADER_TEXT.fontSize,
              color: cell.column.textColor ?? ITOGI_HEADER_TEXT.color,
              textAlign: cell.tree ? 'left' : 'center',
              verticalAlign: 'middle',
              whiteSpace: cell.tree ? 'nowrap' : 'normal',
            }}
          >
            {cell.label}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableHead>
)
