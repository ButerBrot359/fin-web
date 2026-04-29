import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'

import { DocumentTable } from './document-table'

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex flex-col gap-5 pt-5 h-full">
      <PageHeader title={title} onClose={handleClose} />
      <DocumentListToolbar selectedRowId={selectedRowId} />
      <DocumentTable
        attributes={attributes}
        selectedRowId={selectedRowId}
        onSelectRow={setSelectedRowId}
      />
    </div>
  )
}
