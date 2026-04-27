import type { DocumentAttribute } from '@/entities/document-type'

export interface DictionaryTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number) => void
  domain: string
  skipDependsOn?: boolean
}
