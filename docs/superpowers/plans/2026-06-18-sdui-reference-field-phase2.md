# SDUI Server-Driven Reference Field Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session-per-panel isolation to the SDUI runtime so that child forms (ref.create / ref.open) can run in their own SDUI session inside a drawer, with cross-session applyToParent relay for returning the created/opened value to the parent form.

**Architecture:** Introduce `SduiSessionContext` (React Context) that carries `formSessionId`, `revision`, `getValue/setValue`, `dispatch`, and tree state. Root SduiScreen wraps in a Provider backed by the existing global zustand stores. Panel-forms in DialogHost get their own Provider backed by local React state. All field nodes switch from direct global store access to context. Dispatch reads session from context.

**Tech Stack:** React 19 Context, TypeScript, Zustand (existing stores stay for root), MUI Drawer

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/features/sdui/lib/sdui-session-context.tsx` | SduiSessionContext + Provider + `useSduiSession` hook |

### Modified files
| File | What changes |
|---|---|
| `src/features/sdui/types/view.ts` | ViewEffect gets `sessionId?`, `revision?`, `state?`, `parentSessionId?`, `targetNodeId?`, `value?` |
| `src/features/sdui/types/node-types.ts` | EffectType gets `'applyToParent'` |
| `src/features/sdui/ui/sdui-screen.tsx` | Wrap NodeRenderer in SduiSessionProvider |
| `src/features/sdui/lib/dispatch.ts` | Read session from context instead of global store |
| `src/features/sdui/lib/effect-handler.ts` | Handle `applyToParent` effect |
| `src/features/sdui/ui/dialog-host.tsx` | Extended PanelEntry with session, Provider per panel-form |
| `src/features/sdui/ui/nodes/fields/text-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/text-area-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/number-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/date-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/datetime-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/checkbox-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/enum-field-node.tsx` | Switch to useSduiSession |
| `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` | Switch to useSduiSession + ref.create/ref.open commands |
| `src/features/sdui/ui/nodes/composite/table-node.tsx` | Switch to useSduiSession |

---

## Task 1: Types — extend ViewEffect + add applyToParent EffectType

**Files:**
- Modify: `src/features/sdui/types/view.ts:59-67`
- Modify: `src/features/sdui/types/node-types.ts:22`

- [ ] **Step 1: Extend ViewEffect**

In `src/features/sdui/types/view.ts`, add new optional fields to `ViewEffect`. Change:

```ts
export interface ViewEffect {
  type: EffectType
  route?: string
  node?: ViewNode
  id?: string
  level?: string
  message?: string
  url?: string
}
```

to:

```ts
export interface ViewEffect {
  type: EffectType
  route?: string
  node?: ViewNode
  id?: string
  level?: string
  message?: string
  url?: string
  sessionId?: string
  revision?: number
  state?: Record<string, unknown>
  parentSessionId?: string
  targetNodeId?: string
  value?: unknown
}
```

- [ ] **Step 2: Add applyToParent to EffectType**

In `src/features/sdui/types/node-types.ts`, change:

```ts
export type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download'
```

to:

```ts
export type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download' | 'applyToParent'
```

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/types/
git commit -m "feat: extend ViewEffect with session fields and add applyToParent EffectType"
```

---

## Task 2: Create SduiSessionContext + useSduiSession hook

**Files:**
- Create: `src/features/sdui/lib/sdui-session-context.tsx`

- [ ] **Step 1: Create the context and provider**

