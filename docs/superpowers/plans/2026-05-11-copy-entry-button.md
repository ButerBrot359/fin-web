# Copy Entry Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Copy" button to document list toolbar, dictionary list toolbar, and dictionary sidebar list view that sends a POST request to copy an entry and refreshes the list.

**Architecture:** Each toolbar/view gets its own `useMutation` call following existing patterns. New API functions are added to existing API files. Translations are added to the shared `actions` namespace.

**Tech Stack:** React 19, TanStack Query (`useMutation`, `useQueryClient`), react-i18next, existing `apiService`

**Design spec:** `docs/superpowers/specs/2026-05-11-copy-entry-button-design.md`

---

### Task 1: Add translation keys

**Files:**
- Modify: `src/app/config/i18n/locales/ru/common.json:25-39` (actions section)
- Modify: `src/app/config/i18n/locales/kz/common.json:25-39` (actions section)

- [ ] **Step 1: Add Russian translation keys**

In `src/app/config/i18n/locales/ru/common.json`, add three keys to the `"actions"` object, after the existing `"close"` key (line 38):

```json
"close": "Закрыть",
"copy": "Копировать",
"copied": "Запись скопирована",
"copyError": "Ошибка копирования"
```

- [ ] **Step 2: Add Kazakh translation keys**

In `src/app/config/i18n/locales/kz/common.json`, add three keys to the `"actions"` object, after the existing `"close"` key (line 38):

```json
"close": "Жабу",
"copy": "Көшіру",
"copied": "Жазба көшірілді",
"copyError": "Көшіру қатесі"
```

- [ ] **Step 3: Commit**

```bash
git add src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "add: copy entry translation keys (ru/kz)"
```

---

### Task 2: Add API functions

**Files:**
- Modify: `src/features/dict-sidebar/api/dict-sidebar-api.ts:114` (end of file)
- Modify: `src/entities/document-entry/api/document-entry.ts:64` (end of file)
- Modify: `src/entities/document-entry/index.ts:1-9` (add export)

- [ ] **Step 1: Add `copyDictEntry` to dict-sidebar API**

At the end of `src/features/dict-sidebar/api/dict-sidebar-api.ts` (after line 114), add:

```ts
export const copyDictEntry = (domain: string, id: number) =>
  apiService.post<ApiResponse<DictEntry>>({
    url: `${getUniversalEntryByIdUrl(domain, id)}/copy`,
  })
```

This reuses the existing `getUniversalEntryByIdUrl` import (line 6) and `ApiResponse` type (line 10). No new imports needed.

- [ ] **Step 2: Add `copyDocumentEntry` to document-entry API**

At the end of `src/entities/document-entry/api/document-entry.ts` (after line 64), add:

```ts
export const copyDocumentEntry = (typeCode: string, id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${typeCode}/${String(id)}/copy`,
  })
```

This reuses the existing `apiService` import (line 1) and `DocumentEntryResponseData` type import (line 6). No new imports needed.

- [ ] **Step 3: Export `copyDocumentEntry` from barrel**

In `src/entities/document-entry/index.ts`, add `copyDocumentEntry` to the API re-exports:

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

Note: `copyDictEntry` does NOT need a barrel export — the `dict-sidebar` feature imports directly from `../api/dict-sidebar-api` (see `dict-sidebar-list-view.tsx` line 29-34).

- [ ] **Step 4: Commit**

```bash
git add src/features/dict-sidebar/api/dict-sidebar-api.ts src/entities/document-entry/api/document-entry.ts src/entities/document-entry/index.ts
git commit -m "add: copy entry API functions for dict and documents"
```

---

### Task 3: Add copy button to `DocumentListToolbar`

**Files:**
- Modify: `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`

- [ ] **Step 1: Add imports**

Add these imports at the top of the file. After the existing react-router import (line 2), add `useQueryClient` and `useMutation`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
```

