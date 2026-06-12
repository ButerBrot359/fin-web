import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button, CircularProgress, Typography } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'

import { ColumnFilterTrigger } from '@/features/table-filter'
import type { ColumnMetaDto } from '@/shared/lib/eav'
import { extractTableExport, exportTableToXlsx } from '@/shared/lib/table-export'

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
  selectedRowId,
  onRowClick,
  onRowDoubleClick,
  extraRowsAbove,
  exportFileName,
  fetchAllEntries,
  buildExportData,
}: EavEntityTableProps<T>) => {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)

  const metaByCode = useMemo(() => {
    const map = new Map<string, ColumnMetaDto>()
    columnsMeta?.forEach((c) => {
      map.set(c.code, c)
    })
    return map
  }, [columnsMeta])

  useEffect(() => {
    if (!isError) return
    const apiError = error as
      | { message?: string; data?: { message?: string } }
      | null
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

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    // Ресайз колонок мышью (как в Excel): тянем границу заголовка.
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 48, size: 180 },
    state: { sorting },
    onSortingChange,
  })

  const { rows } = table.getRowModel()

  const canExport = !!exportFileName && entries.length > 0

  const handleExport = async () => {
    if (!exportFileName || isExporting) return
    setIsExporting(true)
    try {
      const rows = fetchAllEntries ? await fetchAllEntries() : entries
      const data = buildExportData
        ? await buildExportData(rows)
        : await extractTableExport(table, fetchAllEntries ? rows : undefined)
      if (data.rows.length === 0) {
        showToast('info', t('table.exportEmpty'))
        return
      }
      exportTableToXlsx(exportFileName, data)
    } catch (e) {
      const description = e instanceof Error ? e.message : undefined
      showToast('error', t('table.exportError'), description)
    } finally {
      setIsExporting(false)
    }
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
          className="table-fixed border-separate"
          style={{ borderSpacing: '2px', width: table.getTotalSize() }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
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
                      style={{ width: header.getSize() }}
                      className={cn(
                        'sticky top-0 z-10 border-b-2 border-ui-06 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06',
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
                <td colSpan={columns.length} className="py-16 text-center">
                  <CircularProgress size={24} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
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
                  {row.getVisibleCells().map((cell) => {
                    const cellExtra = cell.column.columnDef.meta as
                      | EavColumnMetaExtra
                      | undefined
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          'px-3 py-2 align-top first:rounded-l-md last:rounded-r-md',
                          cellExtra?.metaCode === '__hierarchy' ||
                            cell.column.id === '__hierarchy'
                            ? 'overflow-hidden whitespace-nowrap'
                            : 'cell-wrap'
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
    </div>
  )
}
