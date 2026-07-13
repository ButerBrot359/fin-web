# SCRUM-265 — fin-web Implementation Spec

> **Status:** Ready to implement. **Audience:** fin-web frontend developer.
> **Precondition:** the webbuh backend for SCRUM-265 is already merged and live — everything below
> is frontend-only. Nothing here requires backend changes.
> **Read first:** `fin-web/CLAUDE.md` (FSD layout, SDUI vs legacy zones, i18n, MUI Typography,
> ~200 lines/file, no cross-zone imports, Husky). This spec assumes those rules and does not repeat them.

## 0. How to use this document

The ticket SCRUM-265 (item 3) adds **two buttons to the document command panel**:
«Вывести иерархию» (a related-documents **icon** button → structure of subordination) and
«Создать на основании» (create-based-on). The buttons themselves are emitted by the backend as SDUI
nodes; the frontend work is (a) teaching the SDUI **BUTTON** node to render an icon + tooltip,
(b) making the resulting **dialog** render its data, (c) giving panel workspace-tabs a way **back**,
and (d) letting the legacy new-document route **carry the basis id** so the server can pre-fill.

The document is organized as **five independent work items (WI-A … WI-E)**. Each is scoped to exactly
one FSD zone and can be delivered as its own commit. For every item you get: the intent, the exact
files, the backend contract it consumes, a **reference implementation**, acceptance criteria, and the
tests to write.

**On the reference code:** it is the target behavior expressed precisely, not a paste-buffer. Match
the behavior and the public shape; let the project's own ESLint/Prettier (lint-staged) decide final
formatting. Reuse the existing building blocks in §4 rather than re-creating them — that is what keeps
the change architecturally integral.

---

## 1. Scope & zone map

| WI | Title | FSD zone | Nature |
|---|---|---|---|
| **WI-A** | i18n keys (related-docs, workspace-tab) | Common (`app/config/i18n`) | 2 files edited |
| **WI-B** | SDUI BUTTON renders `icon` + `tooltip` (icon-only sized to text) | **SDUI** | 1 new + 1 edited (+ test) |
| **WI-C** | Self-contained SDUI dialog panels seeded from `childState` | **SDUI** | 1 edited (+ test) |
| **WI-D** | Back/Close header on workspace-tab panels | Common (`features/workspace-tabs`) | 1 new + 3 edited + 1 layout (+ test) |
| **WI-E** | Legacy new-document open honors `?basisId=` | Legacy (`pages/documents/…`) | 1 edited (+ test) |

Isolation reminder: WI-B/WI-C are SDUI-only; WI-D lives in the shared `workspace-tabs` feature and must
not break either world; WI-E is legacy-only. No new gateway; no direct SDUI↔legacy imports.

---

## 2. Backend contract consumed (source of truth — already shipped)

The frontend reads these off SDUI nodes/effects; it never constructs them.

**BUTTON node props** (`ViewNode.props`):
- `command: string` — SDUI command id (e.g. `"showRelatedDocuments"`, `"createBasedOn:<TargetType>"`).
- `label?: string` — visible text (absent on the icon button).
- `variant?: "primary" | "dropdown" | …` — `"dropdown"` + `children` ⇒ a menu button.
- `icon?: string` — icon name for the client icon map. The related-docs button sends `"related-hierarchy"`.
- `tooltip?: string` — already localized server-side; also used as disabled-reason text.

**Effects** (`ViewResponse.effects`): the related-documents command resolves to an `OPEN_DIALOG`
effect whose panel is pushed onto the SDUI panel store. That panel may carry a **`childState`**
snapshot (a `binding → value` map) and **no `session`** — it is self-contained and read-only.

**Routes / query params:** create-based-on navigates the new-document route with `?basisId=<sourceId>`
(exactly like the existing `?copyFrom=<id>` / `?VidOperatsii=<code>`). The server's OPEN hook fills the
receiver; a missing/deleted basis is handled server-side (warning + empty form).

---

## 3. Reusable building blocks already in the codebase (do NOT re-create)

Rely on these; importing/extending them is what keeps the change small and integral.

