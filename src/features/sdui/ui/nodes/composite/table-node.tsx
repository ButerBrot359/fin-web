import type { FC } from 'react'
import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useViewState } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

interface ColumnDef {
  id: string
  label: string
  binding?: string
  flex?: number | string
}

function extractColumns(children: ViewNode[] | undefined): ColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => ({
      id: c.id,
      label: (c.props?.label as string | undefined) ?? '',
      binding: c.props?.binding as string | undefined,
      flex: c.props?.flex as number | string | undefined,
    }))
}

interface TableRow {
  rowId: string
  [key: string]: unknown
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const allowAdd = node.props?.allowAdd as boolean | undefined
  const allowDelete = node.props?.allowDelete as boolean | undefined

  const rows = (useViewState(node.binding) as TableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractColumns(node.children)

  const handleAdd = () => {
    void dispatch({ type: 'COMMAND', command: `addRow:${node.binding}` })
  }

  const handleDelete = (rowId: string) => {
    void dispatch({ type: 'COMMAND', command: `deleteRow:${node.binding}:${rowId}` })
  }

  return (
    <div>
      {(label || allowAdd) && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          {label && (
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {label}
            </Typography>
          )}
          {allowAdd && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              variant="outlined"
            >
              Добавить
            </Button>
          )}
        </div>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id}>{col.label}</TableCell>
              ))}
              {allowDelete && <TableCell padding="checkbox" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (allowDelete ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    Нет данных
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.rowId}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      {col.binding !== undefined
                        ? String(row[col.binding] ?? '')
                        : ''}
                    </TableCell>
                  ))}
                  {allowDelete && (
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(row.rowId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
