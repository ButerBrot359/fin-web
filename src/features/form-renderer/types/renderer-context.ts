import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import type { FieldFilter, ConditionalAppearance } from '@/entities/form-config'
import type { SelectOption } from '@/shared/types/select-option'

export interface FieldDependency {
  sourceFieldCode: string
  targetAttributeCode: string
}

export type TableReplacersRef = RefObject<
  Map<string, (rows: Record<string, unknown>[]) => void>
>

export interface FormRendererContextValue {
  attributeMap: Map<string, DocumentAttribute>
  form: UseFormReturn<Record<string, unknown>>
  /**
   * Домен формы (DOCUMENT | DICTIONARY | ACCOUNT_PLAN | ...). Определяет, откуда
   * брать метаданные табличных частей: ТЧ живёт в таблице типов СВОЕГО домена.
   * `undefined` трактуется как DOCUMENT (прежнее поведение).
   */
  domain?: string
  language: string
  optionsMap: Record<string, SelectOption[]>
  onFieldChange: (fieldCode: string) => void
  dependencyMap: Map<string, FieldDependency>
  /** Серверные фильтры ссылочных полей по пути поля (см. `FieldFilter`). */
  fieldFilters: Record<string, FieldFilter>
  /**
   * Динамическая видимость элементов из `formConfig.visibility` (ответ handle-event).
   * Ключ — путь поля (см. `lib/utils/field-path`). `false` → скрыт;
   * отсутствие ключа → видим (fallback на статический `showInForm`).
   */
  visibilityMap: Record<string, boolean>
  /**
   * Условное оформление ячеек ТЧ из `formConfig.conditionalAppearance` (OPEN +
   * события). Доменное: набор правил на колонку, вычисление — по значению строки.
   */
  conditionalAppearance: ConditionalAppearance[]
  registerTableReplacer: (
    code: string,
    replacer: (rows: Record<string, unknown>[]) => void
  ) => void
  unregisterTableReplacer: (code: string) => void
}
