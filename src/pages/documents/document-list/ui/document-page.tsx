import { useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'

import { DocumentTable } from './document-table'

export const DocumentPage = () => {
  const { moduleCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)

  return (
    <div className="flex flex-col gap-5 pt-5 h-full">
      <PageHeader title={title} />
      <DocumentListToolbar />
      <DocumentTable attributes={attributes} />
    </div>
  )
}
