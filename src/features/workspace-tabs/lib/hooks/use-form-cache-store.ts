import { create } from 'zustand'

interface FormCacheEntry {
  values: Record<string, unknown> | null
  isDirty: boolean
}

interface FormCacheStore {
  cache: Partial<Record<string, FormCacheEntry>>
  pendingActions: Partial<Record<string, 'save-and-close'>>

  setDirty: (tabId: string, isDirty: boolean) => void
  setCachedValues: (tabId: string, values: Record<string, unknown>) => void
  getCachedValues: (tabId: string) => Record<string, unknown> | null
  clearCache: (tabId: string) => void
  setPendingAction: (tabId: string, action: 'save-and-close') => void
  consumePendingAction: (tabId: string) => 'save-and-close' | null
  removeTab: (tabId: string) => void
}

// Tabs currently being restored — blocks dirty sync from form.watch()
const _restoringTabs = new Set<string>()

export function markRestoring(tabId: string) {
  _restoringTabs.add(tabId)
}

export function unmarkRestoring(tabId: string) {
  _restoringTabs.delete(tabId)
}

export function isRestoring(tabId: string): boolean {
  return _restoringTabs.has(tabId)
}

export const useFormCacheStore = create<FormCacheStore>((set, get) => ({
  cache: {},
  pendingActions: {},

  setDirty: (tabId, isDirty) => {
    set((state) => {
      const existing = state.cache[tabId]
      if (existing?.isDirty === isDirty) return state

      return {
        cache: {
          ...state.cache,
          [tabId]: {
            values: existing ? existing.values : null,
            isDirty,
          },
        },
      }
    })
  },

  setCachedValues: (tabId, values) => {
    set((state) => {
      const existing = state.cache[tabId]
      return {
        cache: {
          ...state.cache,
          [tabId]: {
            values,
            isDirty: existing ? existing.isDirty : true,
          },
        },
      }
    })
  },

  getCachedValues: (tabId) => {
    const entry = get().cache[tabId]
    return entry ? entry.values : null
  },

  clearCache: (tabId) => {
    set((state) => {
      if (!(tabId in state.cache)) return state
      const { [tabId]: _, ...rest } = state.cache
      return { cache: rest }
    })
  },

  setPendingAction: (tabId, action) => {
    set((state) => ({
      pendingActions: { ...state.pendingActions, [tabId]: action },
    }))
  },

  consumePendingAction: (tabId) => {
    const action = get().pendingActions[tabId] ?? null
    if (action) {
      set((state) => {
        const { [tabId]: _, ...rest } = state.pendingActions
        return { pendingActions: rest }
      })
    }
    return action
  },

  removeTab: (tabId) => {
    set((state) => {
      const { [tabId]: _cache, ...restCache } = state.cache
      const { [tabId]: _action, ...restActions } = state.pendingActions
      return { cache: restCache, pendingActions: restActions }
    })
  },
}))
