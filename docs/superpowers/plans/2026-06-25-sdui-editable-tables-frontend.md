# SDUI Editable Tables — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SDUI TABLE node editable — inline cell editing, add/delete/reorder rows, server-driven recalculation via EVENT round-trip, coalescing dirty edits.

**Architecture:** The existing read-only `table-node.tsx` gains an `editable` branch that delegates to `EditableTable`. Cell state lives in `useState<Row[]>` (no RHF). All computation is server-side — the frontend is a pure renderer that echoes input locally and dispatches the full row array on commit. A `useTableSync` hook encapsulates coalescing (one in-flight per table, dirty snapshot, re-apply on server response). A module-level registry enables flush-before-save.

**Tech Stack:** React 19, TanStack Table, Zustand (existing SDUI stores), shared/ui inputs (TextInput, NumberInput, DateTimeInput), MUI (Checkbox, Table), react-i18next.

## Global Constraints

- Для текстов использовать `useTranslation` из `react-i18next` и ключи из `common.json`. Не хардкодить строки в JSX.
- `@/*` → `src/*` — использовать alias-импорты.
- Легаси `form-renderer/` **не трогать** — ни импортов из него, ни правок в нём.
- Фронт **НЕ вычисляет** — никаких формул, пересчётов, валидаций. Только echo ввода + dispatch.
- EVENT всегда с **полным массивом** строк.
- Виджет ячейки по `cellWidget` (бэк резолвит), `dataType` — только для форматирования.
- НЕ запускать `tsc --noEmit`, `npm run lint`, `npm run build` после каждого изменения.
- Barrel-экспорты только на уровне FSD-сегментов. Внутри — прямые импорты.

---

### Task 1: Pending table commits registry

**Files:**
- Create: `src/features/sdui/lib/pending-table-commits.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `registerPendingFlush(binding: string, flush: () => Promise<void>): void`
  - `unregisterPendingFlush(binding: string): void`
  - `flushAllPendingTableCommits(): Promise<void>`

This is a dependency-free module that later tasks rely on.

- [ ] **Step 1: Create the registry module**

```typescript
// src/features/sdui/lib/pending-table-commits.ts

const registry = new Map<string, () => Promise<void>>()

export function registerPendingFlush(
  binding: string,
  flush: () => Promise<void>,
): void {
  registry.set(binding, flush)
}

export function unregisterPendingFlush(binding: string): void {
  registry.delete(binding)
}

export async function flushAllPendingTableCommits(): Promise<void> {
  const flushes = [...registry.values()]
  await Promise.all(flushes.map((fn) => fn()))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/pending-table-commits.ts
git commit -m "add: pending table commits registry for flush-before-save"
```

---

### Task 2: Table toolbar component

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/table-toolbar.tsx`

**Interfaces:**
- Consumes: `Button` from `@/shared/ui/buttons`, MUI icons, `useTranslation`
- Produces: `TableToolbar` component with props:
  ```typescript
  interface TableToolbarProps {
    onAdd: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onRemove: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    canRemove: boolean
    allowAdd?: boolean
    allowReorder?: boolean
    allowDelete?: boolean
  }
  ```

- [ ] **Step 1: Create the toolbar component**

```typescript
// src/features/sdui/ui/nodes/composite/table-toolbar.tsx
import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

import { Button } from '@/shared/ui/buttons'

interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
}

export const TableToolbar = ({
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
  allowAdd = true,
  allowReorder = true,
  allowDelete = true,
}: TableToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      {allowAdd && (
        <Button variant="primary" onClick={onAdd}>
          {t('table.add')}
        </Button>
      )}
      {allowDelete && (
        <Button
          variant="secondary"
          disabled={!canRemove}
          onClick={onRemove}
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 20 }} />}
        />
      )}
      {allowReorder && (
        <>
          <Button
            variant="secondary"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            startIcon={<KeyboardArrowUpIcon sx={{ fontSize: 20 }} />}
          />
          <Button
            variant="secondary"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            startIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-toolbar.tsx
git commit -m "add: SDUI table toolbar component"
```

---

### Task 3: Table cell editor component

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/table-cell-editor.tsx`

**Interfaces:**
- Consumes: `TextInput`, `NumberInput`, `DateTimeInput` from `@/shared/ui/inputs`, MUI `Checkbox`
- Produces: `TableCellEditor` component with props:
  ```typescript
  interface TableCellEditorProps {
    cellWidget: string
    dataType: string
    value: unknown
    readonly?: boolean
    onChange: (value: unknown) => void
    onCommit: () => void
  }
  ```

- [ ] **Step 1: Create the cell editor component**

```typescript
// src/features/sdui/ui/nodes/composite/table-cell-editor.tsx
import type { FC } from 'react'
import { Box, Checkbox } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

import { TextInput, NumberInput, DateTimeInput } from '@/shared/ui/inputs'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'

interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  onChange: (value: unknown) => void
  onCommit: () => void
}

