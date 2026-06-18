import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { Button } from '@/shared/ui/buttons/button'
import { apiService } from '@/shared/api/api'
import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

interface ListSource {
  url: string
  params?: Record<string, string>
}

interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}

interface PagedResponse {
  data: {
    content: ListRow[]
    totalElements: number
    last: boolean
    number: number
  }
}

const PAGE_SIZE = 25

const resolveBinding = (row: ListRow, binding: string): unknown =>
  row[binding] ?? row.attributes?.[binding] ?? ''

export const ListNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const source = node.props?.source as ListSource | undefined
  const searchable = (node.props?.searchable as boolean | undefined) ?? false

  const columnNodes = useMemo(
    () => (node.children ?? []).filter((c) => c.type === 'TABLE_COLUMN'),
    [node.children],
  )

  const selectAction = node.actions?.find((a) => a.trigger === 'select')
  const activateAction = node.actions?.find((a) => a.trigger === 'activate')

  const [search, setSearch] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: pagedData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['sdui-list', source?.url, source?.params, search],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('LIST node: source is required')
      const res = await apiService.get<PagedResponse>({
        url: source.url,
        params: {
          ...source.params,
          page: pageParam,
          size: PAGE_SIZE,
          ...(search.trim() && { search: search.trim() }),
        },
        signal,
      })
      return res.data
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows = useMemo(
    () => pagedData?.pages.flatMap((page) => page.data.content) ?? [],
    [pagedData],
  )

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        const { hasNextPage, isFetchingNextPage, fetchNextPage } = loadMoreRef.current
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: scrollContainer },
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [isLoading])

  const dispatchSelect = (action: { command?: string } | undefined, rowId: number) => {
    if (!action?.command) return
    void dispatch({ type: 'COMMAND', command: action.command, value: { id: rowId }, sourceNodeId: node.id })
  }

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () =>
      columnNodes.map((col: ViewNode) => ({
        id: col.id,
        header: () => <span>{(col.props?.header as string) ?? ''}</span>,
        accessorFn: (row: ListRow) => {
          const binding = col.props?.binding as string
          if (!binding) return ''
          const val = resolveBinding(row, binding)
          if (val && typeof val === 'object' && 'name' in (val as Record<string, unknown>)) {
            return ((val as Record<string, unknown>).name as string) ?? ''
          }
          return val
        },
        size: (col.props?.width as number) ?? 150,
        cell: (info: { getValue: () => unknown }) => (
          <Typography variant="body2" noWrap className="text-ui-06">
            {String(info.getValue() ?? '')}
          </Typography>
        ),
      })),
    [columnNodes],
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const tableRows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
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

  const handleSelect = () => {
    if (selectedRowId == null) return
    dispatchSelect(selectAction, selectedRowId)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleSelect} disabled={selectedRowId == null}>
            {t('dictSidebar.select')}
          </Button>
        </div>
        {searchable && (
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={search}
            className="w-62.5 bg-ui-01"
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
        )}
      </div>

      <div className="relative min-h-0 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">{t('inputs.loading')}</Typography>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">{t('dictSidebar.noData')}</Typography>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
              <table className="w-full border-separate" style={{ borderSpacing: '2px' }}>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06"
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = tableRows[virtualRow.index]
                    const isSelected = selectedRowId === row.original.id

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(row.original.id)}
                        onDoubleClick={() => {
                          dispatchSelect(activateAction ?? selectAction, row.original.id)
                        }}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-ui-07',
                          isSelected ? 'bg-ui-07' : virtualRow.index % 2 === 1 ? 'bg-ui-01' : '',
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                {t('table.loadedCount', { loaded: rows.length, total: pagedData?.pages[0]?.data.totalElements ?? 0 })}
              </Typography>
              {isFetchingNextPage && <CircularProgress size={14} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
