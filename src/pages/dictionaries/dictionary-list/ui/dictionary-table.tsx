import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import { Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'
import emptyImage from '@/shared/assets/info/empty.png'

import { useDictionaryEntries } from '../lib/hooks/use-dictionary-entries'
import { useDictionaryColumns } from '../lib/hooks/use-dictionary-columns'
import type { DictionaryTableProps } from '../types/dictionary-table'

export const DictionaryTable = ({
  attributes,
  selectedRowId,
  onSelectRow,
  domain,
}: DictionaryTableProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { moduleCode = '', pageCode = '' } = useParams()

  const { entries } = useDictionaryEntries(domain, moduleCode)
  const columns = useDictionaryColumns(attributes)

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleDoubleClick = (id: number) => {
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/${String(id)}?domain=${domain}`
    )
  }

  return (
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
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedRowId === row.original.id

            return (
              <tr
                key={row.id}
                onClick={() => {
                  onSelectRow(row.original.id)
                }}
                onDoubleClick={() => {
                  handleDoubleClick(row.original.id)
                }}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-ui-07',
                  isSelected ? 'bg-ui-07' : 'even:bg-ui-01'
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
        </tbody>
      </table>
    </div>
  )
}
