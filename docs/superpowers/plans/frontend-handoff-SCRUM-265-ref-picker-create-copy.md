# Frontend spec — SCRUM-265 (bug 2): «Создать» / «Скопировать» в drawer'е выбора справочника

> **Audience:** fin-web frontend dev (React 19 + TS 5.9 + Vite, FSD).
> **Pairs with:** webbuh backend PR (branch `talgat/SCRUM-218`). This file travels with the **backend** PR for traceability; the frontend change lands in `fin-web` as a normal `feat:`/`fix:` commit.
> **Scope:** `src/features/sdui/` only. No backend, no `docs/`, no test-infra here.
> **Conventions:** follows `fin-web/CLAUDE.md` + `.claude/agents/frontend.md` — FSD layering, zustand for client UI-state, no hardcoded strings in JSX (note: SDUI toolbar labels are **server-sent**, so they are *not* i18n keys — see §6), import from concrete files inside a slice (no intra-slice barrels).

There is already a **reference implementation in the fin-web working tree** (made quickly by an agent). This spec describes the **clean, idiomatic** target. Where the reference is already clean it says so; where it can be tightened per `CLAUDE.md`, §7 lists the deltas.

---

## 1. Context & goal

SCRUM-265 bug 2: when the user opens the **reference-field selection drawer** (the «Показать все» picker on a document's ссылочное поле), they must be able to not only **pick** an existing dictionary record but also **«Создать»** a new one and **«Скопировать»** the highlighted one — then have the freshly created/copied record selected back into the parent field.

The whole picker is **server-driven**. The frontend does **not** decide what buttons exist. The backend (`ChoicePanelComposer`) emits a `TOOLBAR` with the buttons, and `REFERENCE_FIELD` nodes carry feature-gate props. The frontend's job is narrow:

1. **Render** the backend-sent toolbar (already works — generic `BUTTON` → `ButtonNode`).
2. **Feed «Скопировать» / «Выбрать» the highlighted row id** — these toolbar buttons live outside the LIST and have no idea which row is selected. This is the one piece of cross-node state the frontend must bridge (see §5 for «Выбрать»).
3. **Land the user back on the parent** after «Записать и выбрать», popping any intermediate picker drawers, and make the parent field actually **re-render** with the selected value.

Points 2 and 3 are the substance of this change.

---

## 2. Backend contract the frontend consumes

All commands follow the shape `ref.<verb>:<field>`, where `<field>` is the parent form's reference-field node id (e.g. `ref.copy:dogovorKontragenta`).

### 2.0 Transport envelope (`POST /api/view`)

Every interaction — form load, field event, toolbar command — is one `POST /api/view` round-trip through the SDUI transport (`viewTransport.post`). For the picker flow the frontend speaks **only** this envelope; it does **not** call the document/dictionary REST endpoints directly.

**Request:**

```ts
{
  formSessionId: string,   // session the action targets (root form OR a stacked child panel)
  revision: number,        // client's last-seen revision for that session (optimistic-concurrency token)
  route?: string,          // current SPA route, e.g. ".../document/ZayavkaNaRegistratsiyuGPSdelki/27854443"
  action: {
    type: 'COMMAND',       // ('EVENT' for field on-change events — not used by the picker toolbar)
    command: string,       // e.g. "ref.showAll:field.opisanieRaskhoda"
    value?: unknown,       // e.g. { id } for ref.copy / ref.select (§2.3)
    sourceNodeId?: string, // node that raised it, e.g. panel.choice.<field>.btn.select
  }
}
```

**Response:**

```ts
{
  formSessionId: string,
  revision: number,        // incremented; client must adopt it (backend answers STALE_REVISION on mismatch)
  tree: Node | null,       // full node tree on a full render; null when only patches/effects change
  state: object | null,    // full value-state on full render; null otherwise
  patches: Patch[],        // node/value patches to apply incrementally
  statePatch: object | null,// shallow-merge into view-state-store
  effects: Effect[],       // side-effects to run after patches (see table)
}
```

**Effects the picker relies on:**

| `effect.type` | Carries | Frontend action |
|---|---|---|
| `notify` | `level` (`success`/`warning`/`error`), `message` | toast |
| `openDialog` | `node` (a `PAGE`), `sessionId`, `childRevision`, `childState` | push a panel on the stack, seeded with its **own** child session |
| `closeDialog` | `id`; optionally the `applyToParentSessionId` / `applyToParentTargetNodeId` / `applyToParentValue` triple | pop panel(s); if the triple is present, relay the selection (§3.4) |

Each `openDialog` starts a **new child session** (`sessionId` + `childRevision`); every action inside that panel then posts with **that** `formSessionId`. That is why the copy flow juggles several session ids (root form → picker → create child), and why §3.4's pop-to-parent keys off `applyToParentSessionId`. Concrete captured payloads for the whole round-trip are in §9.

### 2.1 `REFERENCE_FIELD` node props (gate flags)

Emitted by `NodeBuilder` for every server-driven reference field:

| Prop | Meaning | Default |
|---|---|---|
| `allowShowAll` | show «Показать все» (opens the picker drawer) | `true` |
| `allowCreate` | show «Создать» in the picker toolbar | `true` for `DICTIONARY`, unless type opted out |
| `allowCopy` | **new** — show «Скопировать» in the picker toolbar | `true` for `DICTIONARY`, unless type opted out |
| `allowOpen` | (Phase 2, off) | `false` |

The same `REFERENCE_FIELD` also emits dormant actions `showAll` / `create` / `open` / `copy` (commands `ref.showAll:<field>` … `ref.copy:<field>`). These live on the **field**; the frontend doesn't dispatch them directly for the toolbar flow — they exist so a field-level affordance can trigger them. The visible picker buttons come from the toolbar (§2.2). The frontend treats `allow*` as pure visibility gates.

### 2.2 The picker toolbar (`ChoicePanelComposer`)

`ref.showAll:<field>` opens a `PAGE` drawer (`presentation:'drawer'`, `kind:'CHOICE_FORM'`) containing:

```
PAGE  panel.choice.<field>                       props: presentation=drawer, placement=right, width=900
 ├ LABEL  "Выбор: <typeLabel>"
 └ VSTACK
    ├ TOOLBAR  panel.choice.<field>.toolbar
    │   ├ BUTTON «Выбрать»     command = ref.select:<field>     (always)
    │   ├ BUTTON «Создать»     command = ref.create:<field>     (if allowCreate)
    │   └ BUTTON «Скопировать» command = ref.copy:<field>       (if allowCopy)
    └ LIST  panel.choice.<field>.list                 props: source={url,params}, searchable, selectionMode=SINGLE
         children: TABLE_COLUMN[]
         actions:  select → ref.select:<field>,  activate → ref.select:<field>
```

Key fact: the **LIST** owns the selected row, but **«Скопировать» lives in the sibling TOOLBAR**, outside the LIST's subtree. Nothing in the tree connects them except a shared `<field>`. That shared `<field>` is the contract the frontend uses to bridge them (§3.1).

### 2.3 `ref.copy` value shape

The backend's `processRefCopy` reads the source record id from `action.value`:

```ts
{ type: 'COMMAND', command: 'ref.copy:<field>', value: { id: <selectedRowId> } }
```

If `action.value` has no `id`, the backend no-ops with a warning toast («Не выбрана запись для копирования…»). So the frontend **must** attach `{ id }` and should **not** dispatch at all when no row is highlighted (honest-disabled — §3.2).

On success the backend opens a **child create drawer** prefilled with a `(копия)` of the source — i.e. another panel stacks on top of the picker.

### 2.4 `dict.saveAndSelect` → `closeDialog` + applyToParent

«Записать и выбрать» inside the create/copy child form runs `processDictionarySaveAndSelect`, which saves the dictionary entry and emits **one** `CLOSE_DIALOG` effect carrying applyToParent fields:

```ts
// EffectType.CLOSE_DIALOG
{
  id: '<childPanelId>',
  applyToParentSessionId:   '<parent form session id>',
  applyToParentTargetNodeId:'<field>',          // the parent reference field node id
  applyToParentValue:       { id, presentation } // the saved record
}
```

Frontend's `closeDialog` handler (§3.4) must:
1. Pop the child form **and** any picker drawers stacked above the parent (so the user lands on the parent, not a stale picker).
2. Relay the selection to the parent session as `COMMAND ref.select:<targetNodeId>` with `value = applyToParentValue`.
3. Apply the parent's response (patches/effects) to the right place — a stacked panel **or** the root form's global stores.

A plain `CLOSE_DIALOG` **without** the applyToParent triple (e.g. a cancelled child form) just pops that one panel.

### 2.5 Opt-out behaviour

Dictionary types with `dictionary_types.picker_actions_disabled = true` (classifiers, `Banki`, `Valyuty`, …) get `allowCreate=false` / `allowCopy=false` on the field **and** `ChoicePanelComposer` omits both buttons. So for those, the toolbar is just «Выбрать». The frontend needs no special-casing — it renders whatever toolbar children arrive.

---

## 3. Required frontend changes, file by file

### 3.1 New: `lib/stores/ref-picker-selection-store.ts` (zustand, field-keyed)

**Responsibility.** Bridge the picker LIST's highlighted row to sibling toolbar buttons that need it — «Скопировать» and «Выбрать» (both keyed off `needsSelectedRow`, see §5).

**Why a store, not props / context.** The LIST and the «Скопировать» button are **siblings** in the server-sent tree (LIST and TOOLBAR are both children of the VSTACK). There is no parent component that owns both and could thread a callback down — the tree is rendered generically by `node-renderer`, which knows nothing about picker semantics. A tiny zustand store is the idiomatic fin-web way to share transient client UI-state across unrelated nodes (consistent with the other `lib/stores/` slices).

**Why keyed by `<field>`.** The only thing the LIST and the button provably agree on is the `<field>` suffix — the backend guarantees `ref.select:<field>` on the LIST and `ref.copy:<field>` on the button share it. Keying by field (not by node id, not a single global value) means multiple pickers could coexist without cross-talk, and the button reads exactly the LIST that feeds it. A bare single-value store would break the moment two reference fields are involved.

**Shape (reference impl — already clean):**

```ts
interface RefPickerSelectionState {
  selection: Record<string, number | null>
  setSelection: (field: string, id: number | null) => void
  clearSelection: (field: string) => void
}
```

Plus two pure helpers exported alongside:
- `refCommandField(command?: string): string | null` — extracts `<field>` from `ref.<verb>:<field>` (everything after the first `:`).
- `useRefPickerSelection(field: string | null): number | null` — selector hook; returns `null` for a `null` field.

**Lifecycle / cleanup.** The LIST writes on every highlight change and **clears on unmount** (drawer close). See §7.1 for the one cleanup nicety (delete the key vs. set `null`) — functionally equivalent for honest-disabled, since both read as "no selection".

### 3.2 `ui/nodes/action/button-node.tsx` — inject the highlighted row for row-acting commands

**Responsibility.** Keep `BUTTON` 100% generic for every command **except** those that act on the picker LIST's highlighted row — «Скопировать» (`ref.copy:`) and «Выбрать» (`ref.select:`) — which need the row id injected and must be honestly disabled until a row exists.

**Clean approach.** The row-acting commands are recognised by a single `needsSelectedRow(command)` predicate (defined in `ref-picker-selection-store.ts`, see §5.1), not an inline `ref.copy:` check:

```ts
const usesSelectedRow = needsSelectedRow(command)
const selectedRowId = useRefPickerSelection(usesSelectedRow ? refCommandField(command) : null)
// ...
if (usesSelectedRow) {
  if (selectedRowId == null) return            // guard: never dispatch a no-op
  void dispatch({ type: 'COMMAND', command, value: { id: selectedRowId }, sourceNodeId: node.id })
  return
}
void dispatch({ type: 'COMMAND', command })    // generic path unchanged

const disabled = !enabled || (usesSelectedRow && selectedRowId == null)
```

**Rationale.**
- The store subscription is **gated** (`usesSelectedRow ? … : null`) so a normal button doesn't subscribe and never re-renders on picker selection. Generic BUTTON behaviour (dropdown, primary/outlined variant, `enabled`) is untouched.
- `disabled` folds the honest-disabled condition into the existing `enabled` gate — the toolbar «Выбрать»/«Скопировать» grey out until a row is highlighted, so the toolbar is the single, honest command source (the LIST no longer renders its own «Выбрать» — §5.2).
- The `selectedRowId == null` guard in `handleClick` is belt-and-suspenders (the button is already disabled), but it makes the no-op impossible even if a future style renders it always-enabled.

### 3.3 `ui/nodes/composite/list-node.tsx` — publish the highlighted row

**Responsibility.** Mirror the LIST's local `selectedRowId` into the shared store under its own `ref.select:<field>` key, and clear on unmount.

**Clean approach (matches reference):**

```ts
const selectField = refCommandField(selectAction?.command)
const setSelection = useRefPickerSelectionStore((s) => s.setSelection)
const clearSelection = useRefPickerSelectionStore((s) => s.clearSelection)
useEffect(() => {
  if (!selectField) return
  setSelection(selectField, selectedRowId)
  return () => { clearSelection(selectField) }
}, [selectField, selectedRowId, setSelection, clearSelection])
```

**Rationale.**
- `selectField` is derived from `selectAction.command` (`ref.select:<field>`) — the LIST publishes under the **same** field the «Скопировать» / toolbar «Выбрать» buttons read. No new contract; the agreement is the backend-emitted command suffix.
- Row click (highlight) and double-click (`activate`) are untouched. The LIST's own «Выбрать» button was **removed** so the toolbar is the single command source (§5.2) — the LIST now owns only search + highlighting and publishes the highlighted row.
- `setSelection` / `clearSelection` are stable zustand actions, so the effect's deps are honest and it re-runs only when the highlight or field actually changes.
- Non-picker LISTs (no `select` action, or a non-`ref.` command) get `selectField === null` and the effect early-returns — zero overhead, no store writes.

### 3.4 `lib/dispatch.ts` — `closeDialog` pops to parent + relays selection

**Responsibility.** Turn the backend's `CLOSE_DIALOG (+applyToParent)` effect into: pop the right panels, relay `ref.select` to the parent, apply the parent's response to the correct target.

**Two branches (matches reference):**

```ts
closeDialog: (effect) => {
  const hasSelection =
    effect.applyToParentSessionId &&
    effect.applyToParentTargetNodeId &&
    effect.applyToParentValue

  if (!hasSelection) {
    // Plain close (cancelled child form) — pop just this panel.
    panelStack = panelStack.filter((p) => p.panelId !== effect.id)
    notifyPanelListeners()
    return
  }

  // Selection made: pop the child form AND any picker drawers above the parent,
  // so the user lands on the parent — not a now-stale showAll picker underneath.
  const parentPanel = findPanelBySessionId(effect.applyToParentSessionId!)
  if (parentPanel) {
    const idx = panelStack.findIndex((p) => p.panelId === parentPanel.panelId)
    panelStack = panelStack.slice(0, idx + 1)   // keep parent + everything below it
  } else {
    panelStack = []                              // parent is the ROOT form → drop whole stack
  }
  notifyPanelListeners()

  // Relay the chosen record to the parent session.
  void viewTransport.post({
    formSessionId: effect.applyToParentSessionId,
    revision: parentPanel?.session?.revision ?? useTreeStore.getState().revision,
    action: {
      type: 'COMMAND',
      command: `ref.select:${effect.applyToParentTargetNodeId}`,
      value: effect.applyToParentValue,
    },
  }).then((res) => { /* apply to panel session OR root stores */ })
}
```

**Rationale.**
- **Pop-to-parent, not pop-one.** The copy flow stacks **two** panels on the document: the picker drawer (`ref.showAll`) and the child create form (`ref.copy`). On save, popping only the immediate child would leave the user staring at a stale picker drawer whose list no longer matters. `slice(0, idx + 1)` collapses everything above the parent in one shot. This is the core correctness fix in dispatch.
- **`hasSelection` guard.** Must check all three applyToParent fields. A cancelled child form sends `CLOSE_DIALOG` with none of them → plain single-pop. Guarding on the triple keeps the two intents cleanly separated.
- **Parent = panel vs. root.** If the parent session is itself a stacked panel, its response updates that panel's session/revision. If the parent is the **root document form**, the response must flow into the global `tree-store` + `view-state-store` (revision bump, clear errors, tree patches, value patches, statePatch merge) — exactly the same pipeline the normal dispatch uses. The `findPanelBySessionId` miss is the signal for "parent is root".
- **Conflict handling.** The relayed `ref.select` can hit `SESSION_NOT_FOUND` if the parent form expired; surface a soft warning toast («Форма устарела, выбор не применён») rather than a hard error.

### 3.5 `ui/sdui-screen.tsx` — make the ROOT form reactive to value patches (the Q2 fix)

**Responsibility.** The root document form must re-render when server-driven **value-only** patches arrive — specifically the `ref.select` relay from §3.4 that sets the parent field's new value.

**The bug.** The root `SduiScreen` builds its SDUI session object with `useMemo`, and `getValue` read `useViewStateStore.getState().state[binding]` — a **non-reactive** snapshot read. The memo deps were `[tree, dirty]`. A value-only patch (e.g. the selected record's `{id, presentation}` landing on the field) changes **neither** `tree.root` **nor** `dirty` — so the memo never recomputed, the session object stayed identical, and the field rendered its stale value. Child panels worked because they have their own reactive plumbing; only the root was blind.

**The fix (matches reference):**

```ts
// Subscribe to the view-state itself so the root re-renders on value-only patches.
const viewStateValues = useViewStateStore((s) => s.state)
// ...
getValue: (binding) => (binding ? viewStateValues[binding] : undefined),
// ...
}, [tree, dirty, viewStateValues])   // add viewStateValues to deps
```

**Rationale.**
- Subscribing with the selector `(s) => s.state` makes the component reactive to value changes; reading `getValue` from the **subscribed** `viewStateValues` (not `getState()`) closes over the fresh value; adding it to the memo deps recomputes the session so descendants see the new `getValue`.
- **Why this is the right altitude:** the root form is the one consumer that synthesizes the session via memo. Children already react. We're not adding a broad re-render — `view-state-store` updates are already batched per dispatch, and the memo body just rebuilds a record of store-bound functions (cheap). The alternative (forcing the field component to subscribe directly) would scatter the fix and diverge from how the root session is constructed.
- **Tradeoff to state honestly:** the session memo now recomputes on every value change in the root form (including each keystroke into a text field). The cost is rebuilding an object of function references — negligible — and it does **not** cause a render loop (§4).

---

## 4. Edge cases & honest-button

- **No row highlighted → «Выбрать»/«Скопировать» disabled.** `disabled = !enabled || (usesSelectedRow && selectedRowId == null)`. The button is visibly greyed; even if clicked it guards and never dispatches. This matches the backend's own defence (no `id` → warning toast / no-op) but avoids the round-trip entirely.
- **Opt-out types.** `allowCopy=false` → backend omits the button → nothing to render. No frontend branch needed.
- **Empty field after pop.** When parent is root and the stack is dropped (`panelStack = []`), the field re-renders from the relayed value patch (§3.5) — that's why the sdui-screen reactivity fix is a hard dependency of the copy flow, not a nice-to-have.
- **No render loop.** The `list-node` effect writes to the store only when `selectedRowId` changes; the store write re-renders the **button** (subscriber), not the LIST (the LIST sets, it doesn't subscribe via the gated hook). The button's render reads the value and does nothing else. `setSelection(field, sameId)` produces a new `selection` object but an unchanged scalar at `[field]`, and `useRefPickerSelection` selects the scalar — so subscribers with an unchanged id don't re-render. No cycle.
- **Two reference fields / two pickers.** Field-keyed store isolates them; closing one drawer clears only its key.
- **Stale parent session.** Relay `ref.select` may 404 (`SESSION_NOT_FOUND`) → soft warning toast, panels already popped, no crash.

---

## 5. Toolbar «Выбрать» — honest single command source (implemented)

**Background.** Originally the toolbar **«Выбрать»** button (`ref.select:<field>`, rendered by `ButtonNode`) dispatched **without** a row id, so the backend `processRefSelect` saw `action.value == null` and closed the panel **without selecting anything** — inert. In practice selection worked only via the LIST's **double-click** (`activate`) and the LIST's own internal «Выбрать» button (old `list-node` ~line 209, which carried `selectedRowId`). So there were **two** «Выбрать» buttons — an inert toolbar one and a working in-LIST one — doing the same job, which is not faithful to the 1С selection form (one command toolbar: Выбрать / Создать / Скопировать).

This is now **implemented** (resolved in two parts):

### 5.1 Toolbar «Выбрать» made honest + working — `needsSelectedRow` predicate

The `ButtonNode` special-case was **generalised** from a `ref.copy:`-only check to a `needsSelectedRow(command)` predicate covering **both** `ref.copy:` and `ref.select:`. Both verbs act on the LIST's highlighted row, so both now attach `value:{id:selectedRowId}` (read from the field-keyed picker store) and honest-disable until a row is highlighted. «Создать» (`ref.create:`) and every other command stay on the untouched generic path.

The predicate lives in `ref-picker-selection-store.ts`, co-located with `refCommandField` (both are command-parsing helpers for the picker):

```ts
/** Commands that operate on the picker LIST's highlighted row. */
export function needsSelectedRow(command: string | undefined): boolean {
  return (
    command?.startsWith('ref.select:') === true ||
    command?.startsWith('ref.copy:') === true
  )
}
```

`button-node.tsx` now computes `const usesSelectedRow = needsSelectedRow(command)` and uses it for **both** the gated store subscription and the disabled gate:

```ts
const usesSelectedRow = needsSelectedRow(command)
const selectedRowId = useRefPickerSelection(usesSelectedRow ? refCommandField(command) : null)
// ...
if (usesSelectedRow) {
  if (selectedRowId == null) return
  void dispatch({ type: 'COMMAND', command, value: { id: selectedRowId }, sourceNodeId: node.id })
  return
}
void dispatch({ type: 'COMMAND', command })   // generic path unchanged

const disabled = !enabled || (usesSelectedRow && selectedRowId == null)
```

The LIST already publishes the highlighted id under `ref.select:<field>` (§3.3) — the same key the toolbar «Выбрать» reads — so this is a pure predicate generalisation with **no new infrastructure**.

### 5.2 Redundancy resolved — the LIST's built-in «Выбрать» removed

To keep a **single command source** (the 1С toolbar), the LIST's own «Выбрать» button (old `list-node` ~line 209) and its `handleSelect` helper were **removed**. The picker now has exactly one «Выбрать» — the toolbar one.

This is safe and was verified: `NodeType.LIST` is emitted **only** by `ChoicePanelComposer`, and that composer **always** pairs the LIST with the TOOLBAR carrying «Выбрать». There are no non-picker LIST usages that relied on the in-list button. The LIST now owns only **search + row highlighting** — it still publishes the highlighted row to the store (§3.3) and still handles **double-click** (`activate` → `ref.select` with `{id}`), so double-click selection is unchanged.

### 5.3 Verification

Browser (ГП doc, «Описание расхода платежного документа» field): the picker shows a **single** «Выбрать», **disabled** until a row is highlighted; highlighting a row enables «Выбрать» and «Скопировать» (and «Создать» is always enabled); clicking «Выбрать» dispatches `ref.select:<field>` with `value:{id}` (confirmed on the wire: `sourceNodeId = panel.choice.<field>.btn.select`) and selects the record into the parent field; double-click still selects. `npx tsc --noEmit` clean.

---

## 6. i18n note (per CLAUDE.md)

`CLAUDE.md` forbids hardcoded strings in JSX — but the picker toolbar labels («Выбрать»/«Создать»/«Скопировать») are **server-sent** in `node.props.label` and rendered verbatim by `ButtonNode`. That is correct and *not* an i18n violation: SDUI is server-driven, the backend owns those strings (and their KZ variants, when localised server-side). **Do not** introduce `common.json` keys for them. The only frontend-owned strings touched here are existing ones (`dictSidebar.select`, conflict/error toasts) — leave them as-is; they already live in `common.json` (`ru` + `kz`).

---

## 7. Where the reference impl can be improved (and where it's already clean)

The reference impl is **largely idiomatic and correct** — the store, the gated subscription in `button-node`, the LIST publish/clear effect, and the sdui-screen reactivity fix all match what I'd ship. Minor tightenings per `CLAUDE.md`:

1. **`ref-picker-selection-store.clearSelection`** sets the key to `null` rather than deleting it. Functionally fine (both read as "no selection"), but `delete`-ing the key keeps the `selection` map from accumulating stale `null` entries over a long session. Cosmetic; either is acceptable.
2. **`dispatch.ts closeDialog`** uses a bare `{ … }` block to scope the selection branch. It reads a little oddly. Extracting the applyToParent branch into a named helper — `applySelectionToParent(effect)` — would make the two intents (plain-close vs. select-and-pop) self-documenting and shrink the dispatch closure. Pure readability; behaviour identical.
3. **Non-null assertions** (`effect.applyToParentSessionId!`) inside the selection branch are safe because `hasSelection` already proved them truthy, but TS won't narrow across the `hasSelection` boolean. Destructuring the three fields **after** the guard (`const { applyToParentSessionId, applyToParentTargetNodeId, applyToParentValue } = effect`) and early-returning lets the compiler narrow them and drops the `!`. Slightly cleaner and removes the assertions.
4. **`button-node` predicate** — done (§5.1): the `ref.copy:` special-case was generalised to a `needsSelectedRow(command)` predicate (`ref.copy:` ∪ `ref.select:`), so it reads as a category, not a one-off, and the toolbar «Выбрать» now works.

None of these are blockers — they're the difference between "works and is clean" (reference) and "reads like it was written deliberately" (target).

---

## 8. Test / verification guidance (per fin-web conventions)

Tests are owned by `frontend-tester`, not the frontend dev — but here's what to cover so the PM can scope it.

**Unit (Vitest + Testing Library):**
- `ref-picker-selection-store`: `setSelection`/`clearSelection` semantics; `refCommandField` parsing (`ref.copy:orgRef` → `orgRef`, no-colon → `null`, `undefined` → `null`); `needsSelectedRow` (`true` for `ref.copy:`/`ref.select:`, `false` for `ref.create:`/generic/`undefined`); `useRefPickerSelection` returns `null` for `null` field.
- `ButtonNode`: a row-acting button (`ref.copy:` **and** `ref.select:`) is disabled when the store has no id; on click with an id dispatches `{ command, value:{id}, sourceNodeId }`; «Создать» (`ref.create:`) and any generic command button are unaffected by store state and dispatch `{ command }` only.
- `ListNode`: publishes `selectedRowId` under its `ref.select:<field>` key on highlight and clears on unmount; renders **no** built-in «Выбрать» (toolbar is the single command source — §5.2); double-click still dispatches `ref.select` with `{id}`.

**Integration / e2e (Playwright):** the full copy flow against a real reference field —
1. open a document, open the picker on a `DICTIONARY` field with `allowCopy`,
2. highlight a row → «Скопировать» enables,
3. click → child create drawer opens prefilled with `(копия)`,
4. «Записать и выбрать» → **both** drawers close, user is back on the document, and the field shows the new record's presentation (this last assertion is what proves the §3.5 root-reactivity fix).
5. Opt-out type (`picker_actions_disabled`): toolbar shows only «Выбрать».

The step-4 assertion is the regression guard for the Q2 bug — without the `sdui-screen` reactivity fix the field stays blank and the e2e fails there.

---

## 9. Observed wire round-trip (verified on `dev.qazyna.ai`, 2026-07-01)

Captured live via Playwright network inspection on the pilot document (ГП-сделки `AAI00-00001`, field «Описание расхода платежного документа», node id `field.opisanieRaskhoda`). This grounds §2 in real payloads **and** records the **current deployed state**, which still lags this spec on the frontend (see the ⚠️ notes — they are the acceptance checklist).

Real node ids on the wire use a `field.` prefix, and the child form is `panel.create.*` with `kind:'OBJECT_FORM'` (not the abstract `panel.choice.*` / `CHOICE_FORM` naming used for illustration in §2.2): `ref.showAll:field.opisanieRaskhoda`, child panel `panel.create.field.opisanieRaskhoda`, its `…​.toolbar` / `…​.btn.save` (command `dict.saveAndSelect`) / `…​.body`, fields `field.nameRu` + `dict.field.*`.

### 9.1 `ref.copy` — request **and** the deployed gap

Request the live fin-web actually sent — note there is **no `value.id`**:

```json
{"formSessionId":"7ddcd553-…","revision":0,
 "route":"/modules/BankiIKassy/document/ZayavkaNaRegistratsiyuGPSdelki/27854443",
 "action":{"type":"COMMAND","command":"ref.copy:field.opisanieRaskhoda"}}
```

Response — backend defended exactly per §2.3 (no `id` → warning, no-op):

```json
{"formSessionId":"7ddcd553-…","revision":1,"tree":null,"state":null,"patches":[],"statePatch":null,
 "effects":[{"type":"notify","level":"warning",
   "message":"Не выбрана запись для копирования. Выберите строку в списке и нажмите «Скопировать»."}]}
```

> ⚠️ **Deployed gap #1:** §3.1–§3.3 (`ref-picker-selection-store` + LIST publish + `needsSelectedRow` in `button-node`) are **not yet shipped** in the live fin-web. Highlighting a row never reaches the command, so «Скопировать» is un-completable from the toolbar. «Создать» works because it needs no row.

### 9.2 `ref.create` → `openDialog` (works end-to-end today)

Response to `ref.create:field.opisanieRaskhoda` (abbreviated) — a full child `OBJECT_FORM`:

```json
{"revision":1,"effects":[{"type":"openDialog","sessionId":"99e84fc8-…","childRevision":0,
  "node":{"id":"panel.create.field.opisanieRaskhoda","type":"PAGE",
    "props":{"presentation":"drawer","placement":"right","width":900,"kind":"OBJECT_FORM"},
    "children":[
      {"id":"…title","type":"LABEL","props":{"text":"Создать: OpisanieRaskhodovPlatezhnogoDokumenta"}},
      {"id":"…toolbar","type":"TOOLBAR","children":[
        {"id":"…btn.save","type":"BUTTON",
         "props":{"command":"dict.saveAndSelect","label":"Записать и выбрать"},
         "actions":[{"trigger":"click","actionId":"command","command":"dict.saveAndSelect"}]}]},
      {"id":"…body","type":"VSTACK","children":[
        /* TEXT_FIELD field.nameRu (required), dict.field.Naimenovaniya, dict.field.NaimenovanieKaz,
           REFERENCE_FIELD dict.field.KodNaznacheniyaPlatezha (→ KodyNaznacheniyaPlatezhey),
           … , REFERENCE_FIELD dict.field.Organizatsiya (→ Organizatsii) */ ]}
    ]}}]}
```

The frontend pushes this as a stacked panel bound to session `99e84fc8-…`; every subsequent edit/save in it posts with that `formSessionId`.

### 9.3 `dict.saveAndSelect` → `closeDialog` + applyToParent + `notify`

Request (posted with the **child** session, not the root):

```json
{"formSessionId":"99e84fc8-…","revision":0,
 "route":"…/ZayavkaNaRegistratsiyuGPSdelki/27854443",
 "action":{"type":"COMMAND","command":"dict.saveAndSelect"}}
```

Response — exactly the §2.4 shape:

```json
{"formSessionId":"99e84fc8-…","revision":2,"tree":null,"state":null,"patches":[],"statePatch":null,
 "effects":[
   {"type":"closeDialog","id":"panel.create.field.opisanieRaskhoda",
    "applyToParentSessionId":"7ddcd553-…","applyToParentTargetNodeId":"field.opisanieRaskhoda",
    "applyToParentValue":{"presentation":"E2E-TEST-УДАЛИТЬ-265","id":262506}},
   {"type":"notify","level":"success","message":"Запись создана: E2E-TEST-УДАЛИТЬ-265"}]}
```

> ⚠️ **Deployed gap #2:** the record **is** created (fresh auto-code `000222334`, no `code_unique` violation — backend `REQUIRES_NEW` works) and the `applyToParent` payload is correct, but on the live fin-web the parent field **did not re-render** with the new value — §3.5 (`sdui-screen` reactivity) is **not yet shipped**. The drawer closes and the success toast shows, yet the field keeps its old presentation («тест»).

**Net.** The **backend** half of the exchange described in §2 is live and correct on the stand; the **frontend** half (§3.1–§3.3 selection bridge, §3.5 root reactivity) is the remaining work — the two ⚠️ gaps above are the concrete acceptance checklist.
