# Frontend Copy Entries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move copy functionality from backend API calls to frontend navigation with pre-filled creation forms for both document entries and dictionary entries.

**Architecture:** Replace `POST /copy` API calls with `navigate` to creation routes with `?copyFrom=${id}` query parameter. Form hooks load the source entry by ID, strip `id`/`code`/date fields, and pre-fill the creation form. Sidebar uses `copyFromId` field on the panel object instead of URL params.

**Tech Stack:** React 19, React Router, TanStack Query, React Hook Form

---

### Task 1: Remove backend copy API functions

**Files:**
- Modify: `src/entities/document-entry/api/document-entry.ts:66-69` — delete `copyDocumentEntry`
- Modify: `src/entities/document-entry/index.ts:7` — remove `copyDocumentEntry` export
- Modify: `src/features/dict-sidebar/api/dict-sidebar-api.ts:116-119` — delete `copyDictEntry`
- Delete: `docs/api/copy-entry-api.md`

- [ ] **Step 1: Remove `copyDocumentEntry` from API file**

In `src/entities/document-entry/api/document-entry.ts`, delete lines 66-69:

```ts
export const copyDocumentEntry = (typeCode: string, id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${typeCode}/${String(id)}/copy`,
  })
```

- [ ] **Step 2: Remove `copyDocumentEntry` from barrel export**

In `src/entities/document-entry/index.ts`, change the export block from:

```ts
export {
  getDocumentEntries,
  getDocumentEntry,
  getNewDocumentEntry,
  createDocumentEntry,
  updateDocumentEntry,
  copyDocumentEntry,
  getPrintCommands,
  printDocumentEntry,
} from './api/document-entry'
```

to:

```ts
export {
  getDocumentEntries,
  getDocumentEntry,
  getNewDocumentEntry,
  createDocumentEntry,
  updateDocumentEntry,
  getPrintCommands,
  printDocumentEntry,
} from './api/document-entry'
```

- [ ] **Step 3: Remove `copyDictEntry` from dict sidebar API**

In `src/features/dict-sidebar/api/dict-sidebar-api.ts`, delete lines 116-119:

```ts
export const copyDictEntry = (domain: string, id: number) =>
  apiService.post<ApiResponse<DictEntry>>({
    url: `${getUniversalEntryByIdUrl(domain, id)}/copy`,
  })
```

- [ ] **Step 4: Delete the backend copy spec file**

Delete `docs/api/copy-entry-api.md`.

- [ ] **Step 5: Commit**

```bash
git add src/entities/document-entry/api/document-entry.ts src/entities/document-entry/index.ts src/features/dict-sidebar/api/dict-sidebar-api.ts
git rm docs/api/copy-entry-api.md
git commit -m "fix: remove backend copy API functions and spec"
```

---

### Task 2: Rewrite `DocumentListToolbar` copy button to navigate

**Files:**
- Modify: `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`

- [ ] **Step 1: Replace imports**

Change line 3 from:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
```

to remove the line entirely (delete it).

Remove line 15:

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
```

Change line 17 from:

```ts
import { copyDocumentEntry, useDocumentEntryPrint } from '@/entities/document-entry'
```

to:

```ts
import { useDocumentEntryPrint } from '@/entities/document-entry'
```

- [ ] **Step 2: Remove `copyMutation` and `useQueryClient`**

Delete the entire block from lines 92-105:

```ts
  const queryClient = useQueryClient()

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyDocumentEntry(moduleCode, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
      showToast('success', t('actions.copied'))
    },
    onError: () => {
      showToast('error', t('actions.copyError'))
    },
  })
```

- [ ] **Step 3: Replace copy button with navigate**

Replace the copy button (lines 162-167):

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null || copyMutation.isPending}
            onClick={() => copyMutation.mutate(selectedRowId!)}
          >
            {t('actions.copy')}
          </Button>
```

with:

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null}
            onClick={() =>
              void navigate(
                `/modules/${pageCode}/document/${moduleCode}/new?copyFrom=${String(selectedRowId)}`
              )
            }
          >
            {t('actions.copy')}
          </Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx
