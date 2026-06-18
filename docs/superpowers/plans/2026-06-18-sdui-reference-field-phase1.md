# SDUI Server-Driven Reference Field Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate REFERENCE_FIELD dropdown and "Показать все" from frontend-built URLs to server-driven `optionsSource` and `ref.showAll` command, add LIST node for drawer picker, add drawer presentation to DialogHost.

**Architecture:** Per-field migration — fields with `optionsSource`/`ref.*` actions use the new server-driven path; fields without them keep working via legacy `DOMAIN_PATH_MAP` + `dict-sidebar`. New LIST node is a standalone paged grid. DialogHost gains a drawer branch.

**Tech Stack:** React 19, TypeScript, MUI Drawer, TanStack Query, @tanstack/react-virtual

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/features/sdui/ui/nodes/composite/list-node.tsx` | LIST node — server-driven paged grid for drawer picker |

### Modified files
| File | What changes |
|---|---|
| `src/features/sdui/types/view.ts:13-16` | Add `command?: string` to `ViewNodeAction` |
| `src/features/sdui/types/node-types.ts:1-15` | Add `LIST` to NodeType union |
| `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` | `optionsSource` handling + `ref.showAll` COMMAND dispatch |
| `src/features/sdui/ui/dialog-host.tsx` | Drawer presentation branch |
| `src/features/sdui/lib/component-registry.ts` | Register `LIST` component |

---

## Task 1: Add `command` to ViewNodeAction + `LIST` to NodeType

**Files:**
- Modify: `src/features/sdui/types/view.ts:13-16`
- Modify: `src/features/sdui/types/node-types.ts:1-15`

- [ ] **Step 1: Add `command` to `ViewNodeAction`**

In `src/features/sdui/types/view.ts`, change:

```ts
export interface ViewNodeAction {
  trigger: string
  actionId: string
}
```

to:

```ts
export interface ViewNodeAction {
  trigger: string
  actionId: string
  command?: string
}
```

This enables server-driven actions like `{ trigger: 'showAll', actionId: 'command', command: 'ref.showAll:field.xxx' }`.

- [ ] **Step 2: Add `LIST` to NodeType**

In `src/features/sdui/types/node-types.ts`, add `'LIST'` to the Composite group. Change:

```ts
  // Composite (3)
  | 'TABLE' | 'TABLE_COLUMN' | 'OBJECT_FIELD'
```

to:

```ts
  // Composite (4)
  | 'TABLE' | 'TABLE_COLUMN' | 'OBJECT_FIELD' | 'LIST'
```

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/types/
git commit -m "feat: add command to ViewNodeAction and LIST to NodeType"
```

---

## Task 2: ReferenceFieldNode — optionsSource

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

- [ ] **Step 1: Add optionsSource handling to fetchOptions**

In `reference-field-node.tsx`, read `optionsSource` from node props and use it in `fetchOptions` when available. The existing code (lines 69-90) builds the URL from `DOMAIN_PATH_MAP`. Insert a new branch at the top of `fetchOptions` that uses `optionsSource` verbatim.

After the existing prop reads (after line 49), add:

```ts
  const optionsSource = node.props?.optionsSource as { url: string; params?: Record<string, string> } | undefined
```

Replace the `fetchOptions` function (lines 69-90) with:

```ts
  const fetchOptions = async (search?: string) => {
    setLoading(true)
    try {
      if (optionsSource) {
        const res = await apiService.get<{ content?: EntryItem[]; items?: EntryItem[] }>({
          url: optionsSource.url,
          params: { ...optionsSource.params, search, page: 0, size: 20 },
        })
        const items = res.data.content ?? res.data.items ?? []
        setOptions(
          items.map((item) => ({
            id: item.id,
            code: String(item.id),
            label: (item.presentation ?? item.name ?? String(item.id)) as string,
          })),
        )
        return
      }

      // Legacy path — field without optionsSource
      if (!targetTypeCode) return
      const res = await apiService.get<{ content?: EntryItem[]; items?: EntryItem[] }>({
        url: `/api/${domainPath}/${targetTypeCode}/entries`,
        params: { search, page: 0, size: 20, ...filter },
      })
      const items = res.data.content ?? res.data.items ?? []
      setOptions(
        items.map((item) => ({
          id: item.id,
          code: String(item.id),
          label: (item.presentation ?? item.name ?? String(item.id)) as string,
        })),
      )
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx
git commit -m "feat: use optionsSource for REFERENCE_FIELD dropdown when provided"
```

