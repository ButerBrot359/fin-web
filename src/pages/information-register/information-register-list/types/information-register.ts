import type { DocumentAttribute } from '@/entities/document-type'

export interface InformationRegisterEntry {
  id: number
  attributes: Record<string, unknown> | null
}

export interface InformationRegisterTableProps {
  attributes: DocumentAttribute[]
}
