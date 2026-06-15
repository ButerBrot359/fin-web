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

export interface WorkspaceTab {
  id: string
  path: string
  search: string
  title: string
  pageType: TabPageType
  createdAt: number
}
