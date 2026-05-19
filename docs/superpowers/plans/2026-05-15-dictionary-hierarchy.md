# Dictionary Hierarchy Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hierarchical drill-down folder navigation to dictionary tables when `isHierarchical: true`, with folder chain rendered inline in the table, a "Create Group" modal, and folder state persistence across tab switches.

**Architecture:** Folder navigation state lives in a lightweight Zustand in-memory store keyed by `location.pathname`. The existing `/paged?parent=ID` API parameter drives data fetching. Ancestor folder rows are prepended to the table body from the in-memory stack; child entries come from the API response with groups sorted first.

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, TanStack Table, TanStack Virtual, MUI Dialog, react-hook-form, Zod

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation-store.ts` | Zustand in-memory store: caches `OpenFolder[]` per tab path |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation.ts` | Hook: reads/writes store, exposes `openFolder`, `closeFolder`, `currentParentId` |
| `src/pages/dictionaries/dictionary-list/ui/create-group-modal.tsx` | MUI Dialog with two fields (nameRu, nameKz), calls createDictEntry with `isGroup: true` |

### Modified Files

| File | Change |
|------|--------|
| `src/features/dict-sidebar/api/dict-sidebar-api.ts` | Add `isGroup?: boolean` to `DictEntry` interface |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-entries.ts` | Add `parentId` param to query key and API call |
| `src/pages/dictionaries/dictionary-list/types/dictionary-table.ts` | Add hierarchy-related props to `DictionaryTableProps` |
| `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-columns.tsx` | Add icon + indent rendering to first column when `isHierarchical` |
| `src/pages/dictionaries/dictionary-list/ui/dictionary-table.tsx` | Render ancestor rows, sort groups first, handle folder click/collapse |
| `src/pages/dictionaries/dictionary-list/ui/dictionary-page.tsx` | Wire `useFolderNavigation`, pass hierarchy props, add "Create Group" button + modal |
| `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx` | Accept and render "Create Group" button when `isHierarchical` |
| `src/app/config/i18n/locales/ru/common.json` | Add translation keys |
| `src/app/config/i18n/locales/kz/common.json` | Add translation keys |

---

## Task 1: Add `isGroup` to `DictEntry` type and `parent` param to API

**Files:**
- Modify: `src/features/dict-sidebar/api/dict-sidebar-api.ts:32-40`
- Modify: `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-entries.ts`

- [ ] **Step 1: Add `isGroup` field to `DictEntry` interface**

In `src/features/dict-sidebar/api/dict-sidebar-api.ts`, add `isGroup` to the `DictEntry` interface:

```ts
export interface DictEntry {
  id: number
  code: string
  nameRu: string
  nameKz: string
  displayName?: string
  isActive: boolean
  isGroup?: boolean
  attributes: Record<string, unknown> | null
}
```

- [ ] **Step 2: Add `parentId` parameter to `useDictionaryEntries`**

In `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-entries.ts`, add `parentId` to the hook signature, query key, and API call:

```ts
export const useDictionaryEntries = (
  domain: string,
  typeCode: string,
  skipDependsOn?: boolean,
  sortAttr?: string,
  sortDir?: string,
  parentId?: number
): UseDictionaryEntriesResult => {
  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dict-entries',
      domain,
      typeCode,
      skipDependsOn,
      sortAttr,
      sortDir,
      parentId,
    ],
    queryFn: ({ pageParam, signal }) =>
      fetchDictEntriesPaged(
        domain,
        typeCode,
        {
          page: pageParam,
          size: PAGE_SIZE,
          ...(skipDependsOn && { skipDependsOn: true }),
          sortAttr,
          sortDir,
          ...(parentId != null && { parent: parentId }),
        },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.data.data.content) ?? [],
    [data]
  )
  const totalElements = data?.pages[0]?.data.data.totalElements ?? 0

  return {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering: isFetching && isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/dict-sidebar/api/dict-sidebar-api.ts src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-entries.ts
git commit -m "feat: add isGroup to DictEntry and parent param to entries query"
```

---

## Task 2: Create folder navigation store and hook

**Files:**
- Create: `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation-store.ts`
- Create: `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation.ts`

- [ ] **Step 1: Create `useFolderNavigationStore`**

Create `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation-store.ts`:

```ts
import { create } from 'zustand'

export interface OpenFolder {
  id: number
  name: string
}

interface FolderNavigationStore {
  cache: Partial<Record<string, OpenFolder[]>>
  setFolders: (path: string, folders: OpenFolder[]) => void
  getFolders: (path: string) => OpenFolder[] | undefined
  removeFolders: (path: string) => void
}

export const useFolderNavigationStore = create<FolderNavigationStore>(
  (set, get) => ({
    cache: {},

    setFolders: (path, folders) => {
      set((state) => ({
        cache: { ...state.cache, [path]: folders },
      }))
    },

    getFolders: (path) => get().cache[path],

    removeFolders: (path) => {
      set((state) => {
        const { [path]: _, ...rest } = state.cache
        return { cache: rest }
      })
    },
  })
)
```

- [ ] **Step 2: Create `useFolderNavigation` hook**

Create `src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation.ts`:

```ts
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  useFolderNavigationStore,
  type OpenFolder,
} from './use-folder-navigation-store'

