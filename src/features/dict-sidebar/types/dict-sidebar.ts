import type { SelectOption } from '@/shared/types/select-option'

export type DictSidebarMode = 'list' | 'create' | 'edit'

export interface DictSidebarPanel {
  id: string
  mode: DictSidebarMode
  domain: string
  typeCode: string
  entryId?: number | string
  copyFromId?: number
  title?: string
  searchParams?: Record<string, string>
  /**
   * Предзаполнение полей формы создания записи (attributeCode → значение).
   * Напр. `{ Vladelets: <контрагент документа> }` — чтобы при создании нового
   * договора из поля документа владелец подставлялся сразу.
   */
  defaults?: Record<string, unknown>
  onSelect?: (value: SelectOption) => void
}
