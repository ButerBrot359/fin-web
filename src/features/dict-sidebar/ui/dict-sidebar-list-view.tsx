import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { Button } from '@/shared/ui/buttons/button'
import { DropdownButton } from '@/shared/ui/buttons/dropdown-button'
import type { DocumentAttribute } from '@/entities/document-type'
import type { SelectOption } from '@/shared/types/select-option'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import {
  fetchDictTypeMetadata,
  fetchDictEntriesPaged,
  searchDictEntries,
  type DictEntry,
} from '../api/dict-sidebar-api'

interface DictSidebarListViewProps {
  panel: DictSidebarPanel
}

export const DictSidebarListView = ({ panel }: DictSidebarListViewProps) => {
  const { t, i18n } = useTranslation()
  const { pop, push } = useDictSidebarStore()

  const [search, setSearch] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const { data: typeData, isLoading: isLoadingType } = useQuery({
    queryKey: ['dict-sidebar-type', panel.domain, panel.typeCode],
    queryFn: ({ signal }) =>
      fetchDictTypeMetadata(panel.domain, panel.typeCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const isSearchMode = search.trim().length > 0

  const { data: pagedData, isLoading: isLoadingPaged } = useQuery({
    queryKey: [
      'dict-sidebar-entries',
      panel.domain,
      panel.typeCode,
      'paged',
      panel.searchParams,
    ],
    queryFn: ({ signal }) =>
      fetchDictEntriesPaged(
        panel.domain,
        panel.typeCode,
        { page: 0, size: 100, ...panel.searchParams },
        signal
      ),
    enabled: !isSearchMode,
    staleTime: 60 * 1000,
    select: (res) => res.data,
  })

  const { data: searchData, isLoading: isLoadingSearch } = useQuery({
    queryKey: [
      'dict-sidebar-entries',
      panel.domain,
      panel.typeCode,
      'search',
      search,
      panel.searchParams,
    ],
    queryFn: ({ signal }) =>
      searchDictEntries(
        panel.domain,
        panel.typeCode,
        search.trim(),
        panel.searchParams,
        signal
      ),
    enabled: isSearchMode,
    staleTime: 30 * 1000,
    select: (res) => res.data.content,
  })

  const entries = isSearchMode ? (searchData ?? []) : (pagedData?.list ?? [])
  const isLoading = isLoadingType || isLoadingPaged || isLoadingSearch

  const visibleAttributes = useMemo(
    () =>
      [...(typeData?.attributes ?? [])]
        .filter((attr: DocumentAttribute) => attr.showInList)
        .sort(
          (a: DocumentAttribute, b: DocumentAttribute) =>
            a.tableSortOrder - b.tableSortOrder
        ),
    [typeData?.attributes]
  )

  const columns = useMemo<ColumnDef<DictEntry>[]>(() => {
    const attributeColumns: ColumnDef<DictEntry>[] = visibleAttributes.map(
      (attr) => ({
        id: attr.code,
        accessorFn: (row: DictEntry) => row.attributes?.[attr.code],
        header: () => {
          const name = getLocalizedName(attr, i18n.language)
          return <span>{name}</span>
        },
        cell: (info: { getValue: () => unknown }) => {
          const value = info.getValue()

          if (
            (attr.dataType === 'DATE' || attr.dataType === 'DATETIME') &&
            typeof value === 'string'
          ) {
            const fmt =
              attr.dataType === 'DATE' ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm:ss'
            return (
              <Typography variant="body2" noWrap className="text-ui-06">
                {formatDate(value, fmt)}
              </Typography>
            )
          }

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

    const nameColumn: ColumnDef<DictEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => (
        <Typography variant="body2" noWrap className="text-ui-06">
          {info.getValue() as string}
        </Typography>
      ),
    }

    return [...attributeColumns, nameColumn]
  }, [visibleAttributes, i18n.language, t])

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedEntry = entries.find((e) => e.id === selectedRowId)

  const handleSelect = () => {
    if (!selectedEntry) return
    const option: SelectOption = {
      id: selectedEntry.id,
      code: selectedEntry.code,
      label:
        selectedEntry.displayName ??
        getLocalizedName(selectedEntry, i18n.language),
      raw: selectedEntry as unknown as Record<string, unknown>,
    }
    panel.onSelect?.(option)
    pop()
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleSelect}
            disabled={!selectedEntry}
          >
            {t('dictSidebar.select')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              push({
                mode: 'create',
                domain: panel.domain,
                typeCode: panel.typeCode,
                onSelect: panel.onSelect,
              })
            }}
          >
            {t('dictSidebar.create')}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={search}
            className="w-[250px] bg-ui-01"
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
          <DropdownButton label={t('actions.more')} disabled />
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">
              {t('inputs.loading')}
            </Typography>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">
              {t('dictSidebar.noData')}
            </Typography>
          </div>
        ) : (
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
                      className="px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06"
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
                    onDoubleClick={handleSelect}
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
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