export const useFolderNavigation = () => {
  const location = useLocation()
  const path = location.pathname

  const store = useFolderNavigationStore()
  const [openFolders, setOpenFoldersLocal] = useState<OpenFolder[]>(
    () => store.getFolders(path) ?? []
  )

  const setFolders = (folders: OpenFolder[]) => {
    setOpenFoldersLocal(folders)
    store.setFolders(path, folders)
  }

  const openFolder = (folder: OpenFolder) => {
    setFolders([...openFolders, folder])
  }

  const closeFolder = (folderId: number) => {
    const index = openFolders.findIndex((f) => f.id === folderId)
    if (index === -1) return
    setFolders(openFolders.slice(0, index))
  }

  const currentParentId =
    openFolders.length > 0 ? openFolders[openFolders.length - 1].id : undefined

  return {
    openFolders,
    currentParentId,
    openFolder,
    closeFolder,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation-store.ts src/pages/dictionaries/dictionary-list/lib/hooks/use-folder-navigation.ts
git commit -m "feat: add folder navigation store and hook"
```

---

## Task 3: Add translation keys

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Add Russian translation keys**

In `src/app/config/i18n/locales/ru/common.json`, add inside the `"actions"` object:

```json
"createGroup": "Создать группу"
```

And add inside the `"dictSidebar"` object (or appropriate section):

```json
"groupCreated": "Группа создана",
"groupCreateError": "Ошибка создания группы"
```

- [ ] **Step 2: Add Kazakh translation keys**

In `src/app/config/i18n/locales/kz/common.json`, add the same keys with Kazakh translations:

```json
"createGroup": "Топ жасау"
```

```json
"groupCreated": "Топ жасалды",
"groupCreateError": "Топ жасау қатесі"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: add translation keys for dictionary group creation"
```

---

## Task 4: Create the "Create Group" modal

**Files:**
- Create: `src/pages/dictionaries/dictionary-list/ui/create-group-modal.tsx`
- Modify: `src/features/dict-sidebar/api/dict-sidebar-api.ts` (add `isGroup` to `DictEntryCreatePayload` if missing)

- [ ] **Step 1: Verify `DictEntryCreatePayload` supports `isGroup`**

Check `src/features/dict-sidebar/api/dict-sidebar-api.ts`. The current `DictEntryCreatePayload` has `parentId` but not `isGroup`. Add `isGroup`:

```ts
export interface DictEntryCreatePayload {
  code?: string
  nameRu: string
  nameKz?: string
  parentId?: number | null
  sortOrder?: number
  isGroup?: boolean
  attributes: Record<string, unknown>
}
```

- [ ] **Step 2: Create the modal component**

Create `src/pages/dictionaries/dictionary-list/ui/create-group-modal.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, TextField } from '@mui/material'

import { createDictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import CrossIcon from '@/shared/assets/icons/cross.svg'

interface CreateGroupModalProps {
  open: boolean
  onClose: () => void
  domain: string
  typeCode: string
  parentId?: number
}

interface CreateGroupForm {
  nameRu: string
  nameKz: string
}

export const CreateGroupModal = ({
  open,
  onClose,
  domain,
  typeCode,
  parentId,
}: CreateGroupModalProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const form = useForm<CreateGroupForm>({
    defaultValues: { nameRu: '', nameKz: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateGroupForm) =>
      createDictEntry(domain, typeCode, {
        nameRu: data.nameRu,
        nameKz: data.nameKz || undefined,
        isGroup: true,
        parentId: parentId ?? null,
        attributes: {},
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['dict-entries', domain, typeCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dictionary-search'],
      })
      showToast('success', t('dictSidebar.groupCreated'))
      form.reset()
      onClose()
    },
    onError: () => {
      showToast('error', t('dictSidebar.groupCreateError'))
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    mutation.mutate(data)
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
            p: 0,
            m: 0,
            minWidth: 500,
            maxWidth: 'none',
          },
        },
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-15 py-10">
        <div className="flex items-center gap-6">
          <h2 className="flex-1 text-[26px] font-bold text-ui-06">
            {t('actions.createGroup')}
          </h2>
          <button type="button" onClick={handleClose}>
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <TextField
          label={t('documentTable.link')}
          {...form.register('nameRu', { required: true })}
          error={!!form.formState.errors.nameRu}
          fullWidth
          autoFocus
        />

        <TextField
          label={t('documentTable.linkKz')}
          {...form.register('nameKz')}
          fullWidth
        />

        <div className="flex gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 rounded-lg"
          >
            {t('actions.create')}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-lg"
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/dict-sidebar/api/dict-sidebar-api.ts src/pages/dictionaries/dictionary-list/ui/create-group-modal.tsx
git commit -m "feat: add create group modal for dictionary hierarchy"
```

---

## Task 5: Update table types and columns for hierarchy rendering

**Files:**
- Modify: `src/pages/dictionaries/dictionary-list/types/dictionary-table.ts`
- Modify: `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-columns.tsx`

- [ ] **Step 1: Update `DictionaryTableProps`**

In `src/pages/dictionaries/dictionary-list/types/dictionary-table.ts`:

```ts
import type { DocumentAttribute } from '@/entities/document-type'
import type { OpenFolder } from '../lib/hooks/use-folder-navigation-store'

export interface DictionaryTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number) => void
  domain: string
  skipDependsOn?: boolean
  isHierarchical?: boolean
  openFolders: OpenFolder[]
  currentParentId?: number
  onOpenFolder: (folder: OpenFolder) => void
  onCloseFolder: (folderId: number) => void
}
```

- [ ] **Step 2: Update `useDictionaryColumns` for hierarchy icons**

In `src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-columns.tsx`, add icon rendering to the name column when `isHierarchical`:

```tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import type { DictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ListElementIcon from '@/shared/assets/icons/list-element-icon.svg'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

const buildAttributeColumns = (
  attributes: DocumentAttribute[],
  language: string
): ColumnDef<DictEntry>[] =>
  [...attributes]
    .filter((attr) => attr.showInList)
    .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
    .map((attr) => ({
      id: attr.code,
      accessorFn: (row: DictEntry) => row.attributes?.[attr.code],
      header: () => <span>{getLocalizedName(attr, language)}</span>,
      cell: ({ getValue }: { getValue: () => unknown }) =>
        cellText(formatCellValue(getValue(), attr)),
    }))

export const useDictionaryColumns = (
  attributes: DocumentAttribute[],
  isHierarchical?: boolean,
  depth?: number
): ColumnDef<DictEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const indent = (depth ?? 0) * 24

    const nameColumn: ColumnDef<DictEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: isHierarchical
        ? ({ row: tableRow }) => {
            const entry = tableRow.original
            const name = getLocalizedName(entry, i18n.language)
            return (
              <div
                className="flex items-center gap-2"
                style={{ paddingLeft: indent }}
              >
                {entry.isGroup ? (
                  <FolderIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <ListElementIcon className="h-4 w-4 shrink-0" />
                )}
                {cellText(name)}
              </div>
            )
          }
        : (info) => cellText(info.getValue() as string),
    }

    return [...buildAttributeColumns(attributes, i18n.language), nameColumn]
  }, [attributes, i18n.language, t, isHierarchical, depth])
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/dictionaries/dictionary-list/types/dictionary-table.ts src/pages/dictionaries/dictionary-list/lib/hooks/use-dictionary-columns.tsx
git commit -m "feat: add hierarchy types and icon rendering to dictionary columns"
```

---

## Task 6: Update `DictionaryTable` for hierarchy rendering

**Files:**
- Modify: `src/pages/dictionaries/dictionary-list/ui/dictionary-table.tsx`

- [ ] **Step 1: Add ancestor rows and folder interaction logic**

Replace the full content of `src/pages/dictionaries/dictionary-list/ui/dictionary-table.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CircularProgress, Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import emptyImage from '@/shared/assets/info/empty.png'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import { useDictionaryEntries } from '../lib/hooks/use-dictionary-entries'
import { useDictionaryColumns } from '../lib/hooks/use-dictionary-columns'
import type { DictionaryTableProps } from '../types/dictionary-table'

