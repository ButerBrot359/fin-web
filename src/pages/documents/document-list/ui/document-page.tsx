import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState, VisibilityState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { useDocumentType } from '@/entities/document-type'
import type { DocumentEntry } from '@/entities/document-entry'
import {
  ActiveFiltersBar,
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
import { showToast } from '@/shared/ui/toast/show-toast'

import { documentEntryLink } from '../lib/document-entry-link'
import { useDocumentColumns } from '../lib/hooks/use-document-columns'
import { DocumentListSettingsDialog } from './document-list-settings-dialog'

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    DOCUMENT_DOMAIN_CONFIG,
    moduleCode
  )

  useFilterUrlSync(moduleCode)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedRowIsPosted, setSelectedRowIsPosted] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [listSettingsOpen, setListSettingsOpen] = useState(false)

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(moduleCode)

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
    filter: filterRequest,
  })

  const columns = useDocumentColumns(attributes)

  const handleSelectRow = (row: DocumentEntry) => {
    setSelectedRowId(row.id)
    setSelectedRowIsPosted(row.isPosted)
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

  const handleGetLink = () => {
    // The DOM type declares clipboard non-null, but some embedded/webview
    // receivers do not expose it at runtime.
    const clipboard = Reflect.get(navigator, 'clipboard') as
      | Clipboard
      | undefined
    if (
      selectedRowId === null ||
      !clipboard ||
      typeof clipboard.writeText !== 'function'
    ) {
      showToast('error', t('actions.copyError'))
      return
    }

    void clipboard
      .writeText(
        documentEntryLink(moduleCode, selectedRowId, window.location.origin)
      )
      .then(() => {
        showToast('success', t('actions.copied'))
      })
      .catch(() => {
        showToast('error', t('actions.copyError'))
      })
  }

  return (
    <div className="flex flex-col gap-5 pt-5 h-full">
      <PageHeader
        title={title}
        onClose={handleClose}
        onLink={selectedRowId === null ? undefined : handleGetLink}
      />
      <DocumentListToolbar
        selectedRowId={selectedRowId}
        selectedRowIsPosted={selectedRowIsPosted}
        onSelectedRowPostedChange={setSelectedRowIsPosted}
        onOpenListSettings={() => {
          setListSettingsOpen(true)
        }}
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
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        exportFileName={title}
        fetchAllEntries={fetchAllEntries}
        selectedRowId={selectedRowId}
        onRowClick={handleSelectRow}
        onRowDoubleClick={handleDoubleClick}
      />
      <DocumentListSettingsDialog
        open={listSettingsOpen}
        tableId={moduleCode}
        columns={columnsMeta}
        columnVisibility={columnVisibility}
        sorting={sorting}
        onClose={() => {
          setListSettingsOpen(false)
        }}
        onColumnVisibilityChange={setColumnVisibility}
        onSortingChange={setSorting}
      />
    </div>
  )
}
