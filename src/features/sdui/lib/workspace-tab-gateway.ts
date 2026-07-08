export interface OpenPanelTabParams {
  tabKey: string // стабильный id вкладки, напр. "movements:123" (props.tabKey с бэка)
  title: string // из props.title узла панели
  panelId: string // id PanelEntry в panel-store
}

export interface WorkspaceTabGatewayImpl {
  openPanelTab: (params: OpenPanelTabParams) => void
}

let gateway: WorkspaceTabGatewayImpl | null = null

// SDUI не знает про реализацию workspace-вкладок (features/workspace-tabs).
// Хост-приложение регистрирует реализацию на своём уровне (app/).
export function setWorkspaceTabGateway(g: WorkspaceTabGatewayImpl | null): void {
  gateway = g
}

// false — если impl не зарегистрирован: вызывающая сторона (dispatch.openDialog)
// откатывается на прежний fullScreen Dialog, функциональность не теряется.
export function openPanelTab(params: OpenPanelTabParams): boolean {
  if (!gateway) {
    console.warn('[sdui] workspace-tab gateway is not bound, falling back to dialog')
    return false
  }
  gateway.openPanelTab(params)
  return true
}
