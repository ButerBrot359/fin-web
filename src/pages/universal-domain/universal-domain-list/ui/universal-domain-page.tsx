import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { useUniversalDomainType } from '../lib/hooks/use-universal-domain-type'
import { useUniversalDomainEntries } from '../lib/hooks/use-universal-domain-entries'
import { useUniversalDomainColumns } from '../lib/hooks/use-universal-domain-columns'
import type { UniversalDomainEntry } from '../types/universal-domain'

/**
 * Универсальная страница-список для типов объектов, у которых нет выделенного
 * контроллера/страницы (например CALCULATION_PLAN). Полностью управляется
 * `domain` (query-параметр) + `:moduleCode` (typeCode): метаданные, колонки и
 * записи берутся из универсального домена бэка
 * (`/api/universaldomain-types`, `/api/universaldomain-entries/.../paged`).
 *
 * Серверная фильтрация по колонкам (POST `/search` + `/columns`) на
 * универсальном домене недоступна — поэтому `columnsMeta` пустой, а колонки
 * строятся по атрибутам типа.
 */
export const UniversalDomainPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? ''

  const {
    title,
    attributes,
    isLoading: isLoadingType,
  } = useUniversalDomainType(domain, moduleCode)
  useTabMeta(title)

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

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
  } = useUniversalDomainEntries(domain, moduleCode, { sortAttr, sortDir })

  const columns = useUniversalDomainColumns(attributes)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <EavEntityTable<UniversalDomainEntry>
        columns={columns}
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
      />
    </div>
  )
}
