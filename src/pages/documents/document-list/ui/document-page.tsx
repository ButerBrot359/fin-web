import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import { useDocumentType } from '@/entities/document-type'
import type { DocumentEntry } from '@/entities/document-entry'
import {
  ActiveFiltersBar,
  isFilterableDocumentType,
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

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)

  const filterEnabled = isFilterableDocumentType(moduleCode)
  const filterTableId = filterEnabled ? moduleCode : undefined
  const { columns: columnsMeta } = useEavColumnsMeta(
    DOCUMENT_DOMAIN_CONFIG,
    filterEnabled ? moduleCode : ''
  )

  useFilterUrlSync(filterTableId)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedRowName, setSelectedRowName] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(filterTableId ?? '__none__')
  const activeFilter = filterTableId ? filterRequest : undefined

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
  } = useEavEntries<DocumentEntry>(DOCUMENT_DOMAIN_CONFIG, moduleCode, {
    sortAttr,
    sortDir,
    filter: activeFilter,
  })

  const columns = useDocumentColumns(attributes)

  const handleSelectRow = (row: DocumentEntry) => {
    setSelectedRowId(row.id)
    setSelectedRowName(row.nameRu)
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
        selectedRowName={selectedRowName}
      />
      {filterTableId && (
        <ActiveFiltersBar tableId={filterTableId} columns={columnsMeta} />
      )}
      <EavEntityTable<DocumentEntry>
        filterTableId={filterTableId}
        columns={columns}
        columnsMeta={filterEnabled ? columnsMeta : undefined}
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
        selectedRowId={selectedRowId}
        onRowClick={handleSelectRow}
        onRowDoubleClick={handleDoubleClick}
      />
    </div>
  )
}