Create `src/features/sdui/lib/sdui-session-context.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react'

import type { ViewNode, ViewPatch } from '../types/view'

export interface SduiSessionValue {
  formSessionId: string | null
  revision: number | null
  getValue: (binding: string | undefined) => unknown
  setValue: (binding: string, value: unknown) => void
  setFromServer: (binding: string, value: unknown) => void
  getAll: () => Record<string, unknown>
  replaceAll: (state: Record<string, unknown>) => void
  merge: (patch: Record<string, unknown>) => void
  isDirty: boolean
  resetDirty: () => void
  tree: ViewNode | null
  setRoot: (node: ViewNode) => void
  setSession: (id: string, rev: number) => void
  bumpRevision: (rev: number) => void
  applyTreePatches: (patches: ViewPatch[]) => void
  clearAllErrors: () => void
}

const SduiSessionContext = createContext<SduiSessionValue | null>(null)

export const useSduiSession = (): SduiSessionValue => {
  const ctx = useContext(SduiSessionContext)
  if (!ctx) throw new Error('useSduiSession must be used within SduiSessionProvider')
  return ctx
}

interface SduiSessionProviderProps {
  value: SduiSessionValue
  children: ReactNode
}

export const SduiSessionProvider = ({ value, children }: SduiSessionProviderProps) => (
  <SduiSessionContext value={value}>{children}</SduiSessionContext>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/sdui-session-context.tsx
git commit -m "feat: create SduiSessionContext and useSduiSession hook"
```

---

## Task 3: Wrap root SduiScreen in SduiSessionProvider

**Files:**
- Modify: `src/features/sdui/ui/sdui-screen.tsx`

- [ ] **Step 1: Add root provider**

In `sdui-screen.tsx`, import the provider and wrap `NodeRenderer` + `DialogHost` in it, backed by the existing global stores.

Add imports:

```ts
import { useMemo } from 'react' // add to existing react import
import { SduiSessionProvider, type SduiSessionValue } from '../lib/sdui-session-context'
```

Before the `return` statement (before line 100), build the context value from global stores:

```ts
  const sessionValue = useMemo<SduiSessionValue>(() => ({
    formSessionId: useTreeStore.getState().formSessionId,
    revision: useTreeStore.getState().revision,
    getValue: (binding) => binding ? useViewStateStore.getState().state[binding] : undefined,
    setValue: useViewStateStore.getState().set,
    setFromServer: useViewStateStore.getState().setFromServer,
    getAll: useViewStateStore.getState().getAll,
    replaceAll: useViewStateStore.getState().replaceAll,
    merge: useViewStateStore.getState().merge,
    isDirty: dirty,
    resetDirty: useViewStateStore.getState().resetDirty,
    tree,
    setRoot: useTreeStore.getState().setRoot,
    setSession: useTreeStore.getState().setSession,
    bumpRevision: useTreeStore.getState().bumpRevision,
    applyTreePatches: useTreeStore.getState().applyPatches,
    clearAllErrors: useTreeStore.getState().clearAllErrors,
  }), [tree, dirty])
```

Replace the return JSX:

```tsx
  return (
    <SduiSessionProvider value={sessionValue}>
      <NodeRenderer node={tree} />
      <DialogHost />
    </SduiSessionProvider>
  )
```

- [ ] **Step 2: Verify dev server compiles**

```bash
npm run dev
```

Open an SDUI document — should work exactly as before.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx
git commit -m "feat: wrap root SduiScreen in SduiSessionProvider"
```

---

## Task 4: Migrate all field nodes to useSduiSession

**Files:** 9 field node files (see file map)

Each file follows the same pattern. For each:
1. Replace `import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'` with `import { useSduiSession } from '../../../lib/sdui-session-context'`
2. Replace `const value = useViewState(node.binding)` with `const { getValue, setValue } = useSduiSession()` + `const value = getValue(node.binding)`
3. Remove the separate `const setValue = useViewStateSetter()` line

- [ ] **Step 1: Migrate text-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/text-field-node.tsx`:

Replace line 5:
```ts
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
```
with:
```ts
import { useSduiSession } from '../../../lib/sdui-session-context'
```

Replace lines 19-20:
```ts
  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
```

- [ ] **Step 2: Migrate text-area-node.tsx**

Same pattern. In `src/features/sdui/ui/nodes/fields/text-area-node.tsx`:

Replace line 5 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 20-21:
```ts
  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
```

- [ ] **Step 3: Migrate number-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/number-field-node.tsx`:

Replace line 4 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 18-19:
```ts
  const rawValue = useViewState(node.binding) as number | string | null | undefined
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const rawValue = getValue(node.binding) as number | string | null | undefined
```

