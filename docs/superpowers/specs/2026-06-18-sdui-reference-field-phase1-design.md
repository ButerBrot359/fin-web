# SDUI Server-Driven Reference Field — Phase 1 Frontend Design

> **Date:** 2026-06-18
> **Backend spec:** `docs/superpowers/plans/frontend-spec-server-driven-reference-field.md`
> **Scope:** optionsSource in REFERENCE_FIELD, ref.showAll command, LIST node, drawer presentation, COMMAND value

---

## 1. Architectural Decisions

| Decision | Choice |
|---|---|
| Migration level | Per-field, not per-screen. Field with `optionsSource` + `ref.*` actions → new path. Without → legacy. |
| Legacy coexistence | `DOMAIN_PATH_MAP` + `dict-sidebar` stay. Both paths coexist in Phase 1. |
| LIST node | New pull-model paged grid. Reuses DictSidebarListView patterns but data/columns from server. |
| Drawer | MUI Drawer in DialogHost, branching on `props.presentation`. |
| Phase 2 scope | NOT in this spec. Buttons "Добавить"/"проваливание" stay on legacy dict-sidebar. |

### Open questions (to clarify with backend after implementation)

1. **Search param for LIST** — assuming `search` on the same `source.url` (`/paged?search=...`). If backend needs separate `/search` endpoint in `source`, will adjust.
2. **Row binding structure** — assuming `row[binding] ?? row.attributes?.[binding]` fallback. Will verify with actual response.
3. **Drawer close button** — assuming frontend renders close button in drawer header, not in server node tree.

---

## 2. File Map

### New files
| File | Responsibility |
|---|---|
| `src/features/sdui/ui/nodes/composite/list-node.tsx` | LIST node — server-driven paged grid for drawer picker |

### Modified files
| File | What changes |
|---|---|
| `src/features/sdui/ui/nodes/fields/reference-field-node.tsx` | Add `optionsSource` handling + `ref.showAll` COMMAND dispatch |
| `src/features/sdui/ui/dialog-host.tsx` | Add `presentation: 'drawer'` branch with MUI Drawer |
| `src/features/sdui/lib/component-registry.ts` | Register `LIST` component |
| `src/features/sdui/types/node-types.ts` | Add `LIST` to NodeType |
| `src/features/sdui/types/view.ts` | Ensure COMMAND + value types work (minor, verify only) |
| `src/features/sdui/lib/dispatch.ts` | Ensure `value` is passed on COMMAND actions (verify only) |

---

## 3. Task 1 — ReferenceFieldNode: optionsSource + ref.showAll

### 3.1 optionsSource (dropdown options from backend)

Current: frontend builds URL from `DOMAIN_PATH_MAP[domain]` + `targetTypeCode`.

New: if `node.props.optionsSource` exists, use it verbatim — only add `search`, `page`, `size`:

```ts
const optionsSource = node.props?.optionsSource as { url: string; params?: Record<string, string> } | undefined

// In fetchOptions:
if (optionsSource) {
  // Use server-provided URL + params directly
  const res = await apiService.get({ url: optionsSource.url, params: { ...optionsSource.params, search, page: 0, size: 20 } })
  // Map response to options
  return
}
// Legacy path (no optionsSource) — keep as-is
```

Response format unchanged: `{ content: [{ id, presentation }] }`. Backend guarantees filter params are already serialized in `optionsSource.params`.

### 3.2 ref.showAll (server command instead of dict-sidebar)

Current: `onShowAll` calls `useDictSidebarStore.push({ mode: 'list', ... })`.

New: if node has `ref.showAll` action → dispatch COMMAND. Backend responds with `openDialog` effect containing drawer + LIST node:

```ts
const showAllAction = node.actions?.find((a) => a.trigger === 'showAll' && a.actionId === 'command')

const onShowAll = showAllAction
  ? () => void dispatch({ type: 'COMMAND', command: showAllAction.command, sourceNodeId: node.id })
  : (canBrowse ? openDictList : undefined)
```

Button visibility: `node.props.allowShowAll` (new path) or `canBrowse` (legacy).

### 3.3 Not in Phase 1

- `ref.create` (Добавить) — stays on legacy `dict-sidebar`
- `ref.open` (проваливание) — stays on legacy `dict-sidebar`
- `applySelected` — unchanged (setValue + fireServerEvent)

---

## 4. Task 2 — LIST node (server-driven paged grid)

