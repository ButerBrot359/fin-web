import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'

import { useDocumentType } from '../lib/hooks/use-document-type'
import { DocumentTable } from './document-table'

export const DocumentPage = () => {
  const { title, attributes } = useDocumentType()

  return (
    <div className="flex flex-col gap-5 pt-5">
      <PageHeader title={title} />
      <DocumentListToolbar />
      <DocumentTable attributes={attributes} />
    </div>
  )
}
