import type { SelectOption } from '@/shared/types/select-option'

export type TabPageType =
  | 'module'
  | 'document-list'
  | 'document-entry'
  | 'document-movements'
  | 'dictionary-list'
  | 'dictionary-entry'
  | 'sidebar-entry'

export interface FormSnapshot {
  values: Record<string, unknown>
  defaultValues: Record<string, unknown>
}

export interface SidebarPanelData {
  domain: string
  typeCode: string
  entryId?: number | string
  mode: 'create' | 'edit'
  title?: string
  searchParams?: Record<string, string>
  onSelect?: (value: SelectOption) => void
}

export interface WorkspaceTab {
  id: string
  path: string
  search: string
  title: string
  pageType: TabPageType
  isDirty: boolean
  sidebarPanel: SidebarPanelData | null
  createdAt: number
}
