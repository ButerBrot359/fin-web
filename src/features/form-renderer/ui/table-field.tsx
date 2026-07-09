import { useState, useMemo, useEffect, useRef } from 'react'
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
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { resolveAttributeDomain } from '@/shared/lib/consts/data-types'
import emptyImage from '@/shared/assets/info/empty.png'

import { useTableColumns } from '../lib/hooks/use-table-columns'
import { buildEmptyRow } from '../lib/utils/build-empty-row'
import { fieldFilterToSearchParams } from '../lib/utils/field-filter-params'
import { isFieldVisible, tableColumnPath } from '../lib/utils/field-path'
import {
  getOrgScopeSourceFields,
  synthesizeReferenceFilter,
} from '../lib/utils/org-scoped-filter'
import { TableCellRenderer } from './table-cell-renderer'
import { TableFieldToolbar } from './table-field-toolbar'
import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'

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

  const {
    registerTableReplacer,
    unregisterTableReplacer,
    fieldFilters,
    visibilityMap,
  } = useFormRendererContext()

  // Поля-источники отбора для ссылочных колонок ТЧ (напр. МОЛ → «Организация»
  // документа из шапки; «Договор контрагента» → «Организация» + «Контрагент»).
  // Значения читаем live — фильтр реактивен.
  const orgSourceFields = useMemo(
    () => [...new Set(columns.flatMap(getOrgScopeSourceFields))],
    [columns]
  )
  const orgSourceValues = form.watch(
    orgSourceFields.length > 0 ? orgSourceFields : ['']
  )
  // Сериализованные id источников — стабильный триггер пересчёта колонок.
  const orgSourceSignature = orgSourceFields
    .map(
      (code, i) =>
        `${code}:${(orgSourceValues[i] as { id?: unknown } | null | undefined)?.id ?? ''}`
    )
    .join(',')

  // Ensure the table field is initialised in form state before useFieldArray
  useEffect(() => {
    const current = form.getValues(attribute.code)
    if (current === undefined) {
      form.setValue(attribute.code, [])
    }
  }, [form, attribute.code])

  const { fields, append, remove, move, replace } = useFieldArray({
    control: form.control as unknown as Control,
    name: attribute.code,
  })

  // Register replace so useFormEvents can update table data from event responses
  useEffect(() => {
    registerTableReplacer(attribute.code, replace)
    return () => {
      unregisterTableReplacer(attribute.code)
    }
  }, [attribute.code, replace, registerTableReplacer, unregisterTableReplacer])

  // Sync useFieldArray when form is reset with external data (existing entry)
  const hasSynced = useRef(false)

  useEffect(() => {
    const subscription = form.watch((formValues) => {
      if (hasSynced.current) return
      const value = formValues[attribute.code]
      if (Array.isArray(value) && value.length > 0) {
        hasSynced.current = true
        replace(value as Record<string, unknown>[])
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [form, attribute.code, replace])

  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const rowNumCol: ColumnDef<Record<string, unknown>> = {
      id: '_rowNum',
      header: '#',
      size: 40,
      cell: ({ row }) => (
        <span className="text-body2 text-ui-05">{row.index + 1}</span>
      ),
    }

    // Динамическая видимость колонок (formConfig.visibility) поверх статической
    // showInForm (уже отфильтровано в use-table-columns): реактивна к смене
    // значений шапки, поэтому накладывается здесь, а не в кэшируемом хуке.
    const visibleColumns = columns.filter((col) =>
      isFieldVisible(visibilityMap, tableColumnPath(attribute.code, col.code))
    )

    // «Счёт учёта» строки (домен ACCOUNT_PLAN) — по нему субконто-ячейки сужают
    // тип через виды субконто счёта. Предполагается один счёт на строку ТЧ.
    const accountColumnCode = columns.find(
      (col) =>
        col.dataType === 'ACCOUNT_PLAN' ||
        resolveAttributeDomain(col)?.domain === 'ACCOUNT_PLAN'
    )?.code

    const dataCols: ColumnDef<Record<string, unknown>>[] = visibleColumns.map(
      (col) => {
        // Фильтр колонки ТЧ: серверный `fieldFilters` по пути `<КодТЧ><КодКолонки>`
        // (напр. `OsnovnyeSredstvaMOL`) имеет приоритет; иначе синтезируем из
        // живого значения поля-источника (МОЛ → «Организация» документа).
        const effectiveFilter =
          fieldFilters[tableColumnPath(attribute.code, col.code)] ??
          synthesizeReferenceFilter(col, (code) => {
            const idx = orgSourceFields.indexOf(code)
            return idx >= 0 ? orgSourceValues[idx] : undefined
          })
        const serverFilterParams = fieldFilterToSearchParams(effectiveFilter)
        return {
          id: col.code,
          header: getLocalizedName(col, language),
          size: getColumnWidth(col.dataType),
          cell: ({ row }) => (
            <TableCellRenderer
              name={`${attribute.code}.${String(row.index)}.${col.code}`}
              column={col}
              control={form.control}
              language={language}
              serverFilterParams={serverFilterParams}
              accountColumnCode={accountColumnCode}
            />
          ),
        }
      }
    )

    return [rowNumCol, ...dataCols]
    // orgSourceValues читается по актуальному рендеру; пересчёт триггерит orgSourceSignature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    columns,
    language,
    attribute.code,
    form.control,
    fieldFilters,
    visibilityMap,
    orgSourceFields,
    orgSourceSignature,
  ])

  const table = useReactTable({
    data: fields as unknown as Record<string, unknown>[],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (_, index) => fields[index]?.id ?? String(index),
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
                    selectedIndex === row.index ? 'bg-ui-07' : ''
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
