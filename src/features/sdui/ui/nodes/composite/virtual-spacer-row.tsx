import type { FC } from 'react'
import { TableCell, TableRow as MuiTableRow } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'

interface VirtualSpacerRowProps {
  /** Суммарная высота невидимых строк по эту сторону окна (virt.paddingTop/Bottom). */
  height: number
  /** Столько колонок, сколько РИСУЕТСЯ, включая колонку «N». */
  colSpan: number
}

/**
 * Строка-распорка окна виртуализации (SCRUM-368): держит высоту таблицы вместо
 * неотрисованных строк, чтобы позиция скроллбара не прыгала.
 */
export const VirtualSpacerRow: FC<VirtualSpacerRowProps> = ({
  height,
  colSpan,
}) => (
  <MuiTableRow aria-hidden="true">
    <TableCell
      colSpan={colSpan}
      sx={{
        height,
        p: 0,
        border: 0,
        // SCRUM-368: фантомные линии строк вместо белого при быстром скролле
        background: `repeating-linear-gradient(to bottom, transparent 0 119px, ${cssVar(palette.pendingGray3)} 119px 120px)`,
      }}
    />
  </MuiTableRow>
)