| Symbol | Location | Use |
|---|---|---|
| `useSduiDispatch` | `features/sdui/lib/dispatch` | dispatch a `COMMAND` action |
| `needsSelectedRow`, `refCommandField`, `useRefPickerSelection` | `features/sdui/lib/stores/ref-picker-selection-store` | selected-row guard (existing button logic) |
| `NodeRenderer` | `features/sdui/ui/node-renderer` | render a node subtree |
| **`PanelStateProvider`** | `features/sdui/lib/panel-state-provider` | **already exists** — read-only SDUI session seeded from a panel snapshot (WI-C reuses it) |
| `useSduiSession`, `SduiSessionProvider` | `features/sdui/lib/sdui-session-context` | session context (getValue/setValue…) |
| `usePanelStore`, `PanelEntry` | `features/sdui/lib/stores/panel-store` | SDUI panel stack; `PanelEntry.viewState` holds `childState` |
| `useWorkspaceTabsStore` (`activateOrCreate`, `activateOrCreatePanel`, `setActiveTab`, `closeTab`) | `features/workspace-tabs/lib/hooks/use-workspace-tabs-store` | workspace tabs incl. panel tabs |
| `notifyPanelTabClose` | `features/workspace-tabs/lib/panel-tab-close-registry` | notify SDUI a panel tab closed |
| `WorkspacePanelHost` | `features/sdui` (barrel) | renders the active panel body |
| `getNewDocumentEntry` | `entities/document-entry` | fetch a fresh document entry with server-side params |

---

## 4. Work items

### WI-A — i18n keys

**Zone:** Common. **Files:** `src/app/config/i18n/locales/ru/common.json`, `…/kz/common.json`.

Add two key groups to **both** locales. Place `workspaceTab` next to the existing `workspaceTabs`
group, and the `button`/`relatedDocuments` keys inside the existing `sdui` object.

```jsonc
// top level, next to "workspaceTabs"
"workspaceTab": { "back": "Назад",  "close": "Закрыть" }          // ru
"workspaceTab": { "back": "Артқа",  "close": "Жабу"     }          // kz

// inside "sdui": { … }
"button": { "relatedDocuments": { "tooltip": "Перейти к иерархическому списку связанных документов" } }, // ru
"relatedDocuments": { "empty": "Нет связанных документов" }                                              // ru
"button": { "relatedDocuments": { "tooltip": "Байланысты құжаттардың иерархиялық тізіміне өту" } },      // kz
"relatedDocuments": { "empty": "Байланысты құжаттар жоқ" }                                               // kz
```

> Note: the related-docs tooltip also arrives pre-localized in `props.tooltip` from the server; the
> `sdui.button.relatedDocuments.tooltip` key is a client-side fallback. `sdui.relatedDocuments.empty`
> is for the no-links case. Keep the JSON valid (mind trailing commas).

**Acceptance:** both files parse; keys resolve via `useTranslation()`.

---

### WI-B — SDUI BUTTON node renders `props.icon` and `props.tooltip`

**Zone:** SDUI.
**Files:** new `src/features/sdui/ui/nodes/action/button-icons.tsx`; edit
`src/features/sdui/ui/nodes/action/button-node.tsx`; test `button-node.test.tsx`.
**Backend contract:** §2 (`icon`, `tooltip`, `command`, `variant`).

**Intent.** The command bar now includes an icon-only button (`{ command:"showRelatedDocuments",
icon:"related-hierarchy", tooltip:… }`). Teach `ButtonNode` to (1) resolve `icon` to a self-contained
inline-SVG glyph, (2) render an **icon-only** button when there is an icon and no label — at the **same
height** as the neighbouring text buttons, (3) wrap any button carrying `tooltip` in a MUI `Tooltip`
(working even when disabled), (4) **degrade gracefully** on an unknown icon (fall back to label, then
command) so the control is never empty.

**Icon registry — new file `button-icons.tsx`** (inline SVG only; a strict panel CSP blocks network
assets; unknown name → `null`):

```tsx
import type { ReactNode } from 'react'

const RelatedHierarchyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <rect x="7.25" y="2.25"  width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="2.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="12.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 6.25v3.5M10 9.75H5v4M10 9.75h5v4" stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BUTTON_ICON_MAP: Record<string, () => ReactNode> = { 'related-hierarchy': RelatedHierarchyIcon }

/** Icon ReactNode by name, or null for an unknown name (caller degrades to text). */
export function resolveButtonIcon(name: string | undefined): ReactNode | null {
  if (!name || !Object.hasOwn(BUTTON_ICON_MAP, name)) return null
  const Icon = BUTTON_ICON_MAP[name]
  return <Icon />
}
```

**`button-node.tsx` — changes** (keep the existing dropdown/selected-row logic intact):

1. Read new props: `const iconName = node.props?.icon as string | undefined` and
   `const tooltip = node.props?.tooltip as string | undefined`.
