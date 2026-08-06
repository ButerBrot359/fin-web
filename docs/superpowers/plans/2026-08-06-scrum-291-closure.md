# SCRUM-291 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 4 remaining SCRUM-291 front pieces: split `list-node.tsx` under the line limit, add the report settings panel (gateway approach A), add `in`/`notIn` multi-value filtering, and finish a11y/test polish.

**Architecture:** SDUI stays free of legacy imports — the settings panel reaches the legacy `ReportAltSettingsDrawer` only through the existing `report-result-gateway` (extended with a `SettingsPanel` field wired at `app/`). The list-node split is a pure refactor guarded by the existing test suite, plus one genuinely-new a11y behavior (keyboard-activatable sort header) added TDD-first.

**Tech Stack:** React 19, TypeScript, TanStack Query, MUI, react-i18next, vitest + @testing-library/react.

## Global Constraints

- SDUI↔legacy isolation: no direct imports either way. The only bridge is the gateway pattern; legacy imports live ONLY in `src/app/`. (CLAUDE.md)
- No new gateway without user approval — approach A **extends the existing** `report-result-gateway`, it does not add a new one (approved in the closure design doc).
- No `useMemo`/`useCallback` unless a clear perf reason (project rule; memory `feedback_no_usememo_usecallback`).
- Texts via `useTranslation` + keys in `common.json` (ru + kz), no hardcoded JSX strings. Text via MUI `<Typography>`.
- New files target ~200 lines; a file >300 lines must be split. `list-node.tsx` must end < 300 lines.
- Never rewrite pre-existing logic to satisfy eslint — `eslint-disable` the pre-existing line instead (session lesson).
- Do NOT run `tsc`/`lint`/`build` after every change, BUT the final gate before merge is `npm run build` (green) — vitest does NOT typecheck; build-breakers were missed twice this session.
- `source.body` overlay for userSettings adds exactly one field (`{ ...body, userSettings }`), never rebuilds the body (spec §19.6).
- Per-task run of the SDUI suite: `npx vitest run --dir src/features/sdui`.

---

## File Structure

**Task 1 (split):**

- Create `src/features/sdui/ui/nodes/composite/list-column-defs.tsx` — owns `ListRow`, `resolveBinding`, `buildListColumns(...)`.
- Create `src/features/sdui/ui/nodes/composite/list-sort-header.tsx` — `ListSortHeader` component (clickable + keyboard-activatable label + arrow + funnel slot).
- Create `src/features/sdui/ui/nodes/composite/list-period-control.tsx` — `ListPeriodControl` (moved verbatim).
- Modify `src/features/sdui/ui/nodes/composite/list-node.tsx` — import the three, drop to < 300 lines.
- Create `src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx` — keyboard a11y test.

**Task 2 (gateway type + node):**

- Modify `src/features/sdui/lib/report-result-gateway.ts` — add `SettingsPanel?`.
- Modify `src/features/sdui/ui/nodes/composite/report-result-node.tsx` — settings button + `userSettings` overlay + refetch.
- Modify `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx` — panel/overlay tests.

**Task 3 (App SettingsPanel):**

- Create `src/app/providers/report-settings-panel.tsx` — legacy-side panel (meta fetch + drawer + `toUserSettingsDto`).
- Modify `src/app/App.tsx` — wire `SettingsPanel` into `setReportResultGateway`.
- Create `src/app/providers/report-settings-panel.test.tsx` — smoke test (or manual + ledger note if too heavy).

**Task 4 (in/notIn):**

- Modify `src/features/sdui/ui/nodes/composite/list-filter-value-control.tsx` — multi-value branch for `in`/`notIn`.
- Modify `src/features/sdui/ui/nodes/composite/list-filter-funnel.tsx` — `canApply` for array ops.
- Modify `src/features/sdui/ui/nodes/composite/list-filter-value-control.test.tsx` — array-value tests.

**Task 5 (polish):**

- Modify existing tests + minor aria labels per ledger.

---

## Task 1: Split `list-node.tsx` + keyboard-activatable sort header

**Files:**

- Create: `src/features/sdui/ui/nodes/composite/list-column-defs.tsx`
- Create: `src/features/sdui/ui/nodes/composite/list-sort-header.tsx`
- Create: `src/features/sdui/ui/nodes/composite/list-period-control.tsx`
- Create: `src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/list-node.tsx`

**Interfaces:**

