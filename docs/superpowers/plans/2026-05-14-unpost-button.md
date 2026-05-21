# Unpost Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Отменить проведение" button to document list toolbar that calls POST `/api/document-entries/{id}/unpost` and refreshes the table.

**Architecture:** Add API function to `entities/document-entry`, add i18n keys, modify `DocumentListToolbar` to replace "Изменить выделенные" with the unpost button using `useMutation`.

**Tech Stack:** React 19, TypeScript, TanStack Query (useMutation), axios

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/entities/document-entry/api/document-entry.ts` | Add `unpostDocumentEntry` |
| Modify | `src/entities/document-entry/index.ts` | Export new function |
| Modify | `src/app/config/i18n/locales/ru/common.json` | Add i18n keys |
| Modify | `src/app/config/i18n/locales/kz/common.json` | Add i18n keys |
| Modify | `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx` | Replace button, add mutation |

---

### Task 1: Add API function + i18n keys

**Files:**
- Modify: `src/entities/document-entry/api/document-entry.ts`
- Modify: `src/entities/document-entry/index.ts`
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Add unpostDocumentEntry function**

Add at the end of `src/entities/document-entry/api/document-entry.ts` (before the final empty line):

```typescript
export const unpostDocumentEntry = (id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${String(id)}/unpost`,
  })
```

- [ ] **Step 2: Export from barrel**

In `src/entities/document-entry/index.ts`, add `unpostDocumentEntry` to the API exports:

```typescript
export {
  getDocumentEntries,
  getDocumentEntry,
  getNewDocumentEntry,
  createDocumentEntry,
  updateDocumentEntry,
  unpostDocumentEntry,
  getPrintCommands,
  printDocumentEntry,
} from './api/document-entry'
```

- [ ] **Step 3: Add Russian i18n keys**

In `ru/common.json`, add to the `"documentListToolbar"` section:

```json
"unpost": "Отменить проведение",
"unpostSuccess": "Проведение отменено",
"unpostError": "Ошибка отмены проведения"
```

- [ ] **Step 4: Add Kazakh i18n keys**

In `kz/common.json`, add to the `"documentListToolbar"` section:

```json
"unpost": "Өткізуді болдырмау",
"unpostSuccess": "Өткізу болдырмалды",
"unpostError": "Өткізуді болдырмау қатесі"
```

- [ ] **Step 5: Commit**

```bash
git add src/entities/document-entry/api/document-entry.ts src/entities/document-entry/index.ts src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: add unpostDocumentEntry API function and i18n keys"
```

---

### Task 2: Replace "Изменить выделенные" with unpost button in toolbar

**Files:**
- Modify: `src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { unpostDocumentEntry } from '@/entities/document-entry'
import { showToast } from '@/shared/ui/toast/show-toast'
```

- [ ] **Step 2: Add mutation and query client inside component**

Inside `DocumentListToolbar`, after the existing `useDocumentEntryPrint` hook:

```typescript
const queryClient = useQueryClient()

const unpostMutation = useMutation({
  mutationFn: (id: number) => unpostDocumentEntry(id),
  onSuccess: () => {
    void queryClient.invalidateQueries({
      queryKey: ['document-entries', moduleCode],
    })
    showToast('success', t('documentListToolbar.unpostSuccess'))
  },
  onError: () => {
    showToast('error', t('documentListToolbar.unpostError'))
  },
})
```

- [ ] **Step 3: Replace the button**

Replace lines 135-137 (the "editSelected" button):

```tsx
<Button variant="secondary" disabled={selectedRowId == null}>
  {t('documentListToolbar.editSelected')}
</Button>
```

With:

```tsx
<Button
  variant="secondary"
  disabled={selectedRowId == null || unpostMutation.isPending}
  onClick={() => selectedRowId && unpostMutation.mutate(selectedRowId)}
>
  {t('documentListToolbar.unpost')}
</Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/widgets/document-list-toolbar/ui/document-list-toolbar.tsx
git commit -m "feat: add unpost button to document list toolbar"
```