- [ ] **Step 4: Migrate date-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/date-field-node.tsx`:

Replace line 4 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 17-18:
```ts
  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
```

- [ ] **Step 5: Migrate datetime-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/datetime-field-node.tsx`:

Replace line 4 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 16-17:
```ts
  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
```

- [ ] **Step 6: Migrate checkbox-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/checkbox-field-node.tsx`:

Replace line 5 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 17-18:
```ts
  const value = (useViewState(node.binding) as boolean | undefined) ?? false
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as boolean | undefined) ?? false
```

- [ ] **Step 7: Migrate enum-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`:

Replace line 11 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 31-32:
```ts
  const value = (useViewState(node.binding) as string | undefined) ?? ''
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const value = (getValue(node.binding) as string | undefined) ?? ''
```

- [ ] **Step 8: Migrate reference-field-node.tsx**

In `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`:

Replace line 6 import → `import { useSduiSession } from '../../../lib/sdui-session-context'`

Replace lines 52-53:
```ts
  const rawValue = useViewState(node.binding) as ReferenceValue | null | undefined
  const setValue = useViewStateSetter()
```
with:
```ts
  const { getValue, setValue } = useSduiSession()
  const rawValue = getValue(node.binding) as ReferenceValue | null | undefined
```

- [ ] **Step 9: Migrate table-node.tsx**

In `src/features/sdui/ui/nodes/composite/table-node.tsx`:

Replace line 18 import:
```ts
import { useViewState } from '../../../lib/stores/view-state-store'
```
with:
```ts
import { useSduiSession } from '../../../lib/sdui-session-context'
```

Replace line 50:
```ts
  const rows = (useViewState(node.binding) as TableRow[] | undefined) ?? []
```
with:
```ts
  const { getValue } = useSduiSession()
  const rows = (getValue(node.binding) as TableRow[] | undefined) ?? []
```

- [ ] **Step 10: Verify dev server compiles and SDUI documents still work**

```bash
npm run dev
```

Open an SDUI document. Fields should read/write values as before.

- [ ] **Step 11: Commit**

```bash
git add src/features/sdui/ui/nodes/
git commit -m "feat: migrate all field nodes from global stores to useSduiSession context"
```

---

## Task 5: Migrate dispatch to read session from context

**Files:**
- Modify: `src/features/sdui/lib/dispatch.ts`

This is the critical change: `useSduiDispatch` must read `formSessionId`/`revision` from context and apply response patches to the session's stores (context-provided functions), not the global singletons.

- [ ] **Step 1: Update useSduiDispatch**

In `src/features/sdui/lib/dispatch.ts`, add context import and change the dispatch to read from session context.

Add import:

```ts
import { useSduiSession } from './sdui-session-context'
```

In `useSduiDispatch()`, add session context at the top of the function (after line 39):

```ts
  const session = useSduiSession()
```

Replace lines 44-47 (where it reads from global stores):

```ts
      const { formSessionId, revision } = useTreeStore.getState()
      const { replaceAll, merge } = useViewStateStore.getState()
      const { setSession, setRoot, bumpRevision, applyPatches: applyTreePatches, clearAllErrors } =
        useTreeStore.getState()
```

with:

```ts
      const { formSessionId, revision } = session
      const { replaceAll, merge, setSession, setRoot, bumpRevision, applyTreePatches, clearAllErrors, setFromServer, resetDirty } = session
```

Then update all references in the function body:
- Line 98: `applyValuePatches(res.patches ?? [], useViewStateStore.getState().setFromServer)` → `applyValuePatches(res.patches ?? [], setFromServer)`
- Line 107: `applyValuePatches(res.patches ?? [], useViewStateStore.getState().setFromServer)` → `applyValuePatches(res.patches ?? [], setFromServer)`
- Line 112: `useViewStateStore.getState().resetDirty()` → `resetDirty()`

Also add `session` to the `useCallback` dependency array.