---

## Task 3: ReferenceFieldNode — ref.showAll command

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

- [ ] **Step 1: Add ref.showAll COMMAND dispatch**

In `reference-field-node.tsx`, find the `showAll` action from node actions and dispatch a COMMAND instead of opening dict-sidebar when the action exists.

After the `openDictCreate` function (after line 126), add:

```ts
  const showAllAction = node.actions?.find(
    (a) => a.trigger === 'showAll' && a.actionId === 'command'
  )
```

Then update the `onShowAll` prop (line 153). Change:

```tsx
        onShowAll={canBrowse ? openDictList : undefined}
```

to:

```tsx
        onShowAll={
          showAllAction
            ? () => void dispatch({ type: 'COMMAND', command: showAllAction.command!, sourceNodeId: node.id })
            : canBrowse ? openDictList : undefined
        }
```

Also update the visibility — if `allowShowAll` prop exists on the node, use it:

```ts
  const allowShowAll = node.props?.allowShowAll as boolean | undefined
```

And update the condition:

```tsx
        onShowAll={
          showAllAction
            ? () => void dispatch({ type: 'COMMAND', command: showAllAction.command!, sourceNodeId: node.id })
            : (allowShowAll ?? canBrowse) ? openDictList : undefined
        }
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx
git commit -m "feat: dispatch ref.showAll COMMAND for server-driven Показать все"
```

---

## Task 4: DialogHost — drawer presentation

**Files:**
- Modify: `src/features/sdui/ui/dialog-host.tsx`

- [ ] **Step 1: Add Drawer import and branch**

Replace the entire `dialog-host.tsx` file:

```tsx
import { useSyncExternalStore } from 'react'
import { Dialog, DialogTitle, DialogContent, Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { getDialogStack, subscribeDialogs, popDialog } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribeDialogs, getDialogStack)

  return (
    <>
      {stack.map((eff, i) => {
        if (!eff.node) return null

        const presentation =
          (eff.node.props?.presentation as string | undefined) ?? 'modal'

        if (presentation === 'drawer') {
          const width = (eff.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={eff.node.id ?? i}
              anchor="right"
              open
              onClose={popDialog}
              slotProps={{
                paper: {
                  sx: {
                    width,
                    borderTopLeftRadius: 40,
                    borderBottomLeftRadius: 40,
                    backgroundColor: '#F2F6FD',
                    overflow: 'hidden',
                  },
                },
                backdrop: {
                  sx: { backgroundColor: 'rgba(34, 33, 36, 0.6)' },
                },
              }}
            >
              <div className="flex h-full flex-col p-7">
                <div className="flex items-center justify-end">
                  <IconButton onClick={popDialog}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                <NodeRenderer node={eff.node} />
              </div>
            </Drawer>
          )
        }

        return (
          <Dialog
            key={eff.node.id ?? i}
            open
            onClose={popDialog}
            maxWidth="md"
            fullWidth
          >
            {eff.node.props?.title != null && (
              <DialogTitle>{String(eff.node.props.title)}</DialogTitle>
            )}
            <DialogContent>
              <NodeRenderer node={eff.node} />
            </DialogContent>
          </Dialog>
        )
      })}
    </>
  )
}
```

