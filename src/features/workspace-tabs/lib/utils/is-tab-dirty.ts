import { useFormCacheStore } from '../hooks/use-form-cache-store'

export function isTabDirty(tabId: string): boolean {
  return useFormCacheStore.getState().cache[tabId]?.isDirty === true
}