**Note:** The `closeSession` function (lines 49-60) still needs the actual session ID — it reads from the closure's `formSessionId` which now comes from context. This is correct.

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Open SDUI document, change a field, save — should work as before.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "feat: migrate useSduiDispatch to read session from SduiSessionContext"
```

---

## Task 6: Extended DialogHost with session-per-panel

**Files:**
- Modify: `src/features/sdui/ui/dialog-host.tsx`
- Modify: `src/features/sdui/lib/dispatch.ts` (dialog stack model)

- [ ] **Step 1: Extend dialog stack to PanelEntry model**

In `src/features/sdui/lib/dispatch.ts`, replace the dialog stack types and add panel session support.

Replace the dialog stack section (lines 14-36) with:

```ts
export interface PanelEntry {
  panelId: string
  node: ViewNode
  presentation: 'drawer' | 'modal'
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  viewState: Record<string, unknown>
}

let panelStack: PanelEntry[] = []
let panelListeners: Array<() => void> = []

export function getPanelStack(): PanelEntry[] {
  return panelStack
}

export function subscribePanels(listener: () => void): () => void {
  panelListeners.push(listener)
  return () => {
    panelListeners = panelListeners.filter((l) => l !== listener)
  }
}

function notifyPanelListeners() {
  panelListeners.forEach((l) => l())
}

export function popPanel(): void {
  panelStack = panelStack.slice(0, -1)
  notifyPanelListeners()
}

export function updatePanelSession(panelId: string, rev: number): void {
  panelStack = panelStack.map((p) =>
    p.panelId === panelId && p.session
      ? { ...p, session: { ...p.session, revision: rev } }
      : p
  )
  notifyPanelListeners()
}

export function updatePanelViewState(panelId: string, state: Record<string, unknown>): void {
  panelStack = panelStack.map((p) =>
    p.panelId === panelId ? { ...p, viewState: state } : p
  )
  // No listener notify needed — viewState is read via context, not useSyncExternalStore
}

export function findPanelBySessionId(sessionId: string): PanelEntry | undefined {
  return panelStack.find((p) => p.session?.formSessionId === sessionId)
}
```

Update the `openDialog` handler in the `effectHandler` creation (line 63-67) to create PanelEntry:

```ts
        openDialog: (effect) => {
          const presentation = (effect.node?.props?.presentation as string) ?? 'modal'
          const entry: PanelEntry = {
            panelId: effect.node?.id ?? String(Date.now()),
            node: effect.node!,
            presentation: presentation as 'drawer' | 'modal',
            viewState: effect.state ?? {},
          }
          if (effect.sessionId) {
            entry.session = {
              formSessionId: effect.sessionId,
              revision: effect.revision ?? 0,
              parentSessionId: session.formSessionId ?? undefined,
              targetNodeId: undefined,
            }
          }
          panelStack = [...panelStack, entry]
          notifyPanelListeners()
        },
        closeDialog: (id) => {
          panelStack = panelStack.filter((p) => p.panelId !== id)
          notifyPanelListeners()
        },
