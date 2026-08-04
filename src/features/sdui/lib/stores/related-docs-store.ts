import { create } from 'zustand'

export interface RelatedDocsSelection {
  rowId: string
  // Снимок флага выделенной строки — выбор confirmMessageSet/Unset у
  // «Пометить на удаление» без обратного поиска по строкам дерева
  isDeletionMarked: boolean
}

// Выделенная строка дерева связанных документов, ключ — anchorId владельца
// вкладки: две открытые панели не делят одно выделение (бэк-спека §3.1).
interface RelatedDocsStore {
  selected: Record<string, RelatedDocsSelection | undefined>
  select: (anchorId: string, row: RelatedDocsSelection | null) => void
  reset: () => void
}

export const useRelatedDocsStore = create<RelatedDocsStore>((set) => ({
  selected: {},
  select: (anchorId, row) => {
    set((s) => ({ selected: { ...s.selected, [anchorId]: row ?? undefined } }))
  },
  reset: () => {
    set({ selected: {} })
  },
}))
