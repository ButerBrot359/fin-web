# SDUI Frontend Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-driven UI engine in `src/features/sdui/` that renders form trees from the backend via `POST /api/view`, manages stateful form sessions (formSessionId/revision), applies patches, plays effects, and handles 409 conflicts — all 31 NodeType components.

**Architecture:** Layered approach — types → stores → patch applier → component registry + renderer → all 31 node components → effect/conflict handlers → dispatch → transport → SduiScreen container → routing integration. Two zustand stores: `TreeStore` (immutable tree + session metadata) and `ViewStateStore` (flat binding→value cache). Single `dispatch` function orchestrates all server communication.

**Tech Stack:** React 19, TypeScript 5.9, Zustand, MUI 7, Sonner (toasts), React Router, Axios (existing `apiService`), react-i18next, date-fns

**Spec:** `docs/superpowers/specs/2026-05-29-sdui-frontend-engine-design.md`
**Backend spec:** `docs/superpowers/plans/frontend-spec-new-events-system.md`

---

### Task 0: Create feature branch

**Files:**
- None (git operation only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout dev
git pull origin dev
git checkout -b feature/sdui-engine
```

- [ ] **Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feature/sdui-engine`

---

### Task 1: Types — NodeType, PatchOp, EffectType, ActionType

**Files:**
- Create: `src/features/sdui/types/node-types.ts`

- [ ] **Step 1: Create node-types.ts**

```ts
export type NodeType =
  // Shell (4)
  | 'APP_SHELL' | 'TOP_BAR' | 'SIDEBAR' | 'WORKSPACE'
  // Layout (10)
  | 'PAGE' | 'VSTACK' | 'HSTACK' | 'GRID' | 'GROUP'
  | 'TABS' | 'TAB' | 'TOOLBAR' | 'SEPARATOR' | 'SPACER'
  // Display (4)
  | 'LABEL' | 'TEXT' | 'BADGE' | 'ICON'
  // Fields (8)
  | 'TEXT_FIELD' | 'TEXT_AREA' | 'NUMBER_FIELD' | 'DATE_FIELD'
  | 'DATETIME_FIELD' | 'CHECKBOX_FIELD' | 'ENUM_FIELD' | 'REFERENCE_FIELD'
  // Composite (3)
  | 'TABLE' | 'TABLE_COLUMN' | 'OBJECT_FIELD'
  // Action (3)
  | 'BUTTON' | 'MENU_ITEM' | 'LINK'

export type PatchOp =
  | 'setProp' | 'setValue'
  | 'replaceNode' | 'insertNode' | 'removeNode' | 'moveNode'
  | 'setOptions'

export type EffectType = 'navigate' | 'openDialog' | 'closeDialog' | 'notify' | 'download'

export type ActionType = 'OPEN' | 'EVENT' | 'COMMAND' | 'CLOSE'
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/types/node-types.ts
git commit -m "feat: add SDUI type enums — NodeType, PatchOp, EffectType, ActionType"
```

---

### Task 2: Types — View DTOs (ViewNode, ViewRequest, ViewResponse, ViewPatch, ViewEffect, ViewAction)

**Files:**
- Create: `src/features/sdui/types/view.ts`

- [ ] **Step 1: Create view.ts**

```ts
import type { ActionType, EffectType, NodeType, PatchOp } from './node-types'

export interface ViewNode {
  id: string
  type: NodeType
  props?: Record<string, unknown>
  binding?: string
  value?: unknown
  children?: ViewNode[]
  actions?: ViewNodeAction[]
}

export interface ViewNodeAction {
  trigger: string
  actionId: string
}

export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
}

export interface ViewRequest {
  formSessionId?: string | null
  revision?: number | null
  layoutCode?: string | null
  route?: string
  action: ViewAction
  state?: Record<string, unknown>
}

export interface ViewResponse {
  formSessionId: string
  revision: number
  tree?: ViewNode
  state?: Record<string, unknown>
  patches?: ViewPatch[]
  statePatch?: Record<string, unknown>
  effects?: ViewEffect[]
}

export interface ViewPatch {
  op: PatchOp
  nodeId?: string
  binding?: string
  key?: string
  value?: unknown
  parentId?: string
  index?: number
  node?: ViewNode
  options?: unknown
}

export interface ViewEffect {
  type: EffectType
  route?: string
  node?: ViewNode
  id?: string
  level?: string
  message?: string
  url?: string
}

export interface NodeProps {
  node: ViewNode
}

export interface ConflictError {
  code: 'STALE_REVISION' | 'SESSION_NOT_FOUND'
  formSessionId?: string
  currentRevision?: number
  snapshot?: { state: Record<string, unknown> }
  reason?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/types/view.ts
git commit -m "feat: add SDUI view DTOs — ViewNode, ViewRequest, ViewResponse, ViewPatch, ViewEffect"
```

---

### Task 3: ViewStateStore — binding→value cache

**Files:**
- Create: `src/features/sdui/lib/stores/view-state-store.ts`

- [ ] **Step 1: Create view-state-store.ts**

```ts
import { create } from 'zustand'

interface ViewStateStoreState {
  state: Record<string, unknown>
  get: (binding: string) => unknown
  set: (binding: string, value: unknown) => void
  merge: (patch: Record<string, unknown>) => void
  replaceAll: (s: Record<string, unknown>) => void
  getAll: () => Record<string, unknown>
}

export const useViewStateStore = create<ViewStateStoreState>((set, get) => ({
  state: {},
  get: (binding) => get().state[binding],
  set: (binding, value) =>
    set((s) => ({ state: { ...s.state, [binding]: value } })),
  merge: (patch) => set((s) => ({ state: { ...s.state, ...patch } })),
  replaceAll: (s) => set({ state: s }),
  getAll: () => get().state,
}))

export const useViewState = (binding: string | undefined) =>
  useViewStateStore((s) => (binding ? s.state[binding] : undefined))

export const useViewStateSetter = () => useViewStateStore((s) => s.set)
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/stores/view-state-store.ts
git commit -m "feat: add ViewStateStore — zustand binding→value cache"
```

---

### Task 4: PatchApplier — immutable tree patching

**Files:**
- Create: `src/features/sdui/lib/patch-applier.ts`

- [ ] **Step 1: Create patch-applier.ts**

```ts
import type { ViewNode, ViewPatch } from '../types/view'

export function findNode(root: ViewNode, id: string): ViewNode | null {
  if (root.id === id) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function updateNode(
  root: ViewNode,
  id: string,
  mutate: (n: ViewNode) => ViewNode,
): ViewNode {
  if (root.id === id) return mutate(root)
  if (!root.children) return root
  let changed = false
  const newChildren = root.children.map((c) => {
    const u = updateNode(c, id, mutate)
    if (u !== c) changed = true
    return u
  })
  return changed ? { ...root, children: newChildren } : root
}

function removeNodeFromTree(root: ViewNode, id: string): ViewNode {
  if (!root.children) return root
  const filtered = root.children.filter((c) => c.id !== id)
  const mapped = filtered.map((c) => removeNodeFromTree(c, id))
  const changed =
    filtered.length !== root.children.length ||
    mapped.some((m, i) => m !== filtered[i])
  return changed ? { ...root, children: mapped } : root
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  const result = [...arr]
  result.splice(index, 0, item)
  return result
}

function applyOne(root: ViewNode, patch: ViewPatch): ViewNode {
  switch (patch.op) {
    case 'setProp':
      return updateNode(root, patch.nodeId!, (n) => ({
        ...n,
        props: { ...n.props, [patch.key!]: patch.value },
      }))

    case 'setValue':
      // setValue does NOT modify the tree — handled separately in ViewStateStore
      return root

    case 'replaceNode':
      return updateNode(root, patch.nodeId!, () => patch.node!)

    case 'insertNode':
      return updateNode(root, patch.parentId!, (parent) => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, patch.node!),
      }))

    case 'removeNode':
      return removeNodeFromTree(root, patch.nodeId!)

    case 'moveNode': {
      const moved = findNode(root, patch.nodeId!)
      if (!moved) return root
      const without = removeNodeFromTree(root, patch.nodeId!)
      return updateNode(without, patch.parentId!, (parent) => ({
        ...parent,
        children: insertAt(parent.children ?? [], patch.index!, moved),
      }))
    }

    case 'setOptions':
      return updateNode(root, patch.nodeId!, (n) => ({
        ...n,
        props: { ...n.props, options: patch.options },
      }))

    default:
      return root
  }
}

export function applyPatches(root: ViewNode, patches: ViewPatch[]): ViewNode {
  return patches.reduce((tree, patch) => applyOne(tree, patch), root)
}

export function applyValuePatches(
  patches: ViewPatch[],
  setter: (binding: string, value: unknown) => void,
): void {
  for (const p of patches) {
    if (p.op === 'setValue' && p.binding) {
      setter(p.binding, p.value)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/patch-applier.ts
git commit -m "feat: add PatchApplier — immutable tree patching for 7 patch ops"
```

---

### Task 5: TreeStore — tree + formSessionId + revision

**Files:**
- Create: `src/features/sdui/lib/stores/tree-store.ts`

- [ ] **Step 1: Create tree-store.ts**

```ts
import { create } from 'zustand'

import { applyPatches } from '../patch-applier'
import type { ViewNode, ViewPatch } from '../../types/view'

interface TreeStoreState {
  root: ViewNode | null
  formSessionId: string | null
  revision: number | null

  setRoot: (node: ViewNode) => void
  setSession: (id: string, rev: number) => void
  bumpRevision: (rev: number) => void
  applyPatches: (patches: ViewPatch[]) => void
  reset: () => void
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  root: null,
  formSessionId: null,
  revision: null,

  setRoot: (node) => set({ root: node }),

  setSession: (id, rev) => set({ formSessionId: id, revision: rev }),

  bumpRevision: (rev) => set({ revision: rev }),

  applyPatches: (patches) => {
    const { root } = get()
    if (!root) return
    set({ root: applyPatches(root, patches) })
  },

  reset: () => set({ root: null, formSessionId: null, revision: null }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/stores/tree-store.ts
git commit -m "feat: add TreeStore — zustand store for tree + session + revision"
```

---

### Task 6: ViewTransport — API layer

**Files:**
- Create: `src/features/sdui/api/view-transport.ts`

- [ ] **Step 1: Create view-transport.ts**

**Important:** The existing `apiService` (see `src/shared/api/api.ts:23-28`) catches `AxiosError` and re-throws `error.response?.data`, losing the HTTP status code. SDUI dispatch needs the 409 status to detect conflicts. So we use the raw `axios` instance directly.

```ts
import axios from 'axios'

import type { ViewRequest, ViewResponse, ConflictError } from '../types/view'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export class ViewConflictError extends Error {
  constructor(public data: ConflictError) {
    super(data.code)
  }
}

export const viewTransport = {
  post: async (req: ViewRequest): Promise<ViewResponse> => {
    try {
      const res = await instance.post<ViewResponse>('/api/view', req)
      return res.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new ViewConflictError(error.response.data as ConflictError)
      }
      if (axios.isAxiosError(error)) {
        throw new Error(
          (error.response?.data as Record<string, unknown>)?.message as string
            ?? error.message,
        )
      }
      throw error
    }
  },

  closeBeacon: (sessionId: string): void => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? ''
    navigator.sendBeacon(`${baseUrl}/api/view/${sessionId}`, '')
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/api/view-transport.ts
git commit -m "feat: add ViewTransport — POST /api/view + sendBeacon for CLOSE"
```

---

### Task 7: EffectHandler

**Files:**
- Create: `src/features/sdui/lib/effect-handler.ts`

- [ ] **Step 1: Create effect-handler.ts**

```ts
import type { NavigateFunction } from 'react-router-dom'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (id: string) => void
}

export function createEffectHandler(deps: EffectHandlerDeps) {
  function play(effect: ViewEffect): void {
    switch (effect.type) {
      case 'navigate':
        void deps.closeSession()
        deps.navigate(effect.route!)
        break

      case 'openDialog':
        deps.openDialog(effect)
        break

      case 'closeDialog':
        deps.closeDialog(effect.id!)
        break

      case 'notify':
        showToast(
          (effect.level as ToastLevel) ?? 'info',
          effect.message ?? '',
        )
        break

      case 'download':
        window.open(effect.url!, '_blank')
        break
    }
  }

  function playAll(effects: ViewEffect[]): void {
    effects.forEach(play)
  }

  return { play, playAll }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/effect-handler.ts
git commit -m "feat: add EffectHandler — navigate, openDialog, closeDialog, notify, download"
```

---

### Task 8: ConflictHandler

**Files:**
- Create: `src/features/sdui/lib/conflict-handler.ts`

- [ ] **Step 1: Create conflict-handler.ts**

```ts
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ConflictError, ViewAction } from '../types/view'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

export function handleConflict(
  err: ConflictError,
  _originalAction: ViewAction,
  reopen: () => Promise<void>,
): void {
  if (err.code === 'STALE_REVISION') {
    showToast('info', 'Синхронизирую...')
    if (err.formSessionId && err.currentRevision != null) {
      useTreeStore.getState().setSession(err.formSessionId, err.currentRevision)
    }
    if (err.snapshot?.state) {
      useViewStateStore.getState().replaceAll(err.snapshot.state)
    }
    // Do NOT retry the original action — user sees updated form and decides
  } else if (err.code === 'SESSION_NOT_FOUND') {
    showToast('warning', 'Сессия истекла, переоткрываю...')
    void reopen()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/conflict-handler.ts
git commit -m "feat: add ConflictHandler — STALE_REVISION resync + SESSION_NOT_FOUND reopen"
```

---

### Task 9: Dispatch — single entry point for all server communication

**Files:**
- Create: `src/features/sdui/lib/dispatch.ts`

- [ ] **Step 1: Create dispatch.ts**

```ts
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewAction, ViewEffect } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'
import { applyValuePatches } from './patch-applier'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'

// Dialog state kept module-local — simple array-based stack for MVP
let dialogStack: ViewEffect[] = []
let dialogListeners: Array<() => void> = []

export function getDialogStack(): ViewEffect[] {
  return dialogStack
}

export function subscribeDialogs(listener: () => void): () => void {
  dialogListeners.push(listener)
  return () => {
    dialogListeners = dialogListeners.filter((l) => l !== listener)
  }
}

function notifyDialogListeners() {
  dialogListeners.forEach((l) => l())
}

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()

  const dispatch = useCallback(
    async (action: ViewAction): Promise<void> => {
      const { formSessionId, revision } = useTreeStore.getState()
      const { replaceAll, merge } = useViewStateStore.getState()
      const { setSession, setRoot, bumpRevision, applyPatches: applyTreePatches } =
        useTreeStore.getState()

      const closeSession = async () => {
        if (formSessionId) {
          try {
            await viewTransport.post({
              formSessionId,
              action: { type: 'CLOSE' },
            })
          } catch {
            // best-effort
          }
        }
      }

      const effectHandler = createEffectHandler({
        navigate,
        closeSession,
        openDialog: (effect) => {
          dialogStack = [...dialogStack, effect]
          notifyDialogListeners()
        },
        closeDialog: (id) => {
          dialogStack = dialogStack.filter(
            (d) => d.node?.id !== id,
          )
          notifyDialogListeners()
        },
      })

      const reopen = async () => {
        await dispatch({ type: 'OPEN' })
      }

      try {
        const res = await viewTransport.post({
          formSessionId: action.type === 'OPEN' ? null : formSessionId,
          revision: action.type === 'OPEN' ? null : revision,
          layoutCode: action.type === 'OPEN' ? null : undefined,
          route: location.pathname,
          action,
        })

        if (action.type === 'OPEN') {
          setSession(res.formSessionId, res.revision)
          if (res.tree) setRoot(res.tree)
          replaceAll(res.state ?? {})
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
        } else {
          // EVENT or COMMAND — order is critical: revision → tree patches → value patches → effects
          bumpRevision(res.revision)
          applyTreePatches(res.patches ?? [])
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().set)
          merge(res.statePatch ?? {})
          effectHandler.playAll(res.effects ?? [])
        }
      } catch (error) {
        if (error instanceof ViewConflictError) {
          handleConflict(error.data, action, reopen)
        } else {
          const message =
            error instanceof Error ? error.message : 'Ошибка запроса'
          showToast('error', message)
        }
      }
    },
    [location.pathname, navigate],
  )

  return dispatch
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "feat: add useSduiDispatch — unified OPEN/EVENT/COMMAND/CLOSE orchestrator"
```

---

### Task 10: UnknownNode + NodeRenderer + ComponentRegistry

**Files:**
- Create: `src/features/sdui/ui/unknown-node.tsx`
- Create: `src/features/sdui/lib/component-registry.ts`
- Create: `src/features/sdui/ui/node-renderer.tsx`

- [ ] **Step 1: Create unknown-node.tsx**

```tsx
import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../types/view'

export const UnknownNode: FC<NodeProps> = ({ node }) => (
  <div
    style={{
      padding: 8,
      border: '1px dashed #f0a000',
      background: '#fff8e1',
      borderRadius: 4,
    }}
  >
    <Typography variant="caption">
      Тип «{node.type}» не поддерживается этой версией клиента (id: {node.id}).
    </Typography>
  </div>
)
```

- [ ] **Step 2: Create component-registry.ts — empty registry (components added in later tasks)**

```ts
import type { FC } from 'react'

import type { NodeProps } from '../types/view'

// Registry is populated by node component tasks (Tasks 11–15).
// Start empty — NodeRenderer falls back to UnknownNode for unregistered types.
const registry: Record<string, FC<NodeProps>> = {}

export function getComponent(type: string): FC<NodeProps> | undefined {
  return registry[type]
}

export function registerComponent(type: string, component: FC<NodeProps>): void {
  registry[type] = component
}

export function getRegistry(): Record<string, FC<NodeProps>> {
  return registry
}
```

- [ ] **Step 3: Create node-renderer.tsx**

```tsx
import type { FC } from 'react'

import type { ViewNode } from '../types/view'
import { getComponent } from '../lib/component-registry'
import { UnknownNode } from './unknown-node'

export const NodeRenderer: FC<{ node: ViewNode }> = ({ node }) => {
  const Component = getComponent(node.type) ?? UnknownNode
  return <Component node={node} />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/unknown-node.tsx src/features/sdui/lib/component-registry.ts src/features/sdui/ui/node-renderer.tsx
git commit -m "feat: add NodeRenderer + ComponentRegistry + UnknownNode fallback"
```

---

### Task 11: Shell node components (4 stubs) + Layout nodes (10)

**Files:**
- Create: `src/features/sdui/ui/nodes/shell/app-shell-node.tsx`
- Create: `src/features/sdui/ui/nodes/shell/top-bar-node.tsx`
- Create: `src/features/sdui/ui/nodes/shell/sidebar-node.tsx`
- Create: `src/features/sdui/ui/nodes/shell/workspace-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/page-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/vstack-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/hstack-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/grid-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/group-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/tabs-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/tab-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/toolbar-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/separator-node.tsx`
- Create: `src/features/sdui/ui/nodes/layout/spacer-node.tsx`

- [ ] **Step 1: Create 4 shell stubs**

Each shell stub renders children via NodeRenderer. They are Phase 1 placeholders.

`src/features/sdui/ui/nodes/shell/app-shell-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const AppShellNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}</div>
)
```

`src/features/sdui/ui/nodes/shell/top-bar-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const TopBarNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}</div>
)
```

`src/features/sdui/ui/nodes/shell/sidebar-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const SidebarNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}</div>
)
```

`src/features/sdui/ui/nodes/shell/workspace-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const WorkspaceNode: FC<NodeProps> = ({ node }) => (
  <div>{node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}</div>
)
```

- [ ] **Step 2: Create page-node.tsx**

```tsx
import { useEffect, type FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const PageNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined

  useEffect(() => {
    if (title) document.title = title
  }, [title])

  return (
    <div className="flex flex-col gap-4">
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
```

- [ ] **Step 3: Create vstack-node.tsx**

```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const VStackNode: FC<NodeProps> = ({ node }) => {
  const gap = node.props?.gap as number | undefined
  const padding = node.props?.padding as number | undefined
  const align = node.props?.align as string | undefined
  const flex = node.props?.flex as string | number | undefined

  return (
    <div
      className="flex flex-col"
      style={{
        gap: gap != null ? `${gap * 4}px` : undefined,
        padding: padding != null ? `${padding * 4}px` : undefined,
        alignItems: align,
        flex,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
```

- [ ] **Step 4: Create hstack-node.tsx**

```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const HStackNode: FC<NodeProps> = ({ node }) => {
  const gap = node.props?.gap as number | undefined
  const justify = node.props?.justify as string | undefined
  const align = node.props?.align as string | undefined
  const flex = node.props?.flex as string | number | undefined

  return (
    <div
      className="flex"
      style={{
        gap: gap != null ? `${gap * 4}px` : undefined,
        justifyContent: justify,
        alignItems: align ?? 'stretch',
        flex,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
```

- [ ] **Step 5: Create grid-node.tsx**

```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const GridNode: FC<NodeProps> = ({ node }) => {
  const columns = (node.props?.columns as number) ?? 1
  const gap = node.props?.gap as number | undefined

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gap != null ? `${gap * 4}px` : undefined,
      }}
    >
      {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
    </div>
  )
}
```

- [ ] **Step 6: Create group-node.tsx**

```tsx
import { useState, type FC } from 'react'
import { Paper, Typography, IconButton, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const GroupNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const collapsible = (node.props?.collapsible as boolean) ?? false
  const initialCollapsed = (node.props?.collapsed as boolean) ?? false
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {title && (
        <div className="mb-2 flex items-center gap-1">
          <Typography variant="subtitle2">{title}</Typography>
          {collapsible && (
            <IconButton size="small" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </IconButton>
          )}
        </div>
      )}
      <Collapse in={!collapsed}>
        <div className="flex flex-col gap-2">
          {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
        </div>
      </Collapse>
    </Paper>
  )
}
```

- [ ] **Step 7: Create tabs-node.tsx + tab-node.tsx**

`src/features/sdui/ui/nodes/layout/tabs-node.tsx`:
```tsx
import { useState, type FC } from 'react'
import { Tabs, Tab } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { NodeRenderer } from '../../node-renderer'

export const TabsNode: FC<NodeProps> = ({ node }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const dispatch = useSduiDispatch()
  const tabs = node.children ?? []

  const handleChange = (_: unknown, newIndex: number) => {
    setActiveIndex(newIndex)
    const tab = tabs[newIndex]
    if (tab?.actions?.some((a) => a.actionId === 'fieldEvent')) {
      void dispatch({
        type: 'EVENT',
        sourceNodeId: tab.id,
        trigger: 'change',
        value: newIndex,
      })
    }
  }

  return (
    <div>
      <Tabs value={activeIndex} onChange={handleChange}>
        {tabs.map((tab, i) => (
          <Tab
            key={tab.id}
            label={(tab.props?.title as string) ?? `Tab ${i + 1}`}
          />
        ))}
      </Tabs>
      {tabs.map((tab, i) => (
        <div key={tab.id} role="tabpanel" hidden={activeIndex !== i}>
          {activeIndex === i && (
            <div className="pt-4">
              {tab.children?.map((c) => (
                <NodeRenderer key={c.id} node={c} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

`src/features/sdui/ui/nodes/layout/tab-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

// TAB content is rendered by TabsNode parent. This component is a fallback
// in case TAB appears standalone (shouldn't happen in practice).
export const TabNode: FC<NodeProps> = ({ node }) => (
  <div>
    {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
  </div>
)
```

- [ ] **Step 8: Create toolbar-node.tsx**

```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'

export const ToolbarNode: FC<NodeProps> = ({ node }) => (
  <div className="flex items-center gap-1">
    {node.children?.map((c) => <NodeRenderer key={c.id} node={c} />)}
  </div>
)
```

- [ ] **Step 9: Create separator-node.tsx + spacer-node.tsx**

`src/features/sdui/ui/nodes/layout/separator-node.tsx`:
```tsx
import type { FC } from 'react'
import { Divider } from '@mui/material'
import type { NodeProps } from '../../../types/view'

export const SeparatorNode: FC<NodeProps> = ({ node }) => (
  <Divider
    orientation={
      (node.props?.orientation as 'horizontal' | 'vertical') ?? 'horizontal'
    }
    flexItem
  />
)
```

`src/features/sdui/ui/nodes/layout/spacer-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'

export const SpacerNode: FC<NodeProps> = () => <div style={{ flex: 1 }} />
```

- [ ] **Step 10: Commit**

```bash
git add src/features/sdui/ui/nodes/shell/ src/features/sdui/ui/nodes/layout/
git commit -m "feat: add shell stubs (4) + layout node components (10)"
```

---

### Task 12: Display node components (4)

**Files:**
- Create: `src/features/sdui/ui/nodes/display/label-node.tsx`
- Create: `src/features/sdui/ui/nodes/display/text-node.tsx`
- Create: `src/features/sdui/ui/nodes/display/badge-node.tsx`
- Create: `src/features/sdui/ui/nodes/display/icon-node.tsx`

- [ ] **Step 1: Create label-node.tsx**

```tsx
import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LabelNode: FC<NodeProps> = ({ node }) => {
  const text = (node.props?.text as string) ?? ''
  const variant = (node.props?.variant as string) ?? 'default'
  const dispatch = useSduiDispatch()

  const isLink = variant === 'link'
  const hasClickAction = node.actions?.some((a) => a.trigger === 'click')

  const handleClick = () => {
    if (isLink && hasClickAction) {
      void dispatch({
        type: 'EVENT',
        sourceNodeId: node.id,
        trigger: 'click',
      })
    }
  }

  return (
    <Typography
      variant={variant === 'heading' ? 'subtitle1' : 'body2'}
      sx={{
        fontWeight: variant === 'heading' ? 700 : undefined,
        color: isLink ? 'primary.main' : undefined,
        cursor: isLink && hasClickAction ? 'pointer' : undefined,
        textDecoration: isLink ? 'underline' : undefined,
      }}
      onClick={handleClick}
    >
      {text}
    </Typography>
  )
}
```

- [ ] **Step 2: Create text-node.tsx**

```tsx
import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../../../types/view'

export const TextNode: FC<NodeProps> = ({ node }) => (
  <Typography variant="body2">
    {(node.props?.text as string) ?? ''}
  </Typography>
)
```

- [ ] **Step 3: Create badge-node.tsx**

```tsx
import type { FC } from 'react'
import { Chip } from '@mui/material'

import type { NodeProps } from '../../../types/view'

const COLOR_MAP: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
}

export const BadgeNode: FC<NodeProps> = ({ node }) => (
  <Chip
    label={(node.props?.text as string) ?? ''}
    color={COLOR_MAP[(node.props?.color as string) ?? 'default'] ?? 'default'}
    size="small"
  />
)
```

- [ ] **Step 4: Create icon-node.tsx**

```tsx
import { Suspense, lazy, type FC } from 'react'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import type { NodeProps } from '../../../types/view'

const iconCache = new Map<string, FC>()

function getIconComponent(name: string): FC {
  if (iconCache.has(name)) return iconCache.get(name)!
  const LazyIcon = lazy(
    () =>
      import(`@mui/icons-material/${name}.js`).catch(
        () => ({ default: HelpOutlineIcon }),
      ) as Promise<{ default: FC }>,
  )
  iconCache.set(name, LazyIcon)
  return LazyIcon
}

export const IconNode: FC<NodeProps> = ({ node }) => {
  const name = (node.props?.name as string) ?? 'HelpOutline'
  const Icon = getIconComponent(name)

  return (
    <Suspense fallback={<HelpOutlineIcon fontSize="small" />}>
      <Icon />
    </Suspense>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/ui/nodes/display/
git commit -m "feat: add display node components — LABEL, TEXT, BADGE, ICON"
```

---

### Task 13: Field node components (8)

**Files:**
- Create: `src/features/sdui/ui/nodes/fields/text-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/text-area-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/number-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/date-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/datetime-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/checkbox-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/enum-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/fields/reference-field-node.tsx`

- [ ] **Step 1: Create text-field-node.tsx**

```tsx
import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TextFieldNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as string) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined
  const placeholder = node.props?.placeholder as string | undefined
  const maxLength = node.props?.maxLength as number | undefined
  const flex = node.props?.flex as string | number | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: 'change' | 'blur', newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <TextField
      label={label}
      value={value}
      required={required}
      disabled={!enabled || readonly}
      error={!!error}
      helperText={error}
      placeholder={placeholder}
      slotProps={{
        htmlInput: { maxLength },
      }}
      onChange={(e) => {
        if (node.binding) setValue(node.binding, e.target.value)
      }}
      onBlur={(e) => fireServerEvent('blur', e.target.value)}
      sx={{ flex }}
    />
  )
}
```

- [ ] **Step 2: Create text-area-node.tsx**

```tsx
import type { FC } from 'react'
import { TextField } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const TextAreaNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as string) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined
  const rows = (node.props?.rows as number) ?? 3

  if (!visible) return null

  const fireServerEvent = (trigger: 'change' | 'blur', newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <TextField
      label={label}
      value={value}
      required={required}
      disabled={!enabled || readonly}
      error={!!error}
      helperText={error}
      multiline
      rows={rows}
      onChange={(e) => {
        if (node.binding) setValue(node.binding, e.target.value)
      }}
      onBlur={(e) => fireServerEvent('blur', e.target.value)}
    />
  )
}
```

- [ ] **Step 3: Create number-field-node.tsx**

Uses existing `NumberInput` from `@/shared/ui/inputs`.

```tsx
import type { FC, ChangeEvent } from 'react'

