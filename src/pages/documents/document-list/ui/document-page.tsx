import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState, VisibilityState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

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
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'
import { EavEntityTable } from '@/widgets/eav-entity-table'
import { showToast } from '@/shared/ui/toast/show-toast'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { documentEntryLink } from '../lib/document-entry-link'
import { useDocumentColumns } from '../lib/hooks/use-document-columns'
import { DocumentListSettingsDialog } from './document-list-settings-dialog'
import { TABEL_LIST_PERIOD_FIELD } from '../lib/tabel-list-period'
import { TabelListPeriodDialog } from './tabel-list-period-dialog'
import { TabelSelectedBulkEditDialog } from './tabel-selected-bulk-edit-dialog'

// This is deliberately opt-in. Other legacy document lists do not yet have
// evidence-backed multi-row commands, while 1C Табель uses row selection for
// its list output and future bulk edit.
const TABEL_TYPE_CODE = 'Tabel'

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    DOCUMENT_DOMAIN_CONFIG,
    moduleCode
  )

  useFilterUrlSync(moduleCode)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([])
  const [selectedRowIsPosted, setSelectedRowIsPosted] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [listSettingsOpen, setListSettingsOpen] = useState(false)
  const [listOutputOpen, setListOutputOpen] = useState(false)
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(moduleCode)
  const tabelListSupportsMultiRowSelection = moduleCode === TABEL_TYPE_CODE
  const setListFilter = useTableFilterStore((state) => state.setFilter)
  const tabelPeriodCondition = filterRequest.filters.find(
    (condition) => condition.field === TABEL_LIST_PERIOD_FIELD
  )

  const debouncedSearch = useDebouncedValue(searchValue, 300)
  const searchFilterRequest = useMemo(
    () => ({
      ...filterRequest,
      q: debouncedSearch.trim() || undefined,
    }),
    [debouncedSearch, filterRequest]
  )

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
    filter: searchFilterRequest,
  })

  const columns = useDocumentColumns(attributes)
  const listOutputColumns = useMemo(
    () => [
      ...attributes
        .filter((attribute) => attribute.showInList)
        .sort((left, right) => left.tableSortOrder - right.tableSortOrder)
        .map((attribute) => ({
          id: attribute.code,
          label: getLocalizedName(attribute, i18n.language),
        })),
      { id: 'nameRu', label: t('documentTable.link') },
    ],
    [attributes, i18n.language, t]
  )

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
        onOpenListOutput={() => {
          setListOutputOpen(true)
        }}
        onOpenPeriod={
          tabelListSupportsMultiRowSelection
            ? () => {
                setPeriodDialogOpen(true)
              }
            : undefined
        }
        onEditSelected={
          tabelListSupportsMultiRowSelection
            ? () => {
                if (selectedRowIds.length === 0) {
                  showToast('error', t('tabelBulkEdit.emptySelection'))
                  return
                }
                setBulkEditDialogOpen(true)
              }
            : undefined
        }
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onClearSearch={() => {
          setSearchValue('')
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
        listOutputColumns={listOutputColumns}
        listOutputOpen={listOutputOpen}
        onListOutputClose={() => {
          setListOutputOpen(false)
        }}
        multiRowSelection={tabelListSupportsMultiRowSelection}
        selectedRowIds={selectedRowIds}
        onSelectedRowIdsChange={setSelectedRowIds}
        listOutputSelectedRowsSupported={tabelListSupportsMultiRowSelection}
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
      <TabelListPeriodDialog
        open={periodDialogOpen}
        currentCondition={tabelPeriodCondition}
        onApply={(condition) => {
          setListFilter(moduleCode, TABEL_LIST_PERIOD_FIELD, condition)
          setPeriodDialogOpen(false)
        }}
        onClose={() => {
          setPeriodDialogOpen(false)
        }}
      />
      <TabelSelectedBulkEditDialog
        open={bulkEditDialogOpen}
        selectedEntryIds={selectedRowIds}
        onClose={() => {
          setBulkEditDialogOpen(false)
        }}
      />
    </div>
  )
}