- Produces: `buildListColumns(args): ColumnDef<ListRow>[]` and `type ListRow` from `list-column-defs.tsx`; `ListSortHeader` (FC) from `list-sort-header.tsx`; `ListPeriodControl` (FC) from `list-period-control.tsx`.
- Consumes: `ListFilterFunnel`/`ListFilterFunnelColumn` (unchanged), `ListFilterValueControl` types, `getCellIcon`, `formatSduiCellValue`, `resolveLoadedCountLabel` (all unchanged).

This is a **pure refactor** except Step 1–4 (new keyboard a11y). The existing `list-node.test.tsx` is the safety net for the moved code — it must stay green with zero edits.

- [ ] **Step 1: Write the failing test for keyboard-activatable sort header**

Create `src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListSortHeader } from './list-sort-header'

describe('ListSortHeader', () => {
  it('activates sort on Enter and Space when sortable', () => {
    const onSort = vi.fn()
    render(
      <ListSortHeader
        label="Дата"
        arrowDir="ASC"
        onSort={onSort}
        funnel={null}
      />
    )
    const btn = screen.getByRole('button', { name: /Дата/ })
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(onSort).toHaveBeenCalledTimes(2)
  })

  it('renders a plain label (no button role) when not sortable', () => {
    render(
      <ListSortHeader
        label="Имя"
        arrowDir={undefined}
        onSort={undefined}
        funnel={null}
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Имя')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx`
Expected: FAIL — module `./list-sort-header` does not exist.

- [ ] **Step 3: Create `list-sort-header.tsx`**

Extract the header render from `list-node.tsx` (lines ~317–362) into a component. Add `onKeyDown` (Enter/Space) — the new behavior — modeled on `workspace-tab-item`:

```tsx
import type { FC, ReactNode } from 'react'

export interface ListSortHeaderProps {
  label: string
  arrowDir: 'ASC' | 'DESC' | undefined
  // Present ⟺ column is sortable; absent → plain, non-interactive label.
  onSort: (() => void) | undefined
  // Funnel node (or null) rendered next to the label; built by the caller.
  funnel: ReactNode
}

export const ListSortHeader: FC<ListSortHeaderProps> = ({
  label,
  arrowDir,
  onSort,
  funnel,
}) => (
  <div className="inline-flex items-center gap-1">
    <span
      {...(onSort
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: onSort,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSort()
              }
            },
            className:
              'inline-flex cursor-pointer select-none items-center gap-1',
          }
        : {})}
    >
      {label}
      {arrowDir && (
        <span aria-hidden="true">{arrowDir === 'ASC' ? '▲' : '▼'}</span>
      )}
    </span>
    {funnel}
  </div>
)
```

- [ ] **Step 4: Run it — verify it passes**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Create `list-period-control.tsx`**

Move `ListPeriodControl` (list-node.tsx lines 62–102) verbatim into the new file, adding the imports it needs (`useTranslation`, `DateTimeInput`, `useSduiDispatch`, and its `ListPeriod` type — import `ListPeriod` from `list-column-defs.tsx`, see Step 6). Export it:

```tsx
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeInput } from '@/shared/ui/inputs'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { ListPeriod } from './list-column-defs'

export const ListPeriodControl: FC<{
  period: ListPeriod
  typeCode: string
  nodeId: string
  dispatch: ReturnType<typeof useSduiDispatch>
}> = ({ period, typeCode, nodeId, dispatch }) => {
  // ...body moved verbatim from list-node.tsx...
}
```

- [ ] **Step 6: Create `list-column-defs.tsx`**

Move `ListRow`, `resolveBinding`, and the `columns` builder into a pure function. Own the shared row types here and re-export them. Signature:

