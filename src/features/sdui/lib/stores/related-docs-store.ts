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
    set((s) => {
      const next = { ...s.selected }
      if (row) {
        next[anchorId] = row
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- ключ по anchorId, не пользовательский ввод
        delete next[anchorId]
      }
      return { selected: next }
    })
  },
  reset: () => {
    set({ selected: {} })
  },
}))
