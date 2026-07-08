export type TabPageType =
  | 'module'
  | 'document-list'
  | 'document-entry'
  | 'document-movements'
  | 'dictionary-list'
  | 'dictionary-entry'
  | 'information-register-list'
  | 'accounting-register-list'
  | 'osv-report-list'
  | 'account-plan-list'
  | 'account-card'
  | 'sdui-panel'

export interface WorkspaceTab {
  id: string
  path: string
  search: string
  title: string
  pageType: TabPageType
  createdAt: number
  // Только для pageType 'sdui-panel': id панели в сторе владельца контента (SDUI).
  // Панельные вкладки не маршрутные: path = '', search = ''.
  panelId?: string
}
