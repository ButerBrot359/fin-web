import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { Button } from '@/shared/ui/buttons/button'
import { DropdownButton } from '@/shared/ui/buttons/dropdown-button'
import type { DocumentAttribute } from '@/entities/document-type'
import type { SelectOption } from '@/shared/types/select-option'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'

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

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data: typeData, isLoading: isLoadingType } = useQuery({
    queryKey: ['dict-sidebar-type', panel.domain, panel.typeCode],
    queryFn: ({ signal }) =>
      fetchDictTypeMetadata(panel.domain, panel.typeCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const isSearchMode = search.trim().length > 0

  const PAGE_SIZE = 25

  const {
    data: pagedData,
    isLoading: isLoadingPaged,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dict-sidebar-entries',
      panel.domain,
      panel.typeCode,
      'paged',
      panel.searchParams,
    ],
    queryFn: ({ signal, pageParam }) =>
      fetchDictEntriesPaged(
        panel.domain,
        panel.typeCode,
        { page: pageParam, size: PAGE_SIZE, ...panel.searchParams },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !isSearchMode,
    staleTime: 60 * 1000,
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
    select: (res) => res.data.data.content,
  })

  const entries = useMemo(
    () =>
      isSearchMode
        ? (searchData ?? [])
        : (pagedData?.pages.flatMap((page) => page.data.data.content) ?? []),
    [isSearchMode, searchData, pagedData]
  )
  const totalElements = pagedData?.pages[0]?.data.data.totalElements ?? 0
  const isLoading = isLoadingType || isLoadingPaged || isLoadingSearch

  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (!observerEntries[0]?.isIntersecting) return
        const { hasNextPage, isFetchingNextPage, fetchNextPage } =
          loadMoreRef.current
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: scrollContainer }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [])

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

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
      : 0

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
      <div className="min-h-0 flex-1 flex flex-col">
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
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
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
                          className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06"
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
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    const isSelected = selectedRowId === row.original.id

                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          setSelectedRowId(row.original.id)
                        }}
                        onDoubleClick={handleSelect}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-ui-07',
                          isSelected
                            ? 'bg-ui-07'
                            : virtualRow.index % 2 === 1
                              ? 'bg-ui-01'
                              : ''
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
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
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: paddingBottom }} />
                    </tr>
                  )}
                </tbody>
              </table>
              <div ref={sentinelRef} className="h-1" />
            </div>

            {!isSearchMode && (
              <div className="shrink-0 px-3 py-2 flex items-center gap-2">
                <Typography variant="body2" className="text-ui-05">
                  {t('table.loadedCount', {
                    loaded: entries.length,
                    total: totalElements,
                  })}
                </Typography>
                {isFetchingNextPage && <CircularProgress size={14} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
