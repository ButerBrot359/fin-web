/**
 * Реестр серверных обработчиков закрытия панели (`props.closeCommand` её корня).
 *
 * Зачем: крестик рисует `DialogHost` — он ВНЕ `SduiSessionProvider` панели и
 * диспатчить команды не умеет. Обработчик регистрирует компонент, живущий уже
 * внутри провайдера (`PanelCloseCommand`), а хост лишь спрашивает реестр.
 *
 * Тот же приём, что у `panel-patch-registry`: регистрация по panelId, внешний
 * код ищет по нему.
 */
type PanelCloseHandler = () => void

const registry = new Map<string, PanelCloseHandler>()

export function registerPanelCloseHandler(
  panelId: string,
  handler: PanelCloseHandler
): void {
  registry.set(panelId, handler)
}

export function unregisterPanelCloseHandler(panelId: string): void {
  registry.delete(panelId)
}

/**
 * Отдать закрытие панели серверу.
 *
 * @returns `true` — обработчик нашёлся и вызван (панель закроет сервер своим
 * `closeDialog`); `false` — панель закрытием не управляет, вызывающий закрывает
 * её сам, как и раньше. Отсутствие обработчика — штатный случай: `closeCommand`
 * эмитится точечно тем формам, у которых есть серверный черновик.
 */
export function requestPanelClose(panelId: string): boolean {
  const handler = registry.get(panelId)
  if (!handler) return false
  handler()
  return true
}
