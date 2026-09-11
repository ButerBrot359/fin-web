import { create } from 'zustand'

/**
 * Текущее перетаскивание в диалоге «Изменить форму» (перенос МЕЖДУ зонами,
 * словарь v3): каждая секция рендерит свой инстанс грид-редактора, и локальный
 * state одного инстанса не виден другому. HTML5 dataTransfer в dragover
 * недоступен по спецификации — общий стор остаётся единственным способом
 * узнать «что тащат», пока курсор летит над чужой зоной.
 */
interface CustomizeFormDndState {
  draggedNodeId: string | null
  start: (nodeId: string) => void
  clear: () => void
}

export const useCustomizeFormDndStore = create<CustomizeFormDndState>(
  (set) => ({
    draggedNodeId: null,
    start: (nodeId) => {
      set({ draggedNodeId: nodeId })
    },
    clear: () => {
      set({ draggedNodeId: null })
    },
  })
)
