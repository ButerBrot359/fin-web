import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import { useDocumentType } from '@/entities/document-type'
import type { DocumentEntry } from '@/entities/document-entry'
import {
  ActiveFiltersBar,
  useDebouncedValue,
  useFilterUrlSync,
  useTableFilterRequest,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  DOCUMENT_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useDocumentColumns } from '../lib/hooks/use-document-columns'

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

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
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

  const columns = useDocumentColumns(attributes)

  const handleSelectRow = (row: DocumentEntry) => {
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
        selectedRowId={selectedRowId}
        searchValue={search}
        onSearchChange={setSearch}
      />
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <EavEntityTable<DocumentEntry>
        filterTableId={moduleCode}
        columns={columns}
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
        selectedRowId={selectedRowId}
        onRowClick={handleSelectRow}
        onRowDoubleClick={handleDoubleClick}
      />
    </div>
  )
}
