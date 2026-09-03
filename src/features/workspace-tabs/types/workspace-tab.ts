export type TabPageType =
  | 'module'
  | 'document-list'
  | 'document-entry'
  | 'document-movements'
  | 'dictionary-list'
  | 'dictionary-entry'
  | 'information-register-list'
  | 'information-register-entry'
  | 'accounting-register-list'
  | 'osv-report-list'
  | 'report-list'
  | 'reportalt'
  | 'account-plan-list'
  | 'account-card'
  | 'sdui-panel'

export interface WorkspaceTab {
  id: string
  /**
   * Экземпляр формы этой вкладки (бэк: `action.formInstanceId`). Живёт столько же,
   * сколько сама вкладка: уход на другую вкладку и возврат сохраняют его, а «Создать»
   * начинает новый — иначе черновик незаписанного документа всплыл бы в новом документе
   * (требование владельца: новая форма создания пустая ВСЕГДА).
   *
   * <p>Необязателен: вкладки, восстановленные из localStorage прежней версией клиента, поля
   * не несут — идентификатор им выдаётся лениво, при первом обращении.
   */
  formInstanceId?: string
  path: string
  search: string
  title: string
  pageType: TabPageType
  createdAt: number
  // Только для pageType 'sdui-panel': id панели в сторе владельца контента (SDUI).
  // Панельные вкладки не маршрутные: path = '', search = ''.
  panelId?: string
  // Только для pageType 'sdui-panel': id вкладки, из которой панель открыта.
  // «Назад» возвращает на неё, оставляя панель в баре (SCRUM-265).
  openerTabId?: string
}