const cellSx: SxProps<Theme> = {
  mb: 0,
  position: 'static',
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
  },
  '& .MuiInputBase-input': {
    padding: '4px 8px !important',
    fontSize: '14px !important',
  },
}

const dateCellSx: SxProps<Theme> = {
  '& .MuiFormControl-root': { mb: 0, position: 'static', width: '100%' },
  '& .MuiInputBase-root': {
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 !important',
  },
  '& .MuiPickersInputBase-root': {
    position: 'relative',
    backgroundColor: 'transparent !important',
    border: 'none !important',
    borderRadius: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    padding: '0 8px !important',
  },
  '& .MuiPickersInputBase-sectionsContainer': {
    padding: '0 !important',
    minHeight: '28px !important',
    height: '28px !important',
    fontSize: '14px !important',
  },
  '& .MuiInputAdornment-root': {
    width: 0,
    overflow: 'visible',
    ml: 0,
    transform: 'translateX(-24px)',
  },
  '& .MuiInputAdornment-root .MuiIconButton-root': { p: '2px' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
}

function formatReadonlyValue(value: unknown, dataType: string): string {
  if (value == null || value === '') return ''
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return String(value)
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(String(value))
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : ''
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : ''
    case 'BOOLEAN':
      return value ? '✓' : ''
    default:
      return String(value)
  }
}

export const TableCellEditor: FC<TableCellEditorProps> = ({
  cellWidget,
  dataType,
  value,
  readonly,
  onChange,
  onCommit,
}) => {
  if (readonly) {
    return (
      <span style={{ padding: '4px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
        {formatReadonlyValue(value, dataType)}
      </span>
    )
  }

  switch (cellWidget) {
    case 'TEXT_FIELD': {
      const strValue = value == null ? '' : String(value)
      return (
        <TextInput
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
          }}
          size="small"
          sx={cellSx}
        />
      )
    }

    case 'NUMBER_FIELD': {
      const strValue =
        value === null || value === undefined ? '' : String(value)
      return (
        <NumberInput
          value={strValue}
          decimal={dataType === 'DECIMAL'}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = raw === '' ? null : parseFloat(raw)
            onChange(parsed)
          }}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
          }}
          size="small"
          sx={cellSx}
        />
      )
    }

    case 'DATE_FIELD':
    case 'DATETIME_FIELD': {
      const strValue = typeof value === 'string' ? value : ''
      return (
        <Box sx={dateCellSx}>
          <DateTimeInput
            value={strValue}
            dateOnly={cellWidget === 'DATE_FIELD'}
            onChange={(v) => {
              onChange(v)
              onCommit()
            }}
            size="small"
          />
        </Box>
      )
    }

    case 'CHECKBOX_FIELD': {
      return (
        <Checkbox
          checked={!!value}
          onChange={(e) => {
            onChange(e.target.checked)
            onCommit()
          }}
          size="small"
          sx={{ p: '2px' }}
        />
      )
    }

    default:
      return (
        <span style={{ padding: '4px 8px', fontSize: 14 }}>
          {String(value ?? '')}
        </span>
      )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-cell-editor.tsx
