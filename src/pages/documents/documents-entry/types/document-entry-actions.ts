import type { UseFormReturn } from 'react-hook-form'

import type { DocumentEntry } from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'

export type SubmitAction = 'save' | 'post' | 'saveAndClose' | 'postAndClose'

export interface SubmitActionConfig {
  isPosted: boolean
  shouldClose: boolean
}

export interface UseDocumentEntryActionsParams {
  isNew: boolean
  existingEntry: DocumentEntry | null
  form: UseFormReturn<Record<string, unknown>>
  attributes: DocumentAttribute[]
}