Drawer styles match `dict-sidebar-drawer.tsx` (900px, rounded corners `40px`, background `#F2F6FD`, backdrop `rgba(34,33,36,0.6)`). Close button in header — renders `CloseIcon` IconButton. Close triggers `popDialog()`.

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/dialog-host.tsx
git commit -m "feat: add drawer presentation to DialogHost for server-driven sidebars"
```

---

## Task 5: LIST node (server-driven paged grid)

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/list-node.tsx`
- Modify: `src/features/sdui/lib/component-registry.ts`

- [ ] **Step 1: Create list-node.tsx**

Create `src/features/sdui/ui/nodes/composite/list-node.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { CircularProgress, Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { SearchInput } from '@/shared/ui/inputs/search-input'
import { Button } from '@/shared/ui/buttons/button'
import { apiService } from '@/shared/api/api'
import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

interface ListSource {
  url: string
  params?: Record<string, string>
}

interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}

interface PagedResponse {
  data: {
    content: ListRow[]
    totalElements: number
    last: boolean
    number: number
  }
}

const PAGE_SIZE = 25

const resolveBinding = (row: ListRow, binding: string): unknown =>
  row[binding] ?? row.attributes?.[binding] ?? ''

export const ListNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const source = node.props?.source as ListSource | undefined
  const searchable = (node.props?.searchable as boolean | undefined) ?? false

  const columnNodes = useMemo(
    () => (node.children ?? []).filter((c) => c.type === 'TABLE_COLUMN'),
    [node.children],
  )

  const selectAction = node.actions?.find((a) => a.trigger === 'select')
  const activateAction = node.actions?.find((a) => a.trigger === 'activate')

  const [search, setSearch] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: pagedData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['sdui-list', source?.url, source?.params, search],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('LIST node: source is required')
      const res = await apiService.get<PagedResponse>({
        url: source.url,
        params: {
          ...source.params,
          page: pageParam,
          size: PAGE_SIZE,
          ...(search.trim() && { search: search.trim() }),
        },
        signal,
      })
      return res.data
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows = useMemo(
    () => pagedData?.pages.flatMap((page) => page.data.content) ?? [],
    [pagedData],
  )

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    const scrollContainer = scrollRef.current
    if (!sentinel || !scrollContainer) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        const { hasNextPage, isFetchingNextPage, fetchNextPage } = loadMoreRef.current
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { root: scrollContainer },
    )

    observer.observe(sentinel)
    return () => { observer.disconnect() }
  }, [isLoading])

  // Dispatch selection command
  const dispatchSelect = (action: { command?: string } | undefined, rowId: number) => {
    if (!action?.command) return
    void dispatch({ type: 'COMMAND', command: action.command, value: { id: rowId }, sourceNodeId: node.id })
  }

  // Columns from TABLE_COLUMN children
  const columns = useMemo<ColumnDef<ListRow>[]>(
    () =>
      columnNodes.map((col: ViewNode) => ({
        id: col.id,
        header: () => <span>{(col.props?.header as string) ?? ''}</span>,
        accessorFn: (row: ListRow) => {
          const binding = col.props?.binding as string
          if (!binding) return ''
          const val = resolveBinding(row, binding)
          if (val && typeof val === 'object' && 'name' in (val as Record<string, unknown>)) {
            return ((val as Record<string, unknown>).name as string) ?? ''
          }
          return val
        },
        size: (col.props?.width as number) ?? 150,
        cell: (info: { getValue: () => unknown }) => (
          <Typography variant="body2" noWrap className="text-ui-06">
            {String(info.getValue() ?? '')}
          </Typography>
        ),
      })),
    [columnNodes],
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const tableRows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
      : 0

  const handleSelect = () => {
    if (selectedRowId == null) return
    dispatchSelect(selectAction, selectedRowId)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleSelect} disabled={selectedRowId == null}>
            {t('dictSidebar.select')}
          </Button>
        </div>
        {searchable && (
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={search}
            className="w-62.5 bg-ui-01"
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
        )}
      </div>

      {/* Table */}
      <div className="relative min-h-0 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">{t('inputs.loading')}</Typography>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Typography className="text-ui-05">{t('dictSidebar.noData')}</Typography>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
              <table className="w-full border-separate" style={{ borderSpacing: '2px' }}>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06"
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr><td style={{ height: paddingTop }} /></tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = tableRows[virtualRow.index]
                    const isSelected = selectedRowId === row.original.id

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(row.original.id)}
                        onDoubleClick={() => {
                          dispatchSelect(activateAction ?? selectAction, row.original.id)
                        }}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-ui-07',
                          isSelected ? 'bg-ui-07' : virtualRow.index % 2 === 1 ? 'bg-ui-01' : '',
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr><td style={{ height: paddingBottom }} /></tr>
                  )}
                </tbody>
              </table>
              <div ref={sentinelRef} className="h-1" />
            </div>

            <div className="shrink-0 px-3 py-2 flex items-center gap-2">
              <Typography variant="body2" className="text-ui-05">
                {t('table.loadedCount', { loaded: rows.length, total: pagedData?.pages[0]?.data.totalElements ?? 0 })}
              </Typography>
              {isFetchingNextPage && <CircularProgress size={14} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register LIST in component-registry**

In `src/features/sdui/lib/component-registry.ts`, add import and registration.

Add import after the `ObjectFieldNode` import (line 38):

```ts
import { ListNode } from '../ui/nodes/composite/list-node'
```

Add to the registry object after `OBJECT_FIELD: ObjectFieldNode,`:

```ts
  LIST: ListNode,