New node type for the drawer picker body. Replaces what `DictSidebarListView` does, but data source and columns come from the server.

### Contract

```jsonc
{
  "type": "LIST",
  "props": {
    "source": { "url": "/api/.../paged", "params": { "af": "...", ... } },
    "searchable": true,
    "selectionMode": "SINGLE"
  },
  "children": [
    { "type": "TABLE_COLUMN", "props": { "header": "Номер", "width": 160, "binding": "Nomer" } }
  ],
  "actions": [
    { "trigger": "select",   "actionId": "command", "command": "ref.select:field.xxx" },
    { "trigger": "activate", "actionId": "command", "command": "ref.select:field.xxx" }
  ]
}
```

### Behavior

- **Data source:** `GET source.url?{...source.params, page, size, search?}` — frontend does NOT build URL or know filter format.
- **Pagination:** infinite scroll with IntersectionObserver (same pattern as DictSidebarListView, PAGE_SIZE=25).
- **Search:** if `props.searchable`, render SearchInput. Adds `search` param to the same `source.url`.
- **Columns:** from children `TABLE_COLUMN` nodes. Cell value: `row[binding] ?? row.attributes?.[binding]`.
- **Selection:**
  - Single click → select action → `dispatch({ type: 'COMMAND', command: action.command, value: { id: row.id } })`
  - Double click → activate action → same dispatch
  - Frontend sends only `{ id }`. Backend resolves canonical presentation and returns `setValue` patch + `closeDialog` effect.
- **After ref.select:** backend sends `closeDialog` + `setValue` + dependency patches. Frontend doesn't manually close drawer or set field value — effect handler does it.

### Implementation notes

- Reuse patterns from `DictSidebarListView`: virtual scroll, IntersectionObserver, table styling.
- Do NOT reuse `DictSidebarListView` component directly — it's tightly coupled to dict-sidebar store. Create a standalone component.
- `LIST` is NOT `TABLE` — it's read-only, server-paginated, select/activate only. No row editing.

---

## 5. Task 3 — Drawer presentation in DialogHost

Current: every `openDialog` effect renders as centered MUI `Dialog`.

New: branch on `eff.node.props.presentation`:

```tsx
const presentation = (eff.node.props?.presentation as string) ?? 'modal'

if (presentation === 'drawer') {
  return (
    <Drawer anchor="right" open onClose={popDialog}
      slotProps={{
        paper: { sx: { width: eff.node.props?.width ?? 900,
                        borderTopLeftRadius: 40, borderBottomLeftRadius: 40,
                        backgroundColor: '#F2F6FD', overflow: 'hidden' } },
        backdrop: { sx: { backgroundColor: 'rgba(34,33,36,0.6)' } }
      }}>
      <div className="flex h-full flex-col p-7">
        {/* Close button */}
        <NodeRenderer node={eff.node} />
      </div>
    </Drawer>
  )
}
// else: existing Dialog branch unchanged
```

- Drawer styles match existing `dict-sidebar-drawer.tsx` (900px, rounded corners, backdrop).
- Close button in drawer header (frontend-rendered, not from node tree).
- Close: `onClose → popDialog()`. Backend can also send `closeDialog(id)` — existing effect handler already supports this.
- Phase 1: max 1 drawer in stack. Render as `.map` over stack (already is) for Phase 2 readiness.

---

## 6. Task 4 — COMMAND value in dispatch

`ViewAction` already has `value?: unknown`. Verify:

1. `dispatch.ts` passes `value` in the COMMAND payload to `POST /api/view` — check it's not stripped.
2. `ref.showAll` dispatch (Task 1) sends `command` + `sourceNodeId` (no value needed).
3. `ref.select` dispatch (Task 2) sends `command` + `value: { id: row.id }`.

If `value` is already forwarded — no code change, just verification. If stripped — add it.

---

## 7. Verification

Test on `dogovorKontragenta` / `schetKontragenta` fields in the GP deal request document:

1. Dropdown shows options from `optionsSource` URL (not from frontend-built URL)
2. "Показать все" dispatches `ref.showAll` command → backend responds with `openDialog(drawer)`
3. Drawer opens with LIST node → shows records with correct columns
4. Drawer records match dropdown options (same backend filter — regression gate for bug 3)
5. Click row → `ref.select` command with `{ id }` → field filled, dependencies recalculated, drawer closes
6. Non-migrated fields (without `optionsSource`) still work via legacy path