```tsx
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'
import type { MutableRefObject } from 'react'
import { formatSduiCellValue } from '../../../lib/format-cell'
import { getCellIcon } from './cell-icon-registry'
import { ListSortHeader } from './list-sort-header'
import {
  ListFilterFunnel,
  type ListFilterFunnelColumn,
} from './list-filter-funnel'
import type {
  FilterEnumOption,
  FilterValueSource,
} from './list-filter-value-control'
import type { ViewNode } from '../../../types/view'
import type { useSduiDispatch } from '../../../lib/dispatch'

export interface ListRow {
  id: number
  [key: string]: unknown
  attributes?: Record<string, unknown>
}
export interface ListSortState {
  column: string
  dir: 'ASC' | 'DESC'
}
export interface ListPeriod {
  from: string | null
  to: string | null
}
export interface ListSource {
  url: string
  params?: Record<string, string>
  method?: string
  body?: unknown
}

export interface BuildListColumnsArgs {
  columnNodes: ViewNode[]
  sortState: ListSortState | undefined
  typeCode: string | undefined
  filterOpLabels: Record<string, string> | undefined
  dispatch: ReturnType<typeof useSduiDispatch>
  nodeId: string
  sortInFlightRef: MutableRefObject<boolean>
}

export const buildListColumns = (
  args: BuildListColumnsArgs
): ColumnDef<ListRow>[] => {
  // ...body moved verbatim from list-node.tsx `columns` useMemo (lines 267–405),
  // with the header render replaced by <ListSortHeader label={...} arrowDir={...}
  // onSort={handleHeaderClick} funnel={canFilter ? <ListFilterFunnel .../> : null} />.
  // Reference args.dispatch / args.nodeId / args.sortInFlightRef.current instead of
  // the closed-over identifiers. Keep the existing eslint-disable comments verbatim.
}
```

`resolveBinding` moves here as a module-local const (verbatim).

- [ ] **Step 7: Rewire `list-node.tsx` to consume the three files**

- Delete the inlined `ListPeriodControl`, `resolveBinding`, `ListRow`/`ListSource`/`ListSortState`/`ListPeriod` interfaces, and the `columns` useMemo body.
- Import: `buildListColumns`, `type ListRow`, `type ListSource`, `type ListSortState`, `type ListPeriod` from `./list-column-defs`; `ListPeriodControl` from `./list-period-control`.
- Replace the `columns` useMemo with:

```tsx
const columns = useMemo<ColumnDef<ListRow>[]>(
  () =>
    buildListColumns({
      columnNodes,
      sortState,
      typeCode,
      filterOpLabels,
      dispatch,
      nodeId: node.id,
      sortInFlightRef,
    }),
  [columnNodes, sortState, typeCode, dispatch, node.id, filterOpLabels]
)
```

(useMemo retained — it has a clear perf reason: rebuilding column defs re-renders the whole virtualized table; this is the existing behavior, not new.)

- Remove now-unused imports (`flexRender` etc. stay; `getCellIcon`, `formatSduiCellValue`, `ListFilterFunnel`, `Typography` for cells move out — drop the ones no longer referenced in list-node).

- [ ] **Step 8: Run the full SDUI suite — verify green + line count**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS (all, including unchanged `list-node.test.tsx`).
Then: `wc -l src/features/sdui/ui/nodes/composite/list-node.tsx` — expect < 300.

- [ ] **Step 9: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/list-column-defs.tsx \
  src/features/sdui/ui/nodes/composite/list-sort-header.tsx \
  src/features/sdui/ui/nodes/composite/list-sort-header.test.tsx \
  src/features/sdui/ui/nodes/composite/list-period-control.tsx \
  src/features/sdui/ui/nodes/composite/list-node.tsx
git commit -m "refactor: split list-node (<300) + keyboard-activatable sort header (SCRUM-291)"
```

---

## Task 2: Gateway `SettingsPanel` field + REPORT_RESULT settings button & overlay

**Files:**

- Modify: `src/features/sdui/lib/report-result-gateway.ts`
- Modify: `src/features/sdui/ui/nodes/composite/report-result-node.tsx`
- Test: `src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`

**Interfaces:**

- Produces: `ReportResultGatewayImpl.SettingsPanel?: FC<SettingsPanelProps>` where
  `interface SettingsPanelProps { reportCode: string; appliedUserSettings: unknown; onApply: (userSettings: unknown) => void; onReset: () => void; open: boolean; onClose: () => void }`.
- Consumes: existing `getReportResultGateway()`.

- [ ] **Step 1: Write the failing tests**

Add to `report-result-node.test.tsx`. Use a fake gateway via `setReportResultGateway`. A `<button>` inside the fake `SettingsPanel` drives `onApply`/`onReset`.

```tsx
it('shows Настройки button and overlays userSettings on refetch when applied', async () => {
  const post = vi
    .spyOn(apiService, 'post')
    .mockResolvedValue({ data: { rows: [] } } as never)
  setReportResultGateway({
    Renderer: () => <div data-testid="rr" />,
    SettingsPanel: ({ open, onApply }) =>
      open ? (
        <button
          data-testid="apply-us"
          onClick={() => {
            onApply({ schemaVersionRef: 1 })
          }}
        >
          apply
        </button>
      ) : null,
  })
  const node = {
    id: 'n1',
    type: 'REPORT_RESULT',
    props: {
      reportCode: 'R1',
      settingsEnabled: true,
      source: {
        url: '/api/reportalt/R1/run',
        method: 'POST',
        body: { parameters: {} },
      },
    },
  }
  render(<ReportResultNode node={node as never} />)
  // button visible
  const settingsBtn = await screen.findByTestId('report-result-settings')
  fireEvent.click(settingsBtn)
  fireEvent.click(screen.getByTestId('apply-us'))
  await waitFor(() => {
    const lastCall = post.mock.calls.at(-1)?.[0] as { data: unknown }
    expect(lastCall.data).toEqual({
      parameters: {},
      userSettings: { schemaVersionRef: 1 },
    })
  })
})

