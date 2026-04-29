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

  const { entries } = useInformationRegisterEntries(domain, moduleCode)
  const columns = useInformationRegisterColumns(attributes)

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

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
    </div>
  )
}
