import { useState, useMemo } from 'react'
import {
  useFieldArray,
  type UseFormReturn,
  type Control,
} from 'react-hook-form'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Skeleton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { DocumentAttribute } from '@/entities/document-type'
import emptyImage from '@/shared/assets/info/empty.png'

import { useTableColumns } from '../lib/hooks/use-table-columns'
import { buildEmptyRow } from '../lib/utils/build-empty-row'
import { TableCellRenderer } from './table-cell-renderer'
import { TableFieldToolbar } from './table-field-toolbar'

interface TableFieldProps {
  attribute: DocumentAttribute
  form: UseFormReturn<Record<string, unknown>>
  language: string
}

const getColumnWidth = (dataType: string): number => {
  switch (dataType) {
    case 'BOOLEAN':
      return 60
    case 'INTEGER':
      return 130
    case 'DECIMAL':
      return 160
    case 'DATE':
    case 'DATETIME':
      return 200
    case 'STRING':
    case 'TEXT':
      return 200
    case 'ENUMS':
      return 180
    default:
      return 240
  }
}

export const TableField = ({ attribute, form, language }: TableFieldProps) => {
  const { t } = useTranslation()
  const { columns, isLoading } = useTableColumns(attribute)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const { fields, append, remove, move } = useFieldArray({
    control: form.control as unknown as Control,
    name: attribute.code,
    keyName: '_rhfId',
  })

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const rowNumCol: ColumnDef<Record<string, unknown>> = {
      id: '_rowNum',
      header: '#',
      size: 40,
      cell: ({ row }) => (
        <span className="text-body2 text-ui-05">{row.index + 1}</span>
      ),
    }

    const dataCols: ColumnDef<Record<string, unknown>>[] = columns.map(
      (col) => ({
        id: col.code,
        header: language === 'kz' ? col.nameKz || col.nameRu : col.nameRu,
        size: getColumnWidth(col.dataType),
        cell: ({ row }) => (
          <TableCellRenderer
            name={`${attribute.code}.${String(row.index)}.${col.code}`}
            column={col}
            control={form.control}
            language={language}
          />
        ),
      })
    )

    return [rowNumCol, ...dataCols]
  }, [columns, language, attribute.code, form.control])

  const table = useReactTable({
    data: fields as unknown as Record<string, unknown>[],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleAdd = () => {
    append(buildEmptyRow(columns))
    setSelectedIndex(fields.length)
  }

  const handleRemove = () => {
    if (selectedIndex === null) return
    remove(selectedIndex)
    if (selectedIndex >= fields.length - 1) {
      setSelectedIndex(fields.length > 1 ? fields.length - 2 : null)
    }
  }

  const handleMoveUp = () => {
    if (selectedIndex === null || selectedIndex === 0) return
    move(selectedIndex, selectedIndex - 1)
    setSelectedIndex(selectedIndex - 1)
  }

  const handleMoveDown = () => {
    if (selectedIndex === null || selectedIndex >= fields.length - 1) return
    move(selectedIndex, selectedIndex + 1)
    setSelectedIndex(selectedIndex + 1)
  }

  if (isLoading) {
    return <Skeleton variant="rectangular" height={200} />
  }

  return (
    <div className="flex flex-col gap-2">
      <TableFieldToolbar
        onAdd={handleAdd}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onRemove={handleRemove}
        canMoveUp={selectedIndex !== null && selectedIndex > 0}
        canMoveDown={
          selectedIndex !== null && selectedIndex < fields.length - 1
        }
        canRemove={selectedIndex !== null}
      />

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <img src={emptyImage} alt="" className="w-[250px] h-[250px]" />
          <Typography variant="subtitle1" fontWeight={600}>
            {t('table.empty')}
          </Typography>
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <table className="w-full border-collapse rounded border border-ui-03">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-ui-03 bg-ui-01"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap border-r border-ui-03 px-2 py-1 text-left text-body2 font-medium text-ui-05 last:border-r-0"
                      style={{ minWidth: header.getSize() }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-ui-03 last:border-b-0 cursor-pointer ${
                    selectedIndex === row.index ? 'bg-ui-07' : 'hover:bg-ui-02'
                  }`}
                  onClick={() => {
                    setSelectedIndex(row.index)
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-r border-ui-03 px-1 py-px last:border-r-0"
                      style={{ minWidth: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