```

Also keep the old exports as aliases for backward compatibility (DialogHost still uses them):

```ts
// Backward-compatible aliases
export const getDialogStack = getPanelStack
export const subscribeDialogs = subscribePanels
export const popDialog = popPanel
```

- [ ] **Step 2: Update DialogHost to render panel-forms with SduiSessionProvider**

Replace `src/features/sdui/ui/dialog-host.tsx`:

```tsx
import { useSyncExternalStore, useState, useCallback, useMemo } from 'react'
import { Dialog, DialogTitle, DialogContent, Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { getPanelStack, subscribePanels, popPanel, updatePanelSession, updatePanelViewState, type PanelEntry } from '../lib/dispatch'
import { SduiSessionProvider, type SduiSessionValue } from '../lib/sdui-session-context'
import { applyPatches, clearErrors } from '../lib/patch-applier'
import type { ViewNode, ViewPatch } from '../types/view'
import { NodeRenderer } from './node-renderer'

const PanelFormProvider = ({ panel, children }: { panel: PanelEntry; children: React.ReactNode }) => {
  const [tree, setTree] = useState<ViewNode>(panel.node)
  const [viewState, setViewState] = useState<Record<string, unknown>>(panel.viewState)
  const [dirty, setDirty] = useState(false)

  const sessionValue = useMemo<SduiSessionValue>(() => ({
    formSessionId: panel.session?.formSessionId ?? null,
    revision: panel.session?.revision ?? null,
    getValue: (binding) => binding ? viewState[binding] : undefined,
    setValue: (binding, value) => {
      setViewState((s) => ({ ...s, [binding]: value }))
      setDirty(true)
    },
    setFromServer: (binding, value) => {
      setViewState((s) => ({ ...s, [binding]: value }))
    },
    getAll: () => viewState,
    replaceAll: (s) => { setViewState(s); setDirty(false) },
    merge: (patch) => setViewState((s) => ({ ...s, ...patch })),
    isDirty: dirty,
    resetDirty: () => setDirty(false),
    tree,
    setRoot: setTree,
    setSession: (id, rev) => {
      updatePanelSession(panel.panelId, rev)
    },
    bumpRevision: (rev) => {
      updatePanelSession(panel.panelId, rev)
    },
    applyTreePatches: (patches) => {
      setTree((t) => applyPatches(t, patches))
    },
    clearAllErrors: () => {
      setTree((t) => clearErrors(t))
    },
  }), [panel.session, panel.panelId, tree, viewState, dirty])

  return <SduiSessionProvider value={sessionValue}>{children}</SduiSessionProvider>
}

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribePanels, getPanelStack)

  return (
    <>
      {stack.map((panel, i) => {
        if (!panel.node) return null

        const content = panel.session ? (
          <PanelFormProvider panel={panel}>
            <NodeRenderer node={panel.node} />
          </PanelFormProvider>
        ) : (
          <NodeRenderer node={panel.node} />
        )

        if (panel.presentation === 'drawer') {
          const width = (panel.node.props?.width as number | undefined) ?? 900

          return (
            <Drawer
              key={panel.panelId}
              anchor="right"
              open
              onClose={popPanel}
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
                  <IconButton onClick={popPanel}>
                    <CloseIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </div>
                {content}
              </div>
            </Drawer>
          )
        }

        return (
          <Dialog
            key={panel.panelId}
            open
            onClose={popPanel}
            maxWidth="md"
            fullWidth
          >
            {panel.node.props?.title != null && (
              <DialogTitle>{String(panel.node.props.title)}</DialogTitle>
            )}
            <DialogContent>
              {content}
            </DialogContent>
          </Dialog>
        )
      })}
    </>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open SDUI document, trigger "Показать все" on a migrated reference field → Phase 1 drawer should still work (no session on panel → no provider wrapping → inherits parent context).

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts src/features/sdui/ui/dialog-host.tsx
git commit -m "feat: extended PanelEntry model with session-per-panel and SduiSessionProvider in DialogHost"
```

---

## Task 7: ref.create / ref.open commands in reference-field-node

**Files:**
- Modify: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

- [ ] **Step 1: Add ref.create and ref.open action handling**

In `reference-field-node.tsx`, after the `showAllAction` and `allowShowAll` lines, add:

```ts
  const createAction = node.actions?.find((a) => a.trigger === 'create' && a.actionId === 'command')
  const openAction = node.actions?.find((a) => a.trigger === 'open' && a.actionId === 'command')
  const allowCreate = node.props?.allowCreate as boolean | undefined
  const allowOpen = node.props?.allowOpen as boolean | undefined
```

Update the `onAdd` prop on `AutocompleteInput`. Change:

```tsx
        onAdd={canBrowse ? openDictCreate : undefined}
```

to:

```tsx
        onAdd={
          createAction
            ? () => void dispatch({ type: 'COMMAND', command: createAction.command!, sourceNodeId: node.id })
            : (allowCreate ?? canBrowse) ? openDictCreate : undefined
        }
```

Update the `endAction` prop. Change the existing endAction to also check `openAction`:

```tsx
        endAction={
          selectedOption && openAction ? (
            <IconButton
              sx={{ p: '4px', borderRadius: '6px' }}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                void dispatch({ type: 'COMMAND', command: openAction.command!, sourceNodeId: node.id })
              }}
            >
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
          ) : selectedOption && canBrowse ? (
            <IconButton
              sx={{ p: '4px', borderRadius: '6px' }}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                useDictSidebarStore.getState().push({
                  mode: 'edit',
                  domain,
                  typeCode: targetTypeCode!,
                  entryId: selectedOption.id,
                  onSelect: applySelected,
                })
              }}
            >
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
          ) : undefined
        }
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/fields/reference-field-node.tsx
git commit -m "feat: add ref.create and ref.open COMMAND dispatch to reference-field-node"
```

---

## Task 8: applyToParent effect handling

**Files:**
- Modify: `src/features/sdui/lib/effect-handler.ts`
- Modify: `src/features/sdui/lib/dispatch.ts`

- [ ] **Step 1: Add applyToParent handler**

In `src/features/sdui/lib/effect-handler.ts`, add a new dependency for the applyToParent handler and handle the new effect type.

Update the `EffectHandlerDeps` interface:

```ts
export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (id: string) => void
  applyToParent?: (effect: ViewEffect) => void
}
```

Add a new case in the `play` function, after the `download` case:

```ts
      case 'applyToParent':
        deps.applyToParent?.(effect)
        break
