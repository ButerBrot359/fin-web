import type { DocumentAttribute } from '@/entities/document-type'

export interface DocumentTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number) => void
}