import { NumberInput } from '@/shared/ui/inputs'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const NumberFieldNode: FC<NodeProps> = ({ node }) => {
  const rawValue = useViewState(node.binding)
  const value = rawValue != null ? String(rawValue) : ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined
  const precision = node.props?.precision as number | undefined
  const flex = node.props?.flex as string | number | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: 'change' | 'blur', newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const numeric = raw === '' ? null : Number(raw)
    if (node.binding) setValue(node.binding, numeric)
  }

  return (
    <NumberInput
      label={label}
      value={value}
      required={required}
      readOnly={readonly}
      disabled={!enabled}
      error={!!error}
      helperText={error}
      decimal={precision != null && precision > 0}
      onChange={handleChange}
      onBlur={() => fireServerEvent('blur', rawValue)}
      sx={{ flex }}
    />
  )
}
```

- [ ] **Step 4: Create date-field-node.tsx**

```tsx
import type { FC } from 'react'

import { DateTimeInput } from '@/shared/ui/inputs'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const DateFieldNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as string) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <DateTimeInput
      label={label}
      value={value}
      required={required}
      readOnly={readonly}
      error={!!error}
      helperText={error}
      dateOnly
      onChange={(newValue) => {
        if (node.binding) setValue(node.binding, newValue)
        fireServerEvent('change', newValue)
      }}
    />
  )
}
```

- [ ] **Step 5: Create datetime-field-node.tsx**

```tsx
import type { FC } from 'react'

