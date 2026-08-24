import type { SelectOption } from '@/shared/types/select-option'

export type DictSidebarMode = 'list' | 'create' | 'edit'

export interface DictSidebarPanel {
  id: string
  mode: DictSidebarMode
  domain: string
  typeCode: string
  entryId?: number | string
  /**
   * Запись, стоящая в поле на момент открытия списка: панель встаёт на неё,
   * как «Показать все» в 1С.
   */
  selectedId?: number | string
  copyFromId?: number
  title?: string
  searchParams?: Record<string, string>
  multiple?: boolean
  /**
   * Предзаполнение полей формы создания записи (attributeCode → значение).
   * Напр. `{ Vladelets: <контрагент документа> }` — чтобы при создании нового
   * договора из поля документа владелец подставлялся сразу.
   */
  defaults?: Record<string, unknown>
  onSelect?: (value: SelectOption) => void
  onSelectMany?: (values: SelectOption[]) => void
}
