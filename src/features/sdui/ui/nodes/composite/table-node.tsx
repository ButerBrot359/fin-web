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
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { TableColumnDef } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { ComplexEditableTable } from './complex-editable-table'

interface ReadOnlyColumnDef {
  id: string
  label: string
  binding?: string
  flex?: number | string
}

function extractReadOnlyColumns(
  children: ViewNode[] | undefined,
): ReadOnlyColumnDef[] {
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

function extractEditableColumns(
  children: ViewNode[] | undefined,
): TableColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => ({
      id: c.id,
      label: (c.props?.label as string | undefined) ?? '',
      binding: (c.props?.binding as string | undefined) ?? '',
      flex: c.props?.flex as number | string | undefined,
      cellWidget: (c.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD',
      dataType: (c.props?.dataType as string | undefined) ?? 'STRING',
      readonly: c.props?.readonly as boolean | undefined,
      required: c.props?.required as boolean | undefined,
    }))
}

interface SimpleTableRow {
  rowId: string
  [key: string]: unknown
}

// Ячейка-ссылка приходит объектом {id, presentation, entityRef}; примитивы — уже строкой.
function renderCellValue(value: unknown): string {
  if (value != null && typeof value === 'object' && 'presentation' in value) {
    return String((value as { presentation: unknown }).presentation ?? '')
  }
  return String(value ?? '')
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const editable = (node.props?.editable as boolean | undefined) ?? true

  if (editable) {
    // Route to complex table if COLUMN_GROUP children exist or master-detail props present
    const hasGroups = node.children?.some((c) => c.type === 'COLUMN_GROUP')
    const hasMasterDetail = !!(node.props?.masterTable && node.props?.masterKey && node.props?.detailKey)
    const hasFooter = node.children?.some(
      (c) => c.type === 'TABLE_COLUMN' && c.props?.footer === true,
    ) || node.children?.some(
      (c) => c.type === 'COLUMN_GROUP' && c.children?.some(
        (cc) => cc.props?.footer === true,
      ),
    )

    if (hasGroups || hasMasterDetail || hasFooter) {
      return <ComplexEditableTable node={node} />
    }

    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  // Read-only path (preserved as-is)
  return <ReadOnlyTable node={node} />
}

const ReadOnlyTable: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const allowAdd = node.props?.allowAdd as boolean | undefined
  const allowDelete = node.props?.allowDelete as boolean | undefined

  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as SimpleTableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractReadOnlyColumns(node.children)

  const handleAdd = () => {
    void dispatch({ type: 'COMMAND', command: `addRow:${node.binding}` })
  }

  const handleDelete = (rowId: string) => {
    void dispatch({
      type: 'COMMAND',
      command: `deleteRow:${node.binding}:${rowId}`,
    })
  }

  return (
    <div>
      {(label || allowAdd) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          }}
        >
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
                        ? renderCellValue(row[col.binding])
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