it('hides Настройки button when settingsEnabled but gateway has no SettingsPanel', () => {
  setReportResultGateway({ Renderer: () => <div /> })
  const node = {
    id: 'n1',
    type: 'REPORT_RESULT',
    props: {
      reportCode: 'R1',
      settingsEnabled: true,
      source: { url: '/x', body: {} },
    },
  }
  render(<ReportResultNode node={node as never} />)
  expect(screen.queryByTestId('report-result-settings')).toBeNull()
})
```

(Import `apiService`, `setReportResultGateway`, `fireEvent`, `waitFor` as the file needs; follow the file's existing render/setup helpers.)

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: FAIL — no `report-result-settings` testid; body sent without `userSettings`.

- [ ] **Step 3: Extend the gateway type**

In `report-result-gateway.ts`, add to `ReportResultGatewayImpl`:

```ts
  // Панель настроек отчёта (опц., §19.1): полностью реализуется на app-слое
  // (легаси-drawer + meta-фетч). SDUI держит userSettings как unknown.
  SettingsPanel?: FC<{
    reportCode: string
    appliedUserSettings: unknown
    onApply: (userSettings: unknown) => void
    onReset: () => void
    open: boolean
    onClose: () => void
  }>
```

- [ ] **Step 4: Wire the node — button, state, overlay**

In `report-result-node.tsx`:

- Read `const settingsEnabled = node.props?.settingsEnabled === true`.
- Add state: `const [userSettings, setUserSettings] = useState<unknown>(undefined)` and `const [settingsOpen, setSettingsOpen] = useState(false)`.
- Compute the effective body (overlay adds one field; never rebuild):

```tsx
const effectiveBody =
  userSettings != null &&
  typeof source?.body === 'object' &&
  source?.body != null
    ? { ...(source.body as Record<string, unknown>), userSettings }
    : source?.body
```

- Use `effectiveBody` in BOTH the `queryKey` (replace `source?.body`) and the `queryFn` `data:` field (replace `source.body`). This makes an apply change the query hash → refetch.
- After `const gateway = getReportResultGateway()`, resolve `const SettingsPanel = gateway?.SettingsPanel`.
- Render a "Настройки" button in the existing toolbar row when `settingsEnabled && SettingsPanel` (add `settingsEnabled` to the row's render guard `(printEnabled || exportEnabled || (settingsEnabled && SettingsPanel))`):

```tsx
{
  settingsEnabled && SettingsPanel && (
    <Button
      data-testid="report-result-settings"
      onClick={() => {
        setSettingsOpen(true)
      }}
    >
      {t('sdui.reportResult.settings')}
    </Button>
  )
}
```

- Render the panel (below the toolbar, still inside the outer `<div>`):

```tsx
{
  settingsEnabled && SettingsPanel && reportCode && (
    <SettingsPanel
      reportCode={reportCode}
      appliedUserSettings={userSettings}
      open={settingsOpen}
      onClose={() => {
        setSettingsOpen(false)
      }}
      onApply={(us) => {
        setUserSettings(us)
        setSettingsOpen(false)
      }}
      onReset={() => {
        setUserSettings(undefined)
        setSettingsOpen(false)
      }}
    />
  )
}
```

- Also pass `effectiveBody` to `gateway?.print?.(reportCode ?? '', effectiveBody, i18n.language)` so a printed report reflects applied settings (replace the current `source.body` arg).

- [ ] **Step 5: Add i18n key**

Add `"settings"` under `sdui.reportResult` in both `src/app/config/i18n/locales/ru/common.json` (`"Настройки"`) and `.../kz/common.json` (kz text).

- [ ] **Step 6: Run — verify pass (no regressions)**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/report-result-node.test.tsx`
Expected: PASS. Then run `npx vitest run --dir src/features/sdui`.

