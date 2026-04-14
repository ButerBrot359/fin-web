import type { SelectOption } from '@/shared/types/select-option'

export type DictSidebarMode = 'list' | 'create' | 'edit'

export interface DictSidebarPanel {
  id: string
  mode: DictSidebarMode
  domain: string
  typeCode: string
  entryId?: number | string
  title?: string
  searchParams?: Record<string, string>
  onSelect?: (value: SelectOption) => void
}
