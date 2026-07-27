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

/** Selector hook: returns the highlighted row id for a given field, or null. */
export function useRefPickerSelection(field: string | null): number | null {
  return useRefPickerSelectionStore((s) =>
    field ? (s.selection[field] ?? null) : null,
  )
}
