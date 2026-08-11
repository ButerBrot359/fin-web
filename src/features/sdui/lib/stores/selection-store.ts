import { create } from 'zustand'

// SCRUM-288 §2.2: единый реестр выделения. Ключ — непрозрачный selectionField
// (пикер ссылочного поля/подбор в ТЧ и дерево связей). Значение — id строки:
// number у пикера, string у дерева (String.valueOf(entryId) на бэке).
interface SelectionState {
  selection: Record<string, string | number | null>
  setSelection: (field: string, id: string | number | null) => void
  clearSelection: (field: string) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: {},
  setSelection: (field, id) => {
    set((s) => ({ selection: { ...s.selection, [field]: id } }))
  },
  clearSelection: (field) => {
    set((s) => {
      const next = { ...s.selection }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- ключ selectionField, не пользовательский ввод
      delete next[field]
      return { selection: next }
    })
  },
}))

/** Селектор: id выделенной строки для поля, или null. */
export function useSelection(field: string | null): string | number | null {
  return useSelectionStore((s) => (field ? (s.selection[field] ?? null) : null))
}
