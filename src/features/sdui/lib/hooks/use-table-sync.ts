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

  // Keep a ref in sync with localRows to avoid stale closures
  const localRowsRef = useRef<TableRow[]>(canonRows)

  const inFlightRef = useRef(false)
  const dirtyRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  // Flag to trigger a coalesced commit after in-flight response arrives.
  // Replaces sentinel entries (__delete__, __move__) to avoid phantom rows.
  const needsCoalescedCommitRef = useRef(false)
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

    if (dirty.size === 0 && !needsCoalescedCommitRef.current) {
      // No pending edits — just accept canon as-is
      const next = canonRows
      setLocalRows(next)
      localRowsRef.current = next
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
      const result = { ...row }
      for (const [key, val] of Object.entries(patch)) {
        // Skip readonly columns — those come from server
        if (!readonlyBindings.current.has(key)) {
          result[key] = val
        }
      }
      return result
    })

    // Keep rows that exist only locally (added while in-flight, with tmp- ids).
    for (const [rowId, patch] of dirty) {
      if (canonRows.some((r) => r.rowId === rowId)) continue
      merged.push({ rowId, ...patch } as TableRow)
    }

    setLocalRows(merged)
    localRowsRef.current = merged
    inFlightRef.current = false

    // Coalesced commit: dirty was non-empty or a structural op was pending
    dirtyRef.current = new Map()
    needsCoalescedCommitRef.current = false
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
      localRowsRef.current = next
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
    sendEvent(localRowsRef.current)
  }

  const addRow = (cols: TableColumnDef[]) => {
    const newRow = buildEmptyRow(cols)
    const next = [...localRowsRef.current, newRow]
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Record entire new row in dirty; coalesced commit will send on response
      const { rowId, ...rest } = newRow
      dirtyRef.current.set(rowId, rest)
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const deleteRow = (index: number) => {
    const prev = localRowsRef.current
    const next = prev.filter((_, i) => i !== index)
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Rebuild dirty: remove deleted row, keep rest
      const deleted = prev[index]
      if (deleted) dirtyRef.current.delete(deleted.rowId)
      // Signal that a coalesced commit is needed after in-flight response
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const moveRow = (from: number, to: number) => {
    const prev = localRowsRef.current
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setLocalRows(next)
    localRowsRef.current = next
    if (node.binding) setValue(node.binding, next)
    if (inFlightRef.current) {
      // Signal that a coalesced commit is needed after in-flight response
      needsCoalescedCommitRef.current = true
    } else {
      sendEvent(next)
    }
  }

  const flushPending = (): Promise<void> => {
    if (!inFlightRef.current && dirtyRef.current.size === 0 && !needsCoalescedCommitRef.current) {
      // Nothing pending — check if there are uncommitted local changes
      // by comparing local with canon
      const hasUncommittedChanges =
        JSON.stringify(localRowsRef.current) !== JSON.stringify(canonRows)
      if (hasUncommittedChanges) {
        return new Promise<void>((resolve) => {
          flushResolveRef.current = resolve
          sendEvent(localRowsRef.current)
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
      needsCoalescedCommitRef.current = false
      sendEvent(localRowsRef.current)
    })
  }

  // Keep a ref always pointing to the latest flushPending to avoid stale
  // closure when registered via useEffect([node.binding])
  const flushPendingRef = useRef<() => Promise<void>>(() => Promise.resolve())
  flushPendingRef.current = flushPending

  // ── Register/unregister flush for flush-before-save ──
  useEffect(() => {
    if (node.binding) {
      registerPendingFlush(node.binding, () => flushPendingRef.current())
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