```

- [ ] **Step 2: Wire applyToParent in dispatch**

In `src/features/sdui/lib/dispatch.ts`, in the `effectHandler` creation, add the `applyToParent` handler:

```ts
        applyToParent: (effect) => {
          // 1. Pop the child panel
          popPanel()

          // 2. Dispatch ref.select into the parent session
          if (effect.parentSessionId && effect.targetNodeId && effect.value) {
            const parentPanel = findPanelBySessionId(effect.parentSessionId)
            if (parentPanel) {
              // For now, the parent session dispatch will be handled through
              // the parent's context when the panel is popped and re-rendered.
              // Queue a ref.select command to the parent:
              void viewTransport.post({
                formSessionId: effect.parentSessionId,
                revision: parentPanel.session?.revision ?? null,
                action: {
                  type: 'COMMAND',
                  command: `ref.select:${effect.targetNodeId}`,
                  value: effect.value,
                },
              }).then((res) => {
                // Apply response to parent stores (root session for now)
                const { bumpRevision, applyTreePatches, clearAllErrors } = session
                const { setFromServer, merge } = session
                bumpRevision(res.revision)
                clearAllErrors()
                applyTreePatches(res.patches ?? [])
                applyValuePatches(res.patches ?? [], setFromServer)
                merge(res.statePatch ?? {})
                // Play any remaining effects from parent response
                effectHandler.playAll(res.effects ?? [])
              }).catch((error) => {
                if (error instanceof ViewConflictError && error.data.code === 'SESSION_NOT_FOUND') {
                  showToast('warning', 'Форма устарела, выбор не применён')
                } else {
                  showToast('error', error instanceof Error ? error.message : 'Ошибка')
                }
              })
            }
          }
        },
```

Add `ViewConflictError` to imports if not already imported (it is — line 7).

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/lib/effect-handler.ts src/features/sdui/lib/dispatch.ts
git commit -m "feat: handle applyToParent effect for cross-session value relay"
```

---

## Task 9: Verify and cleanup

- [ ] **Step 1: TypeScript compilation**

```bash
npx tsc -b --noEmit
```

Fix any type errors.

- [ ] **Step 2: Verify SDUI documents**

1. Open SDUI document — fields work as before
2. Change field → dispatch EVENT → server responds → field updates
3. Save/Post → works
4. "Показать все" → Phase 1 drawer opens, select works

- [ ] **Step 3: Verify ref.create (when backend ships it)**

1. On a migrated field with `ref.create` action → click "Добавить"
2. COMMAND dispatches → backend responds with `openDialog` carrying `sessionId`
3. Drawer opens with form → fields are independent from parent
4. Fill and "Записать и выбрать" → backend responds with `applyToParent`
5. Child drawer closes → parent field fills with created value

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: Phase 2 cleanup and type fixes"
```
