type PanelTabCloseCallback = (panelId: string) => void

const callbacks = new Set<PanelTabCloseCallback>()

// Generic-реестр закрытия панельных вкладок: workspace-tabs не знает, кто
// владеет контентом панели (SDUI). Хост-приложение подписывается на app/.
export function onPanelTabClose(cb: PanelTabCloseCallback): () => void {
  callbacks.add(cb)
  return () => {
    callbacks.delete(cb)
  }
}

export function notifyPanelTabClose(panelId: string): void {
  callbacks.forEach((cb) => cb(panelId))
}
