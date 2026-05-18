import type { DocumentAttribute } from '@/entities/document-type'
import type { OpenFolder } from '../lib/hooks/use-folder-navigation-store'

export interface DictionaryTableProps {
  attributes: DocumentAttribute[]
  selectedRowId: number | null
  onSelectRow: (id: number) => void
  domain: string
  skipDependsOn?: boolean
  isHierarchical?: boolean
  openFolders: OpenFolder[]
  currentParentId?: number
  onOpenFolder: (folder: OpenFolder) => void
  onCloseFolder: (folderId: number) => void
}
