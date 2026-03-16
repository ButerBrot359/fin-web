import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Typography } from '@mui/material'
import { ArrowUpward } from '@mui/icons-material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

import {
  useDocumentEntries,
  type DocumentEntry,
} from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'

import { formatDate } from '@/shared/lib/utils/date'
import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'

const getStatusIcon = (entry: DocumentEntry) => {
  if (entry.isPosted) return <DocPostedIcon className="h-4 w-4 shrink-0" />
  if (entry.isActive) return <DocDraftIcon className="h-4 w-4 shrink-0" />
  return <DocDeletedIcon className="h-4 w-4 shrink-0" />
}

interface DocumentTableProps {
  attributes: DocumentAttribute[]
}

export const DocumentTable = ({ attributes }: DocumentTableProps) => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const entries = useDocumentEntries()
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const columns = useMemo<ColumnDef<DocumentEntry>[]>(() => {
    const visibleAttributes = [...attributes]
      .filter((attr) => attr.showInList)
      .sort((a, b) => a.tableSortOrder - b.tableSortOrder)

    const createdAtColumn: ColumnDef<DocumentEntry> = {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: () => (
        <div className="flex items-center gap-1">
          <span>{t('documentTable.createdAt')}</span>
          <ArrowUpward className="text-ui-05" sx={{ fontSize: 14 }} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {getStatusIcon(row.original)}
          <Typography variant="body2" noWrap className="text-ui-06">
            {formatDate(row.original.createdAt, 'dd.MM.yyyy HH:mm:ss')}
          </Typography>
        </div>
      ),
    }

    const attributeColumns: ColumnDef<DocumentEntry>[] = visibleAttributes.map(
      (attr) => ({
        id: attr.code,
        accessorFn: (row: DocumentEntry) => row.attributes[attr.code],
        header: () => {
          const name =
            i18n.language === 'kz' ? attr.nameKz || attr.nameRu : attr.nameRu
          return <span>{name}</span>
        },
        cell: (info: { getValue: () => unknown }) => {
          const value = info.getValue()
          const display =
            typeof value === 'object' && value !== null
              ? ((value as Record<string, unknown>).name ??
                (value as Record<string, unknown>).nameRu)
              : value
          return (
            <Typography variant="body2" noWrap className="text-ui-06">
              {typeof display === 'string' || typeof display === 'number'
                ? display
                : ''}
            </Typography>
          )
        },
      })
    )

    const nameColumn: ColumnDef<DocumentEntry> = {
      id: 'nameRu',
      accessorFn: (row) =>
        i18n.language === 'kz' ? row.nameKz || row.nameRu : row.nameRu,
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => (
        <Typography variant="body2" noWrap className="text-ui-06">
          {info.getValue() as string}
        </Typography>
      ),
    }

    return [createdAtColumn, ...attributeColumns, nameColumn]
  }, [attributes, i18n.language, t])

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
                  className="px-3 py-2 text-left text-body2 font-medium text-ui-05 whitespace-nowrap border-b-2 border-ui-06"
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
            const isSelected = selectedRowId === row.original.id

            return (
              <tr
                key={row.id}
                onClick={() => {
                  setSelectedRowId(row.original.id)
                }}
                onDoubleClick={() => {
                  void navigate(
                    `/modules/${pageCode}/document/${moduleCode}/${String(row.original.id)}`
                  )
                }}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-ui-07'
                    : rowIndex % 2 === 0
                      ? 'bg-transparent'
                      : 'bg-ui-01'
                } hover:bg-ui-07`}
              >
                {row.getVisibleCells().map((cell, cellIndex) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 max-w-50 truncate ${
                      cellIndex === 0
                        ? 'rounded-l-md'
                        : cellIndex === row.getVisibleCells().length - 1
                          ? 'rounded-r-md'
                          : ''
                    }`}
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