- [ ] **Step 7: Commit**

```bash
git add src/features/sdui/lib/report-result-gateway.ts \
  src/features/sdui/ui/nodes/composite/report-result-node.tsx \
  src/features/sdui/ui/nodes/composite/report-result-node.test.tsx \
  src/app/config/i18n/locales/ru/common.json \
  src/app/config/i18n/locales/kz/common.json
git commit -m "feat: REPORT_RESULT settings button + userSettings overlay via gateway (SCRUM-291)"
```

---

## Task 3: App-side `ReportSettingsPanel` (legacy drawer + meta + DTO) wired into the gateway

**Files:**

- Create: `src/app/providers/report-settings-panel.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/app/providers/report-settings-panel.test.tsx` (smoke; manual-verify fallback allowed — note in ledger)

**Interfaces:**

- Consumes: `useReportAltMeta(code)` → `{ meta, isLoading, ... }`; `ReportAltSettingsDrawer` (props: `open, onClose, meta, draft, onDraftChange, onApply, onReset`); `toUserSettingsDto(state, schemaVersion?, availableColumnCodes?)`, `isEmptySettings`, `type ReportAltSettingsState` from `@/pages/reportalt/lib/utils/user-settings`.
- Produces: `ReportSettingsPanel: FC<{ reportCode; appliedUserSettings; onApply; onReset; open; onClose }>` (props match the gateway `SettingsPanel` contract exactly).

- [ ] **Step 1: Write the smoke test (RED)**

Create `src/app/providers/report-settings-panel.test.tsx`. Mock `useReportAltMeta` to return a minimal meta with one column field, and assert that applying builds a DTO through `toUserSettingsDto` and calls `onApply`. Keep the drawer real but drive apply via its "Применить" button.

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportSettingsPanel } from './report-settings-panel'

vi.mock('@/pages/reportalt/lib/hooks/use-reportalt-meta', () => ({
  useReportAltMeta: () => ({
    meta: {
      definition: { schemaVersion: 3, layout: 'LEDGER' },
      availableFields: [{ code: 'sum', availableAsColumn: true }],
      filters: [],
      availableGroupings: [],
      parameters: [],
    },
    isLoading: false,
  }),
}))

describe('ReportSettingsPanel', () => {
  it('applies a DTO built from the draft and closes', () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(
      <ReportSettingsPanel
        reportCode="R1"
        appliedUserSettings={undefined}
        onApply={onApply}
        onReset={vi.fn()}
        open
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByText(/Применить/))
    expect(onApply).toHaveBeenCalledTimes(1)
    // schemaVersionRef is always present in the DTO
    expect(onApply.mock.calls[0][0]).toMatchObject({ schemaVersionRef: 3 })
  })
})
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/app/providers/report-settings-panel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `report-settings-panel.tsx`**

App-level component (legacy imports permitted here). Derives `availableColumnCodes` the same way `use-reportalt-user-settings` does, builds the DTO on apply. Does NOT touch URL/localStorage (SDUI overlay owns persistence via the node).

```tsx
import { useState, type FC } from 'react'

import { useReportAltMeta } from '@/pages/reportalt/lib/hooks/use-reportalt-meta'
import { ReportAltSettingsDrawer } from '@/pages/reportalt/ui/settings/reportalt-settings-drawer'
import {
  isEmptySettings,
  toUserSettingsDto,
  type ReportAltSettingsState,
} from '@/pages/reportalt/lib/utils/user-settings'

interface ReportSettingsPanelProps {
  reportCode: string
  appliedUserSettings: unknown
  onApply: (userSettings: unknown) => void
  onReset: () => void
  open: boolean
  onClose: () => void
}

/**
 * SCRUM-291 §19.1 — панель настроек отчёта для SDUI-ноды REPORT_RESULT.
 * Живёт в app/ (легаси-импорты разрешены только здесь): монтирует легаси
 * `ReportAltSettingsDrawer`, сам фетчит meta, на «Применить» собирает
 * ReportAltUserSettingsDto и отдаёт его SDUI-ноде через onApply — та накладывает
 * его на source.body. URL/localStorage тут НЕ трогаем (это делает страница
 * reportalt; для SDUI-оверлея персист не нужен).
 */
export const ReportSettingsPanel: FC<ReportSettingsPanelProps> = ({
  reportCode,
  onApply,
  onReset,
  open,
  onClose,
}) => {
  const { meta } = useReportAltMeta(reportCode)
  const [draft, setDraft] = useState<ReportAltSettingsState | null>(null)

  if (!meta) return null

  const availableColumnCodes = (meta.availableFields ?? [])
    .filter((f) => f.availableAsColumn === true)
    .map((f) => f.code)

  const handleApply = () => {
    const dto =
      draft != null && !isEmptySettings(draft)
        ? toUserSettingsDto(
            draft,
            meta.definition.schemaVersion,
            availableColumnCodes
          )
        : undefined
    onApply(dto)
    onClose()
  }

  const handleReset = () => {
    setDraft(null)
    onReset()
    onClose()
  }

  return (
    <ReportAltSettingsDrawer
      open={open}
      onClose={onClose}
      meta={meta}
      draft={draft}
      onDraftChange={setDraft}
      onApply={handleApply}
      onReset={handleReset}
    />
  )
}
```

