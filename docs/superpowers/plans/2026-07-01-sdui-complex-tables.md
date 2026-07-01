# SDUI Complex Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complex table support to SDUI — column groups (horizontal/vertical), footer totals, column visibility, and master-detail filtering — without touching existing table components.

**Architecture:** New `ComplexEditableTable` component alongside existing `EditableTable`. `TableNode` routes to it when `COLUMN_GROUP` children are present. Reuses `useTableSync` for sync/coalescing and `TableCellEditor` for cell widgets. TanStack `useReactTable` with grouped `ColumnDef` for multi-level headers and footers.

**Tech Stack:** React 19, TanStack Table, MUI, TailwindCSS, Zustand (via SDUI session)

## Global Constraints

- Existing `table-node.tsx`, `editable-table.tsx`, `table-cell-editor.tsx`, `use-table-sync.ts` — **DO NOT MODIFY** (used by other pages).
- `useTranslation` for all text; `<Typography>` for text elements.
- Barrel exports only at FSD segment level.
- `@/*` alias → `src/*`.
- No `useCallback`. `useMemo` only where necessary for perf (column memoization to preserve focus).
- API calls in `api/` folder; use `useMutation` for mutations.

---

### Task 1: Register COLUMN_GROUP node type

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/column-group-node.tsx`
- Modify: `src/features/sdui/lib/component-registry.ts:37-79`

**Interfaces:**
- Consumes: `NodeProps` from `src/features/sdui/types/view.ts`
- Produces: `ColumnGroupNode` component (renders null — metadata-only, like `TableColumnNode`)

- [ ] **Step 1: Create column-group-node.tsx**

```tsx
// src/features/sdui/ui/nodes/composite/column-group-node.tsx
import type { FC } from 'react'
import type { NodeProps } from '../../../types/view'

// Metadata-only node. TABLE reads its children to build grouped column defs.
export const ColumnGroupNode: FC<NodeProps> = () => null
```

- [ ] **Step 2: Register in component-registry.ts**

In `src/features/sdui/lib/component-registry.ts`, add import and registry entry:

```ts
// Add import after TableColumnNode import (line 37):
import { ColumnGroupNode } from '../ui/nodes/composite/column-group-node'

// Add to registry object after TABLE_COLUMN entry (line 73):
COLUMN_GROUP: ColumnGroupNode,
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/column-group-node.tsx src/features/sdui/lib/component-registry.ts
git commit -m "add: register COLUMN_GROUP node type in SDUI component registry"
```

---

### Task 2: Build column definition builder with group support

**Files:**
- Create: `src/features/sdui/lib/utils/build-column-defs.ts`

**Interfaces:**
- Consumes: `ViewNode` from `src/features/sdui/types/view.ts`, `TableRow` and `TableColumnDef` from `src/features/sdui/lib/hooks/use-table-sync.ts`, `TableCellEditor` from `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`
- Produces:
  - `buildColumnDefs(children: ViewNode[] | undefined, syncRef: React.RefObject<UseTableSyncResult>): ColumnDef<TableRow>[]` — recursive builder that handles `TABLE_COLUMN` (leaf), `COLUMN_GROUP` with `orientation=HORIZONTAL` (TanStack group), and `COLUMN_GROUP` with `orientation=VERTICAL` (composite cell)
  - `extractAllLeafColumns(children: ViewNode[] | undefined): TableColumnDef[]` — flattens all visible leaf TABLE_COLUMN nodes recursively (needed by `useTableSync` which requires flat column list)
  - `renderCellValue(value: unknown): string` — normalizer for reference objects `{id, presentation}` → presentation text (moved from `table-node.tsx` to shared util)
  - `normalizeKey(value: unknown): unknown` — extracts scalar key for master-detail comparison (`{id, ...}` → `id`)

- [ ] **Step 1: Create build-column-defs.ts**

```ts
// src/features/sdui/lib/utils/build-column-defs.ts
import { type RefObject, createElement } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from '../hooks/use-table-sync'
import { TableCellEditor } from '../../ui/nodes/composite/table-cell-editor'

