import { create } from 'zustand'

// SCRUM-288 §2.2: единый реестр выделения. Ключ — непрозрачный selectionField
// (пикер ссылочного поля/подбор в ТЧ и дерево связей). Значение — id строки:
// number у пикера, string у дерева (String.valueOf(entryId) на бэке).
interface SelectionState {
  selection: Record<string, string | number | null>
  listSelections: Record<string, number[]>
  setSelection: (field: string, id: string | number | null) => void
  clearSelection: (field: string) => void
  setListSelection: (listId: string, ids: number[]) => void
  clearListSelection: (listId: string) => void
}

const EMPTY_LIST_SELECTION: number[] = []

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: {},
  listSelections: {},
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
  setListSelection: (listId, ids) => {
    set((s) => ({
      listSelections: { ...s.listSelections, [listId]: ids },
    }))
  },
  clearListSelection: (listId) => {
    set((s) => {
      const next = { ...s.listSelections }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- list node id is server-defined.
      delete next[listId]
      return { listSelections: next }
    })
  },
}))

/** Селектор: id выделенной строки для поля, или null. */
export function useSelection(field: string | null): string | number | null {
  return useSelectionStore((s) => (field ? (s.selection[field] ?? null) : null))
}

/** Selected rows of an opt-in SDUI list, used by output-list dialogs. */
export function useListSelection(listId: string | null): number[] {
  return useSelectionStore((s) =>
    listId
      ? (s.listSelections[listId] ?? EMPTY_LIST_SELECTION)
      : EMPTY_LIST_SELECTION
  )
}
