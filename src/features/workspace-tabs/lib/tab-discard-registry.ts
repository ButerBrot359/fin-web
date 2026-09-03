type TabDiscardCallback = (tabId: string) => void

const callbacks = new Set<TabDiscardCallback>()

// Generic-реестр «вкладка закрыта с ответом „Не сохранять“»: workspace-tabs
// не знает, кто владеет формой вкладки (SDUI). Хост-приложение подписывается
// на app/ — по образцу panel-tab-close-registry.
export function onTabDiscardClose(cb: TabDiscardCallback): () => void {
  callbacks.add(cb)
  return () => {
    callbacks.delete(cb)
  }
}

export function notifyTabDiscardClose(tabId: string): void {
  callbacks.forEach((cb) => {
    cb(tabId)
  })
}
