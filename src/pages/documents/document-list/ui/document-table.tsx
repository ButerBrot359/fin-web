import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CircularProgress, Typography } from '@mui/material'

import { useDocumentEntries } from '@/entities/document-entry'
import {
  ColumnFilterTrigger,
  useTableFilterRequest,
} from '@/features/table-filter'

import { cn } from '@/shared/lib/utils/cn'
import { showToast } from '@/shared/ui/toast/show-toast'
import emptyImage from '@/shared/assets/info/empty.png'

import { useDocumentColumns } from '../lib/hooks/use-document-columns'
import type { DocumentTableProps } from '../types/document-table'

export const DocumentTable = ({
  attributes,
  selectedRowId,
  onSelectRow,
  filterTableId,
  columnsMeta,
}: DocumentTableProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { moduleCode = '', pageCode = '' } = useParams()

  const [sorting, setSorting] = useState<SortingState>([])

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(filterTableId ?? '__none__')
  const activeFilter = filterTableId ? filterRequest : undefined

  const {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useDocumentEntries(sortAttr, sortDir, activeFilter)

  const columns = useDocumentColumns(attributes)

  const metaByCode = useMemo(() => {
    type Meta = NonNullable<typeof columnsMeta>[number]
    const map = new Map<string, Meta>()
    columnsMeta?.forEach((c) => {
      map.set(c.code, c)
    })

    // ReactTable id для системной колонки статуса — `status`,
    // а ColumnMetaDto приходит под кодом `isPosted`. Пробрасываем
    // мэппинг, чтобы иконка фильтра отрисовалась.
    const isPostedMeta = map.get('isPosted')
    if (filterTableId && isPostedMeta && !map.has('status')) {
      map.set('status', isPostedMeta)
    }

    return map
  }, [columnsMeta, filterTableId])

  useEffect(() => {
    if (!isError) return
    const apiError = error as { message?: string; data?: { message?: string } } | null
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
        const { hasNextPage, isFetchingNextPage, fetchNextPage } =
          loadMoreRef.current
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
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
    state: { sorting },
    onSortingChange: setSorting,
  })

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const handleDoubleClick = (id: number) => {
    void navigate(`/modules/${pageCode}/document/${moduleCode}/${String(id)}`)
  }

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
          className="w-full border-separate"
          style={{ borderSpacing: '2px' }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const columnMeta = filterTableId
                    ? metaByCode.get(header.column.id)
                    : undefined

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap border-b-2 border-ui-06 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06',
                        canSort && 'cursor-pointer select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted && (
                            <span
                              className={cn(
                                'text-[10px] leading-none',
                                sorted === 'asc' && 'rotate-180'
                              )}
                            >
                              ▼
                            </span>
                          )}
                          {filterTableId && columnMeta && (
                            <ColumnFilterTrigger
                              tableId={filterTableId}
                              column={columnMeta}
                            />
                          )}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
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
              const isSelected = selectedRowId === row.original.id

              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    onSelectRow(row.original.id, row.original.nameRu)
                  }}
                  onDoubleClick={() => {
                    handleDoubleClick(row.original.id)
                  }}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-ui-07',
                    isSelected
                      ? 'bg-ui-07'
                      : virtualRow.index % 2 === 1
                        ? 'bg-ui-01'
                        : ''
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
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
      </div>
    </div>
  )
}
