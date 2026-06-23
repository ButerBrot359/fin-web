import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import type { FieldFilter } from '@/entities/form-config'
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
  language: string
  optionsMap: Record<string, SelectOption[]>
  onFieldChange: (fieldCode: string) => void
  dependencyMap: Map<string, FieldDependency>
  /** Серверные фильтры ссылочных полей по пути поля (см. `FieldFilter`). */
  fieldFilters: Record<string, FieldFilter>
  registerTableReplacer: (
    code: string,
    replacer: (rows: Record<string, unknown>[]) => void
  ) => void
  unregisterTableReplacer: (code: string) => void
}
