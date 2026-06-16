# SDUI DialogHost + Dirty Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two SDUI features: dialog rendering (for Дт/Кт button) and form dirty tracking (asterisk in tab + "Save changes?" dialog on close).

**Architecture:** Feature 1 adds a `DialogHost` component that subscribes to the existing `dialogStack` in `dispatch.ts` and renders each dialog as a MUI modal with `NodeRenderer`. Feature 2 splits `set()` in `view-state-store` into user/server paths, tracks `dirty`, syncs it to the existing `useFormCacheStore`, and consumes `pendingAction` in `SduiScreen` for save-and-close.

**Tech Stack:** React 19, Zustand, MUI Dialog, useSyncExternalStore

**Spec:** `docs/superpowers/specs/2026-06-16-sdui-dialog-host-dirty-tracking-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/features/sdui/lib/dispatch.ts` | Modify | Add `popDialog()`, switch to `setFromServer`, reset dirty after save commands |
| `src/features/sdui/ui/dialog-host.tsx` | Create | Render dialog stack as MUI modals |
| `src/features/sdui/lib/stores/view-state-store.ts` | Modify | Add `dirty`, `setFromServer`, `resetDirty` |
| `src/features/sdui/ui/sdui-screen.tsx` | Modify | Mount `DialogHost`, sync dirty to formCacheStore, consume pendingAction |

---

### Task 1: Add `popDialog()` to dispatch.ts

**Files:**
- Modify: `src/features/sdui/lib/dispatch.ts:14-31`

- [ ] **Step 1: Add `popDialog` export after `notifyDialogListeners` (line 31)**

Add this function between `notifyDialogListeners()` (line 31) and `useSduiDispatch()` (line 33):

```ts
export function popDialog(): void {
  dialogStack = dialogStack.slice(0, -1)
  notifyDialogListeners()
}
```

- [ ] **Step 2: Verify no import errors**

Run: `npx tsc --noEmit --pretty src/features/sdui/lib/dispatch.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "add: popDialog export in SDUI dispatch for manual dialog close"
```

---

### Task 2: Create DialogHost component

**Files:**
- Create: `src/features/sdui/ui/dialog-host.tsx`

- [ ] **Step 1: Create `dialog-host.tsx`**

```tsx
import { useSyncExternalStore } from 'react'
import { Dialog, DialogTitle, DialogContent } from '@mui/material'

import { getDialogStack, subscribeDialogs, popDialog } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribeDialogs, getDialogStack)

  return (
    <>
      {stack.map((eff, i) =>
        eff.node ? (
          <Dialog
            key={eff.node.id ?? i}
            open
            onClose={popDialog}
            maxWidth="md"
            fullWidth
          >
            {eff.node.props?.title && (
              <DialogTitle>{String(eff.node.props.title)}</DialogTitle>
            )}
            <DialogContent>
              <NodeRenderer node={eff.node} />
            </DialogContent>
          </Dialog>
        ) : null,
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/dialog-host.tsx
git commit -m "add: DialogHost component for rendering SDUI dialog stack"
```

---

### Task 3: Mount DialogHost in SduiScreen

**Files:**
- Modify: `src/features/sdui/ui/sdui-screen.tsx:12,73-76`

- [ ] **Step 1: Add import for DialogHost**

Add after the `NodeRenderer` import (line 12):

```ts
import { DialogHost } from './dialog-host'
```

- [ ] **Step 2: Mount DialogHost alongside NodeRenderer**

Replace the return statement (lines 73-75):

```tsx
  if (!tree) return <PageSkeleton />

  return <NodeRenderer node={tree} />
```

with:

```tsx
  if (!tree) return <PageSkeleton />

  return (
    <>
      <NodeRenderer node={tree} />
      <DialogHost />
    </>
  )
```

- [ ] **Step 3: Verify manually**

Run dev server, open an SDUI document, click a button that triggers `openDialog` (e.g., Дт/Кт). A MUI modal should appear with the table content. Close via the X button.

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx
git commit -m "add: mount DialogHost in SduiScreen for SDUI dialog rendering"
```

---

### Task 4: Add dirty tracking to view-state-store

**Files:**
- Modify: `src/features/sdui/lib/stores/view-state-store.ts`

- [ ] **Step 1: Replace the entire store with dirty-aware version**

Replace the full content of `view-state-store.ts` with:

```ts
import { create } from 'zustand'

interface ViewStateStoreState {
  state: Record<string, unknown>
  dirty: boolean
  get: (binding: string) => unknown
  set: (binding: string, value: unknown) => void
  setFromServer: (binding: string, value: unknown) => void
  merge: (patch: Record<string, unknown>) => void
  replaceAll: (s: Record<string, unknown>) => void
  getAll: () => Record<string, unknown>
  resetDirty: () => void
}

export const useViewStateStore = create<ViewStateStoreState>((set, get) => ({
  state: {},
  dirty: false,
  get: (binding) => get().state[binding],
  set: (binding, value) =>
    set((s) => ({ state: { ...s.state, [binding]: value }, dirty: true })),
  setFromServer: (binding, value) =>
    set((s) => ({ state: { ...s.state, [binding]: value } })),
  merge: (patch) => set((s) => ({ state: { ...s.state, ...patch } })),
  replaceAll: (s) => set({ state: s, dirty: false }),
  getAll: () => get().state,
  resetDirty: () => set({ dirty: false }),
}))