```

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/list-node.tsx src/features/sdui/lib/component-registry.ts
git commit -m "feat: add LIST node for server-driven paged picker grid"
```

---

## Task 6: Verify COMMAND value passthrough

**Files:**
- Read only: `src/features/sdui/lib/dispatch.ts`
- Read only: `src/features/sdui/api/view-transport.ts`

- [ ] **Step 1: Verify value is forwarded**

In `dispatch.ts` line 89, the entire `action` object is passed in the request:

```ts
const res = await viewTransport.post({
  // ...
  action,  // ← full ViewAction including value
})
```

`ViewAction` already has `value?: unknown` (view.ts:22). `viewTransport.post` sends it as JSON body to `POST /api/view`. So `value` is already forwarded — no code change needed.

Verify this by reading `dispatch.ts:82-89` and confirming `action` is passed directly without stripping fields.

- [ ] **Step 2: No commit needed**

No code changes — this is verification only.

---

## Task 7: Manual E2E Verification

Test on fields with `optionsSource` and `ref.showAll` actions (e.g., `dogovorKontragenta`/`schetKontragenta` on GP deal request document when backend ships the new props).

- [ ] **Step 1: Dropdown options from optionsSource**

1. Open a document with a migrated REFERENCE_FIELD (backend sends `optionsSource` prop)
2. Type in the field → dropdown shows options from `optionsSource.url`
3. Options match what the same URL returns when called directly

- [ ] **Step 2: Показать все → server drawer**

1. Click "Показать все" on a migrated field
2. COMMAND `ref.showAll` dispatches to server
3. Server responds with `openDialog` effect → drawer opens
4. Drawer contains LIST node with records and columns from server
5. Records match dropdown options (same filter — regression gate)

- [ ] **Step 3: Select from LIST**

1. Click a row in the LIST → row highlights
2. Double-click or click "Выбрать" → `ref.select` COMMAND dispatches with `{ id }`
3. Server responds with `closeDialog` + `setValue` → drawer closes, field filled
4. Dependencies recalculate (same as dropdown selection)

- [ ] **Step 4: Legacy fields unaffected**

1. Open a document with non-migrated REFERENCE_FIELD (no `optionsSource`)
2. Dropdown and "Показать все" work via legacy `DOMAIN_PATH_MAP` + `dict-sidebar`
3. No regressions