export const DictionaryTable = ({
  attributes,
  selectedRowId,
  onSelectRow,
  domain,
  skipDependsOn,
  isHierarchical,
  openFolders,
  currentParentId,
  onOpenFolder,
  onCloseFolder,
}: DictionaryTableProps) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { moduleCode = '', pageCode = '' } = useParams()

  const [sorting, setSorting] = useState<SortingState>([])
  const sortAttr = sorting[0]?.id
  const sortDir = sorting[0] ? (sorting[0].desc ? 'DESC' : 'ASC') : undefined

  const {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useDictionaryEntries(
    domain,
    moduleCode,
    skipDependsOn,
    sortAttr,
    sortDir,
    currentParentId
  )

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

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (!observerEntries[0]?.isIntersecting) return
        const { hasNextPage, isFetchingNextPage, fetchNextPage } =
          loadMoreRef.current
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root: scrollContainer }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [isLoading])

  const table = useReactTable({
    data: sortedEntries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const handleDoubleClick = (entry: { id: number; isGroup?: boolean }) => {
    if (isHierarchical && entry.isGroup) {
      return // drill-down handled by single click
    }
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/${String(entry.id)}?domain=${domain}`
    )
  }

  const handleRowClick = (entry: {
    id: number
    isGroup?: boolean
    nameRu: string
    nameKz: string
  }) => {
    if (isHierarchical && entry.isGroup) {
      onOpenFolder({
        id: entry.id,
        name: getLocalizedName(entry, i18n.language),
      })
    } else {
      onSelectRow(entry.id)
    }
  }

  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
      : 0

  return (
    <div className="relative min-h-0 flex-1 flex flex-col">
      {isSortingOrFiltering && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
          <CircularProgress size={24} />
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
        <table
          className="w-full border-separate"
          style={{ borderSpacing: '2px' }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap border-b-2 border-ui-06 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06',
                        canSort && 'cursor-pointer select-none'
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted && (
                            <span
                              className={cn(
                                'text-[10px] leading-none',
                                sorted === 'asc' && 'rotate-180'
                              )}
                            >
                              ▼
                            </span>
                          )}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Ancestor folder rows */}
            {isHierarchical &&
              openFolders.map((folder, index) => (
                <tr
                  key={`ancestor-${String(folder.id)}`}
                  className="cursor-pointer transition-colors hover:bg-ui-07"
                  onClick={() => {
                    onCloseFolder(folder.id)
                  }}
                >
                  <td
                    colSpan={columns.length}
                    className="px-3 py-2 first:rounded-l-md last:rounded-r-md"
                  >
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: index * 24 }}
                    >
                      <ArrowDownIcon className="h-3 w-3 shrink-0" />
                      <FolderIcon className="h-4 w-4 shrink-0" />
                      <Typography
                        variant="body2"
                        noWrap
                        className="text-ui-06 font-medium"
                      >
                        {folder.name}
                      </Typography>
                    </div>
                  </td>
                </tr>
              ))}

            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <CircularProgress size={24} />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && openFolders.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <img src={emptyImage} alt="" className="h-50 w-50" />
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('table.empty')}
                    </Typography>
                  </div>
                </td>
              </tr>
            )}
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              const entry = row.original
              const isSelected = selectedRowId === entry.id
              const isGroup = isHierarchical && entry.isGroup

              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    handleRowClick(entry)
                  }}
                  onDoubleClick={() => {
                    handleDoubleClick(entry)
                  }}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-ui-07',
                    isSelected
                      ? 'bg-ui-07'
                      : virtualRow.index % 2 === 1
                        ? 'bg-ui-01'
                        : ''
                  )}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <td
                      key={cell.id}
                      className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                    >
                      {isGroup && cellIndex === 0 ? (
                        <div
                          className="flex items-center gap-2"
                          style={{
                            paddingLeft: openFolders.length * 24,
                          }}
                        >
                          <ArrowDownIcon className="h-3 w-3 shrink-0 -rotate-90" />
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      ) : (
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
        <div ref={sentinelRef} className="h-1" />
      </div>

      <div className="shrink-0 px-3 py-2 flex items-center gap-2">
        <Typography variant="body2" className="text-ui-05">
          {t('table.loadedCount', {
            loaded: sortedEntries.length,
            total: totalElements,
          })}
        </Typography>
        {isFetchingNextPage && <CircularProgress size={14} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/dictionaries/dictionary-list/ui/dictionary-table.tsx
git commit -m "feat: render hierarchy with ancestor rows and folder drill-down"
```

---

## Task 7: Wire everything in `DictionaryPage` and toolbar

**Files:**
- Modify: `src/pages/dictionaries/dictionary-list/ui/dictionary-page.tsx`
- Modify: `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx`

- [ ] **Step 1: Update `DictionaryListToolbar` to accept `isHierarchical` and `onCreateGroup`**

In `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

interface DictionaryListToolbarProps {
  selectedRowId?: number | null
  domain: string
  isHierarchical?: boolean
  onCreateGroup?: () => void
}

export const DictionaryListToolbar = ({
  selectedRowId,
  domain,
  isHierarchical,
  onCreateGroup,
}: DictionaryListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '', moduleCode = '' } = useParams()
  const [search, setSearch] = useState('')

  const handleCreate = () => {
    if (!pageCode || !moduleCode) return
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}`
    )
  }

  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={handleCreate}>
          {t('actions.create')}
        </Button>
        {isHierarchical && (
          <Button variant="secondary" onClick={onCreateGroup}>
            {t('actions.createGroup')}
          </Button>
        )}
        <Button variant="secondary" disabled={selectedRowId == null}>
          {t('documentListToolbar.editSelected')}
        </Button>
        <Button
          variant="secondary"
          aria-label={t('actions.copy')}
          disabled={selectedRowId == null}
          startIcon={<CopyDocIcon className="h-5 w-5" />}
          onClick={() =>
            void navigate(
              `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}&copyFrom=${String(selectedRowId)}`
            )
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={search}
          className="w-64 bg-ui-01"
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
        <DropdownButton label={t('documentListToolbar.more')} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `DictionaryPage` to wire folder navigation and modal**

In `src/pages/dictionaries/dictionary-list/ui/dictionary-page.tsx`:

```tsx
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useModule } from '@/entities/module'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DictionaryListToolbar } from '@/widgets/dictionary-list-toolbar'

import { useDictionaryType } from '../lib/hooks/use-dictionary-type'
import { useFolderNavigation } from '../lib/hooks/use-folder-navigation'
import { DictionaryTable } from './dictionary-table'
import { CreateGroupModal } from './create-group-modal'

export const DictionaryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
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

  const { title, attributes, typeData, isLoading } = useDictionaryType(
    domain,
    moduleCode
  )
  const isHierarchical = typeData?.isHierarchical ?? false

  useTabMeta(title)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)

  const { openFolders, currentParentId, openFolder, closeFolder } =
    useFolderNavigation()

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoading) return null

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
      <DictionaryTable
        attributes={attributes}
        selectedRowId={selectedRowId}
        onSelectRow={setSelectedRowId}
        domain={domain}
        skipDependsOn={skipDependsOn}
        isHierarchical={isHierarchical}
        openFolders={openFolders}
        currentParentId={currentParentId}
        onOpenFolder={openFolder}
        onCloseFolder={closeFolder}
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
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/dictionaries/dictionary-list/ui/dictionary-page.tsx src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx
git commit -m "feat: wire folder navigation and create group modal in dictionary page"
```

---

## Task 8: Manual testing and fixes

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test on a hierarchical dictionary**

Navigate to "Статьи движения денежных средств" (StatiDvizheniyaDenezhnykhSredstv) or another dictionary where `isHierarchical: true`.

Verify:
1. Root level shows folder icons (📁) for groups, list icons for entries
2. Groups appear above entries
3. Clicking a folder → drill-down: ancestor row with ▼ appears, children load
4. Clicking ancestor row ▼ → collapses back to parent level
5. Multi-level nesting works (open folder → open subfolder → ancestor chain builds)
6. "Создать группу" button appears and opens modal
7. Creating a group → entry appears in list after invalidation
8. Switching to another tab and back → folder state preserved
9. Non-hierarchical dictionaries → no icons, no "Создать группу" button, behavior unchanged

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during hierarchy testing"
```
