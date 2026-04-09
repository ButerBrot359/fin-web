import { useNavigate, useParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'

import { useDocumentEntries } from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'
import { cn } from '@/shared/lib/utils/cn'

import { useDocumentColumns } from '../lib/hooks/use-document-columns'

interface DocumentTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number) => void
}

export const DocumentTable = ({
  attributes,
  selectedRowId,
  onSelectRow,
}: DocumentTableProps) => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const navigate = useNavigate()
  const entries = useDocumentEntries()
  const columns = useDocumentColumns(attributes)

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleDoubleClick = (id: number) => {
    void navigate(`/modules/${pageCode}/document/${moduleCode}/${String(id)}`)
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
                {row.getVisibleCells().map((cell, cellIndex) => (
                  <td
                    key={cell.id}
                    className={cn('max-w-50 truncate px-3 py-2', {
                      'rounded-l-md': cellIndex === 0,
                      'rounded-r-md':
                        cellIndex === row.getVisibleCells().length - 1,
                    })}
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
