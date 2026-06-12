import { create } from 'zustand'

import type { ViewNode } from '../../types/view'

/**
 * Снимок состояния SDUI-документа для одной рабочей вкладки (по route/pathname).
 * Нужен, чтобы при переключении рабочих вкладок не терять введённые значения
 * НОВОГО (несохранённого) документа: вместо CLOSE+reset+повторного OPEN мы
 * кэшируем дерево + значения + id серверной form-session и восстанавливаем их
 * при возврате на вкладку. Серверная сессия при уходе НЕ закрывается, поэтому
 * накопленный scratch на бэке тоже сохраняется.
 */
export interface SduiCacheEntry {
  root: ViewNode
  formSessionId: string | null
  revision: number | null
  viewState: Record<string, unknown>
}

interface SduiCacheStore {
  cache: Record<string, SduiCacheEntry>
  save: (route: string, entry: SduiCacheEntry) => void
  get: (route: string) => SduiCacheEntry | undefined
  remove: (route: string) => void
}

export const useSduiCacheStore = create<SduiCacheStore>((set, get) => ({
  cache: {},
  save: (route, entry) =>
    set((s) => ({ cache: { ...s.cache, [route]: entry } })),
  get: (route) => get().cache[route],
  remove: (route) =>
    set((s) => {
      const next = { ...s.cache }
      delete next[route]
      return { cache: next }
    }),
}))
