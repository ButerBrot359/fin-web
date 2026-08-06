import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { fetchListPage } from '../../../api/reference-options'
import { ListFilterChips, type ListFilterChip } from './list-filter-chips'
import {
  buildListColumns,
  type ListRow,
  type ListSource,
  type ListSortState,
  type ListPeriod,
} from './list-column-defs'
import { ListPeriodControl } from './list-period-control'
import { ListTable } from './list-table'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useRefPickerSelectionStore } from '../../../lib/stores/ref-picker-selection-store'

const PAGE_SIZE = 25

export const ListNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const source = node.props?.source as ListSource | undefined
  const searchable = (node.props?.searchable as boolean | undefined) ?? false

  const columnNodes = useMemo(
    () => (node.children ?? []).filter((c) => c.type === 'TABLE_COLUMN'),
    [node.children]
  )

  const selectAction = node.actions?.find((a) => a.trigger === 'select')
  const activateAction = node.actions?.find((a) => a.trigger === 'activate')

  // SCRUM-291 2b: {TypeCode} для list.applySort:{TypeCode} фронт не получает отдельным
  // props — берёт его из суффикса ПОСЛЕ ПЕРВОГО ДВОЕТОЧИЯ команды активации строки
  // (list.rowOpen:{TypeCode}, для справочников может содержать ещё двоеточия). Нет
  // command с двоеточием → TypeCode не выводим, сортировка не рендерится/не диспатчится
  // (fail-closed, см. design §2b).
  const activateCommand = activateAction?.command
  const typeCode = activateCommand?.includes(':')
    ? activateCommand.slice(activateCommand.indexOf(':') + 1)
    : undefined

  const sortState = node.props?.sortState as ListSortState | undefined
  // SCRUM-291 2c: лейблы операторов воронки — с сервера (LIST.props.filterOpLabels),
  // НЕ i18n (design §2c/§7).
  const filterOpLabels = node.props?.filterOpLabels as
    | Record<string, string>
    | undefined
  // SCRUM-291 2d: props.period присутствует ВСЕГДА при transport=SEARCH (даже
  // {null,null}); при PAGED prop отсутствует вовсе → контрол не рендерим.
  const periodProp = node.props?.period as ListPeriod | undefined
  // SCRUM-291 2c-b: панель чипов — сервер шлёт готовый {field,label}; период
  // сюда никогда не попадает (§8), фронт filterChips не трогает. Fail-closed:
  // без typeCode команды clearFilter/clearAllFilters собрать нельзя — панель
  // не рендерим вовсе, даже если filterChips пришёл.
  const filterChips =
    (node.props?.filterChips as ListFilterChip[] | undefined) ?? []
  // Подавление дублей in-flight: пока предыдущий list.applySort не завершился —
  // повторные клики по заголовкам игнорируются («последний выигрывает» не требуется).
  const sortInFlightRef = useRef(false)

  const [search, setSearch] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  // SCRUM-291 M5: сервер может заменить props.source ответом на sort/filter/period
  // (setProp-патч на LIST-узле) — при смене идентичности source выделенная строка
  // могла уйти из выборки, поэтому сбрасываем выделение. Пропускаем первый рендер,
  // чтобы не сбрасывать выделение, которого ещё не было.
  const sourceKey = JSON.stringify(source ?? null)
  const isFirstSourceRender = useRef(true)
  useEffect(() => {
    if (isFirstSourceRender.current) {
      isFirstSourceRender.current = false
      return
    }
    setSelectedRowId(null)
  }, [sourceKey])

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: pagedData,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'sdui-list',
      source?.url,
      source?.params,
      source?.method,
      source?.body,
      search,
    ],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('LIST node: source is required')
      return fetchListPage({
        url: source.url,
        params: source.params,
        method: source.method,
        body: source.body,
        page: pageParam,
        size: PAGE_SIZE,
        search,
        signal,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows = useMemo(
    () => pagedData?.pages.flatMap((page) => page.data.content) ?? [],
    [pagedData]
  )

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
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

  // Publish highlighted row to shared store for sibling toolbar buttons (ref.copy / ref.select)
  // SCRUM-284 Δ4: ключ группы выбора — с selectAction, не из props
  const selectField = selectAction?.selectionField ?? undefined
  const setSelection = useRefPickerSelectionStore((s) => s.setSelection)
  const clearSelection = useRefPickerSelectionStore((s) => s.clearSelection)
  useEffect(() => {
    if (!selectField) return
    setSelection(selectField, selectedRowId)
    return () => {
      clearSelection(selectField)
    }
  }, [selectField, selectedRowId, setSelection, clearSelection])

  const dispatchSelect = (
    action: { command?: string } | undefined,
    rowId: number
  ) => {
    if (!action?.command) return
    void dispatch({
      type: 'COMMAND',
      command: action.command,
      value: { id: rowId },
      sourceNodeId: node.id,
    })
  }

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () =>
      buildListColumns({
        columnNodes,
        sortState,
        typeCode,
        filterOpLabels,
        dispatch,
        nodeId: node.id,
        sortInFlightRef,
      }),
    [columnNodes, sortState, typeCode, dispatch, node.id, filterOpLabels]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const tableRows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-2">
      <div className="flex items-center justify-between">
        {periodProp && typeCode ? (
          <ListPeriodControl
            period={periodProp}
            typeCode={typeCode}
            nodeId={node.id}
            dispatch={dispatch}
          />
        ) : (
          <div />
        )}
        {searchable && (
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={search}
            className="w-62.5 bg-ui-01"
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
        )}
      </div>

      {typeCode && (
        <ListFilterChips
          chips={filterChips}
          onRemove={(field) => {
            void dispatch({
              type: 'COMMAND',
              command: `list.clearFilter:${typeCode}`,
              value: { field },
              sourceNodeId: node.id,
            })
          }}
          onClearAll={() => {
            void dispatch({
              type: 'COMMAND',
              command: `list.clearAllFilters:${typeCode}`,
              sourceNodeId: node.id,
            })
          }}
        />
      )}

      <ListTable
        table={table}
        rowVirtualizer={rowVirtualizer}
        scrollRef={scrollRef}
        sentinelRef={sentinelRef}
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        isFetchingNextPage={isFetchingNextPage}
        pagedData={pagedData}
        selectedRowId={selectedRowId}
        setSelectedRowId={setSelectedRowId}
        activateAction={activateAction}
        selectAction={selectAction}
        dispatchSelect={dispatchSelect}
      />
    </div>
  )
}
