import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { Button } from '@/shared/ui/buttons/button'
import { DropdownButton } from '@/shared/ui/buttons/dropdown-button'
import type { SelectOption } from '@/shared/types/select-option'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import { useColumnWidths } from '../lib/hooks/use-column-widths'
import { buildDictColumns, mapDictColumns } from '../lib/utils/dict-columns'
import { DictTree } from './dict-tree'
import {
  fetchDictTypeMetadata,
  fetchDictColumns,
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
  const [selectedEntry, setSelectedEntry] = useState<DictEntry | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

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
  // Row-scope parent-отбор (КБП-ПОК-ВИДВНА): «Показать все» с ?parent=<группа>
  // показывает ПЛОСКИЙ отфильтрованный список детей группы (как эталон 1С — виды
  // выбранной группы ОС), а не полное дерево справочника.
  const hasParentFilter = panel.searchParams?.parent != null
  // Дерево — только для иерархических типов в режиме навигации (не поиск, не parent-отбор):
  // поиск и parent-отбор возвращают плоский список.
  const isHierarchical = !!typeData?.isHierarchical
  const isTree = isHierarchical && !isSearchMode && !hasParentFilter

  const PAGE_SIZE = 25

  const {
    data: pagedData,
    isLoading: isLoadingPaged,
    isFetching: isFetchingPaged,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dict-sidebar-entries',
      panel.domain,
      panel.typeCode,
      'paged',
      typeData?.isHierarchical,
      panel.searchParams,
      sortAttr,
      sortDir,
    ],
    queryFn: ({ signal, pageParam }) =>
      fetchDictEntriesPaged(
        panel.domain,
        panel.typeCode,
        {
          page: pageParam,
          size: PAGE_SIZE,
          ...panel.searchParams,
          sortAttr,
          sortDir,
          // Иерархический + parent-отбор → grouped=true, чтобы применился parentId
          // (дети группы). Без parent — grouped=false (плоские листья, как раньше).
          ...(typeData?.isHierarchical && {
            grouped: hasParentFilter ? 'true' : 'false',
          }),
        },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled:
      !isSearchMode &&
      typeData != null &&
      (!isHierarchical || hasParentFilter),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
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
  const isSortingOrFiltering = isFetchingPaged && isPlaceholderData

  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

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
  }, [isLoading])

  // Колонки диалога из GET /dictionaries/entries/{typeCode}/columns. Контракт
  // не зафиксирован — при ошибке/пустом ответе откатываемся на атрибуты типа.
  const { data: columnDtos } = useQuery({
    queryKey: ['dict-sidebar-columns', panel.typeCode],
    queryFn: ({ signal }) => fetchDictColumns(panel.typeCode, signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
    select: (res) => res.data.data,
  })

  // Общая модель колонок для плоской таблицы и дерева (Код / Наименование…).
  const dictColumns = useMemo(() => {
    const fromEndpoint =
      columnDtos && columnDtos.length > 0
        ? mapDictColumns(columnDtos, i18n.language)
        : []
    return fromEndpoint.length > 0
      ? fromEndpoint
      : buildDictColumns(
          typeData?.attributes ?? [],
          panel.typeCode,
          i18n.language,
          t
        )
  }, [columnDtos, typeData?.attributes, panel.typeCode, i18n.language, t])

  const { widthOf, startResize } = useColumnWidths(panel.typeCode)

  const columns = useMemo<ColumnDef<DictEntry>[]>(
    () =>
      dictColumns.map((col) => ({
        id: col.id,
        enableSorting: col.sortable,
        header: () => <span>{col.title}</span>,
        cell: ({ row }) => col.render(row.original),
      })),
    [dictColumns]
  )

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: setSorting,
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
                defaults: panel.defaults,
                onSelect: panel.onSelect,
              })
            }}
          >
            {t('dictSidebar.create')}
          </Button>
          <Button
            variant="secondary"
            aria-label={t('actions.copy')}
            disabled={selectedEntry == null}
            startIcon={<CopyDocIcon className="h-5 w-5" />}
            onClick={() => {
              if (!selectedEntry) return
              push({
                mode: 'create',
                domain: panel.domain,
                typeCode: panel.typeCode,
                onSelect: panel.onSelect,
                copyFromId: selectedEntry.id,
              })
            }}
          />
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
      <div className="relative min-h-0 flex-1 flex flex-col">
        {isSortingOrFiltering && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
            <CircularProgress size={24} />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">
              {t('inputs.loading')}
            </Typography>
          </div>
        ) : isTree ? (
          <DictTree
            panel={panel}
            columns={dictColumns}
            selectedId={selectedEntry?.id ?? null}
            onSelectRow={setSelectedEntry}
            onConfirm={handleSelect}
            widthOf={widthOf}
            startResize={startResize}
          />
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
                className="border-separate"
                style={{
                  borderSpacing: '2px',
                  tableLayout: 'fixed',
                  width: dictColumns.reduce(
                    (sum, col) => sum + widthOf(col.id),
                    0
                  ),
                  minWidth: '100%',
                }}
              >
                <colgroup>
                  {dictColumns.map((col) => (
                    <col key={col.id} style={{ width: widthOf(col.id) }} />
                  ))}
                </colgroup>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const canSort = header.column.getCanSort()
                        const sorted = header.column.getIsSorted()

                        return (
                          <th
                            key={header.id}
                            className={cn(
                              'sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06 relative',
                              canSort && 'cursor-pointer select-none'
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder ? null : (
                              <span className="inline-flex items-center gap-1 max-w-full">
                                <span className="truncate">
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </span>
                                {sorted && (
                                  <span
                                    className={cn(
                                      'text-[10px] leading-none shrink-0',
                                      sorted === 'asc' && 'rotate-180'
                                    )}
                                  >
                                    ▼
                                  </span>
                                )}
                              </span>
                            )}
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              onMouseDown={(e) => startResize(header.column.id, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-ui-04"
                            />
                          </th>
                        )
                      })}
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
                    const isSelected = selectedEntry?.id === row.original.id

                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          setSelectedEntry(row.original)
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
                            className="truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
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
