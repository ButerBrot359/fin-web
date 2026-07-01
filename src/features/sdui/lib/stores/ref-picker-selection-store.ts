import { create } from 'zustand'

interface RefPickerSelectionState {
  selection: Record<string, number | null>
  setSelection: (field: string, id: number | null) => void
  clearSelection: (field: string) => void
}

export const useRefPickerSelectionStore = create<RefPickerSelectionState>(
  (set) => ({
    selection: {},
    setSelection: (field, id) =>
      set((s) => ({ selection: { ...s.selection, [field]: id } })),
    clearSelection: (field) =>
      set((s) => {
        const next = { ...s.selection }
        delete next[field]
        return { selection: next }
      }),
  }),
)

/** Extract `<field>` from `ref.<verb>:<field>` (everything after the first `:`). */
export function refCommandField(command?: string): string | null {
  if (!command) return null
  const idx = command.indexOf(':')
  return idx >= 0 ? command.slice(idx + 1) : null
}

/** Commands that operate on the picker LIST's highlighted row. */
export function needsSelectedRow(command: string | undefined): boolean {
  return (
    command?.startsWith('ref.select:') === true ||
    command?.startsWith('ref.copy:') === true
  )
}

/** Selector hook: returns the highlighted row id for a given field, or null. */
export function useRefPickerSelection(field: string | null): number | null {
  return useRefPickerSelectionStore((s) =>
    field ? (s.selection[field] ?? null) : null,
  )
}
