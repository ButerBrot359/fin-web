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
// Импорт по прямому пути, а не через бочку @/features/table-filter: та тянет за собой
// api/i18n-инициализацию ради одного 10-строчного хука (в этом же файле по той же причине
// SearchInput берётся прямым путём).
import { useDebouncedValue } from '@/features/table-filter/lib/hooks/use-debounced-value'
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
import { ListBreadcrumbs, type ListTrailEntry } from './list-breadcrumbs'
import {
  buildLevelParams,
  isGroupRow,
  parseSelectedPath,
  resolveRowLabel,
  supportsHierarchy,
} from './list-hierarchy'

import type { NodeProps } from '../../../types/view'
import { readPagination } from '../../../lib/utils/pagination'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
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
  // SCRUM-368: размер страницы задаёт бэк (props.pagination.pageSize);
  // старый фронтовый хардкод 25 — фолбэк для ответов без контракта
  const pageSize = readPagination(node)?.pageSize ?? PAGE_SIZE

  const columnNodes = useMemo(
    () => (node.children ?? []).filter((c) => c.type === 'TABLE_COLUMN'),
    [node.children]
  )

  const selectAction = node.actions?.find((a) => a.trigger === 'select')
  const activateAction = node.actions?.find((a) => a.trigger === 'activate')

  // SCRUM-362 B-1: команды приезжают готовыми в node.actions, строка command
  // непрозрачна — фронт больше не собирает их по шаблону и не выкусывает
  // {TypeCode}. Набор actions — сигнал capability: sort/filter/clearFilter/
  // clearAllFilters/period сервер шлёт только на транспорте SEARCH, поэтому
  // контролы гейтятся наличием action (на PAGED их нет — это корректно).
  const sortCommand = node.actions?.find((a) => a.trigger === 'sort')?.command
  const filterCommand = node.actions?.find(
    (a) => a.trigger === 'filter'
  )?.command
  const clearFilterCommand = node.actions?.find(
    (a) => a.trigger === 'clearFilter'
  )?.command
  const clearAllFiltersCommand = node.actions?.find(
    (a) => a.trigger === 'clearAllFilters'
  )?.command
  const periodCommand = node.actions?.find(
    (a) => a.trigger === 'period'
  )?.command
  // Кнопка «Выгрузить в Excel» в подвале: команда приходит готовой (list.exportList:all —
  // прямая серверная выгрузка без диалога колонок). Нет действия — нет кнопки.
  const exportCommand = node.actions?.find(
    (a) => a.trigger === 'export'
  )?.command

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
  // Подавление дублей in-flight: пока предыдущий list.applySort не завершился —
  // повторные клики по заголовкам игнорируются («последний выигрывает» не требуется).
  const sortInFlightRef = useRef(false)

  const [search, setSearch] = useState('')
  // Запрос уходит НЕ на каждое нажатие клавиши: у LIST-узла search сидит в queryKey, а смена
  // ключа сбрасывает бесконечную прокрутку и перезапускает EAV-поиск. Пауза та же, что у
  // пикера ссылочного поля (use-reference-options) и легаси-списков.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  // Панель выбора открывается на записи, стоящей в поле: сервер кладёт её id в
  // props.selectedId (клиенту неоткуда его взять — панель приходит отдельным
  // поддеревом и связи с полем не имеет).
  const serverSelectedId = node.props?.selectedId as number | undefined
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    serverSelectedId ?? null
  )

  // Путь по папкам справочника; пустой — корневой уровень. Начальное значение —
  // с сервера: если запись из поля лежит внутри папки, панель открывается сразу там,
  // иначе выделять на корне нечего (её строки там просто нет).
  const [trail, setTrail] = useState<ListTrailEntry[]>(() =>
    parseSelectedPath(node.props?.selectedPath)
  )
  const isHierarchical = supportsHierarchy(source)
  // Режим поиска считается по ОТЛОЖЕННОЙ строке — вместе с ней меняется и уровень папки
  // (parent уходит из запроса), иначе на первом же символе улетал бы лишний запрос по всему
  // дереву, ещё без самого поиска.
  const isSearchMode = debouncedSearch.trim().length > 0
  // Непустой поиск уплощает уровни и ищет по всему справочнику (эталон 1С): `parent`
  // вместе с поисковой строкой бэк отвергает (HTTP 400 — поиск внутри папки не
  // поддержан). Путь при этом сохраняется: очистили поиск — вернулись на свой уровень.
  const parentId = isSearchMode ? undefined : trail.at(-1)?.id
  const levelParams = isHierarchical
    ? buildLevelParams(source?.params, parentId)
    : source?.params

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
      levelParams,
      source?.method,
      source?.body,
      debouncedSearch,
      pageSize,
    ],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('LIST node: source is required')
      return fetchListPage({
        url: source.url,
        params: levelParams,
        method: source.method,
        body: source.body,
        page: pageParam,
        size: pageSize,
        search: debouncedSearch,
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
    if (!sentinel) return

    // root НЕ задаём. Раньше корнем был scrollRef, но прокручивается он не всегда:
    // в drawer-панели высота не ограничена (PAGE не тянется по высоте), скроллится
    // внешний контейнер, а сентинел внутри scrollRef остаётся в его области всегда —
    // наблюдатель срабатывал один раз при observe() и больше никогда, из-за чего
    // подгрузка вставала на второй странице («Загружено 50 из 110»). Пересечение с
    // вьюпортом считается с учётом отсечения всеми прокручиваемыми предками, поэтому
    // работает в обоих случаях.
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return
      const { hasNextPage, isFetchingNextPage, fetchNextPage } =
        loadMoreRef.current
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage()
      }
    })

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
    // rows.length в зависимостях — пересоздаём наблюдателя после каждой подгруженной
    // страницы: если сентинел так и остался в зоне видимости, событие пересечения
    // повторно не придёт и цепочка подгрузки оборвётся.
  }, [isLoading, rows.length])

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

  // Провал в папку: строка-группа — навигация внутрь, а не выбор значения.
  const drillInto = (row: ListRow) => {
    setSelectedRowId(null)
    setTrail((prev) => [...prev, { id: row.id, label: resolveRowLabel(row) }])
  }

  const canDrillInto = (row: ListRow) =>
    isHierarchical && !isSearchMode && isGroupRow(row)

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

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () =>
      buildListColumns({
        columnNodes,
        sortState,
        sortCommand,
        filterCommand,
        filterOpLabels,
        dispatch,
        nodeId: node.id,
        sortInFlightRef,
      }),
    [
      columnNodes,
      sortState,
      sortCommand,
      filterCommand,
      dispatch,
      node.id,
      filterOpLabels,
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
      <div className="flex items-center justify-between">
        {periodCommand ? (
          <ListPeriodControl
            period={periodProp ?? { from: null, to: null }}
            command={periodCommand}
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

      <ListBreadcrumbs
        trail={isSearchMode ? [] : trail}
        onNavigate={(depth) => {
          setSelectedRowId(null)
          setTrail((prev) => prev.slice(0, depth))
        }}
      />

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
