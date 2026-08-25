import type { FC } from 'react'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { ShimmerBlock } from '@/shared/ui/page-skeleton/page-skeleton'

import type { NodeProps } from '../../../types/view'
import {
  buildHeaderModel,
  extractReadOnlyColumns,
} from '../../../lib/utils/read-only-header-model'

const SKELETON_ROWS = 6

/**
 * Скелетон deferred-таблицы (SCRUM-384 §3.3): реальная шапка из TABLE_COLUMN /
 * COLUMN_GROUP детей (колонки в OPEN приходят сразу) + строки-шиммер до
 * прихода данных через HYDRATE.
 */
export const DeferredTableSkeleton: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const columns = extractReadOnlyColumns(node.children)
  const header = buildHeaderModel(node.children)

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Typography variant="subtitle1" fontWeight={600}>
          {label}
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {header.topRow.map((cell) => (
                <TableCell
                  key={cell.id}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  align={cell.align}
                >
                  {cell.label}
                </TableCell>
              ))}
            </TableRow>
            {header.hasGroups && (
              <TableRow>
                {header.bottomRow.map((cell) => (
                  <TableCell key={cell.id}>{cell.label}</TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <ShimmerBlock className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
