import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'

import { ColumnFilterTrigger } from '@/features/table-filter'
import type { ColumnMetaDto } from '@/shared/lib/eav'
import {
  extractTableExport,
  exportTableToXlsx,
  filterExportRowsById,
} from '@/shared/lib/table-export'
import { useAutoFitColumnsByContent } from '@/shared/lib/table-autofit/use-auto-fit-columns'

import { cn } from '@/shared/lib/utils/cn'
import { showToast } from '@/shared/ui/toast/show-toast'
import emptyImage from '@/shared/assets/info/empty.png'

import type {
  EavColumnMetaExtra,
  EavEntityTableProps,
} from '../types/eav-entity-table'

export const EavEntityTable = <T extends { id: number }>({
  filterTableId,
  columns,
  columnsMeta,
  entries,
  totalElements,
  isLoading,
  isSortingOrFiltering,
  isError,
  error,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  multiRowSelection = false,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  extraRowsAbove,
  exportFileName,
  fetchAllEntries,
  buildExportData,
  listOutputColumns,
  listOutputOpen = false,
  onListOutputClose,
  listOutputSelectedRowsSupported = false,
}: EavEntityTableProps<T>) => {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const listOutputKey = (listOutputColumns ?? [])
    .map((column) => column.id)
    .join('|')
  const [outputSelection, setOutputSelection] = useState(() => ({
    key: listOutputKey,
    ids: (listOutputColumns ?? []).map((column) => column.id),
  }))
  const [onlySelectedOutput, setOnlySelectedOutput] = useState(false)

  useEffect(() => {
    if (!listOutputOpen) return
    setOutputSelection({
      key: listOutputKey,
      ids: (listOutputColumns ?? []).map((column) => column.id),
    })
    setOnlySelectedOutput(false)
  }, [listOutputOpen, listOutputColumns, listOutputKey])

  const metaByCode = useMemo(() => {
    const map = new Map<string, ColumnMetaDto>()
    columnsMeta?.forEach((c) => {
      map.set(c.code, c)
    })
    return map
  }, [columnsMeta])

  useEffect(() => {
    if (!isError) return
    const apiError = error as {
      message?: string
      data?: { message?: string }
    } | null
    const description =
      apiError?.data?.message ??
      apiError?.message ??
      (typeof error === 'string' ? error : undefined)
    showToast('error', t('tableFilter.errorRequest'), description)
  }, [isError, error, t])

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (!observerEntries[0]?.isIntersecting) return
        const {
          hasNextPage: hp,
          isFetchingNextPage: fp,
          fetchNextPage: fn,
        } = loadMoreRef.current
        if (hp && !fp) {
          fn()
        }
      },
      { root: scrollContainer }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [isLoading])

  // Ширина колонок ПО СОДЕРЖИМОМУ (как в исходном отображении регистров):
  // таблица раскладывается auto-layout'ом под контент/заголовки, затем ширины
  // фиксируются — после этого колонки можно тянуть мышью.
  const { columnSizing, onColumnSizingChange, fitted } =
    useAutoFitColumnsByContent(scrollRef, !isLoading && entries.length > 0)

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    // Ресайз колонок мышью (как в Excel): тянем границу заголовка.
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 48, size: 180 },
    state: { sorting, columnSizing, columnVisibility },
    onSortingChange,
    onColumnSizingChange,
    onColumnVisibilityChange,
  })

  const { rows } = table.getRowModel()

  const canExport = !!exportFileName && entries.length > 0

  const handleExport = async (
    columnIds?: string[],
    rowIds?: number[]
  ): Promise<boolean> => {
    if (!exportFileName || isExporting) return false
    setIsExporting(true)
    try {
      const rows = fetchAllEntries ? await fetchAllEntries() : entries
      const selectedRows = filterExportRowsById(rows, rowIds)
      const data = buildExportData
        ? await buildExportData(selectedRows)
        : await extractTableExport(
            table,
            fetchAllEntries || rowIds ? selectedRows : undefined,
            { columnIds }
          )
      if (data.rows.length === 0) {
        showToast('info', t('table.exportEmpty'))
        return false
      }
      exportTableToXlsx(exportFileName, data)
      return true
    } catch (e) {
      const description = e instanceof Error ? e.message : undefined
      showToast('error', t('table.exportError'), description)
      return false
    } finally {
      setIsExporting(false)
    }
  }

  const selectedOutputIds =
    outputSelection.key === listOutputKey
      ? outputSelection.ids
      : (listOutputColumns ?? []).map((column) => column.id)
  const allOutputColumnsSelected =
    (listOutputColumns?.length ?? 0) > 0 &&
    selectedOutputIds.length === listOutputColumns?.length
  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds]
  )
  const allLoadedRowsSelected =
    entries.length > 0 &&
    entries.every((entry) => selectedRowIdSet.has(entry.id))

  const toggleRowSelection = (id: number, checked: boolean) => {
    if (!onSelectedRowIdsChange) return
    onSelectedRowIdsChange(
      checked
        ? [...selectedRowIds.filter((selectedId) => selectedId !== id), id]
        : selectedRowIds.filter((selectedId) => selectedId !== id)
    )
  }

  const toggleLoadedRowSelection = (checked: boolean) => {
    if (!onSelectedRowIdsChange) return
    const loadedIds = new Set(entries.map((entry) => entry.id))
    onSelectedRowIdsChange(
      checked
        ? [...new Set([...selectedRowIds, ...loadedIds])]
        : selectedRowIds.filter((id) => !loadedIds.has(id))
    )
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
      : 0

  return (
    <div className="relative min-h-0 flex-1 flex flex-col">
      {isSortingOrFiltering && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
          <CircularProgress size={24} />
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
        <table
          className={cn('border-separate', fitted ? 'table-fixed' : 'w-full')}
          style={
            fitted
              ? { borderSpacing: '2px', width: table.getTotalSize() }
              : { borderSpacing: '2px' }
          }
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {multiRowSelection && (
                  <th className="sticky top-0 z-10 w-12 border-b-2 border-ui-06 bg-white px-2 py-2 text-center">
                    <Checkbox
                      size="small"
                      checked={allLoadedRowsSelected}
                      indeterminate={
                        selectedRowIds.length > 0 && !allLoadedRowsSelected
                      }
                      slotProps={{
                        input: {
                          'aria-label': t('sdui.listOutput.selectAll'),
                        },
                      }}
                      onChange={(_, checked) => {
                        toggleLoadedRowSelection(checked)
                      }}
                    />
                  </th>
                )}
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const extra = header.column.columnDef.meta as
                    | EavColumnMetaExtra
                    | undefined
                  const metaCode = extra?.metaCode ?? header.column.id
                  const columnMeta = filterTableId
                    ? metaByCode.get(metaCode)
                    : undefined

                  return (
                    <th
                      key={header.id}
                      data-autofit-col={header.column.id}
                      style={fitted ? { width: header.getSize() } : undefined}
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap border-b-2 border-ui-06 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06',
                        canSort && 'cursor-pointer select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="flex w-full items-center gap-1 overflow-hidden">
                          <span className="truncate">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          {sorted && (
                            <span
                              className={cn(
                                'shrink-0 text-[10px] leading-none',
                                sorted === 'asc' && 'rotate-180'
                              )}
                            >
                              ▼
                            </span>
                          )}
                          {filterTableId && columnMeta && (
                            <span className="shrink-0">
                              <ColumnFilterTrigger
                                tableId={filterTableId}
                                column={columnMeta}
                              />
                            </span>
                          )}
                        </span>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            header.column.resetSize()
                          }}
                          className="group absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none select-none justify-end"
                        >
                          {/* видимая часть — тонкая линия 1px, зона захвата 8px */}
                          <div
                            className={cn(
                              'h-full w-px',
                              header.column.getIsResizing()
                                ? 'bg-accent-02'
                                : 'bg-transparent group-hover:bg-accent-02'
                            )}
                          />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {extraRowsAbove}

            {isLoading && (
              <tr>
                <td
                  colSpan={columns.length + (multiRowSelection ? 1 : 0)}
                  className="py-16 text-center"
                >
                  <CircularProgress size={24} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (multiRowSelection ? 1 : 0)}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-4">
                    <img src={emptyImage} alt="" className="h-50 w-50" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('table.empty')}
                    </Typography>
                  </div>
                </td>
              </tr>
            )}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              const entry = row.original
              const isSelected = selectedRowId === entry.id

              return (
                <tr
                  key={row.id}
                  // Виртуализатор замеряет реальную высоту строки — нужно для
                  // переноса текста (строка растёт под несколько строк).
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={
                    onRowClick
                      ? () => {
                          onRowClick(entry)
                        }
                      : undefined
                  }
                  onDoubleClick={
                    onRowDoubleClick
                      ? () => {
                          onRowDoubleClick(entry)
                        }
                      : undefined
                  }
                  className={cn(
                    'transition-colors hover:bg-ui-07',
                    (onRowClick ?? onRowDoubleClick) && 'cursor-pointer',
                    isSelected
                      ? 'bg-ui-07'
                      : virtualRow.index % 2 === 1
                        ? 'bg-ui-01'
                        : ''
                  )}
                >
                  {multiRowSelection && (
                    <td className="px-2 py-2 text-center">
                      <Checkbox
                        size="small"
                        checked={selectedRowIdSet.has(entry.id)}
                        slotProps={{
                          input: {
                            'aria-label': `${t('sdui.listOutput.onlySelected')}: ${String(entry.id)}`,
                          },
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                        }}
                        onChange={(_, checked) => {
                          toggleRowSelection(entry.id, checked)
                        }}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const cellExtra = cell.column.columnDef.meta as
                      | EavColumnMetaExtra
                      | undefined
                    return (
                      <td
                        key={cell.id}
                        style={
                          fitted ? { width: cell.column.getSize() } : undefined
                        }
                        className={cn(
                          'px-3 py-2 first:rounded-l-md last:rounded-r-md',
                          cellExtra?.metaCode === '__hierarchy' ||
                            cell.column.id === '__hierarchy'
                            ? 'whitespace-nowrap'
                            : 'max-w-50 truncate'
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
        <div ref={sentinelRef} className="h-1" />
      </div>

      <div className="shrink-0 px-3 py-2 flex items-center gap-2">
        <Typography variant="body2" className="text-ui-05">
          {t('table.loadedCount', {
            loaded: entries.length,
            total: totalElements,
          })}
        </Typography>
        {isFetchingNextPage && <CircularProgress size={14} />}
        {canExport && (
          <Button
            size="small"
            variant="outlined"
            className="ml-auto"
            disabled={isExporting}
            startIcon={
              isExporting ? (
                <CircularProgress size={14} />
              ) : (
                <FileDownloadOutlinedIcon fontSize="small" />
              )
            }
            onClick={() => {
              void handleExport()
            }}
          >
            {t('table.exportExcel')}
          </Button>
        )}
      </div>

      <Dialog
        open={listOutputOpen}
        onClose={onListOutputClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('documentListToolbar.outputList')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('sdui.listOutput.destination')}: {t('sdui.listOutput.xlsx')}
          </Typography>
          <Typography variant="subtitle2">
            {t('sdui.listOutput.columns')}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={allOutputColumnsSelected}
                indeterminate={
                  selectedOutputIds.length > 0 && !allOutputColumnsSelected
                }
                onChange={(_, checked) => {
                  setOutputSelection({
                    key: listOutputKey,
                    ids: checked
                      ? (listOutputColumns ?? []).map((column) => column.id)
                      : [],
                  })
                }}
              />
            }
            label={t('sdui.listOutput.selectAll')}
          />
          <FormGroup>
            {(listOutputColumns ?? []).map((column) => (
              <FormControlLabel
                key={column.id}
                control={
                  <Checkbox
                    checked={selectedOutputIds.includes(column.id)}
                    onChange={(_, checked) => {
                      setOutputSelection({
                        key: listOutputKey,
                        ids: checked
                          ? [...selectedOutputIds, column.id]
                          : selectedOutputIds.filter((id) => id !== column.id),
                      })
                    }}
                  />
                }
                label={column.label}
              />
            ))}
          </FormGroup>
          {listOutputSelectedRowsSupported && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={onlySelectedOutput}
                  disabled={selectedRowIds.length === 0}
                  onChange={(_, checked) => {
                    setOnlySelectedOutput(checked)
                  }}
                />
              }
              label={t('sdui.listOutput.onlySelected')}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onListOutputClose}>{t('actions.cancel')}</Button>
          <Button
            variant="contained"
            disabled={selectedOutputIds.length === 0 || isExporting}
            onClick={() => {
              void handleExport(
                selectedOutputIds,
                onlySelectedOutput ? selectedRowIds : undefined
              ).then((exported) => {
                if (exported) onListOutputClose?.()
              })
            }}
          >
            {t('actions.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