Add the `showToast` import (after the existing shared imports block):

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
```

Add the `copyDocumentEntry` import (after the `useDocumentEntryPrint` import on line 14):

```ts
import { copyDocumentEntry } from '@/entities/document-entry'
```

- [ ] **Step 2: Add mutation inside the component**

Inside the `DocumentListToolbar` component, after the `handleCreate` function closes (after line 87), add:

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

- [ ] **Step 3: Add the Copy button in JSX**

After the "Edit Selected" button (after line 142, the closing `</Button>` of editSelected), add:

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null || copyMutation.isPending}
            onClick={() => copyMutation.mutate(selectedRowId!)}
          >
            {t('actions.copy')}
          </Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx
git commit -m "add: copy button to DocumentListToolbar"
```

---

### Task 4: Add copy button to `DictionaryListToolbar`

**Files:**
- Modify: `src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx`

- [ ] **Step 1: Add imports**

Add these imports. After the react-router import (line 2), add:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
```

After the existing shared imports, add:

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
import { copyDictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
```

- [ ] **Step 2: Add mutation inside the component**

Inside the `DictionaryListToolbar` component, after `handleCreate` (after line 28), add:

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

- [ ] **Step 3: Add the Copy button in JSX**

After the "Edit Selected" button (after line 38, closing `</Button>`), add:

```tsx
        <Button
          variant="secondary"
          disabled={selectedRowId == null || copyMutation.isPending}
          onClick={() => copyMutation.mutate(selectedRowId!)}
        >
          {t('actions.copy')}
        </Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/dictionary-list-toolbar/ui/dictionary-list-toolbar.tsx
git commit -m "add: copy button to DictionaryListToolbar"
```

---

### Task 5: Add copy button to `DictSidebarListView`

**Files:**
- Modify: `src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx`

- [ ] **Step 1: Add imports**

Add `useMutation` and `useQueryClient` to the existing `@tanstack/react-query` import (line 3-7). Change:

```ts
import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from '@tanstack/react-query'
```

to:

```ts
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'
```

Add `showToast` import after the existing shared imports (after line 25):

```ts
import { showToast } from '@/shared/ui/toast/show-toast'
```

Add `copyDictEntry` to the existing dict-sidebar-api import (line 29-34). Change:

```ts
import {
  fetchDictTypeMetadata,
  fetchDictEntriesPaged,
  searchDictEntries,
  type DictEntry,
} from '../api/dict-sidebar-api'
```

to:

```ts
import {
  fetchDictTypeMetadata,
  fetchDictEntriesPaged,
  searchDictEntries,
  copyDictEntry,
  type DictEntry,
} from '../api/dict-sidebar-api'
```

- [ ] **Step 2: Add mutation inside the component**

Inside the `DictSidebarListView` component, after `handleSelect` closes (after line 273), add:

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

- [ ] **Step 3: Add the Copy button in JSX**

In the toolbar section, after the "Create" button (after line 299, closing `</Button>` of dictSidebar.create), add:

```tsx
          <Button
            variant="secondary"
            disabled={selectedRowId == null || copyMutation.isPending}
            onClick={() => copyMutation.mutate(selectedRowId!)}
          >
            {t('actions.copy')}
          </Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/features/dict-sidebar/ui/dict-sidebar-list-view.tsx
git commit -m "add: copy button to DictSidebarListView"
```

---

### Task 6: Manual verification

No automated tests — the project doesn't have them for UI components. Verify manually.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify DocumentListToolbar**

1. Open any document list page
2. Confirm "Копировать" button is visible and disabled
3. Select a row in the table
4. Confirm button becomes enabled
5. Click the button (will fail with network error until backend is ready — that's expected)
6. Confirm error toast appears

- [ ] **Step 3: Verify DictionaryListToolbar**

1. Open any dictionary list page
2. Same checks as step 2

- [ ] **Step 4: Verify DictSidebarListView**

1. Open a form that triggers the dictionary sidebar
2. Same checks as step 2

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: copy button adjustments after manual testing"
```
