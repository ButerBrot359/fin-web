import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useModule } from '@/entities/module'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DictionaryListToolbar } from '@/widgets/dictionary-list-toolbar'

import { useDictionaryType } from '../lib/hooks/use-dictionary-type'
import { useFolderNavigation } from '../lib/hooks/use-folder-navigation'
import { DictionaryTable } from './dictionary-table'
import { CreateGroupModal } from './create-group-modal'

export const DictionaryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'DICTIONARY'

  const { data: moduleItems } = useModule(pageCode)
  const skipDependsOn = moduleItems.some((column) =>
    column.some((section) =>
      section.elements.some((el) => el.code === moduleCode && el.skipDependsOn)
    )
  )

  const { title, attributes, typeData, isLoading } = useDictionaryType(
    domain,
    moduleCode
  )
  const isHierarchical = typeData?.isHierarchical ?? false

  useTabMeta(title)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)

  const { openFolders, currentParentId, openFolder, closeFolder } =
    useFolderNavigation()

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoading) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <DictionaryListToolbar
        selectedRowId={selectedRowId}
        domain={domain}
        isHierarchical={isHierarchical}
        onCreateGroup={() => {
          setIsCreateGroupOpen(true)
        }}
      />
      <DictionaryTable
        attributes={attributes}
        selectedRowId={selectedRowId}
        onSelectRow={setSelectedRowId}
        domain={domain}
        skipDependsOn={skipDependsOn}
        isHierarchical={isHierarchical}
        openFolders={openFolders}
        currentParentId={currentParentId}
        onOpenFolder={openFolder}
        onCloseFolder={closeFolder}
      />
      {isHierarchical && (
        <CreateGroupModal
          open={isCreateGroupOpen}
          onClose={() => {
            setIsCreateGroupOpen(false)
          }}
          domain={domain}
          typeCode={moduleCode}
          parentId={currentParentId}
        />
      )}
    </div>
  )
}
