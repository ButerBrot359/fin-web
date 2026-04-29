export type TabPageType =
  | 'module'
  | 'document-list'
  | 'document-entry'
  | 'document-movements'
  | 'dictionary-list'
  | 'dictionary-entry'
  | 'information-register-list'

export interface WorkspaceTab {
  id: string
  path: string
  search: string
  title: string
  pageType: TabPageType
  createdAt: number
}
