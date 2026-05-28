import { create } from 'zustand'

/**
 * Состояние дерева плана счетов на каждый путь страницы:
 *   - expanded — раскрытые узлы (`number[]`, не Set — Zustand сериализуется проще)
 *   - selectedId — выбранная строка (для подсветки и тулбар-кнопок)
 *
 * Аналог useFolderNavigationStore для иерархических справочников; разница
 * в модели — у плана счетов нет «drill-down» как в справочнике, мы
 * раскрываем узлы in-place.
 */
interface TreeState {
  expanded: number[]
  selectedId: number | null
}

interface ExpandedNodesStore {
  cache: Partial<Record<string, TreeState>>
  setExpanded: (path: string, ids: number[]) => void
  getExpanded: (path: string) => number[]
  toggle: (path: string, id: number) => void
  setSelected: (path: string, id: number | null) => void
  getSelected: (path: string) => number | null
}

const getOrInit = (
  cache: Partial<Record<string, TreeState>>,
  path: string
): TreeState => cache[path] ?? { expanded: [], selectedId: null }

export const useExpandedNodesStore = create<ExpandedNodesStore>((set, get) => ({
  cache: {},

  setExpanded: (path, ids) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [path]: { ...getOrInit(state.cache, path), expanded: ids },
      },
    }))
  },

  getExpanded: (path) => get().cache[path]?.expanded ?? [],

  toggle: (path, id) => {
    const current = get().cache[path]?.expanded ?? []
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id]
    set((state) => ({
      cache: {
        ...state.cache,
        [path]: { ...getOrInit(state.cache, path), expanded: next },
      },
    }))
  },

  setSelected: (path, id) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [path]: { ...getOrInit(state.cache, path), selectedId: id },
      },
    }))
  },

  getSelected: (path) => get().cache[path]?.selectedId ?? null,
}))
