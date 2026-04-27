import type { FormSnapshot } from '../../types/workspace-tab'

const cache = new Map<string, FormSnapshot>()

export const formSnapshotCache = {
  get: (tabId: string) => cache.get(tabId),
  set: (tabId: string, snapshot: FormSnapshot) => cache.set(tabId, snapshot),
  delete: (tabId: string) => cache.delete(tabId),
}