Note: `handleApply` passes `undefined` when the draft is empty — the node treats `userSettings == null` as "no overlay", matching reportalt's empty-delta semantics.

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/app/providers/report-settings-panel.test.tsx`
Expected: PASS. If the drawer proves too coupled to mock cleanly, downgrade to a manual-verification note in the ledger and keep a minimal render-without-crash assertion — do NOT delete the file.

- [ ] **Step 5: Wire into the gateway in `App.tsx`**

Add the import near the other app-level legacy imports:

```tsx
import { ReportSettingsPanel } from './providers/report-settings-panel'
```

Add `SettingsPanel` to the `setReportResultGateway({ ... })` object (in the existing `useEffect`, alongside `Renderer`/`print`/`exportXlsx`):

```tsx
      SettingsPanel: (props) => <ReportSettingsPanel {...props} />,
```

- [ ] **Step 6: Run the SDUI suite + app test — verify green**

Run: `npx vitest run --dir src/features/sdui && npx vitest run src/app/providers/report-settings-panel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/providers/report-settings-panel.tsx \
  src/app/providers/report-settings-panel.test.tsx \
  src/app/App.tsx
git commit -m "feat: app-side ReportSettingsPanel wired into report-result gateway (SCRUM-291)"
```

---

## Task 4: `in`/`notIn` multi-value filter control

**Files:**

- Modify: `src/features/sdui/ui/nodes/composite/list-filter-value-control.tsx`
- Modify: `src/features/sdui/ui/nodes/composite/list-filter-funnel.tsx`
- Test: `src/features/sdui/ui/nodes/composite/list-filter-value-control.test.tsx`

**Interfaces:**

- Consumes: existing `ReferenceValueControl`/`EnumValueControl`/`ScalarValueControl`, `AutocompleteInput` (has `multiple` from K1).
- Produces: for `op === 'in' | 'notIn'`, `onChange(value: unknown[])` (array). No signature change to `ListFilterValueControlProps`.

- [ ] **Step 1: Write failing tests**

Add to `list-filter-value-control.test.tsx`:

```tsx
it('in with enum column sends an array of selected values', () => {
  const onChange = vi.fn()
  render(
    <ListFilterValueControl
      op="in"
      column={{
        filterValueOptions: [
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ],
      }}
      value={[]}
      onChange={onChange}
    />
  )
  // multi-enum control: selecting two options yields ['A','B']
  // (drive via the control's checkboxes/multiselect per its rendered markup)
  // ...select A then B...
  expect(onChange).toHaveBeenLastCalledWith(['A', 'B'])
})

it('in with reference column sends an array of numeric ids', async () => {
  // reference multi-autocomplete → onChange([12, 34])
})
```

(Fill selection interactions to match the chosen multi-control markup from Step 3.)

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-filter-value-control.test.tsx`
Expected: FAIL — `in` currently renders a single control and emits a scalar.

- [ ] **Step 3: Add the multi-value branch**

In `list-filter-value-control.tsx`, add a `MultiValueControl` that, by column source, renders:

- reference (`filterValueSource`) → `AutocompleteInput` with `multiple` (reuse K1 mechanism from `reference-field-node.tsx`), `onChange` maps selected options → `number[]` of ids.
- enum (`filterValueOptions`) → a multi-select (native `<select multiple>` or checkbox list) emitting `string[]` of `value`.
- scalar (neither) → an editable list of values emitting `string[]`/`number[]` per `dataType`.

