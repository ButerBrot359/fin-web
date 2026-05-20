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

import { cn } from '@/shared/lib/utils/cn'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import emptyImage from '@/shared/assets/info/empty.png'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import { useDictionaryEntries } from '../lib/hooks/use-dictionary-entries'
import { useDictionaryColumns } from '../lib/hooks/use-dictionary-columns'
import type { DictionaryTableProps } from '../types/dictionary-table'

export const DictionaryTable = ({
  attributes,
  selectedRowId,
  onSelectRow,
  domain,
  skipDependsOn,
  isHierarchical,
  openFolders,
  currentParentId,
  onOpenFolder,
  onCloseFolder,
}: DictionaryTableProps) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { moduleCode = '', pageCode = '' } = useParams()

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useDictionaryEntries(
    domain,
    moduleCode,
    skipDependsOn,
    sortAttr,
    sortDir,
    currentParentId
  )

  const sortedEntries = useMemo(() => {
    if (!isHierarchical) return entries
    const groups = entries.filter((e) => e.isGroup)
    const items = entries.filter((e) => !e.isGroup)
    return [...groups, ...items]
  }, [entries, isHierarchical])

  const columns = useDictionaryColumns(
    attributes,
    isHierarchical,
    openFolders.length
  )

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
    data: sortedEntries,
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

  const handleDoubleClick = (entry: { id: number; isGroup?: boolean }) => {
    if (isHierarchical && entry.isGroup) {
      return // drill-down handled by single click
    }
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/${String(entry.id)}?domain=${domain}`
    )
  }

  const handleRowClick = (entry: {
    id: number
    isGroup?: boolean
    nameRu: string
    nameKz: string
  }) => {
    if (isHierarchical && entry.isGroup) {
      onOpenFolder({
        id: entry.id,
        name: getLocalizedName(entry, i18n.language),
      })
    } else {
      onSelectRow(entry.id)
    }
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
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Ancestor folder rows */}
            {isHierarchical &&
              openFolders.map((folder, index) => (
                <tr
                  key={`ancestor-${String(folder.id)}`}
                  className="cursor-pointer transition-colors hover:bg-ui-07"
                  onClick={() => {
                    onCloseFolder(folder.id)
                  }}
                >
                  <td className="whitespace-nowrap px-3 py-2 first:rounded-l-md">
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: index * 24 }}
                    >
                      <ArrowDownIcon className="h-3 w-3 shrink-0" />
                      <FolderIcon className="h-4 w-4 shrink-0" />
                    </div>
                  </td>
                  <td
                    colSpan={columns.length - 1}
                    className="py-2 last:rounded-r-md"
                  >
                    {folder.name}
                  </td>
                </tr>
              ))}

            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <CircularProgress size={24} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && openFolders.length === 0 && (
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
                  onClick={() => {
                    handleRowClick(entry)
                  }}
                  onDoubleClick={() => {
                    handleDoubleClick(entry)
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
                      className={cn(
                        'px-3 py-2 first:rounded-l-md last:rounded-r-md',
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
            loaded: sortedEntries.length,
            total: totalElements,
          })}
        </Typography>
        {isFetchingNextPage && <CircularProgress size={14} />}
      </div>
    </div>
  )
}
