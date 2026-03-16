import type { UseFormReturn } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import type { SelectOption } from '@/shared/types/select-option'

export interface FormRendererContextValue {
  attributeMap: Map<string, DocumentAttribute>
  form: UseFormReturn<Record<string, unknown>>
  language: string
  optionsMap: Record<string, SelectOption[]>
}
