# SDUI Server-Driven Reference Field — Phase 2 Frontend Design

> **Date:** 2026-06-18
> **Backend spec:** `docs/superpowers/plans/frontend-spec-server-driven-reference-field-phase2.md`
> **Scope:** Session-per-panel isolation, ref.create/ref.open commands, applyToParent relay, UX gate

---

## 1. Architectural Decisions

| Decision | Choice |
|---|---|
| Session isolation | React Context `SduiSessionContext` — each panel-form gets its own Provider |
| Field node migration | Explicit `useSduiSession()` hook wrapping context — fields change import, not logic |
| Global stores | Stay as backend for root Provider. Not deleted — root screen uses them via context. |
| Panel stack | Extended `PanelEntry` in DialogHost with optional `session` + local `tree`/`viewState` |
| Dispatch routing | `dispatch` reads `formSessionId`/`revision` from context, not global store |
| applyToParent | New effect in effect-handler, dispatches into parent session by `parentSessionId` |

---

## 2. Core: SduiSessionContext

New file: `src/features/sdui/lib/sdui-session-context.tsx`

```ts
interface SduiSessionValue {
  formSessionId: string | null
  revision: number | null
  getValue: (binding: string) => unknown
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
```

### Root Provider

`SduiScreen` wraps its `NodeRenderer` in `<SduiSessionProvider>` backed by the existing global `useTreeStore` + `useViewStateStore`. No behavior change for root screen — it's a shim.

### Panel Provider

Each panel-form in DialogHost/PanelHost with `session` gets its own `<SduiSessionProvider>` backed by local React state (useState/useReducer for tree + viewState). The provider's `dispatch` sends to its own `formSessionId`/`revision`.

### Hook

```ts
export const useSduiSession = () => useContext(SduiSessionContext)
```

All field nodes switch from:
```ts
const value = useViewState(node.binding)
const setValue = useViewStateSetter()
const dispatch = useSduiDispatch()
```
to:
```ts
const { getValue, setValue } = useSduiSession()
const value = getValue(node.binding)
const dispatch = useSduiDispatch() // dispatch reads session from context
```

---

## 3. Field Node Migration

~8 field nodes + composite nodes need updating:
- `text-field-node.tsx`
- `text-area-node.tsx`
- `number-field-node.tsx`
- `date-field-node.tsx`
- `datetime-field-node.tsx`
- `checkbox-field-node.tsx`
- `enum-field-node.tsx`
- `reference-field-node.tsx`
- `object-field-node.tsx`
- `table-node.tsx`

Change pattern (3-4 lines per file):
```diff
- import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
+ import { useSduiSession } from '../../../lib/sdui-session-context'

- const value = useViewState(node.binding)
- const setValue = useViewStateSetter()
+ const { getValue, setValue } = useSduiSession()
+ const value = getValue(node.binding)
```

---

## 4. Dispatch per Session

`useSduiDispatch()` currently reads from global `useTreeStore.getState()`. Change to read from `SduiSessionContext`:

```ts
export function useSduiDispatch() {
  const session = useSduiSession()
  // use session.formSessionId, session.revision instead of useTreeStore.getState()
  // apply response patches to session.applyTreePatches, session.setFromServer, etc.
}
```

This means dispatch is automatically scoped to the session of the panel where the action originated.

---

## 5. PanelHost — Extended Dialog Stack

### PanelEntry model

```ts
interface PanelEntry {
  panelId: string
  presentation: 'drawer' | 'modal'
  node: ViewNode
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  tree: ViewNode
  viewState: Record<string, unknown>
}
```

- Panel from `ref.showAll` (list picker) — no `session` (pull-grid, no own SDUI session)
- Panel from `ref.create`/`ref.open` — has `session` (from `openDialog.sessionId/revision/state`)

### openDialog effect handling

When `openDialog` effect arrives:
- If `effect.sessionId` exists → create PanelEntry with session, initialize `tree=effect.node`, `viewState=effect.state`
- If no `sessionId` → create PanelEntry without session (Phase 1 behavior — LIST node)

### Rendering

Each panel-form with `session` gets wrapped in `<SduiSessionProvider>` backed by its own local state. Non-session panels render with the parent's context (inherited).

---

## 6. ref.create / ref.open Commands

In `reference-field-node.tsx`:

```ts
const createAction = node.actions?.find((a) => a.trigger === 'create' && a.actionId === 'command')
const openAction = node.actions?.find((a) => a.trigger === 'open' && a.actionId === 'command')

const onAdd = createAction
  ? () => void dispatch({ type: 'COMMAND', command: createAction.command!, sourceNodeId: node.id })
  : (canBrowse ? openDictCreate : undefined)

const endAction = selectedOption && openAction
  ? <IconButton onMouseDown={(e) => {
      e.preventDefault()
      void dispatch({ type: 'COMMAND', command: openAction.command!, sourceNodeId: node.id })
    }}>...</IconButton>
  : (selectedOption && canBrowse ? /* legacy */ : undefined)
```

Visibility: `props.allowCreate`, `props.allowOpen`.

---

## 7. applyToParent Effect

New effect type in effect-handler:

```ts
case 'applyToParent': {
  // 1. Close child panel (pop from stack)
  // 2. Dispatch ref.select into PARENT session using effect.parentSessionId
  //    with value: effect.value and current parent revision
  // 3. If parent session 409 → notify warning
}
```

### ViewEffect extension

```ts
export interface ViewEffect {
  // existing fields...
  sessionId?: string        // for openDialog with child session
  revision?: number         // initial revision for child session
  state?: Record<string, unknown>  // initial state for child session
  parentSessionId?: string  // for applyToParent
  targetNodeId?: string     // field to apply selection to
  value?: unknown           // selected value { id, presentation }
}
```

---

## 8. UX Gate

While a panel-form with `session` is open, parent form must be non-interactive:
- MUI Drawer backdrop already blocks clicks
- Verify that lower panels/form under backdrop don't receive keyboard input
- If needed, add `pointer-events: none` on lower layers

---

## 9. Types Update

- `ViewNodeAction.command` — already added in Phase 1
- `ViewEffect` — add `sessionId?`, `revision?`, `state?`, `parentSessionId?`, `targetNodeId?`, `value?`
- `EffectType` — add `'applyToParent'`
- `NodeType` — no changes needed (LIST already added in Phase 1)

---

## 10. Migration Order (dependency chain)

1. **SduiSessionContext + useSduiSession hook** — foundation
2. **Root SduiSessionProvider** in SduiScreen — wraps existing global stores
3. **Migrate all field nodes** to useSduiSession — must work identically with root provider
4. **Migrate dispatch** to read from context
5. **Extended PanelEntry** with session support in DialogHost
6. **Panel SduiSessionProvider** for child forms
7. **ref.create / ref.open** commands in reference-field-node
8. **applyToParent** effect handling
9. **UX gate**
10. **Verification**
