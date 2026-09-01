import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import {
  ActiveFiltersBar,
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
import { useInformationRegisterColumns } from '../lib/hooks/use-information-register-columns'
import type { InformationRegisterEntry } from '../types/information-register'
import { InformationRegisterListToolbar } from './information-register-list-toolbar'
import {
  InformationRegisterRowContextMenu,
  type RegisterMenuPosition,
} from './information-register-row-context-menu'

export const InformationRegisterPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'INFORMATION_REGISTER'

  const {
    title,
    attributes,
    canEdit,
    isLoading: isLoadingType,
  } = useInformationRegisterType(domain, moduleCode)
  useTabMeta(title)

  const { columns: columnsMeta } = useEavColumnsMeta(
    INFORMATION_REGISTER_DOMAIN_CONFIG,
    moduleCode
  )

  useFilterUrlSync(moduleCode)

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const filterRequest = useTableFilterRequest(moduleCode)

  // columnsMeta после `/columns` уже включает системные поля
  // (id, period, recorderDocumentEntryId, isActive). Используем как есть —
  // patch'ить нечего, self-FK для регистров не релевантен.
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
  } = useEavEntries<InformationRegisterEntry>(
    INFORMATION_REGISTER_DOMAIN_CONFIG,
    moduleCode,
    {
      sortAttr,
      sortDir,
      filter: filterRequest,
    }
  )

  const columns = useInformationRegisterColumns(attributes, columnsMeta)

  // SCRUM-353: создание/правка записи — SDUI-карточка через catch-all,
  // тот же паттерн, что у справочника (dictionary-page.tsx).
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    position: RegisterMenuPosition
    entry: InformationRegisterEntry | null
  } | null>(null)

  const entryPath = (tail: string) =>
    `/modules/${pageCode}/informationregister/${moduleCode}/${tail}?domain=${domain}`

  const openCreate = () => {
    void navigate(entryPath('new'))
  }

  const openEntry = (entry: InformationRegisterEntry) => {
    void navigate(entryPath(String(entry.id)))
  }

  const handleRowContextMenu = (
    entry: InformationRegisterEntry | null,
    e: ReactMouseEvent
  ) => {
    // Гасим нативное меню браузера и всплытие до обёртки (иначе wrapper
    // перезапишет строку на «пустую область»).
    e.preventDefault()
    e.stopPropagation()
    window.getSelection()?.removeAllRanges()
    setContextMenu({ position: { top: e.clientY, left: e.clientX }, entry })
  }

  // ПКМ по пустой области таблицы (§10.3): показываем только «Создать» —
  // как в 1С, создать можно без выделенной строки.
  const handleEmptyAreaContextMenu = (e: ReactMouseEvent) => {
    if (!canEdit) return
    handleRowContextMenu(null, e)
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      {canEdit && <InformationRegisterListToolbar onCreate={openCreate} />}
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <div
        className="flex min-h-0 flex-1 flex-col"
        onContextMenu={handleEmptyAreaContextMenu}
      >
        <EavEntityTable<InformationRegisterEntry>
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
          selectedRowId={canEdit ? selectedRowId : undefined}
          onRowClick={
            canEdit
              ? (entry) => {
                  setSelectedRowId(entry.id)
                }
              : undefined
          }
          onRowDoubleClick={canEdit ? openEntry : undefined}
          onRowContextMenu={canEdit ? handleRowContextMenu : undefined}
        />
      </div>
      {canEdit && (
        <InformationRegisterRowContextMenu
          position={contextMenu?.position ?? null}
          onClose={() => {
            setContextMenu(null)
          }}
          onCreate={openCreate}
          hasEntry={contextMenu?.entry != null}
          onEdit={() => {
            if (contextMenu?.entry) openEntry(contextMenu.entry)
          }}
        />
      )}
    </div>
  )
}
