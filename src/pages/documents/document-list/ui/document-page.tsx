import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'

import { useDocumentType } from '@/entities/document-type'
import type { DocumentEntry } from '@/entities/document-entry'
import {
  ActiveFiltersBar,
  useDebouncedValue,
  useFilterUrlSync,
  useTableFilterRequest,
  useTableFilterStore,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  DOCUMENT_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { invalidateDocumentListQueries } from '@/shared/lib/query/invalidate-entities'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useDocumentColumns } from '../lib/hooks/use-document-columns'
import { TABEL_COLUMN_ORDER, TABEL_TYPE_CODE } from '../lib/consts/tabel-list'
import { buildTabelSelectionColumn } from '../lib/utils/tabel-selection-column'
import { TabelListCriteria } from './tabel-list-criteria'

// SCRUM-360 §2: та же задержка, что у DictField (DEBOUNCE_MS).
const SEARCH_DEBOUNCE_MS = 300

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    DOCUMENT_DOMAIN_CONFIG,
    moduleCode
  )

  useFilterUrlSync(moduleCode)

  // SCRUM-276 spec v2: список Табеля — единственный с мультивыбором и
  // критериями над таблицей; поведение прочих типов не меняется
  const isTabel = moduleCode === TABEL_TYPE_CODE

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sorting, setSorting] = useState<SortingState>([])

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(moduleCode)

  // SCRUM-360 §2: поиск фильтрует по вводу (без Enter), с дебаунсом; значение
  // уходит в тело FilterRequest.q, а не query-параметром.
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const filter = debouncedSearch
    ? { ...filterRequest, q: debouncedSearch }
    : filterRequest

  const {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    fetchAllEntries,
  } = useEavEntries<DocumentEntry>(DOCUMENT_DOMAIN_CONFIG, moduleCode, {
    sortAttr,
    sortDir,
    filter,
  })

  const columns = useDocumentColumns(
    attributes,
    isTabel ? { columnOrder: TABEL_COLUMN_ORDER, hideStatus: true } : undefined
  )

  const queryClient = useQueryClient()

  // Выбор без эффектов: id, выпавшие из списка после перезапроса, отсекаются
  // на выводе — в state могут остаться, но никуда не передаются
  const entryIds = entries.map((e) => e.id)
  const knownIds = new Set(entryIds)
  const effectiveSelected = isTabel
    ? new Set([...selectedIds].filter((id) => knownIds.has(id)))
    : selectedIds

  // Команды «ровно 1 строка» (копирование, печать, отчёты) работают от
  // единственного выбранного id — при 0 или >1 они недоступны (§3.3)
  const singleSelectedId = isTabel
    ? effectiveSelected.size === 1
      ? [...effectiveSelected][0]
      : null
    : selectedRowId

  const tableColumns = isTabel
    ? [
        buildTabelSelectionColumn({
          selectedIds: effectiveSelected,
          loadedIds: entryIds,
          onToggle: (id, checked) => {
            setSelectedIds((prev) => {
              const next = new Set(prev)
              if (checked) next.add(id)
              else next.delete(id)
              return next
            })
          },
          onToggleAll: (checked) => {
            setSelectedIds(checked ? new Set(entryIds) : new Set())
          },
        }),
        ...columns,
      ]
    : columns

  const handleSelectRow = (row: DocumentEntry) => {
    if (isTabel) {
      // Клик по телу строки выбирает одну строку (1С-паттерн), но собранный
      // чекбоксами мультивыбор (2+) молча не рушит — иначе промах мимо
      // чекбокса незаметно сжимает цель bulk-edit до одной записи
      if (effectiveSelected.size > 1) return
      setSelectedIds(new Set([row.id]))
      return
    }
    setSelectedRowId(row.id)
  }

  const handleDoubleClick = (row: DocumentEntry) => {
    void navigate(
      `/modules/${pageCode}/document/${moduleCode}/${String(row.id)}`
    )
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex flex-col gap-5 pt-5 h-full">
      <PageHeader title={title} onClose={handleClose} />
      <DocumentListToolbar
        selectedRowId={singleSelectedId}
        searchValue={search}
        onSearchChange={setSearch}
        tabel={
          isTabel
            ? {
                selectedIds: [...effectiveSelected],
                selectedEntry:
                  entries.find((e) => e.id === singleSelectedId) ?? null,
                hasCriteria:
                  filterRequest.filters.length > 0 || debouncedSearch !== '',
                onRefresh: () => {
                  invalidateDocumentListQueries(queryClient)
                },
                onCancelSearch: () => {
                  useTableFilterStore.getState().clearAll(moduleCode)
                  setSearch('')
                },
              }
            : undefined
        }
      />
      {isTabel && (
        <TabelListCriteria tableId={moduleCode} attributes={attributes} />
      )}
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <EavEntityTable<DocumentEntry>
        filterTableId={moduleCode}
        columns={tableColumns}
        columnsMeta={columnsMeta}
        entries={entries}
        totalElements={totalElements}
        isLoading={isLoading}
        isSortingOrFiltering={isSortingOrFiltering}
        isError={isError}
        error={error}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        sorting={sorting}
        onSortingChange={setSorting}
        exportFileName={title}
        fetchAllEntries={fetchAllEntries}
        selectedRowId={singleSelectedId}
        onRowClick={handleSelectRow}
        onRowDoubleClick={handleDoubleClick}
      />
    </div>
  )
}
