import type { DataType } from '@/shared/lib/consts/data-types'
import type { SelectOption } from '@/shared/types/select-option'

export type DictSidebarMode = 'list' | 'create' | 'edit'

export interface DictSidebarPanel {
  id: string
  mode: DictSidebarMode
  dataType: DataType
  typeCode: string
  entryId?: number | string
  title?: string
  onSelect?: (value: SelectOption) => void
}