Then in `ListFilterValueControl`, before the `between` branch:

```tsx
if (op === 'in' || op === 'notIn') {
  const arr = Array.isArray(value) ? (value as unknown[]) : []
  return <MultiValueControl column={column} value={arr} onChange={onChange} />
}
```

- [ ] **Step 4: Update `canApply` in `list-filter-funnel.tsx`**

Array ops require a non-empty array. Extend the `canApply` computation:

```tsx
const isArrayOp = op === 'in' || op === 'notIn'
const canApply = isValueless
  ? true
  : isArrayOp
    ? Array.isArray(value) && value.length > 0
    : op === 'between'
      ? Array.isArray(value) &&
        value.length === 2 &&
        !isEmptyValue(value[0]) &&
        !isEmptyValue(value[1])
      : !isEmptyValue(value)
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run src/features/sdui/ui/nodes/composite/list-filter-value-control.test.tsx src/features/sdui/ui/nodes/composite/list-filter-funnel.test.tsx`
Expected: PASS. Then `npx vitest run --dir src/features/sdui`.

- [ ] **Step 6: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/list-filter-value-control.tsx \
  src/features/sdui/ui/nodes/composite/list-filter-funnel.tsx \
  src/features/sdui/ui/nodes/composite/list-filter-value-control.test.tsx
git commit -m "feat: in/notIn multi-value filter control (SCRUM-291)"
```

---

## Task 5: a11y / test polish

**Files:**

- Modify: relevant existing test + component files per the `list-phase2`/K-series ledger Minors.

- [ ] **Step 1: Strengthen the L (cell drill-in) test**

Locate the L test (reference-cell-editor open-card). Assert the `onSelect` write-back value/shape, not just that the effect type is `openReferencePicker`. Run it RED-first if the current assertion already passes trivially: add the stronger assertion, run, confirm it exercises the write-back.

Run: `npx vitest run <the L test file>`

- [ ] **Step 2: Audit filter-select aria-labels**

Confirm each native `<select>` in `list-filter-funnel.tsx` and `list-filter-value-control.tsx` has an `aria-label` (op select ✓, enum select ✓). Add any missing label (e.g. new multi-select from Task 4) using existing `table.*` i18n keys. If nothing is missing, note "no gap" in the ledger — do not invent changes.

- [ ] **Step 3: Run full SDUI suite**

Run: `npx vitest run --dir src/features/sdui`
Expected: PASS.

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git add -A
git commit -m "test: strengthen L drill-in assertion + filter a11y labels (SCRUM-291)"
```

---

## Final gate (after all tasks + whole-branch review)

- [ ] `npm run build` — MUST be green (vitest does not typecheck; catch build-breakers here).
- [ ] Merge `dev` → `main` via `superpowers:finishing-a-development-branch`.
- [ ] Update the Jira front spec to v2 (`SCRUM-291-spec-v2-<date>-front.md` in `specs-local/`), attach via REST, 1–2 sentence comment mentioning the backender.
- [ ] Transition the ticket — CONFIRM the target column with the user first; do not move the umbrella ticket silently (memory `feedback_umbrella_ticket_column`).

## Self-Review

- **Spec coverage:** closure design §1 (panel) → Tasks 2+3; §2 (split + a11y) → Task 1; §3 (in/notIn) → Task 4; §4 (polish) → Task 5. All four covered.
- **Type consistency:** `SettingsPanel` prop shape identical in gateway type (Task 2 Step 3), node render (Task 2 Step 4), and `ReportSettingsPanelProps` (Task 3 Step 3). `ListRow`/`ListSource`/`ListSortState`/`ListPeriod` defined once in `list-column-defs.tsx`, imported by `list-node.tsx` and `list-period-control.tsx`.
- **Overlay:** `{ ...body, userSettings }` adds exactly one field (§19.6) — no rebuild. `effectiveBody` used in queryKey + queryFn + print, consistently.
- **Placeholders:** the two verbatim-move steps (Task 1 Steps 5–6) reference exact source line ranges instead of repeating ~140 lines of moved code; every genuinely-new behavior (a11y header, gateway field, node overlay, panel, in/notIn) has full code. Task 4 Step 1/3 leave selection-interaction detail to match the chosen markup — acceptable, the control choice is a small design call for the implementer.
