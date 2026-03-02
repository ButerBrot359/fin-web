import { useMemo, useState } from 'react'
import { Typography } from '@mui/material'
import { Description, ArrowDownward } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

import type { DocumentAttribute } from '../types/document-type'
import { MOCK_DOCUMENT_ENTRIES } from '../lib/consts/mock-document-entries'

type DocumentEntry = Record<string, string | number>

interface DocumentTableProps {
  attributes: DocumentAttribute[]
}

export const DocumentTable = ({ attributes }: DocumentTableProps) => {
  const { i18n } = useTranslation()
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const visibleAttributes = useMemo(
    () =>
      attributes
        .filter((attr) => attr.showInList)
        .sort((a, b) => a.tableSortOrder - b.tableSortOrder),
    [attributes]
  )

  const columns = useMemo<ColumnDef<DocumentEntry>[]>(
    () =>
      visibleAttributes.map((attr, index) => ({
        accessorKey: attr.code,
        header: () => {
          const name =
            i18n.language === 'kz' ? attr.nameKz || attr.nameRu : attr.nameRu

          return (
            <div className="flex items-center gap-1">
              {index === 0 && (
                <Description className="text-ui-05" sx={{ fontSize: 16 }} />
              )}
              <span>{name}</span>
              {index === 0 && (
                <ArrowDownward className="text-ui-05" sx={{ fontSize: 14 }} />
              )}
            </div>
          )
        },
        cell: (info) => {
          const value = info.getValue()
          return (
            <Typography variant="body2" noWrap className="text-ui-06">
              {typeof value === 'string' || typeof value === 'number'
                ? value
                : ''}
            </Typography>
          )
        },
      })),
    [visibleAttributes, i18n.language]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: MOCK_DOCUMENT_ENTRIES as DocumentEntry[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-body2 font-medium text-ui-05 whitespace-nowrap"
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
          {table.getRowModel().rows.map((row, rowIndex) => {
            const entryId = (row.original as { id?: number }).id ?? rowIndex
            const isSelected = selectedRowId === entryId

            return (
              <tr
                key={row.id}
                onClick={() => {
                  setSelectedRowId(entryId)
                }}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-ui-07'
                    : rowIndex % 2 === 0
                      ? 'bg-transparent'
                      : 'bg-ui-01'
                } hover:bg-ui-07`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 max-w-50 truncate">
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