// Reference cell: object with {id, presentation} → show presentation text.
// Primitives already arrive as formatted strings from server.
export function renderCellValue(value: unknown): string {
  if (value != null && typeof value === 'object' && 'presentation' in value) {
    return String((value as { presentation: unknown }).presentation ?? '')
  }
  return String(value ?? '')
}

// Extract scalar key for master-detail comparison.
// Reference keys arrive as {id, presentation} — compare by id.
export function normalizeKey(value: unknown): unknown {
  if (value != null && typeof value === 'object' && 'id' in value) {
    return (value as { id: unknown }).id
  }
  return value
}

function isVisible(node: ViewNode): boolean {
  return (node.props?.visible as boolean | undefined) ?? true
}

function buildLeafColumn(
  col: ViewNode,
  syncRef: RefObject<UseTableSyncResult>,
): ColumnDef<TableRow> {
  const binding = (col.props?.binding as string | undefined) ?? ''
  const cellWidget =
    (col.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD'
  const dataType = (col.props?.dataType as string | undefined) ?? 'STRING'
  const readonly = col.props?.readonly as boolean | undefined
  const hasFooter = col.props?.footer === true

  return {
    id: col.id,
    accessorFn: (row: TableRow) => row[binding],
    header: (col.props?.label as string | undefined) ?? '',
    size: col.props?.flex ? undefined : 150,
    cell: ({ row }) =>
      createElement(TableCellEditor, {
        cellWidget,
        dataType,
        value: row.original[binding],
        readonly,
        onChange: (val: unknown) =>
          syncRef.current.updateCell(row.original.rowId, binding, val),
        onCommit: () => syncRef.current.commitCell(),
      }),
    ...(hasFooter ? { footer: col.id } : {}),
  }
}

function buildVerticalGroupColumn(
  group: ViewNode,
  syncRef: RefObject<UseTableSyncResult>,
): ColumnDef<TableRow> {
  const subCols = (group.children ?? []).filter(isVisible)

  return {
    id: group.id,
    header: (group.props?.label as string | undefined) ?? '',
    size: group.props?.flex ? undefined : 150,
    cell: ({ row }) =>
      createElement(
        'div',
        { className: 'flex flex-col gap-1' },
        ...subCols.map((sub) => {
          const binding = (sub.props?.binding as string | undefined) ?? ''
          const cellWidget =
            (sub.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD'
          const dataType =
            (sub.props?.dataType as string | undefined) ?? 'STRING'
          const readonly = sub.props?.readonly as boolean | undefined

          return createElement(TableCellEditor, {
            key: sub.id,
            cellWidget,
            dataType,
            value: row.original[binding],
            readonly,
            onChange: (val: unknown) =>
              syncRef.current.updateCell(row.original.rowId, binding, val),
            onCommit: () => syncRef.current.commitCell(),
          })
        }),
      ),
  }
}

export function buildColumnDefs(
  children: ViewNode[] | undefined,
  syncRef: RefObject<UseTableSyncResult>,
): ColumnDef<TableRow>[] {
  if (!children) return []
  return children.filter(isVisible).map((c) => {
    if (c.type === 'COLUMN_GROUP') {
      const orientation =
        (c.props?.orientation as string | undefined) ?? 'HORIZONTAL'
      if (orientation === 'VERTICAL') {
        return buildVerticalGroupColumn(c, syncRef)
      }
      // HORIZONTAL — TanStack column group with nested columns
      return {
        id: c.id,
        header: (c.props?.label as string | undefined) ?? '',
        columns: buildColumnDefs(c.children, syncRef),
      }
    }
    // TABLE_COLUMN — leaf
    return buildLeafColumn(c, syncRef)
  })
}

// Flatten all visible leaf TABLE_COLUMN nodes from potentially nested tree.
// useTableSync needs flat column list for buildEmptyRow / dirty tracking.
export function extractAllLeafColumns(
  children: ViewNode[] | undefined,
): TableColumnDef[] {
  if (!children) return []
  const result: TableColumnDef[] = []
  for (const c of children) {
    if (!isVisible(c) && c.type === 'TABLE_COLUMN') {
      // Hidden leaf columns still needed for data (master-detail key)
      result.push({
        id: c.id,
        label: (c.props?.label as string | undefined) ?? '',
        binding: (c.props?.binding as string | undefined) ?? '',
        flex: c.props?.flex as number | string | undefined,
        cellWidget:
          (c.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD',
        dataType: (c.props?.dataType as string | undefined) ?? 'STRING',
        readonly: c.props?.readonly as boolean | undefined,
        required: c.props?.required as boolean | undefined,
      })
    }
    if (c.type === 'TABLE_COLUMN') {
      result.push({
        id: c.id,
        label: (c.props?.label as string | undefined) ?? '',
        binding: (c.props?.binding as string | undefined) ?? '',
        flex: c.props?.flex as number | string | undefined,
        cellWidget:
          (c.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD',
        dataType: (c.props?.dataType as string | undefined) ?? 'STRING',
        readonly: c.props?.readonly as boolean | undefined,
        required: c.props?.required as boolean | undefined,
      })
    }
    if (c.type === 'COLUMN_GROUP') {
      result.push(...extractAllLeafColumns(c.children))
    }
  }
  return result
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/lib/utils/build-column-defs.ts
git commit -m "add: column definition builder with COLUMN_GROUP support (horizontal/vertical)"
```

---

### Task 3: Create ComplexEditableTable component

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/complex-editable-table.tsx`

**Interfaces:**
- Consumes:
  - `buildColumnDefs`, `extractAllLeafColumns`, `renderCellValue` from `src/features/sdui/lib/utils/build-column-defs.ts`
  - `useTableSync`, `TableRow` from `src/features/sdui/lib/hooks/use-table-sync.ts`
  - `TableCellEditor` from `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`
  - `TableToolbar` from `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`
  - `ViewNode` from `src/features/sdui/types/view.ts`
  - `useSduiSession` from `src/features/sdui/lib/sdui-session-context`
- Produces: `ComplexEditableTable` component with props `{ node: ViewNode }`

- [ ] **Step 1: Create complex-editable-table.tsx**

```tsx
// src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow as MuiTableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import {
  useTableSync,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import { useSduiSession } from '../../../lib/sdui-session-context'
import {
  buildColumnDefs,
  extractAllLeafColumns,
  renderCellValue,
  normalizeKey,
} from '../../../lib/utils/build-column-defs'
import { TableToolbar } from './table-toolbar'

interface ComplexEditableTableProps {
  node: ViewNode
}

export const ComplexEditableTable: FC<ComplexEditableTableProps> = ({
  node,
}) => {
  const { t } = useTranslation()
  const { getValue } = useSduiSession()
  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder =
    (node.props?.allowReorder as boolean | undefined) ?? true

  // Flat leaf columns for useTableSync (it needs them for buildEmptyRow / dirty)
  const flatColumns = useMemo(
    () => extractAllLeafColumns(node.children),
    [node.children],
  )

  const sync = useTableSync(node, flatColumns)
  const syncRef = useRef(sync)
  syncRef.current = sync

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null
      if (prev >= sync.rows.length)
        return sync.rows.length > 0 ? sync.rows.length - 1 : null
      return prev
    })
  }, [sync.rows.length])

  // --- Master-detail filtering ---
  const masterTable = node.props?.masterTable as string | undefined
  const masterKey = node.props?.masterKey as string | undefined
  const detailKey = node.props?.detailKey as string | undefined
  const isDetail = !!(masterTable && masterKey && detailKey)

  // Read master's selected row from session (master table stores it)
  const masterSelectedRowId = isDetail
    ? (getValue(`${masterTable}.__selectedRowId`) as string | undefined)
    : undefined

  const masterRows = isDetail
    ? ((getValue(masterTable) as TableRow[] | undefined) ?? [])
    : []

  const selectedMasterRow = masterSelectedRowId
    ? masterRows.find((r) => r.rowId === masterSelectedRowId)
    : undefined

  const visibleRows = useMemo(() => {
    if (!isDetail || !selectedMasterRow) return sync.rows
    const masterKeyVal = normalizeKey(selectedMasterRow[masterKey!])
    return sync.rows.filter(
      (r) => normalizeKey(r[detailKey!]) === masterKeyVal,
    )
  }, [sync.rows, isDetail, selectedMasterRow, masterKey, detailKey])

  // --- Footer values ---
  const footerBinding = node.binding ? `${node.binding}.footer` : undefined
  const footerValues = footerBinding
    ? ((getValue(footerBinding) as Record<string, unknown> | undefined) ?? {})
    : {}

  // --- Column defs (memoized for focus stability) ---
  const tableColumns = useMemo(
    () => buildColumnDefs(node.children, syncRef),
    [node.children],
  )

  const table = useReactTable({
    data: visibleRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  // --- Toolbar handlers ---
  const handleAdd = () => sync.addRow(flatColumns)
  const handleRemove = () => {
    if (selectedIndex !== null) {
      sync.deleteRow(selectedIndex)
      setSelectedIndex(null)
    }
  }
  const handleMoveUp = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      sync.moveRow(selectedIndex, selectedIndex - 1)
      setSelectedIndex(selectedIndex - 1)
    }
  }
  const handleMoveDown = () => {
    if (selectedIndex !== null && selectedIndex < visibleRows.length - 1) {
      sync.moveRow(selectedIndex, selectedIndex + 1)
      setSelectedIndex(selectedIndex + 1)
    }
  }

  // --- Store selected row id for master-detail consumers ---
  const { setValue } = useSduiSession()
  const handleRowClick = (index: number, rowId: string) => {
    setSelectedIndex(index)
    // Publish selected rowId so detail tables can filter
    if (node.binding) {
      setValue(`${node.binding}.__selectedRowId`, rowId)
    }
  }

  const headerGroups = table.getHeaderGroups()
  const footerGroups = table.getFooterGroups()
  const hasFooter = footerGroups.some((fg) =>
    fg.headers.some((h) => h.column.columnDef.footer),
  )

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          onAdd={handleAdd}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          canMoveUp={selectedIndex !== null && selectedIndex > 0}
          canMoveDown={
            selectedIndex !== null && selectedIndex < visibleRows.length - 1
          }
          canRemove={selectedIndex !== null}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
        />
      </div>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            {headerGroups.map((hg) => (
              <MuiTableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableCell
                    key={header.id}
                    colSpan={header.colSpan}
                    sx={{
                      fontWeight: 600,
                      textAlign: 'center',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableCell>
                ))}
              </MuiTableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <MuiTableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </MuiTableRow>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <MuiTableRow
                  key={row.id}
                  hover
                  selected={selectedIndex === index}
                  onClick={() => handleRowClick(index, row.original.rowId)}
                  sx={{ cursor: 'pointer' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} sx={{ p: 0 }}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </MuiTableRow>
              ))
            )}
          </TableBody>
          {hasFooter && (
            <tfoot>
              {footerGroups.map((fg) => (
                <MuiTableRow key={fg.id}>
                  {fg.headers.map((h) => (
                    <TableCell
                      key={h.id}
                      colSpan={h.colSpan}
                      sx={{ fontWeight: 600 }}
                    >
                      {h.column.columnDef.footer
                        ? renderCellValue(
                            footerValues[
                              h.column.columnDef.footer as string
                            ],
                          )
                        : null}
                    </TableCell>
                  ))}
                </MuiTableRow>
              ))}
            </tfoot>
          )}
        </Table>
      </TableContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (component not yet wired).

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/complex-editable-table.tsx
git commit -m "add: ComplexEditableTable with column groups, footer, master-detail"
```

---

### Task 4: Wire ComplexEditableTable into TableNode routing

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx:67-77`

**Interfaces:**
- Consumes: `ComplexEditableTable` from Task 3, `extractAllLeafColumns` from Task 2
- Produces: `TableNode` routes to `ComplexEditableTable` when `COLUMN_GROUP` children are present

- [ ] **Step 1: Add routing logic in table-node.tsx**

In `src/features/sdui/ui/nodes/composite/table-node.tsx`, add import at top (after existing imports):

```ts
import { ComplexEditableTable } from './complex-editable-table'
```

Replace the `TableNode` component (lines 67-77):

```tsx
export const TableNode: FC<NodeProps> = ({ node }) => {
  const editable = (node.props?.editable as boolean | undefined) ?? true

  if (editable) {
    // Route to complex table if COLUMN_GROUP children exist or master-detail props present
    const hasGroups = node.children?.some((c) => c.type === 'COLUMN_GROUP')
    const hasMasterDetail = !!(node.props?.masterTable && node.props?.masterKey && node.props?.detailKey)
    const hasFooter = node.children?.some(
      (c) => c.type === 'TABLE_COLUMN' && c.props?.footer === true,
    ) || node.children?.some(
      (c) => c.type === 'COLUMN_GROUP' && c.children?.some(
        (cc) => cc.props?.footer === true,
      ),
    )

    if (hasGroups || hasMasterDetail || hasFooter) {
      return <ComplexEditableTable node={node} />
    }

    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  // Read-only path (preserved as-is)
  return <ReadOnlyTable node={node} />
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "add: route TABLE to ComplexEditableTable when COLUMN_GROUP/footer/master-detail present"
```

---

### Task 5: Add specs and verify full build

**Files:**
- Existing: `docs/superpowers/plans/ADR-0013-sdui-complex-tables.md` (already committed)
- Existing: `docs/superpowers/plans/frontend-impl-complex-tables.md` (already committed)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no new errors.

- [ ] **Step 2: Verify no regressions in existing tables**

Existing `EditableTable` (editable ТЧ without COLUMN_GROUP) should still route through old path. Verify by checking that `TableNode` with only `TABLE_COLUMN` children (no `COLUMN_GROUP`) still renders `EditableTable`.

- [ ] **Step 3: Commit specs if not yet committed**

```bash
git add docs/superpowers/plans/ADR-0013-sdui-complex-tables.md docs/superpowers/plans/frontend-impl-complex-tables.md
git commit -m "add: ADR-0013 complex tables spec and frontend implementation guide"
```

---

## Verification Checklist (manual, when backend is ready)

Per frontend-impl-complex-tables.md §9:

- [ ] **Horizontal group:** VychetyIPN shows group {Osnovanie, PredostavlyatVychet} as two columns under one header; header has two rows.
- [ ] **GrafikVycheta — only 3 columns:** Razmer + period group; VychetIPN key (`visible:false`) hidden from header but present in row data.
- [ ] **Footer totals:** Column with `footer:true` shows server-computed aggregate; edit → backend recalculates → footer updates.
- [ ] **Dynamic visibility:** `setProp(col, "visible", false)` → column disappears from header/cells/footer, row data intact.
- [ ] **Master-detail filter:** Selecting VychetyIPN row → GrafikVycheta shows only rows with matching VychetIPN key; EVENT sends FULL detail array.
- [ ] **Vertical cell (optional):** With `orientation:VERTICAL` — stacked editors in one cell; text commits on blur, checkbox on click; coalescing per-field.
- [ ] **Existing tables not broken:** Simple editable tables (e.g. "График платежей" in ГП-сделка) still work via old EditableTable path.
