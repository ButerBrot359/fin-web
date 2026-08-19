import { useState, useEffect, useMemo, useRef, type FC } from 'react'
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

import { useVirtualTableRows } from '@/shared/lib/virtual-rows/use-virtual-table-rows'

import type { ViewNode, TableCommandDescriptor } from '../../../types/view'
import {
  useTableSync,
  type TableColumnDef,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import {
  useTableSearch,
  isSearchHit,
} from '../../../lib/hooks/use-table-search'
import { createTableHotkeysHandler } from '../../../lib/utils/table-hotkeys'
import { useRowActivate } from '../../../lib/hooks/use-row-activate'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
import { TableCellEditor } from './table-cell-editor'
import { RequiredMark } from './required-mark'
import { SearchHitCell } from './table-search-cell'
import { TableToolbar } from './table-toolbar'

interface EditableTableProps {
  node: ViewNode
  columns: TableColumnDef[]
}

export const EditableTable: FC<EditableTableProps> = ({ node, columns }) => {
  const { t } = useTranslation()
  const allowAdd = node.props?.allowAdd === true
  const allowDelete = node.props?.allowDelete === true
  const allowReorder = node.props?.allowReorder === true
  const showRowNumbers = node.props?.showRowNumbers === true

  const tableCommands = node.props?.tableCommands as
    | TableCommandDescriptor[]
    | undefined

  const sync = useTableSync(node, columns)
  // Стабильная ссылка на актуальный sync для мемоизированных cell-колбэков:
  // без неё useMemo(tableColumns) захватил бы устаревший sync. Методы sync
  // читают refs, поэтому доступ через syncRef.current корректен.
  const syncRef = useRef(sync)
  syncRef.current = sync
  const validation = useTableValidation(node)
  const validationRef = useRef(validation)
  validationRef.current = validation
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // Активация строки уходит на сервер только если бэк прислал action
  // с trigger='activate' у этой ТЧ (props.rowActivate)
  const activateRow = useRowActivate(node)

  const search = useTableSearch(
    sync.rows,
    columns.map((c) => ({ id: c.id, binding: c.binding }))
  )
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Виртуализация строк (SCRUM-368): в DOM — только видимое окно. Ниже порога
  // хука рендер прежний (все строки).
  const virt = useVirtualTableRows(sync.rows.length)
  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node
    virt.setContainerRef(node)
  }

  // Скролл к текущему совпадению поиска (§6.5: поиск не фильтрует строки).
  // При виртуализации строка совпадения может быть вне окна — сначала подводим
  // окно к её индексу, затем после кадра доводим по горизонтали к самой ячейке.
  useEffect(
    () => {
      const current = search.current
      if (!current) return
      const idx = sync.rows.findIndex((r) => r.rowId === current.rowId)
      if (idx >= 0) virt.scrollToRow(idx)
      requestAnimationFrame(() => {
        containerRef.current
          ?.querySelector('[data-search-hit="true"]')
          ?.scrollIntoView({ block: 'nearest' })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.current?.rowId, search.current?.columnId]
  )

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null
      if (prev >= sync.rows.length)
        return sync.rows.length > 0 ? sync.rows.length - 1 : null
      return prev
    })
  }, [sync.rows.length])

  // Мемоизируем колонки по [columns]: при ре-рендере EditableTable (ввод символа →
  // setLocalRows) определения колонок/cell-функций НЕ пересоздаются, поэтому TanStack
  // не ремонтит ячейку и инпут сохраняет фокус. cell-колбэки берут актуальный sync
  // через syncRef.current.
  const tableColumns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorFn: (row: TableRow) => row[col.binding],
        // TanStack `header` — string | функция (не элемент): маркер оборачиваем
        // в render-функцию, обычную колонку оставляем строкой-label (SCRUM-329).
        header:
          col.required && !col.readonly
            ? () => <RequiredMark label={col.label} />
            : col.label,
        size: col.flex ? undefined : 150,
        cell: ({ row }) => (
          <TableCellEditor
            cellWidget={col.cellWidget}
            dataType={col.dataType}
            value={row.original[col.binding]}
            readonly={col.readonly}
            props={col.props}
            required={col.required}
            revealErrors={validationRef.current.revealErrors}
            onChange={(val) => {
              syncRef.current.updateCell(row.original.rowId, col.binding, val)
            }}
            onCommit={() => {
              syncRef.current.commitCell()
            }}
          />
        ),
      })),
    [columns]
  )

  const table = useReactTable({
    data: sync.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  const handleAdd = () => {
    sync.addRow(columns)
  }
  const handleRemove = () => {
    if (selectedIndex !== null) {
      sync.deleteRow(selectedIndex)
      setSelectedIndex(null)
    }
  }
  const handleCopy = () => {
    if (selectedIndex === null) return
    const src = sync.rows[selectedIndex]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!src) return
    const { rowId: _rowId, ...values } = src
    sync.addRow(columns, values)
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

  const handleKeyDown = createTableHotkeysHandler({
    onAdd: handleAdd,
    onCopy: handleCopy,
    onRemove: handleRemove,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onFocusSearch: search.focusInput,
    onClearSearch: search.clear,
  })

  return (
    <div tabIndex={-1} style={{ outline: 'none' }} onKeyDown={handleKeyDown}>
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          onAdd={handleAdd}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          onCopy={handleCopy}
          canMoveUp={selectedIndex !== null && selectedIndex > 0}
          canMoveDown={
            selectedIndex !== null && selectedIndex < sync.rows.length - 1
          }
          canRemove={selectedIndex !== null}
          canCopy={selectedIndex !== null}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
          commands={tableCommands}
          search={search}
          selectedRowId={
            selectedIndex != null
              ? (sync.rows[selectedIndex]?.rowId ?? null)
              : null
          }
        />
      </div>
      <TableContainer component={Paper} ref={setContainerRef}>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <MuiTableRow key={hg.id}>
                {showRowNumbers && (
                  <TableCell
                    sx={{ width: 48, textAlign: 'center', fontWeight: 600 }}
                  >
                    {t('table.rowNumber')}
                  </TableCell>
                )}
                {hg.headers.map((header) => (
                  <TableCell key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableCell>
                ))}
              </MuiTableRow>
            ))}
          </TableHead>
          <TableBody ref={virt.setBodyRef}>
            {table.getRowModel().rows.length === 0 ? (
              <MuiTableRow>
                <TableCell
                  colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </MuiTableRow>
            ) : (
              <>
                {virt.paddingTop > 0 && (
                  <MuiTableRow aria-hidden="true">
                    <TableCell
                      colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                      sx={{ height: virt.paddingTop, p: 0, border: 0 }}
                    />
                  </MuiTableRow>
                )}
                {(virt.virtualItems
                  ? virt.virtualItems.map(
                      (item) => table.getRowModel().rows[item.index]
                    )
                  : table.getRowModel().rows
                ).map((row) => (
                  <MuiTableRow
                    key={row.id}
                    hover
                    data-index={virt.isVirtualized ? row.index : undefined}
                    ref={virt.measureRow}
                    selected={selectedIndex === row.index}
                    onClick={() => {
                      setSelectedIndex(row.index)
                      activateRow(row.id)
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    {showRowNumbers && (
                      <TableCell
                        sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {row.index + 1}
                        </Typography>
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <SearchHitCell
                        key={cell.id}
                        isHit={isSearchHit(
                          search.current,
                          row.original.rowId,
                          cell.column.id
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </SearchHitCell>
                    ))}
                  </MuiTableRow>
                ))}
                {virt.paddingBottom > 0 && (
                  <MuiTableRow aria-hidden="true">
                    <TableCell
                      colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                      sx={{ height: virt.paddingBottom, p: 0, border: 0 }}
                    />
                  </MuiTableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
