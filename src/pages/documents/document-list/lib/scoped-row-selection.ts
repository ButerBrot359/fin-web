export interface ScopedRowSelection {
  scope: string
  ids: number[]
}

/**
 * A list selection is valid only for the exact query that rendered it.
 * Returning an empty array on scope drift is intentionally fail-closed: a
 * bulk action must never carry hidden rows into a different search/filter.
 */
export const selectedIdsForScope = (
  selection: ScopedRowSelection,
  scope: string
): number[] => (selection.scope === scope ? selection.ids : [])
