import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'

import { useModule } from '@/entities/module'
import type { DictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import {
  ActiveFiltersBar,
  useFilterUrlSync,
  useTableFilterRequest,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  DICTIONARY_DOMAIN_CONFIG,
  useEavColumnsMeta,
  useEavEntries,
  type ColumnMetaDto,
} from '@/shared/lib/eav'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { PageHeader } from '@/widgets/page-header'
import { DictionaryListToolbar } from '@/widgets/dictionary-list-toolbar'
import { EavEntityTable } from '@/widgets/eav-entity-table'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import { useDictionaryType } from '../lib/hooks/use-dictionary-type'
import { useFolderNavigation } from '../lib/hooks/use-folder-navigation'
import { useDictionaryColumns } from '../lib/hooks/use-dictionary-columns'
import { CreateGroupModal } from './create-group-modal'

/**
 * Для self-FK на текущий справочник (например `parentId`) бэк присылает
 * `referencedTypeCode = null`. UI автокомплита фильтра без `referencedTypeCode`
 * не работает — фолбэчим на typeCode самой страницы.
 *
 * TODO(backend): убрать после фикса gap бэка #10 (присылать self-FK как обычный
 * referencedTypeCode).
 */
const patchSelfFkParentId = (
  columns: ColumnMetaDto[],
  typeCode: string
): ColumnMetaDto[] =>
  columns.map((c) =>
    c.code === 'parentId' &&
    c.dataType === 'DICTIONARY' &&
    !c.referencedTypeCode
      ? { ...c, referencedTypeCode: typeCode, referencedDomainKind: 'DICTIONARY' }
      : c
  )

export const DictionaryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { i18n } = useTranslation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'DICTIONARY'

  const { data: moduleItems } = useModule(pageCode)
  const skipDependsOn = moduleItems.some((column) =>
    column.some((section) =>
      section.elements.some((el) => el.code === moduleCode && el.skipDependsOn)
    )
  )

  const { title, attributes, typeData, isLoading: isLoadingType } =
    useDictionaryType(domain, moduleCode)
  const isHierarchical = typeData?.isHierarchical ?? false

  useTabMeta(title)

  const { columns: rawColumnsMeta } = useEavColumnsMeta(
    DICTIONARY_DOMAIN_CONFIG,
    moduleCode
  )
  const columnsMeta = useMemo(
    () => patchSelfFkParentId(rawColumnsMeta, moduleCode),
    [rawColumnsMeta, moduleCode]
  )

  useFilterUrlSync(moduleCode)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const { openFolders, currentParentId, openFolder, closeFolder } =
    useFolderNavigation()

  const filterRequest = useTableFilterRequest(moduleCode)

  const eavExtra = useMemo(
    () => ({
      ...(skipDependsOn && { skipDependsOn: true }),
      ...(currentParentId != null && { parent: currentParentId }),
    }),
    [skipDependsOn, currentParentId]
  )
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
  } = useEavEntries<DictEntry>(DICTIONARY_DOMAIN_CONFIG, moduleCode, {
    sortAttr,
    sortDir,
    filter: filterRequest,
    extraParams: eavExtra,
  })

  // Группы — выше элементов; иерархические столбцы рендерим только в иерархичных
  // справочниках.
  const sortedEntries = useMemo(() => {
    if (!isHierarchical) return entries
    const groups = entries.filter((e) => e.isGroup)
    const items = entries.filter((e) => !e.isGroup)
    return [...groups, ...items]
  }, [entries, isHierarchical])

  const columns = useDictionaryColumns(
    attributes,
    isHierarchical,
    openFolders.length
  )

  const handleRowClick = (entry: DictEntry) => {
    if (isHierarchical && entry.isGroup) {
      openFolder({
        id: entry.id,
        name: getLocalizedName(entry, i18n.language),
      })
      return
    }
    setSelectedRowId(entry.id)
  }

  const handleDoubleClick = (entry: DictEntry) => {
    if (isHierarchical && entry.isGroup) return
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/${String(entry.id)}?domain=${domain}`
    )
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  // Ancestor folder rows для drill-down (только в иерархических справочниках).
  const ancestorRows = isHierarchical ? (
    <>
      {openFolders.map((folder, index) => (
        <tr
          key={`ancestor-${String(folder.id)}`}
          className="cursor-pointer transition-colors hover:bg-ui-07"
          onClick={() => {
            closeFolder(folder.id)
          }}
        >
          <td className="whitespace-nowrap px-3 py-2 first:rounded-l-md">
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: index * 24 }}
            >
              <ArrowDownIcon className="h-3 w-3 shrink-0" />
              <FolderIcon className="h-4 w-4 shrink-0" />
            </div>
          </td>
          <td
            colSpan={columns.length - 1}
            className="py-2 last:rounded-r-md"
          />
        </tr>
      ))}
    </>
  ) : undefined

  if (isLoadingType) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <DictionaryListToolbar
        selectedRowId={selectedRowId}
        domain={domain}
        isHierarchical={isHierarchical}
        onCreateGroup={() => {
          setIsCreateGroupOpen(true)
        }}
      />
      <ActiveFiltersBar tableId={moduleCode} columns={columnsMeta} />
      <EavEntityTable<DictEntry>
        filterTableId={moduleCode}
        columns={columns}
        columnsMeta={columnsMeta}
        entries={sortedEntries}
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
        selectedRowId={selectedRowId}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleDoubleClick}
        extraRowsAbove={ancestorRows}
      />
      {isHierarchical && (
        <CreateGroupModal
          open={isCreateGroupOpen}
          onClose={() => {
            setIsCreateGroupOpen(false)
          }}
          domain={domain}
          typeCode={moduleCode}
          parentId={currentParentId}
        />
      )}
    </div>
  )
}