2. Resolve and classify:
   ```tsx
   const icon = resolveButtonIcon(iconName)
   const isIconOnly = !!icon && !label
   // icon-only: wrap the glyph in a line-box of the text line-height (1.75em) so the button
   // matches the neighbouring text buttons' height — a bare 20px SVG makes it ~4px shorter.
   const content: ReactNode = isIconOnly
     ? <span style={{ display: 'inline-flex', alignItems: 'center', height: '1.75em' }}>{icon}</span>
     : (icon ?? label ?? command ?? '')       // unknown-icon fallback: label, then command
   const ariaLabel = isIconOnly ? (tooltip ?? command ?? undefined) : undefined
   ```
3. Build the button once, then wrap in `Tooltip` when `tooltip` is set (a `<span style={{display:'inline-flex'}}>`
   wrapper is required so the tooltip fires on **disabled** buttons):
   ```tsx
   const button = (
     <Button variant={muiVariant} disabled={disabled} onClick={handleClick}
             aria-label={ariaLabel} sx={isIconOnly ? { minWidth: 0, px: 1 } : undefined}>
       {content}
     </Button>
   )
   return (
     <>
       {tooltip ? <Tooltip title={tooltip}><span style={{ display: 'inline-flex' }}>{button}</span></Tooltip> : button}
       {isDropdown && (/* existing Menu with node.children mapped through NodeRenderer */)}
     </>
   )
   ```
   Add `Tooltip` to the `@mui/material` import and `ReactNode` to the `react` import.

**Architectural note.** Reuse the same `Button` + `muiVariant` as text buttons; the only icon-only
deltas are `minWidth:0`, horizontal padding, and the 1.75em content line-box. This guarantees identical
height/hit-area and keeps a single button primitive.

**Acceptance:**
- `{ command, icon:"related-hierarchy", tooltip }` (no label) → icon-only button, accessible name = tooltip,
  inline `<svg>` present, height equal to sibling text buttons; hover shows the tooltip.
- Text/label buttons unchanged (regression).
- Unknown icon → no crash; falls back to label, else command; no `<svg>`.

**Tests (`button-node.test.tsx`, vitest + Testing Library):** icon-only renders with tooltip as
accessible name + inline svg; hover surfaces `role="tooltip"`; label button regression; unknown-icon
falls back to label (no svg); no-label-no-valid-icon falls back to command. Mock `useSduiDispatch` and
the ref-picker selection store (`needsSelectedRow → false`).

---

### WI-C — Self-contained SDUI dialog panels seeded from `childState`

**Zone:** SDUI. **File:** edit `src/features/sdui/ui/dialog-host.tsx`; test `panel-state-provider.test.tsx`.
**Backend contract:** §2 (`OPEN_DIALOG` with `childState`/`viewState`, no `session`).
**Reuse:** `PanelStateProvider` (**already on main**) — do not create it.

**Intent / bug fixed.** A panel opened without a `session` (e.g. «Связанные документы») carries its rows
as a `childState` snapshot in `PanelEntry.viewState`. Previously `DialogHost` rendered such a panel with
a bare `<NodeRenderer>`, so field bindings found no values and the dialog rendered **empty**. Wrap the
no-session branch in `PanelStateProvider` (a read-only SDUI session seeded from `viewState`) so bindings
resolve.

**Change** in `DialogHost`, where each panel's content is chosen:

```tsx
const content = panel.session ? (
  <PanelFormProvider panel={panel} />
) : (
  // No-session (childState) panel: no patches, but fields must read values from the snapshot.
  // Seed a read-only session from viewState — without this the dialog is empty (WI-3 fix).
  <PanelStateProvider panel={panel}>
    <NodeRenderer node={panel.node} />
  </PanelStateProvider>
)
```

Add the import `import { PanelStateProvider } from '../lib/panel-state-provider'`. (The earlier
`if (!panel.node) return null` early-return is removed as part of this branch restructuring; the
existing `panel.openInWorkspaceTab` skip and the presentation switch — `page`/`drawer`/modal — are
unchanged.)

**Architectural note.** `PanelStateProvider` already models exactly this (read-only session over a
snapshot); reusing it — rather than threading raw values through NodeRenderer — keeps the read-only
contract in one place: a childState panel takes no further EVENT/COMMAND and does not depend on the
parent form staying mounted.

**Acceptance:** a childState panel renders its rows from `viewState`; `session.setValue(...)` inside such
a panel is a no-op + `console.warn` (read-only), never throws.

