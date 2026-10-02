type TabSaveFailedCallback = (tabId: string) => void

const callbacks = new Set<TabSaveFailedCallback>()

export function onTabSaveFailed(cb: TabSaveFailedCallback): () => void {
  callbacks.add(cb)
  return () => {
    callbacks.delete(cb)
  }
}

export function notifyTabSaveFailed(tabId: string): void {
  callbacks.forEach((cb) => {
    cb(tabId)
  })
}