git commit -m "add: SDUI table cell editor component"
```

---

### Task 4: useTableSync hook — coalescing and sync

**Files:**
- Create: `src/features/sdui/lib/hooks/use-table-sync.ts`

**Interfaces:**
- Consumes:
  - `useSduiSession()` → `{ getValue, setValue }` from `@/features/sdui/lib/sdui-session-context`
  - `useSduiDispatch()` from `@/features/sdui/lib/dispatch`
  - `registerPendingFlush`, `unregisterPendingFlush` from `@/features/sdui/lib/pending-table-commits`
  - `ViewNode` from `@/features/sdui/types/view`
- Produces:
  ```typescript
  interface TableColumnDef {
    id: string; label: string; binding: string; flex?: number | string
    cellWidget: string; dataType: string; readonly?: boolean; required?: boolean
  }
  interface TableRow { rowId: string; [key: string]: unknown }
  interface UseTableSyncResult {
    rows: TableRow[]
    updateCell: (rowId: string, binding: string, value: unknown) => void
    commitCell: () => void
    addRow: (columns: TableColumnDef[]) => void
    deleteRow: (index: number) => void
    moveRow: (from: number, to: number) => void
    flushPending: () => Promise<void>
  }
  function useTableSync(node: ViewNode, columns: TableColumnDef[]): UseTableSyncResult
  ```

This is the most complex piece. It manages local row state, dirty tracking, in-flight coalescing, and flush.

- [ ] **Step 1: Create the hook**

```typescript
// src/features/sdui/lib/hooks/use-table-sync.ts
import { useState, useEffect, useRef } from 'react'

import type { ViewNode } from '../../types/view'
import { useSduiSession } from '../sdui-session-context'
import { useSduiDispatch } from '../dispatch'
import {
  registerPendingFlush,
  unregisterPendingFlush,
} from '../pending-table-commits'

export interface TableColumnDef {
  id: string
  label: string
  binding: string
  flex?: number | string
  cellWidget: string
  dataType: string
  readonly?: boolean
  required?: boolean
}

export interface TableRow {
  rowId: string
  [key: string]: unknown
}

export interface UseTableSyncResult {
  rows: TableRow[]
  updateCell: (rowId: string, binding: string, value: unknown) => void
  commitCell: () => void
  addRow: (columns: TableColumnDef[]) => void
  deleteRow: (index: number) => void
  moveRow: (from: number, to: number) => void
  flushPending: () => Promise<void>
}

function buildEmptyRow(columns: TableColumnDef[]): TableRow {
  const row: TableRow = { rowId: `tmp-${crypto.randomUUID()}` }
  for (const col of columns) {
    switch (col.dataType) {
      case 'STRING':
      case 'TEXT':
        row[col.binding] = ''
        break
      case 'INTEGER':
      case 'DECIMAL':
        row[col.binding] = 0
        break
      case 'BOOLEAN':
        row[col.binding] = false
        break
      default:
        row[col.binding] = null
        break
    }
  }
  return row
}

