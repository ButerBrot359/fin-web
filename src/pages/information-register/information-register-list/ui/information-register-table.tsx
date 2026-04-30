import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { Typography } from '@mui/material'

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

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (
          observerEntries[0]?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="min-h-0 flex-1 flex flex-col">
      <div className="min-h-0 flex-1 overflow-auto pb-2">
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
                    className="whitespace-nowrap border-b-2 border-ui-06 px-3 py-2 text-left text-body2 font-medium text-ui-06"
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
            {table.getRowModel().rows.length === 0 && (
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
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="even:bg-ui-01">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="py-4 text-center">
            <Typography variant="body2" className="text-ui-05">
              {t('inputs.loading')}
            </Typography>
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-2">
        <Typography variant="body2" className="text-ui-05">
          {t('table.loadedCount', {
            loaded: entries.length,
            total: totalElements,
          })}
        </Typography>
      </div>
    </div>
  )
}
