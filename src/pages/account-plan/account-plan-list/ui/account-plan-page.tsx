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
  ACCOUNT_PLAN_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { PageHeader } from '@/widgets/page-header'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useAccountPlanType } from '../lib/hooks/use-account-plan-type'
import { useAccountPlanColumns } from '../lib/hooks/use-account-plan-columns'
import type { AccountPlanEntry } from '../types/account-plan'

export const AccountPlanPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'ACCOUNT_PLAN'

  const {
    title,
    attributes,
    isLoading: isLoadingType,
  } = useAccountPlanType(domain, moduleCode)
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    ACCOUNT_PLAN_DOMAIN_CONFIG,
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
  } = useEavEntries<AccountPlanEntry>(ACCOUNT_PLAN_DOMAIN_CONFIG, moduleCode, {
    sortAttr,
    sortDir,
    filter: filterRequest,
  })

  const columns = useAccountPlanColumns(attributes)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <EavEntityTable<AccountPlanEntry>
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
      />
    </div>
  )
}