export function useTableSync(
  node: ViewNode,
  columns: TableColumnDef[],
): UseTableSyncResult {
  const { getValue, setValue } = useSduiSession()
  const dispatch = useSduiDispatch()

  const canonRows = (getValue(node.binding) as TableRow[] | undefined) ?? []
  const [localRows, setLocalRows] = useState<TableRow[]>(canonRows)

  const inFlightRef = useRef(false)
  const dirtyRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  // Promise resolve for flush-before-save: resolves when the in-flight
  // response arrives AND dirty has been re-sent (if any).
  const flushResolveRef = useRef<(() => void) | null>(null)

  // Track which columns are readonly so re-apply skips them
  const readonlyBindings = useRef(new Set<string>())
  useEffect(() => {
    const s = new Set<string>()
    for (const col of columns) {
      if (col.readonly) s.add(col.binding)
    }
    readonlyBindings.current = s
  }, [columns])

  // ── React to server canon changes ──
  useEffect(() => {
    const dirty = dirtyRef.current

    if (dirty.size === 0) {
      // No pending edits — just accept canon as-is
      setLocalRows(canonRows)
      if (inFlightRef.current) {
        inFlightRef.current = false
        flushResolveRef.current?.()
        flushResolveRef.current = null
      }
      return
    }

    // Re-apply dirty snapshot over canon
    const merged = canonRows.map((row) => {
      const patch = dirty.get(row.rowId)
      if (!patch) return row
      const merged = { ...row }
      for (const [key, val] of Object.entries(patch)) {
        // Skip readonly columns — those come from server
        if (!readonlyBindings.current.has(key)) {
          merged[key] = val
        }
      }
      return merged
    })

    // Keep rows that exist only locally (added while in-flight, with tmp- ids)
    for (const [rowId, patch] of dirty) {
      if (!canonRows.some((r) => r.rowId === rowId)) {
        merged.push({ rowId, ...patch } as TableRow)
      }
    }

    setLocalRows(merged)
    inFlightRef.current = false

    // Coalesced commit: dirty was non-empty → send immediately
    dirtyRef.current = new Map()
    sendEvent(merged)

    // Don't resolve flush yet — the coalesced commit is now in-flight.
    // It will resolve on the next canon update with empty dirty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonRows])

  // ── Send EVENT with full row array ──
  const sendEvent = (rows: TableRow[]) => {
    inFlightRef.current = true
    void dispatch({
      type: 'EVENT',
      sourceNodeId: node.id,
      trigger: 'change',
      value: rows,
    })
  }

  // ── Public API ──

  const updateCell = (rowId: string, binding: string, value: unknown) => {
    setLocalRows((prev) => {
      const next = prev.map((r) =>
        r.rowId === rowId ? { ...r, [binding]: value } : r,
      )
      // Mark form dirty via session.setValue
      if (node.binding) setValue(node.binding, next)
      return next
    })

    // If in-flight, record in dirty snapshot
    if (inFlightRef.current) {
      const dirty = dirtyRef.current
      const existing = dirty.get(rowId) ?? {}
      dirty.set(rowId, { ...existing, [binding]: value })
    }
  }

  const commitCell = () => {
    if (inFlightRef.current) {
      // Already in-flight — edits are in dirtyRef, will coalesce on response
      return
    }
    sendEvent(localRows)
  }

  const addRow = (cols: TableColumnDef[]) => {
    const newRow = buildEmptyRow(cols)
    setLocalRows((prev) => {
      const next = [...prev, newRow]
      if (node.binding) setValue(node.binding, next)
      return next
    })
    if (inFlightRef.current) {
      // Record entire new row in dirty
      const { rowId, ...rest } = newRow
      dirtyRef.current.set(rowId, rest)
    } else {
      // setLocalRows is async, so read the next state via callback
      setLocalRows((current) => {
        sendEvent(current)
        return current
      })
    }
  }

  const deleteRow = (index: number) => {
    setLocalRows((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (node.binding) setValue(node.binding, next)
      if (inFlightRef.current) {
        // Rebuild dirty: remove deleted row, keep rest
        const deleted = prev[index]
        if (deleted) dirtyRef.current.delete(deleted.rowId)
        // Mark that we need a coalesced commit
        // (we set a sentinel empty entry so dirty.size > 0)
        if (dirtyRef.current.size === 0) {
          dirtyRef.current.set('__delete__', {})
        }
      } else {
        sendEvent(next)
      }
      return next
    })
  }

  const moveRow = (from: number, to: number) => {
    setLocalRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      if (node.binding) setValue(node.binding, next)
      if (inFlightRef.current) {
        if (dirtyRef.current.size === 0) {
          dirtyRef.current.set('__move__', {})
        }
      } else {
        sendEvent(next)
      }
      return next
    })
  }

  const flushPending = (): Promise<void> => {
    if (!inFlightRef.current && dirtyRef.current.size === 0) {
      // Nothing pending — check if there are uncommitted local changes
      // by comparing local with canon
      const hasUncommittedChanges =
        JSON.stringify(localRows) !== JSON.stringify(canonRows)
      if (hasUncommittedChanges) {
        return new Promise<void>((resolve) => {
          flushResolveRef.current = resolve
          sendEvent(localRows)
        })
      }
      return Promise.resolve()
    }

    if (inFlightRef.current) {
      // Wait for current in-flight + potential coalesced commit to finish
      return new Promise<void>((resolve) => {
        flushResolveRef.current = resolve
      })
    }

    // Dirty exists but no in-flight — send now
    return new Promise<void>((resolve) => {
      flushResolveRef.current = resolve
      dirtyRef.current = new Map()
      sendEvent(localRows)
    })
  }

  // ── Register/unregister flush for flush-before-save ──
  useEffect(() => {
    if (node.binding) {
      registerPendingFlush(node.binding, flushPending)
    }
    return () => {
      if (node.binding) unregisterPendingFlush(node.binding)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.binding])

  return {
    rows: localRows,
    updateCell,
    commitCell,
    addRow,
    deleteRow,
    moveRow,
    flushPending,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/lib/hooks/use-table-sync.ts
git commit -m "add: useTableSync hook — coalescing, dirty snapshot, flush"
```

---

### Task 5: EditableTable component

**Files:**
- Create: `src/features/sdui/ui/nodes/composite/editable-table.tsx`

**Interfaces:**
- Consumes:
  - `useTableSync` from `@/features/sdui/lib/hooks/use-table-sync` (types `TableColumnDef`, `TableRow`)
  - `TableCellEditor` from `./table-cell-editor`
  - `TableToolbar` from `./table-toolbar`
  - `useReactTable`, `getCoreRowModel`, `flexRender`, `type ColumnDef` from `@tanstack/react-table`
  - `ViewNode` from `@/features/sdui/types/view`
- Produces: `EditableTable` component with props `{ node: ViewNode; columns: TableColumnDef[] }`

- [ ] **Step 1: Create the editable table component**

```typescript
// src/features/sdui/ui/nodes/composite/editable-table.tsx
import { useState, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
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
  type TableColumnDef,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import { TableCellEditor } from './table-cell-editor'
import { TableToolbar } from './table-toolbar'

interface EditableTableProps {
  node: ViewNode
  columns: TableColumnDef[]
}

export const EditableTable: FC<EditableTableProps> = ({ node, columns }) => {
  const { t } = useTranslation()
  const allowAdd = (node.props?.allowAdd as boolean | undefined) ?? true
  const allowDelete = (node.props?.allowDelete as boolean | undefined) ?? true
  const allowReorder = (node.props?.allowReorder as boolean | undefined) ?? true

  const sync = useTableSync(node, columns)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const tableColumns: ColumnDef<TableRow>[] = columns.map((col) => ({
    id: col.id,
    accessorFn: (row: TableRow) => row[col.binding],
    header: col.label,
    size: col.flex ? undefined : 150,
    cell: ({ row }) => (
      <TableCellEditor
        cellWidget={col.cellWidget}
        dataType={col.dataType}
        value={row.original[col.binding]}
        readonly={col.readonly}
        onChange={(val) => sync.updateCell(row.original.rowId, col.binding, val)}
        onCommit={sync.commitCell}
      />
    ),
  }))

  const table = useReactTable({
    data: sync.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
  })

  const handleAdd = () => sync.addRow(columns)
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
    if (selectedIndex !== null && selectedIndex < sync.rows.length - 1) {
      sync.moveRow(selectedIndex, selectedIndex + 1)
      setSelectedIndex(selectedIndex + 1)
    }
  }

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
            selectedIndex !== null && selectedIndex < sync.rows.length - 1
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
            {table.getHeaderGroups().map((hg) => (
              <MuiTableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableCell key={header.id}>
                    {flexRender(
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
                <TableCell colSpan={columns.length} align="center">
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
                  onClick={() => setSelectedIndex(index)}
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
        </Table>
      </TableContainer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/editable-table.tsx
git commit -m "add: EditableTable component with TanStack Table + sync"
```

---

### Task 6: Update table-node.tsx — editable branch + extended columns

**Files:**
- Modify: `src/features/sdui/ui/nodes/composite/table-node.tsx`

**Interfaces:**
- Consumes:
  - `EditableTable` from `./editable-table`
  - `TableColumnDef` from `@/features/sdui/lib/hooks/use-table-sync`
- Produces: updated `TableNode` that renders `EditableTable` when `editable !== false`

- [ ] **Step 1: Rewrite table-node.tsx**

Replace the entire file. The read-only path is preserved inside the component (when `editable === false`). The new `extractColumns` reads `cellWidget`, `dataType`, `readonly`, `required` from column props.

```typescript
// src/features/sdui/ui/nodes/composite/table-node.tsx
import type { FC } from 'react'
import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { TableColumnDef } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'

interface ReadOnlyColumnDef {
  id: string
  label: string
  binding?: string
  flex?: number | string
}

function extractReadOnlyColumns(
  children: ViewNode[] | undefined,
): ReadOnlyColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => ({
      id: c.id,
      label: (c.props?.label as string | undefined) ?? '',
      binding: c.props?.binding as string | undefined,
      flex: c.props?.flex as number | string | undefined,
    }))
}

function extractEditableColumns(
  children: ViewNode[] | undefined,
): TableColumnDef[] {
  if (!children) return []
  return children
    .filter((c) => c.type === 'TABLE_COLUMN')
    .map((c) => ({
      id: c.id,
      label: (c.props?.label as string | undefined) ?? '',
      binding: (c.props?.binding as string | undefined) ?? '',
      flex: c.props?.flex as number | string | undefined,
      cellWidget: (c.props?.cellWidget as string | undefined) ?? 'TEXT_FIELD',
      dataType: (c.props?.dataType as string | undefined) ?? 'STRING',
      readonly: c.props?.readonly as boolean | undefined,
      required: c.props?.required as boolean | undefined,
    }))
}

interface SimpleTableRow {
  rowId: string
  [key: string]: unknown
}

export const TableNode: FC<NodeProps> = ({ node }) => {
  const editable = (node.props?.editable as boolean | undefined) ?? true

  if (editable) {
    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  // ── Read-only path (preserved as-is) ──
  return <ReadOnlyTable node={node} />
}

const ReadOnlyTable: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const allowAdd = node.props?.allowAdd as boolean | undefined
  const allowDelete = node.props?.allowDelete as boolean | undefined

  const { getValue } = useSduiSession()
  const rows =
    (getValue(node.binding) as SimpleTableRow[] | undefined) ?? []
  const dispatch = useSduiDispatch()

  const columns = extractReadOnlyColumns(node.children)

  const handleAdd = () => {
    void dispatch({ type: 'COMMAND', command: `addRow:${node.binding}` })
  }

  const handleDelete = (rowId: string) => {
    void dispatch({
      type: 'COMMAND',
      command: `deleteRow:${node.binding}:${rowId}`,
    })
  }

  return (
    <div>
      {(label || allowAdd) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          }}
        >
          {label && (
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {label}
            </Typography>
          )}
          {allowAdd && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              variant="outlined"
            >
              Добавить
            </Button>
          )}
        </div>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.id}>{col.label}</TableCell>
              ))}
              {allowDelete && <TableCell padding="checkbox" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (allowDelete ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    Нет данных
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.rowId}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      {col.binding !== undefined
                        ? String(row[col.binding] ?? '')
                        : ''}
                    </TableCell>
                  ))}
                  {allowDelete && (
                    <TableCell padding="checkbox">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(row.rowId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sdui/ui/nodes/composite/table-node.tsx
git commit -m "add: editable branch in TableNode with extended column extraction"
```

---

### Task 7: Flush-before-save in dispatch.ts

**Files:**
- Modify: `src/features/sdui/lib/dispatch.ts:168` (before the `viewTransport.post` call)

**Interfaces:**
- Consumes: `flushAllPendingTableCommits` from `./pending-table-commits`

This is a one-line addition. Before the `viewTransport.post` call in the main dispatch, flush all pending table commits for save commands.

- [ ] **Step 1: Add the import**

At the top of `dispatch.ts` (after the existing imports, around line 12), add:

```typescript
import { flushAllPendingTableCommits } from './pending-table-commits'
```

- [ ] **Step 2: Add flush before save**

In the `try` block of `dispatch`, right before `const res = await viewTransport.post(...)` (line 169), add the flush for save commands:

```typescript
      // Flush pending table edits before save commands
      const saveCommands = ['save', 'saveAndClose', 'post', 'postAndClose']
      if (action.type === 'COMMAND' && saveCommands.includes(action.command ?? '')) {
        await flushAllPendingTableCommits()
      }
```

Also remove the duplicate `saveCommands` declaration later in the function (line ~197) — reuse the one above by moving the existing `const saveCommands` above the `try` block, or simply inline the check. The cleanest approach: move `saveCommands` to module-level.

Full change — extract `saveCommands` to module-level, add flush, remove inline re-declaration:

Add at module level (e.g. after line 13):
```typescript
const SAVE_COMMANDS = ['save', 'saveAndClose', 'post', 'postAndClose']
```

Before the `try` block's `viewTransport.post`:
```typescript
        if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
          await flushAllPendingTableCommits()
        }
```

Replace the later `const saveCommands = [...]` check (~line 197-199) with:
```typescript
          if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
            resetDirty()
          }
```

- [ ] **Step 3: Commit**

```bash
git add src/features/sdui/lib/dispatch.ts
git commit -m "add: flush pending table commits before save commands"
```