git commit -m "fix: document copy button navigates to creation form"
```

---

### Task 3: Add `copyFrom` handling to `useDocumentEntryForm`

**Files:**
- Modify: `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts`

- [ ] **Step 1: Add `copyFrom` param and query**

After the existing `vidOperatsii` variable (line 32), add `copyFrom`:

```ts
  const copyFrom = searchParams.get('copyFrom')
```

After the `newEntryData` query (lines 37-42), add the copy query:

```ts
  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery({
    queryKey: ['document-entry', copyFrom],
    queryFn: () => getDocumentEntry(copyFrom!),
    enabled: isNew && !!copyFrom,
    select: (response) => response.data.data,
  })
```

- [ ] **Step 2: Disable `getNewDocumentEntry` when `copyFrom` is present**

Change the `enabled` condition of the `newEntryData` query from:

```ts
    enabled: isNew && !!vidOperatsii,
```

to:

```ts
    enabled: isNew && !!vidOperatsii && !copyFrom,
```

- [ ] **Step 3: Add `copyFrom` branch in the `useEffect`**

In the `useEffect` (starting at line 55), add a new branch for `copyFromData` after the existing `existingEntry` check but before the `newEntryData` check. The full `useEffect` should become:

```ts
  useEffect(() => {
    let defaults: Record<string, unknown> | null = null

    if (!isNew && existingEntry?.attributes) {
      defaults = existingEntry.attributes
    } else if (isNew && copyFromData?.attributes) {
      defaults = { ...copyFromData.attributes, Data: new Date().toISOString() }
    } else if (isNew && newEntryData?.attributes) {
      defaults = { Data: new Date().toISOString(), ...newEntryData.attributes }
    } else if (isNew && !vidOperatsii && !copyFrom) {
      defaults = { Data: new Date().toISOString() }
    }

    if (!defaults) return

    const cached = useFormCacheStore.getState().getCachedValues(pathname)

    if (cached) {
      markRestoring(pathname)
      form.reset(defaults)
      for (const [key, value] of Object.entries(cached)) {
        form.setValue(key, value, { shouldDirty: true })
      }
      const isDirty = hasChanges(cached, defaults)
      useFormCacheStore.getState().clearCache(pathname)
      useFormCacheStore.getState().setDirty(pathname, isDirty)
      restoredRef.current = isDirty
      queueMicrotask(() => {
        unmarkRestoring(pathname)
      })
    } else if (!form.formState.isDirty && !restoredRef.current) {
      form.reset(defaults)
    }
  }, [isNew, existingEntry, newEntryData, copyFromData, vidOperatsii, copyFrom, form, pathname])
```

Key changes:
- New `copyFromData` branch spreads source attributes and overrides `Data` with current date
- The fallback `isNew && !vidOperatsii` branch also checks `!copyFrom` to avoid setting empty defaults while copy data loads
- `copyFromData` and `copyFrom` added to dependency array

- [ ] **Step 4: Update `isLoading` return value**

Change the return from:

```ts
    isLoading: isLoadingEntry || isLoadingNewEntry,
```

to:

```ts
    isLoading: isLoadingEntry || isLoadingNewEntry || isLoadingCopy,
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts
git commit -m "feat: useDocumentEntryForm supports copyFrom query param"
```

---

### Task 4: Rewrite `DictionaryListToolbar` copy button to navigate

**Files:**
- Modify: `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx`

- [ ] **Step 1: Replace imports**

Change line 3 from:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
```

Delete this line entirely.

Delete line 9:

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
```

Delete line 10:

```ts
import { copyDictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
```

- [ ] **Step 2: Remove `copyMutation` and `useQueryClient`**

Delete the entire block from lines 26-45:

```ts
  const queryClient = useQueryClient()

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyDictEntry(domain, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['dict-entries', domain, moduleCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dict-sidebar-entries', domain, moduleCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dictionary-search'],
      })
      showToast('success', t('actions.copied'))
    },
    onError: () => {
      showToast('error', t('actions.copyError'))
    },
  })
```

- [ ] **Step 3: Replace copy button with navigate**

Replace the copy button (lines 63-69):

```tsx
        <Button
          variant="secondary"
          disabled={selectedRowId == null || copyMutation.isPending}
          onClick={() => copyMutation.mutate(selectedRowId!)}
        >
          {t('actions.copy')}
        </Button>
