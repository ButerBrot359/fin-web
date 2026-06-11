import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import {
  ActiveFiltersBar,
  useFilterUrlSync,
  useTableFilterRequest,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  ACCOUNTING_REGISTER_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { PageHeader } from '@/widgets/page-header'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useAccountingRegisterType } from '../lib/hooks/use-accounting-register-type'
import { useAccountingRegisterColumns } from '../lib/hooks/use-accounting-register-columns'
import { useAccountingRegisterExport } from '../lib/hooks/use-accounting-register-export'
import type { AccountingRegisterEntry } from '../types/accounting-register'

export const AccountingRegisterPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'ACCOUNTING_REGISTER'

  const { title, isLoading: isLoadingType } = useAccountingRegisterType(
    domain,
    moduleCode
  )
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    ACCOUNTING_REGISTER_DOMAIN_CONFIG,
    moduleCode
  )

  useFilterUrlSync(moduleCode)

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(moduleCode)

  const {
    entries,
    totalElements,
    isLoading: isLoadingEntries,
    isSortingOrFiltering,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    fetchAllEntries,
  } = useEavEntries<AccountingRegisterEntry>(
    ACCOUNTING_REGISTER_DOMAIN_CONFIG,
    moduleCode,
    {
      sortAttr,
      sortDir,
      filter: filterRequest,
    }
  )

  const columns = useAccountingRegisterColumns(columnsMeta)
  const buildExportData = useAccountingRegisterExport(columnsMeta)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <EavEntityTable<AccountingRegisterEntry>
        filterTableId={moduleCode}
        columns={columns}
        columnsMeta={columnsMeta}
        entries={entries}
        totalElements={totalElements}
        isLoading={isLoadingEntries}
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
        buildExportData={buildExportData}
      />
    </div>
  )
}