export const useViewState = (binding: string | undefined) =>
  useViewStateStore((s) => (binding ? s.state[binding] : undefined))

export const useViewStateSetter = () => useViewStateStore((s) => s.set)
```

Key changes from original:
- Added `dirty: boolean` field (default `false`)
- `set()` now also sets `dirty: true` — this is the path called by field nodes on user input
- Added `setFromServer()` — same as old `set()` but doesn't touch `dirty`
- `replaceAll()` now resets `dirty: false` (called on OPEN)
- Added `resetDirty()`

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/stores/view-state-store.ts
git commit -m "add: dirty tracking in view-state-store with user/server set paths"
```

---

### Task 5: Switch dispatch.ts to setFromServer + reset dirty after save

**Files:**
- Modify: `src/features/sdui/lib/dispatch.ts:87-105`

- [ ] **Step 1: Switch OPEN branch to use setFromServer (line 93)**

Replace:

```ts
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().set)
```

(the one inside `if (action.type === 'OPEN')` block, line 93) with:

```ts
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().setFromServer)
```

- [ ] **Step 2: Switch EVENT/COMMAND branch to use setFromServer (line 102)**

Replace:

```ts
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().set)
```

(the one inside the `else` block, line 102) with:

```ts
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().setFromServer)
```

- [ ] **Step 3: Add dirty reset after save-related commands**

After `effectHandler.playAll(res.effects ?? [])` (line 104), add:

```ts
          const saveCommands = ['save', 'saveAndClose', 'post', 'postAndClose']
          if (action.type === 'COMMAND' && saveCommands.includes(action.command ?? '')) {
            useViewStateStore.getState().resetDirty()
          }
```

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "fix: use setFromServer for SDUI patches, reset dirty after save commands"
```

---

### Task 6: Sync dirty to formCacheStore + consume pendingAction in SduiScreen

**Files:**
- Modify: `src/features/sdui/ui/sdui-screen.tsx`

- [ ] **Step 1: Add imports**

Update the import from `react-router-dom` (line 2):

```ts
import { useLocation, useNavigate } from 'react-router-dom'
```

Update the import from `@/features/workspace-tabs` (line 5):

```ts
import { useTabMeta, useWorkspaceTabsStore, useFormCacheStore } from '@/features/workspace-tabs'
```

- [ ] **Step 2: Add `useNavigate` and dirty subscription**

After `const dispatch = useSduiDispatch()` (line 22), add:

```ts
  const navigate = useNavigate()
  const dirty = useViewStateStore((s) => s.dirty)
```

- [ ] **Step 3: Add formCacheStore sync**

After `useTabMeta(...)` (line 25) and before the first `useEffect` (line 27), add:

```ts
  useEffect(() => {
    useFormCacheStore.getState().setDirty(location.pathname, dirty)
  }, [location.pathname, dirty])
```

- [ ] **Step 4: Add pendingAction consumer**

After the `beforeunload` useEffect block (lines 64-71) and before the `if (!tree)` check (line 73), add:

```ts
  useEffect(() => {
    const pending = useFormCacheStore.getState().consumePendingAction(location.pathname)
    if (pending === 'save-and-close') {
      const route = location.pathname
      void dispatch({ type: 'COMMAND', command: 'save' }).then(() => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        const { tabs } = useWorkspaceTabsStore.getState()
        if (tabs.length > 0) {
          const next = tabs[0]
          void navigate(next.path + next.search)
        } else {
          void navigate('/')
        }
      })
    }
  }, [location.pathname, dispatch, navigate])
```

Note: dispatches `save` (not `saveAndClose`) so the server doesn't send a `navigate` effect. After successful save, explicitly closes the tab and navigates to the next one — mirroring `performClose` logic from `workspace-tab-bar.tsx`.

- [ ] **Step 5: Clean up dirty on unmount**

Inside the existing cleanup function (the `return () => {` in the first useEffect, around line 43), add `useFormCacheStore.getState().setDirty(route, false)` before `reset()`. Specifically, after the `else` block that calls `dispatch({ type: 'CLOSE' })` (line 57-58) and before `reset()` (line 60), add:

```ts
      useFormCacheStore.getState().setDirty(route, false)
```

- [ ] **Step 6: Verify manually**

1. Open an SDUI document, change a field value → tab title should show `*`
2. Click save → `*` should disappear
3. Change a field, click tab close (X) → "Сохранить изменения?" dialog should appear
4. Click "Сохранить" → document saves and tab closes
5. Click "Отбросить" → tab closes without saving
6. Click "Отмена" → dialog closes, tab stays

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx
git commit -m "add: sync SDUI dirty state to formCacheStore, consume save-and-close pendingAction"
```

---

## Final State

After all 6 tasks:

- **Фича 1 (DialogHost):** `openDialog` effects render as MUI modals. `closeDialog` effect and manual close (X button) both work. Mounted once inside `SduiScreen`, subscribes to global `dialogStack`.
- **Фича 2 (Dirty tracking):** User edits mark form dirty → asterisk in tab. Server patches don't mark dirty. Save/post resets dirty. Tab close checks dirty → shows "Save changes?" dialog → "Save" dispatches SDUI `saveAndClose`.