**Tests (`panel-state-provider.test.tsx`):** a `Probe` reading `useSduiSession().getValue(binding)`
shows the seeded value; a mutator calling `setValue` triggers a warn and does not throw.

---

### WI-D — Back/Close header on workspace-tab panels

**Zone:** Common (`features/workspace-tabs`).
**Files:** new `ui/workspace-panel-header.tsx`; edit `types/workspace-tab.ts`,
`lib/hooks/use-workspace-tabs-store.ts`, `index.ts`; wire into `src/app/layout/layout.tsx`; test
`ui/workspace-panel-header.test.tsx`.
**Reuse:** `useWorkspaceTabsStore` (`setActiveTab`, `closeTab`), `notifyPanelTabClose`.

**Intent / bug fixed.** Panels opened as a workspace tab (related-documents, movements) had **no visible
way back** to the tab they were opened from. Add a generic header (Back + Close) shown for any active
`sdui-panel` tab, and remember the **opener** tab so Back returns there.

**1) Type — `types/workspace-tab.ts`:** add
```ts
// Only for pageType 'sdui-panel': the tab this panel was opened from. Used by the Back button (WI-4).
openerTabId?: string
```

**2) Store — `lib/hooks/use-workspace-tabs-store.ts`, in `activateOrCreatePanel(id, title, panelId)`:**
capture the opener at creation time (the active tab when the panel opens, excluding the panel itself):
```ts
const { tabs, activeTabId } = get()
// … existing "reuse existing tab" branch …
const openerTabId = activeTabId && activeTabId !== id ? activeTabId : undefined
const tab: WorkspaceTab = { id, path: '', /* … */, pageType: 'sdui-panel', panelId, openerTabId, createdAt: Date.now() }
```

**3) New component — `ui/workspace-panel-header.tsx`** (full reference):

```tsx
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconButton, Tooltip, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'

import { useWorkspaceTabsStore } from '../lib/hooks/use-workspace-tabs-store'
import { notifyPanelTabClose } from '../lib/panel-tab-close-registry'
import type { WorkspaceTab } from '../types/workspace-tab'

// Route to a tab: navigate for a routed tab, just activate for a panel tab.
const goToTab = (navigate: ReturnType<typeof useNavigate>, tab: WorkspaceTab | undefined): void => {
  if (!tab) { void navigate('/'); return }
  useWorkspaceTabsStore.getState().setActiveTab(tab.id)
  if (tab.pageType !== 'sdui-panel') void navigate(tab.path + tab.search)
}

// Header for a panel workspace tab: Back (to opener) + Close (close panel). Generic —
// shown for any active tab of pageType 'sdui-panel'.
export const WorkspacePanelHeader = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeTab = useWorkspaceTabsStore((s) => s.tabs.find((tab) => tab.id === s.activeTabId))
  if (activeTab?.pageType !== 'sdui-panel') return null

  const opener = () =>
    useWorkspaceTabsStore.getState().tabs.find((tab) => tab.id === activeTab.openerTabId)

  const handleBack = () => goToTab(navigate, opener())   // panel stays open in the bar
  const handleClose = () => {
    const closed = useWorkspaceTabsStore.getState().closeTab(activeTab.id)
    if (closed?.panelId) notifyPanelTabClose(closed.panelId)
    const next = useWorkspaceTabsStore.getState()
      .tabs.find((tab) => tab.id === useWorkspaceTabsStore.getState().activeTabId)
    goToTab(navigate, next)   // closeTab already picked the next active tab; sync the router
  }

  return (
    <div className="flex shrink-0 items-center gap-1 pb-3">
      <Tooltip title={t('workspaceTab.back')}>
        <IconButton size="small" aria-label={t('workspaceTab.back')} onClick={handleBack}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      {activeTab.title && (
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{activeTab.title}</Typography>
      )}
      <div className="flex-1" />
      <Tooltip title={t('workspaceTab.close')}>
        <IconButton size="small" aria-label={t('workspaceTab.close')} onClick={handleClose}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </div>
  )
}
```

**4) Barrel — `index.ts`:** `export { WorkspacePanelHeader } from './ui/workspace-panel-header'`.

**5) Layout — `src/app/layout/layout.tsx`:** render the header above the panel host (keep the existing
"hide, don't unmount, the route content" behavior):
```tsx
import { useWorkspaceTabsStore, WorkspacePanelHeader } from '@/features/workspace-tabs'
// …
{activePanelId && (
  <div className="flex h-full min-h-0 flex-col">
    <WorkspacePanelHeader />
    <div className="min-h-0 flex-1">
      <WorkspacePanelHost panelId={activePanelId} />
    </div>
  </div>
)}
```