```

with:

```tsx
        <Button
          variant="secondary"
          disabled={selectedRowId == null}
          onClick={() =>
            void navigate(
              `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}&copyFrom=${String(selectedRowId)}`
            )
          }
        >
          {t('actions.copy')}
        </Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx
git commit -m "fix: dictionary copy button navigates to creation form"
```

---

### Task 5: Add `copyFrom` handling to `DictionaryEntryPage`

**Files:**
- Modify: `src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx`

- [ ] **Step 1: Read `copyFrom` from URL**

After the `domain` state (line 44-47), add:

```ts
  const [copyFrom] = useState(
    () => new URLSearchParams(window.location.search).get('copyFrom')
  )
```

- [ ] **Step 2: Add copy-from query**

After the existing `entryData` query (lines 67-76), add:

```ts
  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-entry', domain, copyFrom],
    queryFn: ({ signal }) => fetchDictEntryById(domain, copyFrom!, signal),
    enabled: isNew && !!copyFrom,
    select: (res) => res.data.data,
  })
```

- [ ] **Step 3: Add `copyFromData` branch in `useEffect`**

In the `useEffect` (line 83), add a new branch after `entryData` and before the `isNew && cached` branch. The full `useEffect` becomes:

```ts
  useEffect(() => {
    const cached = useFormCacheStore
      .getState()
      .getCachedValues(location.pathname)

    if (entryData) {
      const values: Record<string, unknown> = { ...entryData.attributes }
      values.nameRu = entryData.nameRu
      values.nameKz = entryData.nameKz
      values.code = entryData.code

      if (cached) {
        markRestoring(location.pathname)
        form.reset(values)
        for (const [key, value] of Object.entries(cached)) {
          form.setValue(key, value, { shouldDirty: true })
        }
        const hasDirtyFields = Object.keys(cached).some(
          (key) => JSON.stringify(cached[key]) !== JSON.stringify(values[key])
        )
        useFormCacheStore.getState().clearCache(location.pathname)
        useFormCacheStore.getState().setDirty(location.pathname, hasDirtyFields)
        restoredRef.current = hasDirtyFields
        queueMicrotask(() => {
          unmarkRestoring(location.pathname)
        })
      } else if (!form.formState.isDirty && !restoredRef.current) {
        form.reset(values)
      }
    } else if (isNew && copyFromData) {
      const values: Record<string, unknown> = { ...copyFromData.attributes }
      values.nameRu = copyFromData.nameRu
      values.nameKz = copyFromData.nameKz

      if (cached) {
        markRestoring(location.pathname)
        form.reset(values)
        for (const [key, value] of Object.entries(cached)) {
          form.setValue(key, value, { shouldDirty: true })
        }
        useFormCacheStore.getState().clearCache(location.pathname)
        useFormCacheStore.getState().setDirty(location.pathname, true)
        restoredRef.current = true
        queueMicrotask(() => {
          unmarkRestoring(location.pathname)
        })
      } else if (!form.formState.isDirty && !restoredRef.current) {
        form.reset(values)
      }
    } else if (isNew && cached) {
      markRestoring(location.pathname)
      form.reset(cached)
      useFormCacheStore.getState().clearCache(location.pathname)
      useFormCacheStore.getState().setDirty(location.pathname, true)
      restoredRef.current = true
      queueMicrotask(() => {
        unmarkRestoring(location.pathname)
      })
    }
  }, [entryData, copyFromData]) // eslint-disable-line react-hooks/exhaustive-deps
