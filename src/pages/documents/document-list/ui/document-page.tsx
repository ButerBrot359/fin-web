import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'

import { DocumentTable } from './document-table'

export const DocumentPage = () => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const navigate = useNavigate()
  const { title, attributes } = useDocumentType(moduleCode)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const handleClose = () => {
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
