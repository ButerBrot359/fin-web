import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { ConsolidatedWorkerRow } from '../types/consolidated'

interface ConsolidatedGridProps {
  data: ConsolidatedWorkerRow[]
}

const formatNumber = (value: number): string =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })

export const ConsolidatedGrid = ({ data }: ConsolidatedGridProps) => {
  const { t } = useTranslation()

  const columns: ColumnDef<ConsolidatedWorkerRow>[] = [
    {
      id: 'index',
      header: '№',
      cell: ({ row }) => row.index + 1,
      size: 50,
    },
    {
      accessorKey: 'rabotnikName',
      header: t('tarifikatsiya.worker'),
      size: 200,
    },
    {
      accessorKey: 'dolzhnost',
      header: t('tarifikatsiya.position'),
      size: 180,
    },
    {
      accessorKey: 'tarifnayaStavka',
      header: t('tarifikatsiya.tariffRate'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'nadbavki',
      header: t('tarifikatsiya.supplements'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'mesyachnyFot',
      header: t('tarifikatsiya.monthlyPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
    {
      accessorKey: 'dopolnitelnyFot',
      header: t('tarifikatsiya.additionalPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 150,
    },
    {
      accessorKey: 'itogoFot',
      header: t('tarifikatsiya.totalPayroll'),
      cell: ({ getValue }) => formatNumber(getValue() as number),
      size: 130,
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-2">
      <Typography variant="subtitle2">
        {t('tarifikatsiya.workerSummary')}
      </Typography>
      <div className="overflow-x-auto rounded-md border border-ui-03">
        <table className="w-full border-collapse text-body2">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-ui-02">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-ui-03 px-3 py-2 text-left font-medium text-ui-05"
                    style={{ width: header.getSize() }}
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-4 text-center text-ui-04"
                >
                  {t('table.empty')}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-ui-03 hover:bg-ui-01">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 text-ui-06">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