import { DateTimeInput } from '@/shared/ui/inputs'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const DatetimeFieldNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as string) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <DateTimeInput
      label={label}
      value={value}
      required={required}
      readOnly={readonly}
      error={!!error}
      helperText={error}
      onChange={(newValue) => {
        if (node.binding) setValue(node.binding, newValue)
        fireServerEvent('change', newValue)
      }}
    />
  )
}
```

- [ ] **Step 6: Create checkbox-field-node.tsx**

```tsx
import type { FC } from 'react'
import { Checkbox, FormControlLabel } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

export const CheckboxFieldNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as boolean) ?? false
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const label = node.props?.label as string | undefined

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <FormControlLabel
      label={label ?? ''}
      control={
        <Checkbox
          checked={value}
          disabled={!enabled || readonly}
          onChange={(_e, checked) => {
            if (node.binding) setValue(node.binding, checked)
            fireServerEvent('change', checked)
          }}
        />
      }
    />
  )
}
```

- [ ] **Step 7: Create enum-field-node.tsx**

```tsx
import type { FC } from 'react'
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

interface EnumOption {
  value: string
  label: string
}

export const EnumFieldNode: FC<NodeProps> = ({ node }) => {
  const value = (useViewState(node.binding) as string) ?? ''
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined
  const options = (node.props?.options as EnumOption[]) ?? []

  if (!visible) return null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  return (
    <FormControl error={!!error} required={required} disabled={!enabled || readonly}>
      {label && <InputLabel>{label}</InputLabel>}
      <Select
        value={value}
        label={label}
        onChange={(e) => {
          const newValue = e.target.value
          if (node.binding) setValue(node.binding, newValue)
          fireServerEvent('change', newValue)
        }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  )
}
```

- [ ] **Step 8: Create reference-field-node.tsx**

Reuses existing `AutocompleteInput` from `@/shared/ui/inputs`. Implements server search via existing API endpoints.

```tsx
import { useState, type FC } from 'react'

import { apiService } from '@/shared/api/api'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { NodeProps } from '../../../types/view'
import { useViewState, useViewStateSetter } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

interface ReferenceValue {
  id: number
  presentation: string
}

const DOMAIN_PATH: Record<string, string> = {
  DICTIONARY: 'dictionary-entries',
  DOCUMENT: 'document-entries',
  ACCOUNT_PLAN: 'account-plan',
}

export const ReferenceFieldNode: FC<NodeProps> = ({ node }) => {
  const rawValue = useViewState(node.binding) as ReferenceValue | null | undefined
  const setValue = useViewStateSetter()
  const dispatch = useSduiDispatch()

  const [options, setOptions] = useState<SelectOption[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const visible = (node.props?.visible as boolean) ?? true
  const readonly = (node.props?.readonly as boolean) ?? false
  const required = (node.props?.required as boolean) ?? false
  const enabled = (node.props?.enabled as boolean) ?? true
  const error = node.props?.error as string | undefined
  const label = node.props?.label as string | undefined
  const domain = (node.props?.domain as string) ?? 'DICTIONARY'
  const targetTypeCode = node.props?.targetTypeCode as string | undefined
  const filter = node.props?.filter as Record<string, unknown> | undefined

  if (!visible) return null

  const selectedOption: SelectOption | null = rawValue
    ? { id: rawValue.id, code: String(rawValue.id), label: rawValue.presentation }
    : null

  const fireServerEvent = (trigger: string, newValue: unknown) => {
    if (node.actions?.some((a) => a.trigger === trigger && a.actionId === 'fieldEvent')) {
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger, value: newValue })
    }
  }

  const fetchOptions = async (search: string) => {
    if (!targetTypeCode) return
    const domainPath = DOMAIN_PATH[domain] ?? 'dictionary-entries'
    setLoading(true)
    try {
      const res = await apiService.get<{
        content: Array<{ id: number; presentation?: string; nameRu?: string }>
      }>({
        url: `/api/${domainPath}/${targetTypeCode}/entries`,
        params: { search, page: 0, size: 20, ...filter },
      })
      setOptions(
        res.data.content.map((item) => ({
          id: item.id,
          code: String(item.id),
          label: item.presentation ?? item.nameRu ?? String(item.id),
        })),
      )
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AutocompleteInput
      value={selectedOption}
      inputValue={inputValue}
      options={options}
      label={label}
      readOnly={readonly}
      disabled={!enabled}
      required={required}
      error={!!error}
      helperText={error}
      loading={loading}
      onInputChange={(_e, val, reason) => {
        setInputValue(val)
        if (reason === 'input') {
          void fetchOptions(val)
        }
      }}
      onOpen={() => {
        if (options.length === 0) void fetchOptions('')
      }}
      onChange={(opt) => {
        const newValue = opt
          ? { id: opt.id as number, presentation: opt.label }
          : null
        if (node.binding) setValue(node.binding, newValue)
        fireServerEvent('change', newValue)
      }}
    />
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/features/sdui/ui/nodes/fields/
git commit -m "feat: add field node components — TEXT_FIELD, TEXT_AREA, NUMBER_FIELD, DATE_FIELD, DATETIME_FIELD, CHECKBOX_FIELD, ENUM_FIELD, REFERENCE_FIELD"
```

---

### Task 14: Composite node components (3) + Action node components (3)

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/table-node.tsx`
- Create: `src/features/sdui/ui/nodes/composite/table-column-node.tsx`
- Create: `src/features/sdui/ui/nodes/composite/object-field-node.tsx`
- Create: `src/features/sdui/ui/nodes/action/button-node.tsx`
- Create: `src/features/sdui/ui/nodes/action/menu-item-node.tsx`
- Create: `src/features/sdui/ui/nodes/action/link-node.tsx`

- [ ] **Step 1: Create table-node.tsx**

```tsx
import type { FC } from 'react'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import type { NodeProps } from '../../../types/view'
import { useViewState } from '../../../lib/stores/view-state-store'
import { useSduiDispatch } from '../../../lib/dispatch'

interface RowData {
  rowId: number | string
  [key: string]: unknown
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const rows = (useViewState(node.binding) as RowData[]) ?? []
  const dispatch = useSduiDispatch()

  const label = node.props?.label as string | undefined
  const allowAdd = (node.props?.allowAdd as boolean) ?? false
  const allowDelete = (node.props?.allowDelete as boolean) ?? false
  const columns = node.children ?? []

  const handleAddRow = () => {
    void dispatch({
      type: 'COMMAND',
      command: `addRow:${node.binding}`,
      sourceNodeId: node.id,
    })
  }

  const handleDeleteRow = (rowId: number | string) => {
    void dispatch({
      type: 'COMMAND',
      command: `deleteRow:${node.binding}:${rowId}`,
      sourceNodeId: node.id,
    })
  }

  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center gap-2">
          <Typography variant="subtitle2">{label}</Typography>
          {allowAdd && (
            <IconButton size="small" onClick={handleAddRow}>
              <AddIcon fontSize="small" />
            </IconButton>
          )}
        </div>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{ width: col.props?.width as number | undefined }}
                >
                  {(col.props?.header as string) ?? ''}
                </TableCell>
              ))}
              {allowDelete && <TableCell width={48} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.rowId}>
                {columns.map((col) => {
                  const attrCode = col.props?.attributeCode as string
                  return (
                    <TableCell key={col.id}>
                      {String(row[attrCode] ?? '')}
                    </TableCell>
                  )
                })}
                {allowDelete && (
                  <TableCell>
                    <IconButton size="small" onClick={() => handleDeleteRow(row.rowId)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (allowDelete ? 1 : 0)} align="center">
                  <Typography variant="body2" color="text.secondary">
                    Нет данных
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create table-column-node.tsx + object-field-node.tsx**

`src/features/sdui/ui/nodes/composite/table-column-node.tsx`:
```tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'

// TABLE_COLUMN is not rendered standalone — TABLE parent reads its props.
// This exists for registry completeness.
export const TableColumnNode: FC<NodeProps> = () => null
```

`src/features/sdui/ui/nodes/composite/object-field-node.tsx`:
```tsx
import type { FC } from 'react'
import { Typography } from '@mui/material'
import type { NodeProps } from '../../../types/view'

// OBJECT_FIELD — placeholder on MVP
export const ObjectFieldNode: FC<NodeProps> = ({ node }) => (
  <div style={{ padding: 8, border: '1px dashed #ccc', borderRadius: 4 }}>
    <Typography variant="caption" color="text.secondary">
      OBJECT_FIELD (id: {node.id}) — будет реализован позже
    </Typography>
  </div>
)
```

- [ ] **Step 3: Create button-node.tsx**

```tsx
import { useState, type FC, type MouseEvent } from 'react'
import { Button, Menu } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { NodeRenderer } from '../../node-renderer'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const dispatch = useSduiDispatch()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const label = (node.props?.label as string) ?? ''
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean) ?? true
  const variant = (node.props?.variant as string) ?? 'secondary'
  const isDropdown = variant === 'dropdown'
  const hasChildren = (node.children?.length ?? 0) > 0

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (isDropdown && hasChildren) {
      setAnchorEl(e.currentTarget)
    } else if (command) {
      void dispatch({
        type: 'COMMAND',
        command,
        sourceNodeId: node.id,
      })
    }
  }

  return (
    <>
      <Button
        variant={variant === 'primary' ? 'contained' : 'outlined'}
        disabled={!enabled}
        onClick={handleClick}
        size="small"
      >
        {label}
      </Button>
      {isDropdown && hasChildren && (
        <Menu
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={() => setAnchorEl(null)}
        >
          {node.children!.map((child) => (
            <NodeRenderer key={child.id} node={child} />
          ))}
        </Menu>
      )}
    </>
  )
}
```

- [ ] **Step 4: Create menu-item-node.tsx**

```tsx
import type { FC } from 'react'
import { MenuItem } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const dispatch = useSduiDispatch()
  const label = (node.props?.label as string) ?? ''
  const command = node.props?.command as string | undefined

  return (
    <MenuItem
      onClick={() => {
        if (command) {
          void dispatch({
            type: 'COMMAND',
            command,
            sourceNodeId: node.id,
          })
        }
      }}
    >
      {label}
    </MenuItem>
  )
}
```

- [ ] **Step 5: Create link-node.tsx**

```tsx
import type { FC } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link as MuiLink } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LinkNode: FC<NodeProps> = ({ node }) => {
  const dispatch = useSduiDispatch()

  const text = (node.props?.text as string) ?? ''
  const route = (node.props?.route as string) ?? '#'
  const external = (node.props?.external as boolean) ?? false
  const hasServerAction = node.actions?.some((a) => a.actionId === 'navigate')

  const handleClick = (e: React.MouseEvent) => {
    if (hasServerAction) {
      e.preventDefault()
      void dispatch({
        type: 'EVENT',
        sourceNodeId: node.id,
        trigger: 'click',
      })
    }
  }

  if (external) {
    return (
      <MuiLink href={route} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {text}
      </MuiLink>
    )
  }

  return (
    <MuiLink component={RouterLink} to={route} onClick={handleClick}>
      {text}
    </MuiLink>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/ src/features/sdui/ui/nodes/action/
git commit -m "feat: add composite (TABLE, TABLE_COLUMN, OBJECT_FIELD) + action (BUTTON, MENU_ITEM, LINK) nodes"
```

---

### Task 15: Register all 31 components in registry

**Files:**
- Modify: `src/features/sdui/lib/component-registry.ts`

- [ ] **Step 1: Update component-registry.ts to import and register all 31 components**

Replace the entire file content:

```ts
import type { FC } from 'react'

import type { NodeProps } from '../types/view'

// Shell
import { AppShellNode } from '../ui/nodes/shell/app-shell-node'
import { TopBarNode } from '../ui/nodes/shell/top-bar-node'
import { SidebarNode } from '../ui/nodes/shell/sidebar-node'
import { WorkspaceNode } from '../ui/nodes/shell/workspace-node'
// Layout
import { PageNode } from '../ui/nodes/layout/page-node'
import { VStackNode } from '../ui/nodes/layout/vstack-node'
import { HStackNode } from '../ui/nodes/layout/hstack-node'
import { GridNode } from '../ui/nodes/layout/grid-node'
import { GroupNode } from '../ui/nodes/layout/group-node'
import { TabsNode } from '../ui/nodes/layout/tabs-node'
import { TabNode } from '../ui/nodes/layout/tab-node'
import { ToolbarNode } from '../ui/nodes/layout/toolbar-node'
import { SeparatorNode } from '../ui/nodes/layout/separator-node'
import { SpacerNode } from '../ui/nodes/layout/spacer-node'
// Display
import { LabelNode } from '../ui/nodes/display/label-node'
import { TextNode } from '../ui/nodes/display/text-node'
import { BadgeNode } from '../ui/nodes/display/badge-node'
import { IconNode } from '../ui/nodes/display/icon-node'
// Fields
import { TextFieldNode } from '../ui/nodes/fields/text-field-node'
import { TextAreaNode } from '../ui/nodes/fields/text-area-node'
import { NumberFieldNode } from '../ui/nodes/fields/number-field-node'
import { DateFieldNode } from '../ui/nodes/fields/date-field-node'
import { DatetimeFieldNode } from '../ui/nodes/fields/datetime-field-node'
import { CheckboxFieldNode } from '../ui/nodes/fields/checkbox-field-node'
import { EnumFieldNode } from '../ui/nodes/fields/enum-field-node'
import { ReferenceFieldNode } from '../ui/nodes/fields/reference-field-node'
// Composite
import { TableNode } from '../ui/nodes/composite/table-node'
import { TableColumnNode } from '../ui/nodes/composite/table-column-node'
import { ObjectFieldNode } from '../ui/nodes/composite/object-field-node'
// Action
import { ButtonNode } from '../ui/nodes/action/button-node'
import { MenuItemNode } from '../ui/nodes/action/menu-item-node'
import { LinkNode } from '../ui/nodes/action/link-node'

const registry: Record<string, FC<NodeProps>> = {
  // Shell
  APP_SHELL: AppShellNode,
  TOP_BAR: TopBarNode,
  SIDEBAR: SidebarNode,
  WORKSPACE: WorkspaceNode,
  // Layout
  PAGE: PageNode,
  VSTACK: VStackNode,
  HSTACK: HStackNode,
  GRID: GridNode,
  GROUP: GroupNode,
  TABS: TabsNode,
  TAB: TabNode,
  TOOLBAR: ToolbarNode,
  SEPARATOR: SeparatorNode,
  SPACER: SpacerNode,
  // Display
  LABEL: LabelNode,
  TEXT: TextNode,
  BADGE: BadgeNode,
  ICON: IconNode,
  // Fields
  TEXT_FIELD: TextFieldNode,
  TEXT_AREA: TextAreaNode,
  NUMBER_FIELD: NumberFieldNode,
  DATE_FIELD: DateFieldNode,
  DATETIME_FIELD: DatetimeFieldNode,
  CHECKBOX_FIELD: CheckboxFieldNode,
  ENUM_FIELD: EnumFieldNode,
  REFERENCE_FIELD: ReferenceFieldNode,
  // Composite
  TABLE: TableNode,
  TABLE_COLUMN: TableColumnNode,
  OBJECT_FIELD: ObjectFieldNode,
  // Action
  BUTTON: ButtonNode,
  MENU_ITEM: MenuItemNode,
  LINK: LinkNode,
}

export function getComponent(type: string): FC<NodeProps> | undefined {
  return registry[type]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/component-registry.ts
git commit -m "feat: register all 31 node components in ComponentRegistry"
```

---

### Task 16: SduiScreen container

**Files:**
- Create: `src/features/sdui/ui/sdui-screen.tsx`

- [ ] **Step 1: Create sdui-screen.tsx**

```tsx
import { useEffect, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { useTreeStore } from '../lib/stores/tree-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const SduiScreen: FC = () => {
  const location = useLocation()
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()

  // OPEN on mount / route change; CLOSE on unmount / route change
  useEffect(() => {
    void dispatch({ type: 'OPEN' })

    return () => {
      void dispatch({ type: 'CLOSE' })
      reset()
    }
  }, [location.pathname])

  // beforeunload: best-effort CLOSE via sendBeacon
  useEffect(() => {
    const handler = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) viewTransport.closeBeacon(sid)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!tree) return <PageSkeleton />

  return <NodeRenderer node={tree} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/sdui-screen.tsx
git commit -m "feat: add SduiScreen — OPEN on mount, CLOSE on unmount, sendBeacon"
```

---

### Task 17: Barrel export + route integration + i18n keys

**Files:**
- Create: `src/features/sdui/index.ts`
- Modify: `src/app/App.tsx` (add one lazy-loaded route)
- Modify: `src/app/config/i18n/locales/ru/common.json`
- Modify: `src/app/config/i18n/locales/kz/common.json`

- [ ] **Step 1: Create barrel export**

```ts
export { SduiScreen } from './ui/sdui-screen'
export type { ViewNode, ViewAction, ViewRequest, ViewResponse, NodeProps } from './types/view'
export type { NodeType } from './types/node-types'
```

- [ ] **Step 2: Add SDUI route to App.tsx**

In `src/app/App.tsx`, add the lazy import at the top (after other lazy imports):

```tsx
const SduiScreen = lazy(() =>
  import('@/features/sdui').then((m) => ({ default: m.SduiScreen }))
)
```

Then inside the `<Routes>` in `AppRoutes`, add **before** the closing `</Routes>`:

```tsx
          <Route path="/sdui/*" element={<SduiScreen />} />
```

Full diff — add after the last `<Route>` (accountplan entry) and before `</Routes>`:
```tsx
          <Route path="/sdui/*" element={<SduiScreen />} />
```

- [ ] **Step 3: Add i18n keys to ru/common.json**

Add to the JSON (before the closing `}`):

```json
  "sdui": {
    "conflict": {
      "staleRevision": "Синхронизирую...",
      "sessionNotFound": "Сессия истекла, переоткрываю..."
    },
    "unknownNode": "Тип «{{type}}» не поддерживается этой версией клиента",
    "loading": "Загрузка..."
  }
```

- [ ] **Step 4: Add i18n keys to kz/common.json**

```json
  "sdui": {
    "conflict": {
      "staleRevision": "Синхрондау...",
      "sessionNotFound": "Сессия мерзімі аяқталды, қайта ашу..."
    },
    "unknownNode": "«{{type}}» түрі клиенттің осы нұсқасында қолдау көрсетілмейді",
    "loading": "Жүктелуде..."
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/features/sdui/index.ts src/app/App.tsx src/app/config/i18n/locales/ru/common.json src/app/config/i18n/locales/kz/common.json
git commit -m "feat: add SDUI barrel export, /sdui/* route, i18n keys"
```

---

### Task 18: Smoke test against real backend

**Files:**
- None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open pilot document in browser**

Navigate to: `http://localhost:5173/sdui/documents/ZayavkaNaRegistratsiyuGPSdelki/1`

Expected: The form should render with fields populated from the backend. Console should show no errors. Network tab should show a successful `POST /api/view` with `action.type: "OPEN"`.

- [ ] **Step 3: Test field interaction**

Change a field that has a server-event (e.g., `Контрагент` reference field). Verify:
- Network tab shows `POST /api/view` with `action.type: "EVENT"`
- Response contains patches that update related fields
- UI updates accordingly

- [ ] **Step 4: Test button click**

Click "Записать" button. Verify:
- Network tab shows `POST /api/view` with `action.type: "COMMAND"`, `command: "save"`
- Toast appears on success/error
- Form stays open (session alive)

- [ ] **Step 5: Test navigation away**

Navigate away from the page. Verify:
- Network tab shows `POST /api/view` with `action.type: "CLOSE"`

- [ ] **Step 6: Final commit if any fixes needed**

If any fixes were needed during smoke test:
```bash
git add -u
git commit -m "fix: smoke test fixes for SDUI engine"
```