**Acceptance:** a panel tab records `openerTabId` = the tab active when it opened; **Back** activates the
opener (routing there) and leaves the panel open; **Close** closes the panel tab (+ `notifyPanelTabClose`)
and routes to the newly-active tab; the header renders nothing when the active tab is not a panel.

**Tests (`workspace-panel-header.test.tsx`):** seed a panel over a routed doc tab; assert
`openerTabId`; Back calls `navigate('/doc')` and keeps 2 tabs; Close leaves only the doc tab and routes
to it; header renders null when the active tab isn't a panel. Mock `useNavigate`; import `@/app/config/i18n`.

---

### WI-E — Legacy new-document open honors `?basisId=`

**Zone:** Legacy. **File:** edit
`src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts`; test `use-document-entry-form.test.tsx`.
**Backend contract:** §2 (`?basisId=`). **Reuse:** `getNewDocumentEntry` and the existing `VidOperatsii`
plumbing — **mirror it**.

**Intent.** create-based-on navigates to `/documents/<target>/new?basisId=<id>`. The server fills the
receiver from the basis document; the form just renders the result. Proxy `basisId` into the `/new`
request exactly like `VidOperatsii`.

**Change** in `useDocumentEntryForm`:
1. Read the param and fold it into the new-entry params:
   ```ts
   const basisId = searchParams.get('basisId')
   const newEntryParams =
     vidOperatsii || basisId
       ? { ...(vidOperatsii && { VidOperatsii: vidOperatsii }), ...(basisId && { basisId }) }
       : undefined
   ```
2. Query: include `basisId` in `queryKey`, and enable when either param is present (and not copyFrom):
   ```ts
   queryKey: ['document-entry-new', moduleCode, vidOperatsii, basisId],
   enabled: isNew && (!!vidOperatsii || !!basisId) && !copyFrom,
   ```
3. Defaults: the "reset to empty" branch must **exclude** `basisId` (it awaits the `/new` response, like
   VidOperatsii): `} else if (isNew && !vidOperatsii && !copyFrom && !basisId) {`. Add `basisId` to the
   effect's dependency array.

**Architectural note.** This is a minimal, symmetric extension of the existing server-param path — no new
request shape, no client-side fill. A missing/deleted basis is the server's concern (warning + empty form).

**Acceptance:** navigating to `…/new?basisId=5` calls `getNewDocumentEntry('<type>', { basisId: '5' })`
and renders the filled form; `copyFrom` behavior unchanged; no basis/VidOperatsii → `/new` not called.

**Tests (`use-document-entry-form.test.tsx`):** with `basisId=5`, `getNewDocumentEntry` is called with
`{ basisId: '5' }` and the copyFrom path is not; with no params, `/new` is not called. Mock
`@/entities/document-entry` and `react-router-dom` (params/location/search).

---

## 5. Verification

- Per-WI vitest as listed. Whole suite green: `npm run test`.
- Types: `npx tsc --noEmit` → 0.
- Lint: your staged files must pass `eslint` (Husky lint-staged runs `eslint --fix` + `prettier --write`
  on commit). Note the repo's `main` has pre-existing lint errors in unrelated files — only your changed
  files must be clean. Commit messages must match `feat|fix|add|refactor: …` (commit-msg hook).
- Manual smoke (against a running webbuh backend + `npm run dev`): open a document whose type has basis
  links (pilot: **СчётКОплате ← Заявка на регистрацию ГП сделки**). Expect: after Дт/Кт an **icon**
  button with the tooltip → click opens a populated «Связанные документы» panel with a **Back/Close**
  header; a «Создать на основании» dropdown → picking a target opens a pre-filled new document.

## 6. Suggested commit sequence (one per WI, matching the reference branch)

```
add:  i18n keys for SCRUM-265 (related-docs, workspace-tab)     # WI-A
feat: SDUI button icon and tooltip, icon-only sized to text buttons   # WI-B
fix:  seed self-contained SDUI dialog panels from childState    # WI-C
feat: back/close header on workspace-tab panels                 # WI-D
fix:  honor basisId on legacy new-document open                 # WI-E
```

Order is not load-bearing, but WI-A before WI-D/WI-B keeps their i18n keys available, and WI-B before a
manual smoke of WI-C lets you exercise the related-docs icon end to end.
