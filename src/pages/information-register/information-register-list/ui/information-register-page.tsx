import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import {
  ActiveFiltersBar,
  isFilterableInformationRegisterType,
  useFilterUrlSync,
  useTableFilterRequest,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  INFORMATION_REGISTER_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { PageHeader } from '@/widgets/page-header'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useInformationRegisterType } from '../lib/hooks/use-information-register-type'
import { useInformationRegisterEntries } from '../lib/hooks/use-information-register-entries'
import { useInformationRegisterColumns } from '../lib/hooks/use-information-register-columns'
import type { InformationRegisterEntry } from '../types/information-register'

export const InformationRegisterPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'INFORMATION_REGISTER'

  const { title, attributes, isLoading: isLoadingType } =
    useInformationRegisterType(domain, moduleCode)
  useTabMeta(title)

  const filterEnabled = isFilterableInformationRegisterType(moduleCode)
  const filterTableId = filterEnabled ? moduleCode : undefined
  const { columns: columnsMeta } = useEavColumnsMeta(
    INFORMATION_REGISTER_DOMAIN_CONFIG,
    filterEnabled ? moduleCode : ''
  )

  useFilterUrlSync(filterTableId)

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(filterTableId ?? '__none__')

  // TODO(phase-2-3+): когда FILTERABLE_INFORMATION_REGISTER_TYPES покроет все
  // регистры — удалить legacyQuery + useInformationRegisterEntries GET /paged.
  const eavQuery = useEavEntries<InformationRegisterEntry>(
    INFORMATION_REGISTER_DOMAIN_CONFIG,
    moduleCode,
    {
      sortAttr,
      sortDir,
      filter: filterEnabled ? filterRequest : undefined,
      enabled: filterEnabled,
    }
  )

  const legacyQuery = useInformationRegisterEntries(
    domain,
    moduleCode,
    sortAttr,
    sortDir,
    !filterEnabled
  )

  const entries = filterEnabled ? eavQuery.entries : legacyQuery.entries
  const totalElements = filterEnabled
    ? eavQuery.totalElements
    : legacyQuery.totalElements
  const isLoadingEntries = filterEnabled
    ? eavQuery.isLoading
    : legacyQuery.isLoading
  const isSortingOrFiltering = filterEnabled
    ? eavQuery.isSortingOrFiltering
    : legacyQuery.isSortingOrFiltering
  const hasNextPage = filterEnabled
    ? eavQuery.hasNextPage
    : legacyQuery.hasNextPage
  const isFetchingNextPage = filterEnabled
    ? eavQuery.isFetchingNextPage
    : legacyQuery.isFetchingNextPage
  const fetchNextPage = filterEnabled
    ? eavQuery.fetchNextPage
    : legacyQuery.fetchNextPage

  const columns = useInformationRegisterColumns(attributes)

  // columnsMeta после `/columns` уже включает системные поля
  // (id, period, recorderDocumentEntryId, isActive). Используем как есть —
  // patch'ить нечего, self-FK для регистров не релевантен.
  const effectiveColumnsMeta = useMemo(
    () => (filterEnabled ? columnsMeta : undefined),
    [filterEnabled, columnsMeta]
  )

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      {filterTableId && (
        <ActiveFiltersBar tableId={filterTableId} columns={columnsMeta} />
      )}
      <EavEntityTable<InformationRegisterEntry>
        filterTableId={filterTableId}
        columns={columns}
        columnsMeta={effectiveColumnsMeta}
        entries={entries}
        totalElements={totalElements}
        isLoading={isLoadingEntries}
        isSortingOrFiltering={isSortingOrFiltering}
        isError={filterEnabled ? eavQuery.isError : undefined}
        error={filterEnabled ? eavQuery.error : undefined}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  )
}
