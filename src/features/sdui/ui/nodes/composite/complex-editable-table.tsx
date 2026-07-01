import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow as MuiTableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import { useTableSync, type TableRow } from '../../../lib/hooks/use-table-sync'
import { useSduiSession } from '../../../lib/sdui-session-context'
import {
  buildColumnDefs,
  extractAllLeafColumns,
  renderCellValue,
  normalizeKey,
} from '../../../lib/utils/build-column-defs'
import { TableToolbar } from './table-toolbar'

interface ComplexEditableTableProps {
  node: ViewNode
}

export const ComplexEditableTable: FC<ComplexEditableTableProps> = ({
  node,
}) => {
  const { t } = useTranslation()
  const { getValue, setValue } = useSduiSession()

  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? true

  // Master-detail props
  const masterTable = node.props?.masterTable as string | undefined
  const masterKey = node.props?.masterKey as string | undefined
  const detailKey = node.props?.detailKey as string | undefined
  const isMasterDetail = Boolean(masterTable && masterKey && detailKey)

  // Memoize columns by node.children — critical for preserving input focus
  const flatColumns = useMemo(
    () => extractAllLeafColumns(node.children),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.children],
  )

  const sync = useTableSync(node, flatColumns)
  // Stable ref for memoized cell callbacks — avoids stale closures
  const syncRef = useRef(sync)
  syncRef.current = sync

  const tableColumns = useMemo(
    () => buildColumnDefs(node.children, syncRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.children],
  )

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null
      if (prev >= sync.rows.length)
        return sync.rows.length > 0 ? sync.rows.length - 1 : null
      return prev
    })
  }, [sync.rows.length])

  // ── Master-detail filtering ──
  const visibleRows = useMemo<TableRow[]>(() => {
    if (!isMasterDetail || !masterTable || !masterKey || !detailKey) {
      return sync.rows
    }

    const selectedMasterRowId = getValue(masterTable + '.__selectedRowId') as
      | string
      | undefined
    if (!selectedMasterRowId) return sync.rows

    const masterRows = (getValue(masterTable) as TableRow[] | undefined) ?? []
    const selectedMasterRow = masterRows.find(
      (r) => r.rowId === selectedMasterRowId,
    )
    if (!selectedMasterRow) return sync.rows

    const masterKeyValue = normalizeKey(selectedMasterRow[masterKey])

    return sync.rows.filter(
      (row) => normalizeKey(row[detailKey]) === masterKeyValue,
    )
  }, [
    sync.rows,
    isMasterDetail,
    masterTable,
    masterKey,
    detailKey,
    getValue,
  ])

  // ── Footer ──
  const footerValues = useMemo(() => {
    if (!node.binding) return undefined
    return getValue(node.binding + '.footer') as
      | Record<string, unknown>
      | undefined
  }, [node.binding, getValue])

  const hasFooter = useMemo(
    () =>
      Boolean(
        footerValues &&
          tableColumns.some((col) => {
            // Check if any leaf column (recursively) has a footer defined
            const hasFooterDef = (
              c: (typeof tableColumns)[number],
            ): boolean => {
              if ('columns' in c && Array.isArray(c.columns)) {
                return c.columns.some(hasFooterDef)
              }
              return Boolean(c.footer)
            }
            return hasFooterDef(col)
          }),
      ),
    [footerValues, tableColumns],
  )

  const table = useReactTable({
    data: visibleRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  // Publish selected rowId to session for detail tables
  const handleRowClick = (rowId: string, index: number) => {
    setSelectedIndex(index)
    if (node.binding) {
      setValue(node.binding + '.__selectedRowId', rowId)
    }
  }

  const handleAdd = () => sync.addRow(flatColumns)
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

  const leafColumnCount = flatColumns.length || 1

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
                {hg.headers.map((header) =>
                  header.isPlaceholder ? (
                    <TableCell key={header.id} colSpan={header.colSpan} />
                  ) : (
                    <TableCell key={header.id} colSpan={header.colSpan}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableCell>
                  ),
                )}
              </MuiTableRow>
            ))}
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 ? (
              <MuiTableRow>
                <TableCell colSpan={leafColumnCount} align="center">
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
                  onClick={() => handleRowClick(row.id, index)}
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
          {hasFooter && footerValues && (
            <TableFooter>
              {table.getFooterGroups().map((fg) => (
                <MuiTableRow key={fg.id}>
                  {fg.headers.map((header) => {
                    const footerId = header.column.columnDef.footer
                    const footerText =
                      typeof footerId === 'string' && footerValues[footerId] !== undefined
                        ? renderCellValue(footerValues[footerId])
                        : ''
                    return (
                      <TableCell key={header.id} colSpan={header.colSpan}>
                        {footerText ? (
                          <Typography variant="body2" fontWeight="bold">
                            {footerText}
                          </Typography>
                        ) : null}
                      </TableCell>
                    )
                  })}
                </MuiTableRow>
              ))}
            </TableFooter>
          )}
        </Table>
      </TableContainer>
    </div>
  )
}
