import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { useDebouncedValue } from '@/shared/lib/hooks/use-debounced-value'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { ListFilterChips, type ListFilterChip } from './list-filter-chips'
import { ListQuickFilters, readQuickFilters } from './list-quick-filters'
import {
  buildListColumns,
  type ListRow,
  type ListSource,
  type ListSortState,
  type ListPeriod,
} from './list-column-defs'
import { ListPeriodControl } from './list-period-control'
import { ListTable } from './list-table'
import { ListBreadcrumbs } from './list-breadcrumbs'

import type { NodeProps } from '../../../types/view'
import { readPagination } from '../../../lib/utils/pagination'
import { readListActions } from '../../../lib/utils/read-list-actions'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import { useListInfiniteRows } from '../../../lib/hooks/use-list-infinite-rows'
import { useListTrail } from '../../../lib/hooks/use-list-trail'
import {
  buildToggleExpand,
  isTreeDisplayMode,
} from '../../../lib/utils/list-tree-mode'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useSelectionStore } from '../../../lib/stores/selection-store'

/** Пауза перед отправкой поиска, мс — как в пикере ссылочного поля и легаси-списках. */
const SEARCH_DEBOUNCE_MS = 300

const PAGE_SIZE = 25

export const ListNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const source = node.props?.source as ListSource | undefined
  const searchable = (node.props?.searchable as boolean | undefined) ?? false
  const isTree = isTreeDisplayMode(node)
  // SCRUM-368: размер страницы задаёт бэк (props.pagination.pageSize);
  // старый фронтовый хардкод 25 — фолбэк для ответов без контракта
  const pageSize = readPagination(node)?.pageSize ?? PAGE_SIZE

  const columnNodes = useMemo(
    () => (node.children ?? []).filter((c) => c.type === 'TABLE_COLUMN'),
    [node.children]
  )

  const {
    selectAction,
    activateAction,
    sortCommand,
    filterCommand,
    clearFilterCommand,
    clearAllFiltersCommand,
    periodCommand,
    exportCommand,
    expandAction,
  } = readListActions(node)

  const sortState = node.props?.sortState as ListSortState | undefined
  // SCRUM-291 2c: лейблы операторов воронки — с сервера (LIST.props.filterOpLabels),
  // НЕ i18n (design §2c/§7).
  const filterOpLabels = node.props?.filterOpLabels as
    | Record<string, string>
    | undefined
  // SCRUM-291 2d → SCRUM-362 B-1: контрол периода гейтится period-действием
  // (сервер шлёт его только при SEARCH и наличии реквизита периода);
  // props.period несёт текущие значения границ.
  const periodProp = node.props?.period as ListPeriod | undefined
  // SCRUM-291 2c-b: панель чипов — сервер шлёт готовый {field,label}; период
  // сюда никогда не попадает (§8), фронт filterChips не трогает. Fail-closed:
  // без clearFilter/clearAllFilters-действий панель не рендерим вовсе.
  const filterChips =
    (node.props?.filterChips as ListFilterChip[] | undefined) ?? []
  // Панель отбора над таблицей (как в журнале 1С). Значения берём из тех же чипов, что
  // рисуются под панелью: показанное в панели и снятое чипом — одно состояние.
  const quickFilterValues = useMemo(
    () =>
      Object.fromEntries(
        filterChips.map((chip) => [
          chip.field,
          (chip as { value?: unknown }).value,
        ])
      ),
    [filterChips]
  )
  const quickFilters = useMemo(
    () => readQuickFilters(node, columnNodes, quickFilterValues),
    [node, columnNodes, quickFilterValues]
  )
  // Подавление дублей in-flight: пока предыдущий list.applySort не завершился —
  // повторные клики по заголовкам игнорируются («последний выигрывает» не требуется).
  const sortInFlightRef = useRef(false)

  const [search, setSearch] = useState('')
  // Запрос уходит НЕ на каждое нажатие клавиши: у LIST-узла search сидит в queryKey, а смена
  // ключа сбрасывает бесконечную прокрутку и перезапускает EAV-поиск. Пауза та же, что у
  // пикера ссылочного поля (use-reference-options) и легаси-списков.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const {
    selectedRowId,
    setSelectedRowId,
    trail,
    isHierarchical,
    isSearchMode,
    levelParams,
    drillInto,
    canDrillInto,
    navigateToDepth,
  } = useListTrail({ node, source, debouncedSearch })

  const {
    rows,
    pagedData,
    isLoading,
    isError,
    isFetchingNextPage,
    sentinelRef,
  } = useListInfiniteRows({
    source,
    params: levelParams,
    search: debouncedSearch,
    pageSize,
  })

  const scrollRef = useRef<HTMLDivElement>(null)

  // Publish highlighted row to shared store for sibling toolbar buttons (ref.copy / ref.select)
  // SCRUM-284 Δ4: ключ группы выбора — с selectAction, не из props
  const selectField = selectAction?.selectionField ?? undefined
  const setSelection = useSelectionStore((s) => s.setSelection)
  const clearSelection = useSelectionStore((s) => s.clearSelection)
  useEffect(() => {
    if (!selectField) return
    setSelection(selectField, selectedRowId)
    return () => {
      clearSelection(selectField)
    }
  }, [selectField, selectedRowId, setSelection, clearSelection])

  // Свою иконку папки рисуем, только если сервер не прислал колонку-иконку
  // (cellKind='ICON' с iconMap по isGroup) — иначе в строке было бы две папки.
  const showFolderIcon =
    isHierarchical && !columnNodes.some((c) => c.props?.cellKind === 'ICON')

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

  const onToggleExpand = buildToggleExpand(
    isTree,
    expandAction,
    dispatch,
    node.id
  )

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () =>
      buildListColumns({
        columnNodes,
        // §8.1: в дереве нет сортировки кликом по заголовку — состояние и
        // команду сортировки не пробрасываем (стрелка и клик не рендерятся).
        sortState: isTree ? undefined : sortState,
        sortCommand: isTree ? undefined : sortCommand,
        filterCommand,
        filterOpLabels,
        dispatch,
        nodeId: node.id,
        sortInFlightRef,
        onToggleExpand,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      columnNodes,
      sortState,
      sortCommand,
      filterCommand,
      dispatch,
      node.id,
      filterOpLabels,
      isTree,
      expandAction,
    ]
  )

  const sizing = useSduiColumnSizing(node)

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: sizing.enableColumnResizing,
    columnResizeMode: sizing.columnResizeMode,
    state: { columnSizing: sizing.columnSizing },
    onColumnSizingChange: sizing.onColumnSizingChange,
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
      {/* Период, отборы и поиск — ОДНОЙ строкой, как шапка журнала 1С: там «Период»,
          «Организация» и прочие параметры стоят в ряд, а не двумя этажами над таблицей
          (обращение 20.09.2026). Ряд переносится, когда параметров больше, чем ширины. */}
      <div className="flex flex-wrap items-center gap-4">
        {periodCommand && (
          <ListPeriodControl
            period={periodProp ?? { from: null, to: null }}
            command={periodCommand}
            nodeId={node.id}
            dispatch={dispatch}
          />
        )}

        {filterCommand && (
          <ListQuickFilters
            filters={quickFilters}
            onApply={(field, op, value) => {
              void dispatch({
                type: 'COMMAND',
                command: filterCommand,
                value:
                  value === undefined ? { field, op } : { field, op, value },
                sourceNodeId: node.id,
              })
            }}
          />
        )}

        {searchable && (
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={search}
            className="ml-auto w-62.5 bg-ui-01"
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
        )}
      </div>

      {clearFilterCommand && clearAllFiltersCommand && (
        <ListFilterChips
          chips={filterChips}
          onRemove={(field) => {
            void dispatch({
              type: 'COMMAND',
              command: clearFilterCommand,
              value: { field },
              sourceNodeId: node.id,
            })
          }}
          onClearAll={() => {
            void dispatch({
              type: 'COMMAND',
              command: clearAllFiltersCommand,
              sourceNodeId: node.id,
            })
          }}
        />
      )}

      {/* §8.7 п.2: в дереве панель крошек не рендерим — TOOLBAR крошек с
          бэка и не придёт, а клиентский trail принадлежит drill-down. */}
      {!isTree && (
        <ListBreadcrumbs
          trail={isSearchMode ? [] : trail}
          onNavigate={navigateToDepth}
        />
      )}

      <ListTable
        table={table}
        canDrillInto={canDrillInto}
        onDrillInto={drillInto}
        showFolderIcon={showFolderIcon}
        isResizable={sizing.isResizable}
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
        onExport={
          exportCommand
            ? () => {
                void dispatch({
                  type: 'COMMAND',
                  command: exportCommand,
                  sourceNodeId: node.id,
                })
              }
            : undefined
        }
      />
    </div>
  )
}
