import { useState, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow as MuiTableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import {
  useTableSync,
  type TableColumnDef,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import { TableCellEditor } from './table-cell-editor'
import { TableToolbar } from './table-toolbar'

interface EditableTableProps {
  node: ViewNode
  columns: TableColumnDef[]
}

export const EditableTable: FC<EditableTableProps> = ({ node, columns }) => {
  const { t } = useTranslation()
  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? true

  const sync = useTableSync(node, columns)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const tableColumns: ColumnDef<TableRow>[] = columns.map((col) => ({
    id: col.id,
    accessorFn: (row: TableRow) => row[col.binding],
    header: col.label,
    size: col.flex ? undefined : 150,
    cell: ({ row }) => (
      <TableCellEditor
        cellWidget={col.cellWidget}
        dataType={col.dataType}
        value={row.original[col.binding]}
        readonly={col.readonly}
        onChange={(val) => sync.updateCell(row.original.rowId, col.binding, val)}
        onCommit={sync.commitCell}
      />
    ),
  }))

  const table = useReactTable({
    data: sync.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  const handleAdd = () => sync.addRow(columns)
  const handleRemove = () => {
    if (selectedIndex !== null) {
      sync.deleteRow(selectedIndex)
      setSelectedIndex(null)
    }
  }
  const handleMoveUp = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      sync.moveRow(selectedIndex, selectedIndex - 1)
      setSelectedIndex(selectedIndex - 1)
    }
  }
  const handleMoveDown = () => {
    if (selectedIndex !== null && selectedIndex < sync.rows.length - 1) {
      sync.moveRow(selectedIndex, selectedIndex + 1)
      setSelectedIndex(selectedIndex + 1)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          onAdd={handleAdd}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          canMoveUp={selectedIndex !== null && selectedIndex > 0}
          canMoveDown={
            selectedIndex !== null && selectedIndex < sync.rows.length - 1
          }
          canRemove={selectedIndex !== null}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
        />
      </div>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <MuiTableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableCell key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableCell>
                ))}
              </MuiTableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <MuiTableRow>
                <TableCell colSpan={columns.length} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </MuiTableRow>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <MuiTableRow
                  key={row.id}
                  hover
                  selected={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                  sx={{ cursor: 'pointer' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} sx={{ p: 0 }}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </MuiTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
