import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'

import {
  ActiveFiltersBar,
  useDebouncedValue,
  useFilterUrlSync,
  useTableFilterRequest,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  INFORMATION_REGISTER_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
} from '@/shared/lib/eav'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'
import { showToast } from '@/shared/ui/toast/show-toast'
import { PageHeader } from '@/widgets/page-header'
import { EavEntityTable } from '@/widgets/eav-entity-table'

import { deleteInformationRegisterEntry } from '../api/information-register-api'

import { useInformationRegisterType } from '../lib/hooks/use-information-register-type'
import { useInformationRegisterColumns } from '../lib/hooks/use-information-register-columns'
import type { InformationRegisterEntry } from '../types/information-register'
import { InformationRegisterListToolbar } from './information-register-list-toolbar'
import {
  InformationRegisterRowContextMenu,
  type RegisterMenuPosition,
} from './information-register-row-context-menu'

/** Поиск фильтрует по вводу, без Enter — как строка поиска формы списка 1С. */
const SEARCH_DEBOUNCE_MS = 300

export const InformationRegisterPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
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

  // Строка поиска над списком: значение уходит в тело FilterRequest.q, откуда
  // бэк строит предикат по колонкам списка (измерения, ресурсы, представления
  // ссылок) — тем же трактом, что у справочника и документа.
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const filter = debouncedSearch
    ? { ...filterRequest, q: debouncedSearch }
    : filterRequest

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
      filter,
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

  // «Скопировать» — тот же приём, что у справочника и документа: карточка новой
  // записи открывается с ?copyFrom=<id>, значения подставляет сервер (OPEN).
  const openCopy = () => {
    if (selectedRowId == null) return
    void navigate(`${entryPath('new')}&copyFrom=${String(selectedRowId)}`)
  }

  const openSelected = () => {
    if (selectedRowId == null) return
    void navigate(entryPath(String(selectedRowId)))
  }

  const refreshList = () => {
    void queryClient.invalidateQueries({
      queryKey: ['information-register', 'entries'],
    })
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInformationRegisterEntry(id),
    onSuccess: () => {
      // Удалённая запись не должна остаться «выделенной»: команды тулбара
      // работают от selectedRowId и иначе стреляли бы по несуществующему id.
      setSelectedRowId(null)
      refreshList()
      showToast('success', t('informationRegister.deleteSuccess'))
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('informationRegister.deleteError')
      )
    },
  })

  const confirmDelete = () => {
    setDeleteDialogOpen(false)
    if (selectedRowId != null) deleteMutation.mutate(selectedRowId)
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
    // ПКМ выделяет строку (как в 1С): команды контекстного меню и тулбара
    // работают от ОДНОГО selectedRowId, а не от двух разных источников.
    setSelectedRowId(entry?.id ?? null)
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
      {canEdit && (
        <InformationRegisterListToolbar
          onCreate={openCreate}
          onCopy={openCopy}
          onEdit={openSelected}
          onDelete={() => {
            setDeleteDialogOpen(true)
          }}
          onRefresh={refreshList}
          hasSelection={selectedRowId != null}
          isDeleting={deleteMutation.isPending}
          searchValue={search}
          onSearchChange={setSearch}
        />
      )}
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
          onCopy={openCopy}
          onDelete={() => {
            setDeleteDialogOpen(true)
          }}
          onRefresh={refreshList}
        />
      )}
      <ConfirmDialog
        open={deleteDialogOpen}
        title={t('informationRegister.deleteTitle')}
        message={t('informationRegister.deleteMessage')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false)
        }}
      />
    </div>
  )
}
