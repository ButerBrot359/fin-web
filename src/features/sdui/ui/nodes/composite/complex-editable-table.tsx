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
import { useSduiSession, useBindingValue } from '../../../lib/sdui-session-context'
import {
  buildColumnDefs,
  extractAllLeafColumns,
} from '../../../lib/utils/build-column-defs'
import { renderCellValue } from '../../../lib/utils/cell-value'
import {
  findSelectedMasterRow,
  filterDetailRows,
} from '../../../lib/utils/master-detail'
import { TableToolbar } from './table-toolbar'

// Единая высота строки для master-detail пары (SCRUM-282 #3): в ячейках VERTICAL-групп
// стопки редакторов разной высоты (checkbox+text vs date+date), без общей высоты
// строки таблицы разъезжаются. height на <tr> работает как min-height.
// Позже уедет в конфиг-сервис стилей.
const ROW_HEIGHT = 72

interface ComplexEditableTableProps {
  node: ViewNode
}

export const ComplexEditableTable: FC<ComplexEditableTableProps> = ({
  node,
}) => {
  const { t } = useTranslation()
  const { getValue, setFromServer } = useSduiSession()

  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? true
  const showRowNumbers = node.props?.showRowNumbers === true

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

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  // ── Master-detail filtering ──
  // Реактивные подписки (SCRUM-282 #4): getValue давал разовый снимок,
  // detail не ре-рендерился при выборе master-строки.
  const selectedMasterRowId = useBindingValue(
    isMasterDetail && masterTable ? masterTable + '.__selectedRowId' : undefined,
  ) as string | undefined
  const masterRows = useBindingValue(
    isMasterDetail && masterTable ? masterTable : undefined,
  ) as TableRow[] | undefined

  const selectedMasterRow = findSelectedMasterRow(masterRows, selectedMasterRowId)
  const masterKeyValue =
    selectedMasterRow && masterKey ? selectedMasterRow[masterKey] : undefined

  const visibleRows = useMemo<TableRow[]>(() => {
    if (!isMasterDetail || !masterKey || !detailKey) return sync.rows
    return filterDetailRows(sync.rows, selectedMasterRow, masterKey, detailKey)
  }, [sync.rows, isMasterDetail, masterKey, detailKey, selectedMasterRow])

  // Индекс выбранной строки в текущем видимом наборе (не в полном sync.rows —
  // при активном master-detail фильтре это разные массивы, SCRUM-282 C1).
  const selectedVisibleIndex =
    selectedRowId != null
      ? visibleRows.findIndex((r) => r.rowId === selectedRowId)
      : -1

  // Сброс выбора, если выбранная строка выпала из видимого набора — покрывает
  // и смену master-строки, и удаление/фильтрацию строки (SCRUM-282 I2).
  useEffect(() => {
    if (
      selectedRowId != null &&
      !visibleRows.some((r) => r.rowId === selectedRowId)
    ) {
      setSelectedRowId(null)
    }
  }, [visibleRows, selectedRowId])

  // ── Footer ──
  const footerValues = node.binding
    ? (getValue(node.binding + '.footer') as Record<string, unknown> | undefined)
    : undefined

  const hasFooter = Boolean(
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
  )

  const table = useReactTable({
    data: visibleRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  // Publish selected rowId to session for detail tables
  const handleRowClick = (rowId: string) => {
    setSelectedRowId(rowId)
    if (node.binding) {
      setFromServer(node.binding + '.__selectedRowId', rowId)
    }
  }

  // Detail-таблица: новая строка сразу получает ключ связи выбранной master-строки;
  // без выбранной master-строки добавление заблокировано (canAdd ниже) — как в 1С.
  const handleAdd = () => {
    if (isMasterDetail && detailKey) {
      if (masterKeyValue === undefined) return
      sync.addRow(flatColumns, { [detailKey]: masterKeyValue })
      return
    }
    sync.addRow(flatColumns)
  }
  // Удаляем по rowId из ПОЛНОГО массива sync.rows (SCRUM-282 C1): selectedVisibleIndex
  // указывает на позицию в отфильтрованном visibleRows и не годится для sync.deleteRow.
  const handleRemove = () => {
    if (selectedRowId === null) return
    const globalIndex = sync.rows.findIndex((r) => r.rowId === selectedRowId)
    if (globalIndex >= 0) sync.deleteRow(globalIndex)
    setSelectedRowId(null)
  }
  // Reorder возможен только вне master-detail (allowReorder && !isMasterDetail в
  // тулбаре) — там visibleRows === sync.rows, поэтому selectedVisibleIndex совпадает
  // с глобальным индексом и move корректен.
  const handleMoveUp = () => {
    if (selectedVisibleIndex > 0) {
      sync.moveRow(selectedVisibleIndex, selectedVisibleIndex - 1)
    }
  }
  const handleMoveDown = () => {
    if (
      selectedVisibleIndex >= 0 &&
      selectedVisibleIndex < visibleRows.length - 1
    ) {
      sync.moveRow(selectedVisibleIndex, selectedVisibleIndex + 1)
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
          canMoveUp={!isMasterDetail && selectedVisibleIndex > 0}
          canMoveDown={
            !isMasterDetail &&
            selectedVisibleIndex >= 0 &&
            selectedVisibleIndex < visibleRows.length - 1
          }
          canRemove={selectedRowId !== null}
          canAdd={!isMasterDetail || masterKeyValue !== undefined}
          allowAdd={allowAdd}
          allowReorder={allowReorder && !isMasterDetail}
          allowDelete={allowDelete}
        />
      </div>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((hg, hgIndex) => (
              <MuiTableRow key={hg.id}>
                {showRowNumbers && hgIndex === 0 && (
                  <TableCell
                    rowSpan={table.getHeaderGroups().length}
                    sx={{ width: 48, textAlign: 'center', fontWeight: 600 }}
                  >
                    {t('table.rowNumber')}
                  </TableCell>
                )}
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
                <TableCell
                  colSpan={leafColumnCount + (showRowNumbers ? 1 : 0)}
                  align="center"
                >
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
                  selected={row.id === selectedRowId}
                  onClick={() => handleRowClick(row.id)}
                  sx={{ cursor: 'pointer', height: ROW_HEIGHT }}
                >
                  {showRowNumbers && (
                    <TableCell sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}>
                      <Typography variant="body2" color="text.secondary">
                        {index + 1}
                      </Typography>
                    </TableCell>
                  )}
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
                  {showRowNumbers && <TableCell />}
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