```

Key changes:
- New `isNew && copyFromData` branch copies `attributes`, `nameRu`, `nameKz` but **not** `code`
- `copyFromData` added to dependency array

- [ ] **Step 4: Update loading state**

Find where `isLoadingEntry` is used to guard rendering (line 299):

```tsx
        {isLoadingEntry ? null : (
```

Change to:

```tsx
        {isLoadingEntry || isLoadingCopy ? null : (
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/dictionaries/dictionary-entry/ui/dictionary-entry-page.tsx
git commit -m "feat: DictionaryEntryPage supports copyFrom query param"
```

---

### Task 6: Add `copyFromId` to `DictSidebarPanel` type and update `DictSidebarListView`

**Files:**
- Modify: `src/features/dict-sidebar/types/dict-sidebar.ts`
- Modify: `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx`

- [ ] **Step 1: Add `copyFromId` to `DictSidebarPanel`**

In `src/features/dict-sidebar/types/dict-sidebar.ts`, add `copyFromId` to the interface:

```ts
export interface DictSidebarPanel {
  id: string
  mode: DictSidebarMode
  domain: string
  typeCode: string
  entryId?: number | string
  copyFromId?: number
  title?: string
  searchParams?: Record<string, string>
  onSelect?: (value: SelectOption) => void
}
```

- [ ] **Step 2: Replace imports in `DictSidebarListView`**

In `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx`, change the tanstack import (lines 3-9) from:

```ts
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
```

to:

```ts
import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query'
```

Remove line 28:

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
```

Remove `copyDictEntry` from the API import (lines 32-38), changing:

```ts
import {
  fetchDictTypeMetadata,
  fetchDictEntriesPaged,
  searchDictEntries,
  copyDictEntry,
  type DictEntry,
} from '../api/dict-sidebar-api'
```

to:

```ts
import {
  fetchDictTypeMetadata,
  fetchDictEntriesPaged,
  searchDictEntries,
  type DictEntry,
} from '../api/dict-sidebar-api'
```

- [ ] **Step 3: Remove `copyMutation` and `useQueryClient`**

Delete the entire block (lines 279-301):

```ts
  const queryClient = useQueryClient()

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyDictEntry(panel.domain, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['dict-sidebar-entries', panel.domain, panel.typeCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dictionary-search'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['document-entries'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['document-entry'],
      })
      showToast('success', t('actions.copied'))
    },
    onError: () => {
      showToast('error', t('actions.copyError'))
    },
  })
```

- [ ] **Step 4: Replace copy button with push**

Replace the copy button (lines 328-334):

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null || copyMutation.isPending}
            onClick={() => copyMutation.mutate(selectedRowId!)}
          >
            {t('actions.copy')}
          </Button>
```

with:

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null}
            onClick={() => {
              push({
                mode: 'create',
                domain: panel.domain,
                typeCode: panel.typeCode,
                onSelect: panel.onSelect,
                copyFromId: selectedRowId!,
              })
            }}
          >
            {t('actions.copy')}
          </Button>
```

- [ ] **Step 5: Commit**

```bash
git add src/features/dict-sidebar/types/dict-sidebar.ts src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx
git commit -m "feat: dict sidebar copy button pushes create panel with copyFromId"
```

---

### Task 7: Add `copyFromId` handling to `DictSidebarFormView`

**Files:**
- Modify: `src/features/dict-sidebar/ui/dict-sidebar-form-view.tsx`

- [ ] **Step 1: Add copy-from query**

After the existing `entryData` query (lines 51-61), add:

```ts
  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-sidebar-entry', panel.domain, panel.copyFromId],
    queryFn: ({ signal }) =>
      fetchDictEntryById(panel.domain, panel.copyFromId!, signal),
    enabled: !savedEntryId && !!panel.copyFromId,
    select: (res) => res.data.data,
  })
```

- [ ] **Step 2: Add `useEffect` for copy-from data**

After the existing `useEffect` for `entryData` (lines 63-77), add a new `useEffect`:

```ts
  useEffect(() => {
    if (!copyFromData || savedEntryId) return
    const values: Record<string, unknown> = { ...copyFromData.attributes }
    values.nameRu = copyFromData.nameRu
    values.nameKz = copyFromData.nameKz
    form.reset(values)
  }, [copyFromData, savedEntryId, form])
```

This copies `attributes`, `nameRu`, `nameKz` but **not** `code`.

- [ ] **Step 3: Update loading guard**

Change the loading condition in the render (line 234):

```tsx
        {isLoadingEntry ? null : (
```

to:

```tsx
        {isLoadingEntry || isLoadingCopy ? null : (
```

- [ ] **Step 4: Commit**

```bash
git add src/features/dict-sidebar/ui/dict-sidebar-form-view.tsx
git commit -m "feat: DictSidebarFormView pre-fills form from copyFromId"
```

---

### Task 8: Verify build

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: No TypeScript errors, successful build. If there are unused import warnings from ESLint, fix them.

- [ ] **Step 2: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: cleanup unused imports after copy refactor"
```
