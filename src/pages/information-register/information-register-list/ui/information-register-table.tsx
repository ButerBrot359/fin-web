import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CircularProgress, Typography } from '@mui/material'

import emptyImage from '@/shared/assets/info/empty.png'

import { useInformationRegisterEntries } from '../lib/hooks/use-information-register-entries'
import { useInformationRegisterColumns } from '../lib/hooks/use-information-register-columns'
import type { InformationRegisterTableProps } from '../types/information-register'

export const InformationRegisterTable = ({
  attributes,
  domain,
}: InformationRegisterTableProps) => {
  const { t } = useTranslation()
  const { moduleCode = '' } = useParams()

  const {
    entries,
    totalElements,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInformationRegisterEntries(domain, moduleCode)
  const columns = useInformationRegisterColumns(attributes)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
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
  }, [])

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const { rows } = table.getRowModel()

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
    <div className="min-h-0 flex-1 flex flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
        <table
          className="w-full border-separate"
          style={{ borderSpacing: '2px' }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="sticky top-0 z-10 whitespace-nowrap border-b-2 border-ui-06 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 && (
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

              return (
                <tr
                  key={row.id}
                  className={virtualRow.index % 2 === 1 ? 'bg-ui-01' : ''}
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
